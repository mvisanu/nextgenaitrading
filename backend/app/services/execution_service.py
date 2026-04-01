"""
Order execution service — routes orders through the correct broker client,
validates provider/symbol compatibility, and persists BrokerOrder records.
"""
from __future__ import annotations

import json
import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.broker.factory import get_broker_client
from app.broker.robinhood_client import ROBINHOOD_CRYPTO_SYMBOLS
from app.models.live import BrokerOrder, PositionSnapshot
from app.models.user import User
from app.schemas.live import ExecuteRequest, OrderOut
from app.services.credential_service import get_credential

logger = logging.getLogger(__name__)

# Simple heuristic: crypto symbols contain a dash (e.g. BTC-USD, ETH-USD)
def _is_crypto_symbol(symbol: str) -> bool:
    return "-" in symbol


async def execute_order(
    payload: ExecuteRequest,
    db: AsyncSession,
    current_user: User,
) -> OrderOut:
    """Route an order to the correct broker and persist the result."""
    cred = await get_credential(payload.credential_id, db, current_user)

    # Enforce Robinhood crypto-only constraint
    if cred.provider == "robinhood" and not _is_crypto_symbol(payload.symbol):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Robinhood only supports crypto symbols. "
                "Switch to Alpaca for stock trading."
            ),
        )

    # Resolve quantity: either provided directly or estimated from notional USD
    quantity = payload.quantity or 0.0
    estimated_price: float | None = None
    if not payload.quantity and payload.notional_usd:
        # Estimate quantity from latest market price
        try:
            from app.services.market_data import load_ohlcv_for_strategy
            df = load_ohlcv_for_strategy(payload.symbol, "1d")
            if len(df) > 0:
                estimated_price = float(df["Close"].iloc[-1])
                quantity = payload.notional_usd / estimated_price
        except Exception:
            # If price lookup fails, record the notional but use 0 quantity
            logger.warning("Could not estimate price for %s, using 0 quantity", payload.symbol)

    error_msg: str | None = None
    broker_order_id: str | None = None
    filled_price: float | None = None
    filled_qty: float | None = None
    order_status = "pending"
    raw_response: dict = {}

    try:
        client = get_broker_client(cred)
        result = client.place_order(
            symbol=payload.symbol,
            side=payload.side,
            quantity=quantity,
            notional_usd=payload.notional_usd,
            order_type="market",
            dry_run=payload.dry_run,
        )
        broker_order_id = result.broker_order_id
        order_status = result.status
        filled_price = result.filled_price
        filled_qty = result.filled_quantity
        raw_response = result.raw_response
    except NotImplementedError as exc:
        error_msg = str(exc)
        order_status = "not_implemented"
    except Exception as exc:
        logger.exception("Order execution error for user_id=%d: %s", current_user.id, exc)
        error_msg = str(exc)
        order_status = "error"

    broker_order = BrokerOrder(
        user_id=current_user.id,
        # Guard: only set strategy_run_id if it was provided — a dangling FK from
        # a failed/uncommitted signal-check run would cause an IntegrityError on commit.
        strategy_run_id=payload.strategy_run_id if payload.strategy_run_id else None,
        symbol=payload.symbol,
        side=payload.side,
        order_type="market",
        quantity=quantity if quantity else None,
        notional_usd=payload.notional_usd,
        broker_order_id=broker_order_id,
        status=order_status,
        filled_price=filled_price,
        filled_quantity=filled_qty,
        mode_name=payload.mode_name,
        dry_run=payload.dry_run,
        error_message=error_msg,
        raw_response_json=json.dumps(raw_response) if raw_response else None,
    )
    db.add(broker_order)
    try:
        await db.commit()
        await db.refresh(broker_order)
    except IntegrityError as exc:
        await db.rollback()
        logger.error("DB integrity error persisting order for user_id=%d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Order could not be saved — invalid strategy_run_id or data constraint violation.",
        ) from exc

    # Upsert PositionSnapshot immediately so the portfolio reflects the new holding.
    # We do this for both dry-run and live orders so the ledger stays consistent.
    # Only update position for buy/sell — skip on error to avoid phantom positions.
    if order_status not in ("error",):
        try:
            await _upsert_position_snapshot(
                db=db,
                user_id=current_user.id,
                symbol=payload.symbol,
                side=payload.side,
                filled_qty=filled_qty or quantity,
                filled_price=filled_price or estimated_price,
                mode_name=payload.mode_name,
            )
        except Exception as exc:
            logger.warning(
                "PositionSnapshot upsert failed for user_id=%d symbol=%s: %s",
                current_user.id, payload.symbol, exc,
            )

    if error_msg and not payload.dry_run:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Order submission failed: {error_msg}",
        )

    return OrderOut.model_validate(broker_order)


async def _upsert_position_snapshot(
    db: AsyncSession,
    user_id: int,
    symbol: str,
    side: str,
    filled_qty: float,
    filled_price: float | None,
    mode_name: str | None,
) -> None:
    """
    Upsert PositionSnapshot for user after a buy or sell order.

    Buy:  add quantity; recalculate weighted avg entry price.
    Sell: reduce quantity; mark is_open=False when qty reaches 0.

    Isolated from the main order commit so a snapshot failure never
    rolls back the BrokerOrder record.
    """
    if filled_qty <= 0:
        return

    result = await db.execute(
        select(PositionSnapshot)
        .where(
            PositionSnapshot.user_id == user_id,
            PositionSnapshot.symbol == symbol,
            PositionSnapshot.is_open.is_(True),
        )
        .order_by(PositionSnapshot.created_at.desc())
        .limit(1)
    )
    existing: PositionSnapshot | None = result.scalar_one_or_none()

    if side == "buy":
        if existing:
            # Weighted average entry price
            old_notional = (existing.avg_entry_price or 0.0) * existing.quantity
            new_notional = (filled_price or 0.0) * filled_qty
            new_qty = existing.quantity + filled_qty
            existing.avg_entry_price = (
                (old_notional + new_notional) / new_qty if new_qty > 0 else filled_price
            )
            existing.quantity = new_qty
            existing.is_open = True
            if mode_name and not existing.strategy_mode:
                existing.strategy_mode = mode_name
        else:
            snap = PositionSnapshot(
                user_id=user_id,
                symbol=symbol,
                position_side="long",
                quantity=filled_qty,
                avg_entry_price=filled_price,
                mark_price=filled_price,
                is_open=True,
                strategy_mode=mode_name,
            )
            db.add(snap)
    elif side == "sell":
        if existing:
            new_qty = max(existing.quantity - filled_qty, 0.0)
            existing.quantity = new_qty
            if new_qty <= 0:
                existing.is_open = False

    await db.commit()
