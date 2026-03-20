from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.security import assert_ownership
from app.db.session import get_db
from app.models.strategy import StrategyRun, TradeDecision
from app.models.user import User
from app.schemas.strategy import StrategyRunOut, StrategyRunRequest, TradeDecisionOut
from app.services.strategy_run_service import run_strategy

router = APIRouter(prefix="/strategies", tags=["strategies"])


@router.post("/ai-pick/run", response_model=StrategyRunOut, status_code=status.HTTP_202_ACCEPTED)
async def run_ai_pick(
    payload: StrategyRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StrategyRunOut:
    """Run AI Pick optimizer. May take up to 120 seconds."""
    run = await run_strategy(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        mode="ai-pick",
        leverage_override=payload.leverage,
        db=db,
        current_user=current_user,
        run_type="backtest",
    )
    return StrategyRunOut.model_validate(run)


@router.post(
    "/buy-low-sell-high/run",
    response_model=StrategyRunOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_buy_low_sell_high(
    payload: StrategyRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StrategyRunOut:
    """Run Buy Low / Sell High optimizer. May take up to 120 seconds."""
    run = await run_strategy(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        mode="buy-low-sell-high",
        leverage_override=payload.leverage,
        db=db,
        current_user=current_user,
        run_type="backtest",
    )
    return StrategyRunOut.model_validate(run)


@router.get("/runs", response_model=list[StrategyRunOut])
async def list_runs(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> list[StrategyRunOut]:
    result = await db.execute(
        select(StrategyRun)
        .where(StrategyRun.user_id == current_user.id)
        .order_by(StrategyRun.created_at.desc())
        .limit(limit)
    )
    runs = result.scalars().all()
    return [StrategyRunOut.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=StrategyRunOut)
async def get_run(
    run_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StrategyRunOut:
    result = await db.execute(
        select(StrategyRun).where(StrategyRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    assert_ownership(run.user_id, current_user.id)
    return StrategyRunOut.model_validate(run)


@router.get("/runs/{run_id}/decisions", response_model=list[TradeDecisionOut])
async def get_run_decisions(
    run_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
) -> list[TradeDecisionOut]:
    # Ownership check via run
    run_result = await db.execute(
        select(StrategyRun).where(StrategyRun.id == run_id)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    assert_ownership(run.user_id, current_user.id)

    result = await db.execute(
        select(TradeDecision)
        .where(
            TradeDecision.strategy_run_id == run_id,
            TradeDecision.user_id == current_user.id,
        )
        .order_by(TradeDecision.timestamp_of_bar.asc())
        .limit(limit)
    )
    decisions = result.scalars().all()
    return [TradeDecisionOut.model_validate(d) for d in decisions]
