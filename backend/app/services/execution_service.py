"""Durable order intents, broker reconciliation, and confirmed-fill accounting."""
from __future__ import annotations
import asyncio
import hashlib
import json
import math
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.broker.factory import get_broker_client
from app.models.live import BrokerOrder, PositionSnapshot
from app.models.strategy import StrategyRun
from app.models.user import User
from app.schemas.live import ExecuteRequest, OrderOut
from app.services.credential_service import get_credential

TERMINAL = {"filled", "canceled", "expired", "rejected", "simulated", "not_implemented"}

def _fingerprint(payload: ExecuteRequest, broker_paper: bool) -> str:
    return hashlib.sha256(json.dumps({**payload.model_dump(mode="json", exclude={"client_order_id"}), "broker_paper": broker_paper}, sort_keys=True).encode()).hexdigest()

async def execute_order(payload: ExecuteRequest, db: AsyncSession, current_user: User, *, paper_override: bool | None = None) -> OrderOut:
    user_id = current_user.id
    key = str(payload.client_order_id or uuid4())
    existing = await db.scalar(select(BrokerOrder).where(BrokerOrder.user_id == user_id, BrokerOrder.client_order_id == key))
    if existing:
        # Replays belong to the saved environment, even if settings or strategy records changed.
        broker_paper = existing.broker_paper if paper_override is None else paper_override
        fingerprint = _fingerprint(payload, broker_paper)
        if existing.request_fingerprint != fingerprint:
            raise HTTPException(409, "This order ID already belongs to a different request")
        return await reconcile_order(key, db, current_user)
    cred = await get_credential(payload.credential_id, db, current_user)
    if cred.provider == "robinhood" and "-" not in payload.symbol:
        raise HTTPException(422, "Robinhood only supports crypto symbols. Switch to Alpaca for stocks.")
    if payload.strategy_run_id:
        run = await db.scalar(select(StrategyRun.id).where(StrategyRun.id == payload.strategy_run_id, StrategyRun.user_id == user_id))
        if run is None:
            raise HTTPException(422, "Strategy run does not belong to this account")
    broker_paper = cred.paper_trading if paper_override is None else paper_override
    fingerprint = _fingerprint(payload, broker_paper)
    # Construct the client and validate all local inputs before reserving/submitting.
    client = get_broker_client(cred, paper=broker_paper)
    order = BrokerOrder(user_id=user_id, client_order_id=key, request_fingerprint=fingerprint,
        credential_id=cred.id, broker_paper=broker_paper, strategy_run_id=payload.strategy_run_id,
        symbol=payload.symbol, side=payload.side, order_type="market", quantity=payload.quantity,
        notional_usd=payload.notional_usd, status="submitting", dry_run=payload.dry_run, mode_name=payload.mode_name,
        applied_filled_quantity=0, applied_filled_notional=0)
    db.add(order)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        await db.refresh(current_user)
        existing = await db.scalar(select(BrokerOrder).where(BrokerOrder.user_id == user_id, BrokerOrder.client_order_id == key))
        if existing is None:
            raise HTTPException(422, "Order intent could not be saved; nothing was submitted")
        if existing.request_fingerprint != fingerprint:
            raise HTTPException(409, "This order ID already belongs to a different request")
        return await reconcile_order(key, db, current_user)
    try:
        # Preserve dollar-based orders as notional; never substitute an estimated share quantity.
        result = await asyncio.to_thread(client.place_order, symbol=payload.symbol, side=payload.side,
            quantity=payload.quantity or 0, notional_usd=payload.notional_usd, order_type="market",
            dry_run=payload.dry_run, client_order_id=key)
    except NotImplementedError:
        return await _save_failure(key, "not_implemented", "Live execution is not supported by this broker", db, user_id)
    except Exception:
        # A timeout is not proof of rejection. Never retry the broker POST here.
        return await _save_failure(key, "submission_unknown", "Broker response unavailable. Check this order before placing another.", db, user_id)
    return await _save_result(key, result, db, current_user)

async def _save_failure(key, status, message, db, user_id):
    order = await db.scalar(select(BrokerOrder).where(BrokerOrder.user_id == user_id, BrokerOrder.client_order_id == key).with_for_update().execution_options(populate_existing=True))
    # Another request may already have recovered a fill while the original call timed out.
    if order.status in {"submitting", "submission_unknown"}:
        order.status = status
        order.error_message = message
    await db.commit()
    await db.refresh(order)
    return OrderOut.model_validate(order)

