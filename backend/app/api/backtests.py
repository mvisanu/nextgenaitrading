from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.security import assert_ownership
from app.db.session import get_db
from app.models.backtest import BacktestTrade, VariantBacktestResult
from app.models.strategy import StrategyRun
from app.models.user import User
from app.schemas.backtest import (
    BacktestOut,
    BacktestRunRequest,
    BacktestTradeOut,
    ChartDataResponse,
    LeaderboardEntry,
)
from app.services.market_data import df_to_candles, load_ohlcv_for_strategy
from app.services.strategy_run_service import run_strategy

router = APIRouter(prefix="/backtests", tags=["backtests"])


@router.post("/run", response_model=BacktestOut, status_code=status.HTTP_202_ACCEPTED)
async def run_backtest_endpoint(
    payload: BacktestRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BacktestOut:
    run = await run_strategy(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        mode=payload.mode,
        leverage_override=payload.leverage,
        db=db,
        current_user=current_user,
        run_type="backtest",
    )
    return BacktestOut.model_validate(run)


@router.get("", response_model=list[BacktestOut])
async def list_backtests(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> list[BacktestOut]:
    result = await db.execute(
        select(StrategyRun)
        .where(
            StrategyRun.user_id == current_user.id,
            StrategyRun.run_type == "backtest",
        )
        .order_by(StrategyRun.created_at.desc())
        .limit(limit)
    )
    runs = result.scalars().all()
    return [BacktestOut.model_validate(r) for r in runs]


@router.get("/{run_id}", response_model=BacktestOut)
async def get_backtest(
    run_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BacktestOut:
    result = await db.execute(select(StrategyRun).where(StrategyRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found.")
    assert_ownership(run.user_id, current_user.id)
    return BacktestOut.model_validate(run)


@router.get("/{run_id}/trades", response_model=list[BacktestTradeOut])
async def get_backtest_trades(
    run_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[BacktestTradeOut]:
    # Verify ownership via run
    run_result = await db.execute(select(StrategyRun).where(StrategyRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found.")
    assert_ownership(run.user_id, current_user.id)

    result = await db.execute(
        select(BacktestTrade)
        .where(
            BacktestTrade.strategy_run_id == run_id,
            BacktestTrade.user_id == current_user.id,
        )
        .order_by(BacktestTrade.entry_time.asc())
    )
    trades = result.scalars().all()
    return [BacktestTradeOut.model_validate(t) for t in trades]


@router.get("/{run_id}/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    run_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LeaderboardEntry]:
    run_result = await db.execute(select(StrategyRun).where(StrategyRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found.")
    assert_ownership(run.user_id, current_user.id)

    result = await db.execute(
        select(VariantBacktestResult)
        .where(
            VariantBacktestResult.strategy_run_id == run_id,
            VariantBacktestResult.user_id == current_user.id,
        )
        .order_by(VariantBacktestResult.validation_score.desc())
    )
    variants = result.scalars().all()
    return [LeaderboardEntry.model_validate(v) for v in variants]


@router.get("/{run_id}/chart-data", response_model=ChartDataResponse)
async def get_chart_data(
    run_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChartDataResponse:
    """Returns chart-ready OHLCV candles, trade signals, and equity curve."""
    run_result = await db.execute(select(StrategyRun).where(StrategyRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backtest not found.")
    assert_ownership(run.user_id, current_user.id)

    # Fetch candles
    try:
        df = load_ohlcv_for_strategy(run.symbol, run.timeframe)
        candles = df_to_candles(df)
    except Exception:
        candles = []

    # Fetch trades for signal markers + equity curve
    trades_result = await db.execute(
        select(BacktestTrade)
        .where(
            BacktestTrade.strategy_run_id == run_id,
            BacktestTrade.user_id == current_user.id,
        )
        .order_by(BacktestTrade.entry_time.asc())
    )
    trades = trades_result.scalars().all()

    signals = []
    for t in trades:
        if t.entry_time:
            signals.append(
                {
                    "time": t.entry_time.strftime("%Y-%m-%d"),
                    "position": "belowBar",
                    "color": "#22c55e",
                    "shape": "arrowUp",
                    "text": f"BUY {t.mode_name}",
                }
            )
        if t.exit_time:
            signals.append(
                {
                    "time": t.exit_time.strftime("%Y-%m-%d"),
                    "position": "aboveBar",
                    "color": "#ef4444",
                    "shape": "arrowDown",
                    "text": f"SELL ({t.exit_reason or 'signal'})",
                }
            )

    # Equity curve
    equity = []
    running = 100.0
    for t in trades:
        running = running * (1 + t.return_pct / 100.0)
        date_str = t.exit_time.strftime("%Y-%m-%d") if t.exit_time else ""
        equity.append({"date": date_str, "equity": round(running, 4)})

    return ChartDataResponse(candles=candles, signals=signals, equity=equity)
