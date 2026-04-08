from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.factory import get_broker_client
from app.models.trailing_bot import TrailingBotSession
from app.models.user import User
from app.schemas.trailing_bot import TrailingBotSetupRequest
from app.services import credential_service

logger = logging.getLogger(__name__)


def _whole_shares(qty: float) -> int:
    """Floor to whole shares — Alpaca GTC orders don't support fractional quantities."""
    return max(1, int(qty))


def _place_stop_order_alpaca(
    broker,
    symbol: str,
    qty: float,
    stop_price: float,
    dry_run: bool,
) -> str:
    """Place a GTC stop-market sell order. Returns broker order ID."""
    if dry_run:
        return f"dry-stop-{symbol}-{stop_price}"

    from alpaca.trading.enums import OrderSide, TimeInForce
    from alpaca.trading.requests import StopOrderRequest

    req = StopOrderRequest(
        symbol=symbol,
        qty=_whole_shares(qty),
        side=OrderSide.SELL,
        time_in_force=TimeInForce.GTC,
        stop_price=round(stop_price, 2),
    )
    order = broker.client.submit_order(req)
    return str(order.id)


def _place_limit_buy_alpaca(
    broker,
    symbol: str,
    qty: float,
    limit_price: float,
    dry_run: bool,
) -> str:
    """Place a GTC limit buy order. Returns broker order ID."""
    if dry_run:
        return f"dry-limit-{symbol}-{limit_price}"

    from alpaca.trading.enums import OrderSide, TimeInForce
    from alpaca.trading.requests import LimitOrderRequest

    req = LimitOrderRequest(
        symbol=symbol,
        qty=_whole_shares(qty),
        side=OrderSide.BUY,
        time_in_force=TimeInForce.GTC,
        limit_price=round(limit_price, 2),
    )
    order = broker.client.submit_order(req)
    return str(order.id)


def _cancel_order_alpaca(broker, order_id: str, dry_run: bool) -> bool:
    """Cancel an existing order by ID. Returns True on success, False on failure."""
    if dry_run or order_id.startswith("dry-"):
        return True
    try:
        import uuid as _uuid
        broker.client.cancel_order_by_id(_uuid.UUID(order_id))
        return True
    except Exception as exc:
        logger.warning("Could not cancel order %s: %s", order_id, exc)
        return False


def _get_latest_price(symbol: str) -> Optional[float]:
    """Fetch the latest daily close price for a symbol."""
    try:
        from app.services.market_data import load_ohlcv_for_strategy
        df = load_ohlcv_for_strategy(symbol, "1d")
        if df is not None and len(df) > 0:
            return float(df["Close"].iloc[-1])
    except Exception as exc:
        logger.warning("Price fetch failed for %s: %s", symbol, exc)
    return None


def _poll_order_fill(broker, order_id: str, max_attempts: int = 7, interval_sec: float = 2.0) -> tuple[Optional[float], Optional[int]]:
    """
    Synchronous poll: wait for a market order to fill.
    Returns (filled_avg_price, filled_qty).
    If partially filled after timeout, cancels the remainder and waits for it to settle
    so no pending buy blocks the subsequent stop-sell placement.
    """
    import time
    import uuid as _uuid
    last_filled_price: Optional[float] = None
    last_filled_qty: int = 0

    for attempt in range(max_attempts):
        try:
            order = broker.client.get_order_by_id(_uuid.UUID(order_id))
            status = str(order.status)
            last_filled_qty = int(float(order.filled_qty)) if order.filled_qty else 0
            last_filled_price = float(order.filled_avg_price) if order.filled_avg_price else None

            if status == "filled":
                return last_filled_price, last_filled_qty

            if status in ("canceled", "expired", "rejected", "done_for_day"):
                return last_filled_price, last_filled_qty if last_filled_qty else None

        except Exception as exc:
            logger.warning("Error polling order %s: %s", order_id, exc)
            return None, None

        time.sleep(interval_sec)

    # Timed out — cancel remainder to clear pending buy before stop placement
    try:
        broker.client.cancel_order_by_id(_uuid.UUID(order_id))
        logger.info("Cancelled partial remainder of order %s (filled %d shares)", order_id, last_filled_qty)
        time.sleep(3)  # let Alpaca settle the cancel before we place a sell
    except Exception as cancel_exc:
        logger.warning("Could not cancel partial remainder %s: %s", order_id, cancel_exc)

    return last_filled_price, last_filled_qty if last_filled_qty else None