async def reconcile_order(key: str, db: AsyncSession, current_user: User) -> OrderOut:
    order = await db.scalar(select(BrokerOrder).where(BrokerOrder.user_id == current_user.id, BrokerOrder.client_order_id == key))
    if order is None:
        raise HTTPException(404, "No saved order intent found")
    if order.status in TERMINAL or order.dry_run:
        return OrderOut.model_validate(order)
    if order.credential_id is None:
        raise HTTPException(409, "The original broker credential is no longer available")
    cred = await get_credential(order.credential_id, db, current_user)
    client = get_broker_client(cred, paper=order.broker_paper)
    try:
        result = await asyncio.to_thread(client.get_order_by_client_id, key)
    except Exception:
        # Broker lookup may lag submission. Not-found never authorizes resubmission.
        raise HTTPException(503, "Broker status is still unconfirmed. Keep this order ID and check again.")
    return await _save_result(key, result, db, current_user)

async def _save_result(key, result, db: AsyncSession, current_user: User) -> OrderOut:
    # Serialize this user's ledger updates, including different orders for one symbol.
    await db.execute(select(User.id).where(User.id == current_user.id).with_for_update())
    order = await db.scalar(select(BrokerOrder).where(BrokerOrder.user_id == current_user.id, BrokerOrder.client_order_id == key).with_for_update().execution_options(populate_existing=True))
    order.broker_order_id = result.broker_order_id
    incoming_status = result.status.rsplit(".", 1)[-1].lower()
    if order.status not in TERMINAL:
        order.status = incoming_status
    order.error_message = None
    order.raw_response_json = json.dumps(result.raw_response, default=str)
    qty, price = result.filled_quantity or 0, result.filled_price or 0
    if not order.dry_run and math.isfinite(qty) and math.isfinite(price) and qty > 0 and price > 0:
        delta = qty - order.applied_filled_quantity
        notional = qty * price
        if delta > 0:
            delta_price = (notional - order.applied_filled_notional) / delta
            if math.isfinite(delta_price) and delta_price > 0:
                await _upsert_position_snapshot(db, order.user_id, order.symbol, order.side, delta,
                    delta_price, order.mode_name, order.credential_id, order.broker_paper)
                order.applied_filled_quantity = qty
                order.applied_filled_notional = notional
        if qty >= (order.filled_quantity or 0):
            order.filled_quantity = qty
            order.filled_price = price
    await db.commit()
    await db.refresh(order)
    return OrderOut.model_validate(order)

async def _upsert_position_snapshot(db, user_id, symbol, side, filled_qty, filled_price, mode_name, credential_id=None, broker_paper=False):
    """Apply a confirmed incremental fill in the caller's transaction, including shorts/flips."""
    if not filled_price or filled_qty <= 0:
        return
    existing = await db.scalar(select(PositionSnapshot).where(PositionSnapshot.user_id == user_id,
        PositionSnapshot.symbol == symbol, PositionSnapshot.credential_id == credential_id,
        PositionSnapshot.broker_paper == broker_paper, PositionSnapshot.is_open.is_(True)).with_for_update())
    direction = "long" if side == "buy" else "short"
    if existing is None:
        db.add(PositionSnapshot(user_id=user_id, credential_id=credential_id, broker_paper=broker_paper,
            symbol=symbol, position_side=direction, quantity=filled_qty, avg_entry_price=filled_price,
            mark_price=filled_price, realized_pnl=0, is_open=True, strategy_mode=mode_name))
        return
    if existing.position_side == direction:
        existing.avg_entry_price = ((existing.avg_entry_price or 0) * existing.quantity + filled_qty * filled_price) / (existing.quantity + filled_qty)
        existing.quantity += filled_qty
    else:
        closed = min(existing.quantity, filled_qty)
        existing.realized_pnl = (existing.realized_pnl or 0) + closed * (filled_price - (existing.avg_entry_price or 0)) * (1 if existing.position_side == "long" else -1)
        remainder = existing.quantity - filled_qty
        existing.quantity = abs(remainder)
        existing.is_open = remainder != 0
        if remainder < 0:
            existing.position_side = direction
            existing.avg_entry_price = filled_price
    existing.mark_price = filled_price
