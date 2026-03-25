from __future__ import annotations

import json
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.live import BrokerOrder, PositionSnapshot
from app.models.user import User
from app.schemas.live import (
    AccountStatus,
    ExecuteRequest,
    LiveChartResponse,
    LiveRunRequest,
    OrderOut,
    PositionOut,
    SignalCheckOut,
)
from app.services import credential_service
from app.services.execution_service import execute_order
from app.services.market_data import df_to_candles, load_ohlcv_for_strategy
from app.services.strategy_run_service import run_strategy

router = APIRouter(prefix="/live", tags=["live"])


@router.post("/run-signal-check", response_model=SignalCheckOut)
async def run_signal_check(
    payload: LiveRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SignalCheckOut:
    """Run regime + signal logic for the selected symbol; no order submitted."""
    # Enforce Robinhood crypto-only constraint at signal-check time too
    cred = await credential_service.get_credential(payload.credential_id, db, current_user)
    if cred.provider == "robinhood" and "-" not in payload.symbol:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Robinhood only supports crypto symbols. "
                "Switch to Alpaca for stock trading."
            ),
        )

    run = await run_strategy(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        mode=payload.mode,
        leverage_override=None,
        db=db,
        current_user=current_user,
        run_type="signal",
    )
    # Parse per-indicator confirmation details from notes JSON
    confirmation_details = []
    reason = None
    if run.notes:
        try:
            notes_data = json.loads(run.notes)
            confirmation_details = notes_data.get("confirmation_details", [])
            reason = notes_data.get("reason")
        except (json.JSONDecodeError, TypeError):
            pass

    return SignalCheckOut(
        symbol=run.symbol,
        regime=run.current_regime,
        signal=run.current_signal,
        confirmation_count=run.confirmation_count,
        strategy_run_id=run.id,
        reason=reason,
        confirmation_details=confirmation_details,
    )


@router.post("/execute", response_model=OrderOut)
async def execute_live_order(
    payload: ExecuteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrderOut:
    """Submit a live or dry-run order. Defaults to dry_run=True."""
    return await execute_order(payload, db, current_user)


@router.get("/orders", response_model=list[OrderOut])
async def list_orders(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> list[OrderOut]:
    result = await db.execute(
        select(BrokerOrder)
        .where(BrokerOrder.user_id == current_user.id)
        .order_by(BrokerOrder.created_at.desc())
        .limit(limit)
    )
    orders = result.scalars().all()
    return [OrderOut.model_validate(o) for o in orders]


@router.get("/positions", response_model=list[PositionOut])
async def list_positions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[PositionOut]:
    """
    Returns open position snapshots from DB.
    For live broker positions, call /live/status to get the active credential,
    then use the broker client directly (this is a DB-backed view).
    """
    result = await db.execute(
        select(PositionSnapshot)
        .where(
            PositionSnapshot.user_id == current_user.id,
            PositionSnapshot.is_open.is_(True),
        )
        .order_by(PositionSnapshot.created_at.desc())
    )
    positions = result.scalars().all()
    return [PositionOut.model_validate(p) for p in positions]


@router.get("/status", response_model=AccountStatus)
async def get_live_status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    credential_id: int | None = None,
) -> AccountStatus:
    """
    Returns broker connection status and account info for the specified credential.
    If credential_id not provided, uses the most recently created active credential.
    """
    if credential_id:
        cred = await credential_service.get_credential(credential_id, db, current_user)
    else:
        from sqlalchemy import select as sa_select
        from app.models.broker import BrokerCredential

        result = await db.execute(
            sa_select(BrokerCredential)
            .where(
                BrokerCredential.user_id == current_user.id,
                BrokerCredential.is_active.is_(True),
            )
            .order_by(BrokerCredential.created_at.desc())
            .limit(1)
        )
        cred = result.scalar_one_or_none()
        if not cred:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active broker credentials found. Add a credential in /profile.",
            )

    from app.broker.factory import get_broker_client

    connected = False
    account_info = None
    try:
        client = get_broker_client(cred)
        connected = client.ping()
        if connected:
            account_info = client.get_account()
    except Exception:
        pass

    return AccountStatus(
        credential_id=cred.id,
        provider=cred.provider,
        profile_name=cred.profile_name,
        paper_trading=cred.paper_trading,
        connected=connected,
        account_info=account_info,
    )


@router.get("/chart-data", response_model=LiveChartResponse)
async def get_live_chart_data(
    symbol: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    interval: str = "1d",
) -> LiveChartResponse:
    """Fetch OHLCV candles for the live trading price chart."""
    symbol = symbol.strip().upper()
    # Reject obviously invalid symbols before hitting yfinance.
    # Valid examples: AAPL, BTC-USD, ETH-USD, SPY, TSLA
    # Must be at least 2 chars, contain only letters/digits/hyphens, start with a letter.
    if not re.fullmatch(r"[A-Z][A-Z0-9\-]{1,19}", symbol):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid symbol '{symbol}'. Must be 2–20 characters, letters/digits/hyphens, starting with a letter.",
        )
    try:
        df = load_ohlcv_for_strategy(symbol, interval)
        candles = df_to_candles(df)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Symbol '{symbol}' not found or returned no data",
        ) from exc
    return LiveChartResponse(candles=candles)
