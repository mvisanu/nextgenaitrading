from __future__ import annotations

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
        qty=qty,
        side=OrderSide.SELL,
        time_in_force=TimeInForce.GTC,
        stop_price=stop_price,
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
        qty=qty,
        side=OrderSide.BUY,
        time_in_force=TimeInForce.GTC,
        limit_price=limit_price,
    )
    order = broker.client.submit_order(req)
    return str(order.id)


def _cancel_order_alpaca(broker, order_id: str, dry_run: bool) -> None:
    """Cancel an existing order by ID. Silently ignores errors."""
    if dry_run or order_id.startswith("dry-"):
        return
    try:
        import uuid as _uuid
        broker.client.cancel_order_by_id(_uuid.UUID(order_id))
    except Exception as exc:
        logger.warning("Could not cancel order %s: %s", order_id, exc)


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


async def setup_trailing_bot(
    req: TrailingBotSetupRequest,
    db: AsyncSession,
    current_user: User,
) -> TrailingBotSession:
    """
    1. Buy initial_qty shares at market.
    2. Place a GTC stop-market sell order at floor_price.
    3. Place GTC limit buy orders for each ladder rule.
    4. Save session to DB and return it.
    """
    cred = await credential_service.get_credential(req.credential_id, db, current_user)
    broker = get_broker_client(cred)

    # 1. Market buy
    buy_result = broker.place_order(
        symbol=req.symbol,
        side="buy",
        quantity=req.initial_qty,
        dry_run=req.dry_run,
    )

    # 2. Floor stop-market sell
    stop_order_id = _place_stop_order_alpaca(
        broker, req.symbol, req.initial_qty, req.floor_price, req.dry_run
    )

    # 3. Ladder-in limit buys
    ladder_rows = []
    for rule in req.ladder_rules:
        order_id = _place_limit_buy_alpaca(
            broker, req.symbol, rule.qty, rule.price, req.dry_run
        )
        ladder_rows.append({
            "price": rule.price,
            "qty": rule.qty,
            "order_id": order_id,
            "filled": False,
        })

    # 4. Persist session
    session = TrailingBotSession(
        user_id=current_user.id,
        credential_id=req.credential_id,
        symbol=req.symbol,
        initial_qty=req.initial_qty,
        entry_price=buy_result.filled_price,
        initial_order_id=buy_result.broker_order_id,
        stop_order_id=stop_order_id,
        floor_price=req.floor_price,
        current_floor=req.floor_price,
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


async def adjust_trailing_stop(
    session: TrailingBotSession,
    broker,
    db: AsyncSession,
) -> None:
    """
    Called by the scheduler. Checks current price and adjusts the stop order
    upward if thresholds are met. The floor only ever moves UP.
    """
    import asyncio
    from app.services.market_data import load_ohlcv_for_strategy

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
                _cancel_order_alpaca(broker, session.stop_order_id or "", session.dry_run)
                new_stop_id = _place_stop_order_alpaca(
                    broker, session.symbol, session.initial_qty, new_floor, session.dry_run
                )
                session.stop_order_id = new_stop_id
                session.current_floor = new_floor
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
                _cancel_order_alpaca(broker, session.stop_order_id or "", session.dry_run)
                new_stop_id = _place_stop_order_alpaca(
                    broker, session.symbol, session.initial_qty, new_floor, session.dry_run
                )
                session.stop_order_id = new_stop_id
                session.current_floor = new_floor
                session.trailing_high_water = current_price