async def setup_trailing_bot(
    req: TrailingBotSetupRequest,
    db: AsyncSession,
    current_user: User,
) -> TrailingBotSession:
    """
    1. Get current price to compute whole-share qty (avoids GTC fractional-share rejection).
    2. Buy qty shares at market.
    3. Wait for fill (up to ~14s) to get actual fill price; fall back to pre-buy price.
    4. Compute floor_price = fill_price * (1 - floor_pct/100).
    5. Place a GTC stop-market sell at floor_price.
    6. For each ladder rule: place GTC limit buy.
    7. Save session to DB and return it.

    Rollback contract: if anything in steps 3-7 fails after the buy has been submitted,
    we cancel both the stop order (if placed) and the original buy order before re-raising.
    This prevents orphaned Alpaca orders that would cause "wash trade" errors on the next attempt.
    """
    from fastapi import HTTPException, status as http_status
    from sqlalchemy import select as _select

    cred = await credential_service.get_credential(req.credential_id, db, current_user)
    broker = get_broker_client(cred)

    # Guard: prevent duplicate active sessions for same symbol (would cause wash-trade on Alpaca)
    existing = await db.execute(
        _select(TrailingBotSession).where(
            TrailingBotSession.user_id == current_user.id,
            TrailingBotSession.symbol == req.symbol.upper(),
            TrailingBotSession.status == "active",
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"An active trailing-bot session for {req.symbol.upper()} already exists. Cancel it before creating a new one.",
        )

    # 1. Fetch current price to determine whole-share qty
    current_price = await asyncio.to_thread(_get_latest_price, req.symbol)
    if not current_price:
        raise ValueError(f"Could not fetch price for {req.symbol}")
    initial_qty = _whole_shares(req.buy_amount_usd / current_price)

    # 2. Market buy — whole shares (GTC stop orders require whole shares)
    buy_result = await asyncio.to_thread(
        broker.place_order,
        symbol=req.symbol,
        side="buy",
        quantity=initial_qty,
        dry_run=req.dry_run,
    )

    # Everything from here through DB commit is wrapped in a rollback guard.
    # If ANY step fails we cancel the stop order (if placed) and the buy order
    # so Alpaca is left in a clean state for the next attempt.
    stop_order_id: Optional[str] = None
    ladder_rows: list = []

    try:
        # 3. Wait for fill to get actual fill price (avoids wash-trade on stop placement)
        fill_price = buy_result.filled_price
        filled_qty = initial_qty
        if not fill_price and not req.dry_run and buy_result.broker_order_id != "dry-run":
            polled_price, polled_qty = await asyncio.to_thread(
                _poll_order_fill, broker, buy_result.broker_order_id
            )
            if polled_price:
                fill_price = polled_price
            if polled_qty:
                filled_qty = polled_qty
        if not fill_price:
            fill_price = current_price  # best estimate if fill data unavailable

        # 4. Auto-calculate floor price
        floor_price = round(fill_price * (1 - req.floor_pct / 100), 4)

        # 5. Floor stop-market sell — use actual filled qty to avoid wash-trade
        stop_order_id = await asyncio.to_thread(
            _place_stop_order_alpaca, broker, req.symbol, filled_qty, floor_price, req.dry_run
        )

        # 6. Ladder-in limit buys (price and qty derived from fill + percentages)
        for rule in req.ladder_rules:
            ladder_price = round(fill_price * (1 - rule.drop_pct / 100), 4)
            ladder_qty = round(rule.buy_amount_usd / ladder_price, 8)
            order_id = await asyncio.to_thread(
                _place_limit_buy_alpaca, broker, req.symbol, ladder_qty, ladder_price, req.dry_run
            )
            ladder_rows.append({
                "price": ladder_price,
                "qty": ladder_qty,
                "drop_pct": rule.drop_pct,
                "buy_amount_usd": rule.buy_amount_usd,
                "order_id": order_id,
                "filled": False,
            })

        # 7. Persist session
        session = TrailingBotSession(
            user_id=current_user.id,
            credential_id=req.credential_id,
            symbol=req.symbol,
            buy_amount_usd=req.buy_amount_usd,
            floor_pct=req.floor_pct,
            initial_qty=filled_qty,
            entry_price=fill_price,
            initial_order_id=buy_result.broker_order_id,
            stop_order_id=stop_order_id,
            floor_price=floor_price,
            current_floor=floor_price,
            trailing_trigger_pct=10.0,
            trailing_trail_pct=5.0,
            trailing_step_pct=5.0,
            trailing_active=False,
            trailing_high_water=None,
            ladder_rules_json=json.dumps(ladder_rows),
            dry_run=req.dry_run,
            status="active",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    except Exception as setup_exc:
        # ── Rollback: clean up any orders already sent to Alpaca ──────────────
        # Cancel stop order first (it has no fill, so it's safe to cancel immediately).
        if stop_order_id is not None:
            cancelled_stop = await asyncio.to_thread(
                _cancel_order_alpaca, broker, stop_order_id, req.dry_run
            )
            if cancelled_stop:
                logger.info("Rollback: cancelled stop order %s for %s", stop_order_id, req.symbol)
            else:
                logger.error(
                    "Rollback: FAILED to cancel stop order %s for %s — "
                    "manual cleanup required on Alpaca to avoid future wash-trade errors",
                    stop_order_id, req.symbol,
                )
        # Cancel any ladder limit buys that were already submitted.
        for row in ladder_rows:
            if row.get("order_id") and not str(row["order_id"]).startswith("dry-"):
                await asyncio.to_thread(
                    _cancel_order_alpaca, broker, row["order_id"], req.dry_run
                )
        # Cancel the market buy (may already be filled; cancel is a no-op on filled orders).
        if not req.dry_run and buy_result.broker_order_id not in ("dry-run",):
            await asyncio.to_thread(
                _cancel_order_alpaca, broker, buy_result.broker_order_id, False
            )
        raise setup_exc


async def adjust_trailing_stop(
    session: TrailingBotSession,
    broker,
    db: AsyncSession,
) -> None:
    """
    Called by the scheduler. Checks current price and adjusts the stop order
    upward if thresholds are met. The floor only ever moves UP.
    """
    if session.status != "active" or session.entry_price is None:
        return

    current_price = await asyncio.to_thread(_get_latest_price, session.symbol)
    if current_price is None:
        return

    entry = session.entry_price
    gain_pct = ((current_price - entry) / entry) * 100

    if not session.trailing_active:
        if gain_pct >= session.trailing_trigger_pct:
            session.trailing_active = True
            session.trailing_high_water = current_price
            new_floor = round(current_price * (1 - session.trailing_trail_pct / 100), 4)
            if new_floor > (session.current_floor or 0):
                logger.info(
                    "Session %d: activating trailing stop. Gain=%.2f%%, new floor=$%.4f",
                    session.id, gain_pct, new_floor,
                )
                cancelled = await asyncio.to_thread(_cancel_order_alpaca, broker, session.stop_order_id or "", session.dry_run)
                if not cancelled:
                    logger.error(
                        "Session %d: aborting floor raise — cancel of old stop order %s failed.",
                        session.id, session.stop_order_id,
                    )
                    return
                new_stop_id = await asyncio.to_thread(
                    _place_stop_order_alpaca, broker, session.symbol, session.initial_qty, new_floor, session.dry_run
                )
                session.stop_order_id = new_stop_id
                session.current_floor = new_floor
                await db.commit()
        return

    # Already trailing: move floor up every trailing_step_pct above high water
    if current_price > (session.trailing_high_water or 0):
        prev_high = session.trailing_high_water or entry
        step_gained = ((current_price - prev_high) / prev_high) * 100

        if step_gained >= session.trailing_step_pct:
            new_floor = round(current_price * (1 - session.trailing_trail_pct / 100), 4)
            if new_floor > (session.current_floor or 0):
                logger.info(
                    "Session %d: raising floor. Price=$%.4f, new floor=$%.4f",
                    session.id, current_price, new_floor,
                )
                cancelled = await asyncio.to_thread(_cancel_order_alpaca, broker, session.stop_order_id or "", session.dry_run)
                if not cancelled:
                    logger.error(
                        "Session %d: aborting floor raise — cancel of old stop order %s failed.",
                        session.id, session.stop_order_id,
                    )
                    return
                new_stop_id = await asyncio.to_thread(
                    _place_stop_order_alpaca, broker, session.symbol, session.initial_qty, new_floor, session.dry_run
                )
                session.stop_order_id = new_stop_id
                session.current_floor = new_floor
                session.trailing_high_water = current_price
                await db.commit()
