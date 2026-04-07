"""
Congress copy service.

setup_congress_copy()  — create a CongressCopySession in DB
process_new_trades()   — fetch new Capitol Trades entries, persist them, place orders
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.congress_trade import CongressCopySession, CongressTrade, CongressCopiedOrder
from app.models.user import User
from app.schemas.congress_trade import CongressCopySetupRequest
from app.broker.visanu_alpaca import visanu_client
from app.services.capitol_trades_service import fetch_trades_for_politician

logger = logging.getLogger(__name__)

# Fixed trade size: $500 per copied stock trade; always 1 contract for options
_TRADE_USD = 500.0
_STOCK_PRICE_ESTIMATE = 100.0
_OPTION_CONTRACTS = 1.0


async def setup_congress_copy(
    payload: CongressCopySetupRequest,
    db: AsyncSession,
    user: User,
) -> CongressCopySession:
    """Create and persist a new CongressCopySession."""
    session = CongressCopySession(
        user_id=user.id,
        politician_id=payload.politician_id,
        politician_name=payload.politician_name,
        politician_party=payload.politician_party,
        dry_run=payload.dry_run,
        status="active",
    )
    db.add(session)
    await db.flush()
    await db.commit()
    await db.refresh(session)
    logger.info(
        "congress_copy: session id=%d created for %s (dry_run=%s)",
        session.id,
        session.politician_name,
        session.dry_run,
    )
    return session


def _estimate_qty(is_option: bool) -> float:
    """Estimate share/contract quantity. Options: 1 contract. Stocks: ~5 shares."""
    if is_option:
        return _OPTION_CONTRACTS
    return max(1.0, round(_TRADE_USD / _STOCK_PRICE_ESTIMATE))


async def process_new_trades(
    session: CongressCopySession,
    db: AsyncSession,
) -> int:
    """
    Fetch new Capitol Trades entries for the session's politician.
    Persist unseen entries and place matching Alpaca orders.
    Returns count of new trades processed.

    IMPORTANT: Does NOT commit — caller (scheduler task) commits once after the loop.
    """
    entries = fetch_trades_for_politician(
        session.politician_id,
        page_size=50,
        since_date=session.last_trade_date,
    )

    if not entries:
        logger.info(
            "congress_copy: session id=%d — no new entries for %s",
            session.id,
            session.politician_name,
        )
        session.last_checked_at = datetime.now(timezone.utc)
        return 0

    # Find already-stored Capitol Trade IDs to avoid duplicates
    existing_result = await db.execute(
        select(CongressTrade.capitol_trade_id).where(
            CongressTrade.session_id == session.id
        )
    )
    existing_ids: set[str] = {row[0] for row in existing_result.all()}

    new_entries = [e for e in entries if e.id not in existing_ids]
    if not new_entries:
        logger.info(
            "congress_copy: session id=%d — %d entries fetched, all already stored",
            session.id,
            len(entries),
        )
        session.last_checked_at = datetime.now(timezone.utc)
        return 0

    logger.info(
        "congress_copy: session id=%d — %d new trade(s) to process",
        session.id,
        len(new_entries),
    )

    processed = 0
    latest_reported: Optional[str] = session.last_trade_date

    for entry in new_entries:
        # Persist the Capitol Trade record
        trade_row = CongressTrade(
            session_id=session.id,
            capitol_trade_id=entry.id,
            politician_id=entry.politician_id,
            politician_name=entry.politician_name,
            ticker=entry.ticker,
            asset_name=entry.asset_name,
            asset_type=entry.asset_type,
            option_type=entry.option_type,
            trade_type=entry.trade_type,
            size_range=entry.size_range,
            trade_date=entry.trade_date,
            reported_at=entry.reported_at,
        )
        db.add(trade_row)
        await db.flush()  # get trade_row.id before creating the order row

        is_option = entry.asset_type == "option"
        qty = _estimate_qty(is_option)
        side = "buy" if entry.trade_type == "purchase" else "sell"
        symbol = entry.ticker.upper()

        alpaca_order_id: Optional[str] = None
        order_status = "dry_run" if session.dry_run else "submitted"
        error_msg: Optional[str] = None

        try:
            alpaca_order_id = visanu_client.place_market_order(
                symbol=symbol,
                qty=qty,
                side=side,
                dry_run=session.dry_run,
            )
            if not session.dry_run and alpaca_order_id:
                order_status = "submitted"
        except Exception as exc:
            error_msg = str(exc)
            order_status = "error"
            logger.error(
                "congress_copy: session id=%d — order error for %s: %s",
                session.id, symbol, exc,
            )

        order_row = CongressCopiedOrder(
            session_id=session.id,
            congress_trade_id=trade_row.id,
            alpaca_order_id=alpaca_order_id,
            symbol=symbol,
            side=side,
            qty=qty,
            order_type="market",
            status=order_status,
            dry_run=session.dry_run,
            error_message=error_msg,
        )
        db.add(order_row)
        processed += 1

        if entry.reported_at and (
            latest_reported is None or entry.reported_at > latest_reported
        ):
            latest_reported = entry.reported_at

    session.last_checked_at = datetime.now(timezone.utc)
    if latest_reported:
        session.last_trade_date = latest_reported

    logger.info(
        "congress_copy: session id=%d — processed %d new trade(s)", session.id, processed
    )
    return processed
