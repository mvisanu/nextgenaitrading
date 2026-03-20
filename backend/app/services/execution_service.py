"""
Order execution service — routes orders through the correct broker client,
validates provider/symbol compatibility, and persists BrokerOrder records.
"""
from __future__ import annotations

import json
import logging

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.factory import get_broker_client
from app.broker.robinhood_client import ROBINHOOD_CRYPTO_SYMBOLS
from app.models.live import BrokerOrder
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

    quantity = payload.quantity or 0.0
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
        strategy_run_id=payload.strategy_run_id,
        symbol=payload.symbol,
        side=payload.side,
        order_type="market",
        quantity=quantity,
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
    await db.commit()
    await db.refresh(broker_order)

    if error_msg and not payload.dry_run:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Order submission failed: {error_msg}",
        )

    return OrderOut.model_validate(broker_order)
