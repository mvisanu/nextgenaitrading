from __future__ import annotations

import json
import logging
import re
from typing import Annotated

import pandas as pd

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.live import BrokerOrder, PositionSnapshot
from app.models.user import User
from app.schemas.live import (
    AccountStatus,
    BollingerOverlayBar,
    ExecuteRequest,
    LiveChartResponse,
    LiveRunRequest,
    OrderOut,
    PositionOut,
    SignalCheckOut,
    SqueezeData,
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
    squeeze_data = None
    if run.notes:
        try:
            notes_data = json.loads(run.notes)
            confirmation_details = notes_data.get("confirmation_details", [])
            reason = notes_data.get("reason")
            if "squeeze" in notes_data:
                squeeze_data = SqueezeData(**notes_data["squeeze"])
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
        squeeze=squeeze_data,
    )


@router.post("/execute", response_model=OrderOut)
@limiter.limit("10/minute")
async def execute_live_order(
    request: Request,
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
    limit: int = Query(default=50, ge=1, le=200),
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
    interval: str = "1d",
    bollinger: bool = False,
) -> LiveChartResponse:
    """Fetch OHLCV candles for the live trading price chart."""
    symbol = symbol.strip().upper()
    if not re.fullmatch(r"[A-Z\^][A-Z0-9\-\.=]{0,19}", symbol):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid symbol '{symbol}'. Must be 1–20 characters, letters/digits/hyphens, starting with a letter.",
        )
    try:
        df = load_ohlcv_for_strategy(symbol, interval)
        candles = df_to_candles(df, interval)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Symbol '{symbol}' not found or returned no data",
        ) from exc

    bollinger_overlay = None
    if bollinger:
        try:
            from app.services.bollinger_squeeze_service import compute_bollinger_bands, detect_squeeze

            # Adapt BB period to timeframe — shorter timeframes need longer
            # periods to produce smooth bands (5m × 50 ≈ 1D × 20 in real time)
            INTRADAY_INTERVALS = {"1m", "2m", "5m", "15m", "30m"}
            SHORT_INTERVALS = {"1h", "2h", "3h", "4h"}
            if interval in INTRADAY_INTERVALS:
                bb_length = 50
                smooth_window = 5  # EMA smooth the output bands
            elif interval in SHORT_INTERVALS:
                bb_length = 30
                smooth_window = 3
            else:
                bb_length = 20  # daily/weekly — standard
                smooth_window = 0

            bb = compute_bollinger_bands(df["Close"], length=bb_length)

            # Apply EMA smoothing to reduce noise on intraday
            if smooth_window > 1:
                for col in ("bb_upper", "bb_lower", "bb_middle"):
                    bb[col] = bb[col].ewm(span=smooth_window, adjust=False).mean()

            from app.services.market_data import _INTRADAY_INTERVALS
            is_intraday = interval in _INTRADAY_INTERVALS

            bollinger_overlay = []
            for ts, row in bb.iterrows():
                if any(pd.isna([row["bb_upper"], row["bb_lower"], row["bb_middle"]])):
                    continue
                if is_intraday and hasattr(ts, "timestamp"):
                    time_val: str | int = int(ts.timestamp())
                elif hasattr(ts, "strftime"):
                    time_val = ts.strftime("%Y-%m-%d")
                else:
                    time_val = str(ts)[:10]
                bollinger_overlay.append(BollingerOverlayBar(
                    time=time_val,
                    upper=round(float(row["bb_upper"]), 4),
                    lower=round(float(row["bb_lower"]), 4),
                    middle=round(float(row["bb_middle"]), 4),
                    is_squeeze=detect_squeeze(float(row["bb_width_percentile"])),
                ))
        except Exception as exc:
            logger.warning("Bollinger overlay computation failed: %s", exc)

    return LiveChartResponse(candles=candles, bollinger=bollinger_overlay)
