"""
Copy trading session lifecycle and trade execution.

Session creation: saves session + seeds existing Quiver trades as pre_existing
  so historical disclosures are never bulk-copied.

Trade execution: wraps broker.place_order() with sell-position checks and
  options fallback logic. All Alpaca calls run in asyncio.to_thread.

Scheduler entry point: process_active_sessions(db) — fetches Quiver once,
  loops all active sessions, commits once after the loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.factory import get_broker_client
from app.models.broker import BrokerCredential
from app.models.copy_trading import CopiedPoliticianTrade, CopyTradingSession
from app.models.user import User
from app.schemas.copy_trading import CreateSessionRequest
from app.services.politician_ranker_service import PoliticianScore, get_best_politician
from app.services.politician_scraper_service import (
    PoliticianTrade,
    fetch_congressional_trades,
    get_politician_trades,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Low-level broker helpers (synchronous — called via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _should_skip_sell(ticker: str, positions: list[dict]) -> bool:
    position_symbols = {p.get("symbol", "").upper() for p in positions}
    return ticker.upper() not in position_symbols


def _execute_stock_trade(
    trade: PoliticianTrade,
    broker,
    copy_amount_usd: float,
    dry_run: bool,
) -> dict:
    """Place a notional stock/ETF order. Returns {order_id, status, alpaca_status}."""
    if trade.trade_type == "sell" and not dry_run:
        positions = broker.get_positions()
        if _should_skip_sell(trade.ticker, positions):
            logger.info("Skipping sell %s — no position", trade.ticker)
            return {"order_id": None, "alpaca_status": "skipped_no_position", "status": "skipped_no_position"}

    result = broker.place_order(
        symbol=trade.ticker,
        side=trade.trade_type,
        quantity=0,
        notional_usd=copy_amount_usd,
        dry_run=dry_run,
    )
    alpaca_status = result.status if result.status else "pending"
    return {
        "order_id": result.broker_order_id,
        "alpaca_status": alpaca_status,
        "status": result.status,
    }


def _execute_options_trade(
    trade: PoliticianTrade,
    broker,
    copy_amount_usd: float,
    dry_run: bool,
) -> dict:
    """Attempt options trade; fall back to underlying stock if contract is unresolvable."""
    if trade.option_strike is not None and trade.option_expiry and trade.option_type:
        try:
            exp = (trade.option_expiry or "").replace("-", "").replace("/", "")
            if len(exp) == 8:
                exp = exp[2:]
            strike_int = int(float(trade.option_strike) * 1000)
            cp = "C" if trade.option_type.lower() == "call" else "P"
            contract_symbol = f"{trade.ticker}{exp}{cp}{strike_int:08d}"
            result = broker.place_order(
                symbol=contract_symbol,
                side=trade.trade_type,
                quantity=1,
                dry_run=dry_run,
            )
            return {
                "order_id": result.broker_order_id,
                "alpaca_status": result.status,
                "status": result.status,
                "notes": f"options contract {contract_symbol}",
            }
        except Exception as exc:
            logger.warning("Options order failed (%s), falling back to underlying %s", exc, trade.ticker)

    logger.warning("Falling back to underlying stock %s for options trade", trade.ticker)
    return _execute_stock_trade(trade, broker, copy_amount_usd, dry_run)


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

async def create_session(
    req: CreateSessionRequest,
    db: AsyncSession,
    current_user: User,
) -> CopyTradingSession:
    """
    Create a new active copy-trading session.
    Seeds all existing Quiver trades for the target politician as pre_existing
    so they are never bulk-copied on first poll.
    """
    # Fetch once — used for name resolution and seeding
    try:
        all_trades = await fetch_congressional_trades()
    except Exception as exc:
        logger.warning("Could not fetch congressional trades on session creation: %s", exc)
        all_trades = []

    session = CopyTradingSession(
        user_id=current_user.id,
        status="active",
        dry_run=req.dry_run,
        copy_amount_usd=req.copy_amount_usd,
        target_politician_id=req.target_politician_id,
        credential_id=req.credential_id,
    )

    # Resolve politician name for display
    if req.target_politician_id and all_trades:
        politician_trades = get_politician_trades(req.target_politician_id, all_trades)
        if politician_trades:
            session.target_politician_name = politician_trades[0].politician_name

    db.add(session)
    await db.flush()  # get session.id before seeding

    # Seed existing trades so they are never bulk-copied
    await _seed_existing_trades(session, all_trades, db)

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("create_session commit failed: %s", exc)
        raise
    await db.refresh(session)
    logger.info(
        "Created copy-trading session id=%d user=%d politician=%s dry_run=%s",
        session.id, current_user.id, req.target_politician_id or "auto", req.dry_run,
    )
    return session


async def _seed_existing_trades(
    session: CopyTradingSession,
    all_trades: list[PoliticianTrade],
    db: AsyncSession,
) -> None:
    """
    Mark all currently visible Quiver trades for the session's politician as pre_existing.
    Prevents historical disclosures from being bulk-copied when the session first activates.
    Accepts already-fetched all_trades to avoid a redundant Quiver API call.
    """
    try:
        if session.target_politician_id:
            trades_to_seed = get_politician_trades(session.target_politician_id, all_trades)
        else:
            best = get_best_politician(all_trades)
            if best is None:
                return
            trades_to_seed = get_politician_trades(best.politician_id, all_trades)

        # Deduplicate by trade_id — Quiver can return duplicate records for the same event
        seen: set[str] = set()
        unique_trades: list[PoliticianTrade] = []
        for t in trades_to_seed:
            if t.trade_id not in seen:
                seen.add(t.trade_id)
                unique_trades.append(t)

        # Skip trade_ids already persisted for this user (e.g. from a prior session)
        existing_result = await db.execute(
            select(CopiedPoliticianTrade.trade_id).where(
                CopiedPoliticianTrade.user_id == session.user_id
            )
        )
        already_in_db: set[str] = {row[0] for row in existing_result}
        new_trades = [t for t in unique_trades if t.trade_id not in already_in_db]

        now = datetime.now(timezone.utc)
        for t in new_trades:
            row = CopiedPoliticianTrade(
                session_id=session.id,
                user_id=session.user_id,
                trade_id=t.trade_id,
                politician_id=t.politician_id,
                politician_name=t.politician_name,
                ticker=t.ticker,
                asset_type=t.asset_type,
                trade_type=t.trade_type,
                trade_date=t.trade_date,
                disclosure_date=t.disclosure_date,
                amount_low=t.amount_low,
                amount_high=t.amount_high,
                alpaca_order_id=None,
                alpaca_status="pre_existing",
                copy_amount_usd=None,
                dry_run=session.dry_run,
                created_at=now,
                notes="seeded on session creation",
            )
            db.add(row)
        logger.info(
            "Seeded %d pre-existing trades for session id=%d (skipped %d duplicates)",
            len(new_trades), session.id, len(trades_to_seed) - len(new_trades),
        )
    except Exception as exc:
        logger.warning("Seeding failed for session id=%d: %s", session.id, exc)


# ---------------------------------------------------------------------------
# Scheduler: process all active sessions
# ---------------------------------------------------------------------------

async def process_active_sessions(db: AsyncSession) -> None:
    """
    Called by the scheduler every 15 min.
    Fetches Quiver data once, then processes each active session.
    Caller is responsible for db.commit() after this function returns.
    """
    all_trades = await fetch_congressional_trades()

    result = await db.execute(
        select(CopyTradingSession).where(CopyTradingSession.status == "active")
    )
    sessions = result.scalars().all()

    if not sessions:
        logger.info("copy_trading_monitor: no active sessions")
        return

    logger.info("copy_trading_monitor: processing %d active session(s)", len(sessions))

    for session in sessions:
        try:
            await _process_one_session(session, all_trades, db)
        except Exception as exc:
            logger.error("copy_trading_monitor: session id=%d error: %s", session.id, exc)


async def _process_one_session(
    session: CopyTradingSession,
    all_trades: list[PoliticianTrade],
    db: AsyncSession,
) -> None:
    # Load broker credential for this user — prefer pinned credential_id if set
    if session.credential_id:
        cred_result = await db.execute(
            select(BrokerCredential).where(
                BrokerCredential.id == session.credential_id,
                BrokerCredential.user_id == session.user_id,
            )
        )
    else:
        cred_result = await db.execute(
            select(BrokerCredential).where(
                BrokerCredential.user_id == session.user_id,
                BrokerCredential.provider == "alpaca",
                BrokerCredential.is_active == True,
            )
        )
    cred = cred_result.scalars().first()
    if cred is None:
        logger.warning(
            "No active Alpaca credential for user_id=%d (session=%d)",
            session.user_id, session.id,
        )
        return

    broker = get_broker_client(cred)

    # Determine which politician to follow
    if session.target_politician_id:
        politician_trades = get_politician_trades(session.target_politician_id, all_trades)
    else:
        best = get_best_politician(all_trades)
        if best is None:
            logger.warning("No best politician found for session id=%d", session.id)
            return
        politician_trades = get_politician_trades(best.politician_id, all_trades)
        if session.target_politician_name != best.politician_name:
            session.target_politician_name = best.politician_name

    # Get already-copied trade_ids for this user (across all sessions)
    copied_result = await db.execute(
        select(CopiedPoliticianTrade.trade_id).where(
            CopiedPoliticianTrade.user_id == session.user_id
        )
    )
    already_copied: set[str] = {row[0] for row in copied_result}

    new_trades = [t for t in politician_trades if t.trade_id not in already_copied]
    if not new_trades:
        logger.debug("session id=%d: no new trades to copy", session.id)
        return

    logger.info("session id=%d: copying %d new trade(s)", session.id, len(new_trades))

    for trade in new_trades:
        await _copy_one_trade(trade, session, broker, db)


async def _copy_one_trade(
    trade: PoliticianTrade,
    session: CopyTradingSession,
    broker,
    db: AsyncSession,
) -> None:
    logger.info(
        "COPY TRADE: session=%d | %s %s %s | $%.0f–$%.0f | dry_run=%s",
        session.id, trade.politician_name, trade.trade_type.upper(), trade.ticker,
        trade.amount_low, trade.amount_high, session.dry_run,
    )
    try:
        if "option" in trade.asset_type.lower():
            exec_result = await asyncio.to_thread(
                _execute_options_trade, trade, broker, session.copy_amount_usd, session.dry_run
            )
        else:
            exec_result = await asyncio.to_thread(
                _execute_stock_trade, trade, broker, session.copy_amount_usd, session.dry_run
            )
    except Exception as exc:
        logger.error("Trade execution error for %s: %s", trade.ticker, exc)
        exec_result = {"order_id": None, "alpaca_status": f"error: {exc}"[:50]}

    record = CopiedPoliticianTrade(
        session_id=session.id,
        user_id=session.user_id,
        trade_id=trade.trade_id,
        politician_id=trade.politician_id,
        politician_name=trade.politician_name,
        ticker=trade.ticker,
        asset_type=trade.asset_type,
        trade_type=trade.trade_type,
        trade_date=trade.trade_date,
        disclosure_date=trade.disclosure_date,
        amount_low=trade.amount_low,
        amount_high=trade.amount_high,
        alpaca_order_id=exec_result.get("order_id"),
        alpaca_status=exec_result.get("alpaca_status", "unknown"),
        copy_amount_usd=session.copy_amount_usd,
        dry_run=session.dry_run,
        notes=exec_result.get("notes", f"source_amount=${trade.amount_low:.0f}-{trade.amount_high:.0f}"),
    )
    db.add(record)
