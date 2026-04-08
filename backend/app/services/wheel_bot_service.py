"""
Wheel Strategy Bot — service layer (V7).

Stage machine:
    sell_put → assigned → sell_call → called_away → sell_put (cycle repeats)

Rules enforced:
- Never sell put if cash < strike × 100
- Strike target: put = current_price × 0.90; call = cost_basis × 1.10
- Expiration: 14–28 days (2–4 weeks)
- Never sell call with strike < cost_basis_per_share
- 50% profit early close: if current_premium ≤ premium_received × 0.50 → buy_to_close + reopen
- Total premium tracked across all cycles in total_premium_collected
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.wheel_alpaca_client import WheelAlpacaClient
from app.core.security import decrypt_value
from app.models.broker import BrokerCredential
from app.models.user import User
from app.models.wheel_bot import WheelBotSession
from app.schemas.wheel_bot import WheelBotSetupRequest, WheelBotSummaryResponse

logger = logging.getLogger(__name__)


# ── Client factory ─────────────────────────────────────────────────────────────

async def get_wheel_client(session: WheelBotSession, db: AsyncSession) -> WheelAlpacaClient:
    """
    Build a WheelAlpacaClient for the given session.

    If session.credential_id is set, decrypt and use those Alpaca keys.
    Otherwise fall back to WHEEL_ALPACA_* environment variables.
    """
    if session.credential_id:
        result = await db.execute(
            select(BrokerCredential).where(
                BrokerCredential.id == session.credential_id,
                BrokerCredential.user_id == session.user_id,
            )
        )
        cred = result.scalars().first()
        if cred:
            api_key = decrypt_value(cred.api_key)
            secret_key = decrypt_value(cred.encrypted_secret_key)
            base_url = cred.base_url or (
                "https://paper-api.alpaca.markets"
                if cred.paper_trading
                else "https://api.alpaca.markets"
            )
            return WheelAlpacaClient(api_key=api_key, secret_key=secret_key, base_url=base_url)
        logger.warning(
            "wheel_bot: session %d credential_id=%d not found — falling back to env vars",
            session.id,
            session.credential_id,
        )
    return WheelAlpacaClient()


# ── Setup ──────────────────────────────────────────────────────────────────────

async def setup_wheel_bot(
    req: WheelBotSetupRequest,
    db: AsyncSession,
    user: User,
) -> WheelBotSession:
    """
    Create and persist a new WheelBotSession.

    Raises HTTP 409 if an active session already exists for this user+symbol.
    """
    # Conflict guard — one active session per user per symbol
    existing = await db.execute(
        select(WheelBotSession).where(
            WheelBotSession.user_id == user.id,
            WheelBotSession.symbol == req.symbol,
            WheelBotSession.status == "active",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active wheel bot session already exists for {req.symbol}.",
        )

    session = WheelBotSession(
        user_id=user.id,
        symbol=req.symbol,
        dry_run=req.dry_run,
        credential_id=req.credential_id,
        stage="sell_put",
        shares_qty=0,
        total_premium_collected=0.0,
        status="active",
        last_action="Session created — awaiting first put sale.",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    logger.info(
        "wheel_bot: session %d created for user %d symbol=%s dry_run=%s",
        session.id,
        user.id,
        session.symbol,
        session.dry_run,
    )
    return session


# ── Check and act ──────────────────────────────────────────────────────────────

async def check_and_act(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> None:
    """
    Evaluate the current stage and advance the state machine if conditions are met.

    Called by the scheduler every 15 min (market hours only).
    All DB mutations are done in-place on the session object; the caller commits.
    """
    symbol = session.symbol
    dry_run = session.dry_run

    try:
        if session.stage == "sell_put":
            await _handle_sell_put(session, client, symbol, dry_run)

        elif session.stage == "assigned":
            await _handle_assigned(session, client, symbol, dry_run)

        elif session.stage == "sell_call":
            await _handle_sell_call(session, client, symbol, dry_run)

        elif session.stage == "called_away":
            await _handle_called_away(session, client, symbol, dry_run)

    except Exception as exc:
        logger.error(
            "wheel_bot: check_and_act error for session %d (stage=%s): %s",
            session.id,
            session.stage,
            exc,
        )
        session.last_action = f"Error in stage {session.stage}: {exc}"

    session.updated_at = datetime.now(timezone.utc)


async def _handle_sell_put(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    symbol: str,
    dry_run: bool,
) -> None:
    """
    Stage: sell_put

    If no active contract yet, attempt to sell a cash-secured put.
    If we already have an active put order, check for fill / assignment.
    """
    if session.active_order_id and session.active_order_id != "dry-run":
        # Check if the existing put has been assigned
        try:
            order = client.get_order(session.active_order_id)
            order_status = order.get("status", "")
            if order_status in ("filled", "partially_filled"):
                # Put assigned → own shares
                session.stage = "assigned"
                session.shares_qty = 100
                session.cost_basis_per_share = session.active_strike
                session.last_action = (
                    f"Put assigned: 100 shares of {symbol} @ "
                    f"${session.active_strike:.2f}. Advancing to sell_call stage."
                )
                logger.info(
                    "wheel_bot: session %d put assigned @ %.2f — advancing to assigned",
                    session.id,
                    session.active_strike or 0,
                )
                return
        except Exception as exc:
            logger.warning(
                "wheel_bot: session %d could not check put order %s: %s",
                session.id,
                session.active_order_id,
                exc,
            )
        # Order not yet filled — nothing to do
        return

    # No active order — try to sell a new put
    account = client.get_account()
    cash = float(account.get("buying_power", account.get("cash", 0)) or 0)

    current_price = client.get_latest_price(symbol) if not dry_run else None
    if current_price is None:
        # Dry run: simulate a price
        current_price = 200.0
        logger.info("wheel_bot: session %d dry_run — using simulated price %.2f", session.id, current_price)

    target_strike = round(current_price * 0.90, 2)

    if not dry_run and cash < target_strike * 100:
        session.last_action = (
            f"Insufficient cash (${cash:.2f}) to sell put at strike ${target_strike:.2f} "
            f"(requires ${target_strike * 100:.2f}). Waiting."
        )
        logger.info(
            "wheel_bot: session %d insufficient cash %.2f for put strike %.2f",
            session.id,
            cash,
            target_strike,
        )
        return

    expiry = client.pick_expiration(days_min=14, days_max=28)
    chain = client.get_option_chain(symbol, expiry)
    contract = client.closest_strike(chain, target_strike, "put")

    if contract is None and not dry_run:
        session.last_action = f"No put contracts found for {symbol} expiry {expiry}. Waiting."
        return

    # Determine contract symbol and premium
    if contract:
        contract_symbol = contract.get("symbol", f"{symbol}_{expiry}_P{int(target_strike)}")
        premium = client.mid_price(contract)
        strike = float(contract.get("strike_price", target_strike))
    else:
        # dry_run fallback
        contract_symbol = f"{symbol}_{expiry}_P{int(target_strike)}"
        premium = round(current_price * 0.03, 2)  # ~3% simulated premium
        strike = target_strike

    result = client.place_order(
        symbol=contract_symbol,
        side="sell",
        qty=1,
        order_type="limit",
        limit_price=round(premium, 2),
        dry_run=dry_run,
    )

    session.active_contract_symbol = contract_symbol
    session.active_order_id = result["order_id"]
    session.active_premium_received = premium
    session.active_strike = strike
    session.active_expiry = expiry
    session.last_action = (
        f"Sold 1 put {contract_symbol} @ ${premium:.2f} "
        f"(strike ${strike:.2f}, expiry {expiry})"
        + (" [DRY RUN]" if dry_run else "")
    )

    if dry_run:
        # In dry_run, simulate immediate fill and advance to assigned
        session.stage = "assigned"
        session.shares_qty = 100
        session.cost_basis_per_share = strike
        session.last_action += " — simulated fill, advancing to sell_call."
        logger.info(
            "wheel_bot: session %d dry_run put sold+assigned @ %.2f", session.id, strike
        )
    else:
        logger.info(
            "wheel_bot: session %d put order placed %s @ %.2f",
            session.id,
            result["order_id"],
            premium,
        )


async def _handle_assigned(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    symbol: str,
    dry_run: bool,
) -> None:
    """
    Stage: assigned

    Confirm we hold shares and advance to sell_call.
    In dry_run mode, skip the position check.
    """
    if not dry_run:
        position = client.get_position(symbol)
        if not position:
            session.last_action = f"No position in {symbol} yet — waiting for assignment."
            return
        session.shares_qty = int(float(position.get("qty", 100)))

    session.stage = "sell_call"
    session.last_action = (
        f"Assignment confirmed: {session.shares_qty} shares of {symbol} "
        f"@ cost basis ${session.cost_basis_per_share:.2f}. Ready to sell call."
    )
    logger.info(
        "wheel_bot: session %d advancing to sell_call — shares=%d cost_basis=%.2f",
        session.id,
        session.shares_qty,
        session.cost_basis_per_share or 0,
    )


async def _handle_sell_call(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    symbol: str,
    dry_run: bool,
) -> None:
    """
    Stage: sell_call

    If no active call, sell a covered call at cost_basis × 1.10.
    If active call exists, check for 50% profit early close or assignment.
    """
    cost_basis = session.cost_basis_per_share or 0.0

    if session.active_order_id and session.active_order_id != "dry-run":
        try:
            order = client.get_order(session.active_order_id)
            order_status = order.get("status", "")
            if order_status in ("filled", "partially_filled"):
                # Check for 50% profit close opportunity
                # We check the current mid-price of the contract
                if session.active_contract_symbol and session.active_premium_received:
                    expiry = session.active_expiry or client.pick_expiration()
                    chain = client.get_option_chain(symbol, expiry)
                    current_mid = 0.0
                    if chain:
                        contract = client.closest_strike(
                            chain, session.active_strike or 0, "call"
                        )
                        if contract:
                            current_mid = client.mid_price(contract)

                    if current_mid <= session.active_premium_received * 0.50 and current_mid > 0:
                        # 50% profit — buy to close and reopen
                        buy_result = client.place_order(
                            symbol=session.active_contract_symbol,
                            side="buy",
                            qty=1,
                            order_type="limit",
                            limit_price=round(current_mid, 2),
                            dry_run=dry_run,
                        )
                        session.total_premium_collected += (
                            session.active_premium_received - current_mid
                        )
                        session.active_order_id = None
                        session.active_contract_symbol = None
                        session.active_premium_received = None
                        session.last_action = (
                            f"50% profit close: bought back call @ ${current_mid:.2f} "
                            f"(sold @ ${session.active_premium_received:.2f}). "
                            f"Reopening call. buy_order={buy_result['order_id']}"
                        )
                        logger.info(
                            "wheel_bot: session %d 50%% profit close @ %.2f",
                            session.id,
                            current_mid,
                        )
                        return

                # Call assigned — shares called away
                session.stage = "called_away"
                session.last_action = (
                    f"Call filled/assigned: shares of {symbol} called away. "
                    f"Total premium: ${session.total_premium_collected:.2f}"
                )
                logger.info(
                    "wheel_bot: session %d call assigned — advancing to called_away",
                    session.id,
                )
                return
        except Exception as exc:
            logger.warning(
                "wheel_bot: session %d could not check call order %s: %s",
                session.id,
                session.active_order_id,
                exc,
            )
        return

    # No active call order — sell a new covered call
    if cost_basis <= 0:
        session.last_action = "Cannot sell call: cost_basis_per_share is not set."
        return

    target_call_strike = round(cost_basis * 1.10, 2)
    expiry = client.pick_expiration(days_min=14, days_max=28)
    chain = client.get_option_chain(symbol, expiry)
    contract = client.closest_strike(chain, target_call_strike, "call")

    if contract:
        call_strike = float(contract.get("strike_price", target_call_strike))
        premium = client.mid_price(contract)
        contract_symbol = contract.get("symbol", f"{symbol}_{expiry}_C{int(call_strike)}")
    else:
        # dry_run fallback or no chain data
        call_strike = target_call_strike
        current_price = client.get_latest_price(symbol) if not dry_run else cost_basis * 1.05
        premium = round((current_price or cost_basis) * 0.02, 2)
        contract_symbol = f"{symbol}_{expiry}_C{int(call_strike)}"

    # Safety: never sell call below cost basis
    if call_strike < cost_basis:
        session.last_action = (
            f"Skipping call: closest strike ${call_strike:.2f} < "
            f"cost basis ${cost_basis:.2f}. Waiting."
        )
        return

    result = client.place_order(
        symbol=contract_symbol,
        side="sell",
        qty=1,
        order_type="limit",
        limit_price=round(premium, 2),
        dry_run=dry_run,
    )

    session.active_contract_symbol = contract_symbol
    session.active_order_id = result["order_id"]
    session.active_premium_received = premium
    session.active_strike = call_strike
    session.active_expiry = expiry
    session.last_action = (
        f"Sold 1 call {contract_symbol} @ ${premium:.2f} "
        f"(strike ${call_strike:.2f}, expiry {expiry})"
        + (" [DRY RUN]" if dry_run else "")
    )

    if dry_run:
        # Simulate call assignment immediately
        session.stage = "called_away"
        session.total_premium_collected += premium
        session.last_action += " — simulated fill, advancing to called_away."
        logger.info(
            "wheel_bot: session %d dry_run call sold+assigned @ %.2f", session.id, call_strike
        )
    else:
        logger.info(
            "wheel_bot: session %d call order placed %s @ %.2f",
            session.id,
            result["order_id"],
            premium,
        )


async def _handle_called_away(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    symbol: str,
    dry_run: bool,
) -> None:
    """
    Stage: called_away

    Shares have been called away. Reset share position and cycle back to sell_put.
    """
    if not dry_run:
        # Confirm no remaining position
        position = client.get_position(symbol)
        if position and float(position.get("qty", 0)) > 0:
            session.last_action = f"Waiting for {symbol} position to clear before cycling."
            return

    # Accumulate the call premium
    if session.active_premium_received:
        session.total_premium_collected += session.active_premium_received

    session.shares_qty = 0
    session.cost_basis_per_share = None
    session.active_contract_symbol = None
    session.active_order_id = None
    session.active_premium_received = None
    session.active_strike = None
    session.active_expiry = None
    session.stage = "sell_put"
    session.last_action = (
        f"Cycle complete. Shares called away. "
        f"Total premium collected: ${session.total_premium_collected:.2f}. "
        f"Restarting put cycle."
    )
    logger.info(
        "wheel_bot: session %d cycle complete — total_premium=%.2f, returning to sell_put",
        session.id,
        session.total_premium_collected,
    )


# ── Daily summary ──────────────────────────────────────────────────────────────

async def generate_daily_summary(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> WheelBotSummaryResponse:
    """
    Generate (or return cached) a daily summary for the session.

    If last_summary_json was written today (per updated_at), return the cached version.
    Otherwise build a fresh summary and persist it.
    """
    # Check cache — if updated_at is today, return cached summary
    now = datetime.now(timezone.utc)
    updated_at = session.updated_at
    if updated_at and session.last_summary_json:
        try:
            # Compare calendar date in UTC
            if updated_at.date() == now.date():
                cached = json.loads(session.last_summary_json)
                return WheelBotSummaryResponse(**cached)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    # Build fresh summary text
    stage_labels = {
        "sell_put": "Selling cash-secured put",
        "assigned": "Awaiting call sale after assignment",
        "sell_call": "Selling covered call",
        "called_away": "Shares called away — cycling back",
    }
    stage_desc = stage_labels.get(session.stage, session.stage)

    lines = [
        f"Wheel Bot Daily Summary — {session.symbol}",
        f"Stage: {stage_desc}",
        f"Shares held: {session.shares_qty}",
    ]
    if session.cost_basis_per_share:
        lines.append(f"Cost basis: ${session.cost_basis_per_share:.2f}/share")
    if session.active_contract_symbol:
        lines.append(f"Active contract: {session.active_contract_symbol}")
    if session.active_premium_received:
        lines.append(f"Active premium: ${session.active_premium_received:.2f}")
    if session.active_expiry:
        lines.append(f"Expiry: {session.active_expiry}")
    lines.append(f"Total premium collected: ${session.total_premium_collected:.2f}")
    if session.last_action:
        lines.append(f"Last action: {session.last_action}")
    lines.append(f"Mode: {'DRY RUN' if session.dry_run else 'LIVE'}")

    summary_text = "\n".join(lines)

    response = WheelBotSummaryResponse(
        symbol=session.symbol,
        stage=session.stage,
        total_premium_collected=session.total_premium_collected,
        shares_qty=session.shares_qty,
        cost_basis_per_share=session.cost_basis_per_share,
        last_action=session.last_action,
        summary=summary_text,
    )

    # Cache to DB
    session.last_summary_json = json.dumps(response.model_dump())
    session.updated_at = now
    await db.commit()

    return response
