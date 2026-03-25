"""
Strategy run service.

Orchestrates:
1. Symbol validation
2. OHLCV fetch
3. Strategy/optimizer execution
4. DB persistence of StrategyRun, TradeDecision, VariantBacktestResult, BacktestTrade
5. Pine Script artifact generation for optimizer modes
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.artifacts.pine_script_generator import generate_pine_script
from app.backtesting.engine import run_backtest
from app.models.artifact import WinningStrategyArtifact
from app.models.backtest import BacktestTrade, VariantBacktestResult
from app.models.strategy import StrategyRun, TradeDecision
from app.models.user import User
from app.services.market_data import load_ohlcv_for_strategy

logger = logging.getLogger(__name__)

# Mode defaults
MODE_DEFAULTS: dict[str, dict] = {
    "conservative": {"leverage": 2.5, "min_confirmations": 7, "trailing_stop_pct": None},
    "aggressive": {"leverage": 4.0, "min_confirmations": 5, "trailing_stop_pct": 0.05},
    "ai-pick": {"leverage": 2.0, "min_confirmations": None, "trailing_stop_pct": None},
    "buy-low-sell-high": {"leverage": 2.0, "min_confirmations": None, "trailing_stop_pct": None},
}


async def run_strategy(
    symbol: str,
    timeframe: str,
    mode: str,
    leverage_override: float | None,
    db: AsyncSession,
    current_user: User,
    run_type: str = "backtest",
) -> StrategyRun:
    """
    Main entry point for all strategy/backtest runs.
    Returns the persisted StrategyRun record.
    """
    defaults = MODE_DEFAULTS.get(mode, {})
    leverage = leverage_override if leverage_override is not None else defaults.get("leverage", 1.0)
    min_confirmations = defaults.get("min_confirmations")
    trailing_stop_pct = defaults.get("trailing_stop_pct")

    # Create StrategyRun record
    run = StrategyRun(
        user_id=current_user.id,
        run_type=run_type,
        mode_name=mode,
        symbol=symbol,
        timeframe=timeframe,
        leverage=leverage,
        min_confirmations=min_confirmations,
        trailing_stop_pct=trailing_stop_pct,
    )
    db.add(run)
    await db.flush()  # get run.id

    try:
        df = load_ohlcv_for_strategy(symbol, timeframe)

        if mode in ("conservative", "aggressive"):
            run = await _run_hmm_mode(run, df, mode, leverage, db, current_user)
        elif mode == "ai-pick":
            run = await _run_optimizer_mode(run, df, "ai_pick", leverage, db, current_user)
        elif mode == "buy-low-sell-high":
            run = await _run_optimizer_mode(
                run, df, "buy_low_sell_high", leverage, db, current_user
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Strategy run failed for run_id=%d: %s", run.id, exc)
        run.error_message = str(exc)  # type: ignore[assignment]

    await db.commit()
    await db.refresh(run)
    return run


async def _run_hmm_mode(
    run: StrategyRun,
    df,
    mode: str,
    leverage: float,
    db: AsyncSession,
    current_user: User,
) -> StrategyRun:
    """Run Conservative or Aggressive HMM strategy and save decisions + trades."""
    from app.strategies.aggressive import AggressiveStrategy
    from app.strategies.conservative import ConservativeStrategy

    strategy = ConservativeStrategy() if mode == "conservative" else AggressiveStrategy()
    result = strategy.generate_signals(df)

    # Update run with signal info
    run.current_regime = result.regime  # type: ignore[assignment]
    run.current_signal = result.signal  # type: ignore[assignment]
    run.confirmation_count = result.confirmation_count  # type: ignore[assignment]
    run.bull_state_id = result.bull_state_id  # type: ignore[assignment]
    run.bear_state_id = result.bear_state_id  # type: ignore[assignment]
    run.current_state_id = result.current_state_id  # type: ignore[assignment]

    # Store per-indicator confirmation details in notes as JSON for the signal check UI
    if result.confirmation_details:
        run.notes = json.dumps({"confirmation_details": result.confirmation_details, "reason": result.reason_summary})  # type: ignore[assignment]

    # Save per-bar TradeDecision records (up to last 100 bars to avoid bloat)
    bar_data = list(zip(result.bar_timestamps, result.signals_per_bar))[-100:]
    for ts, sig_info in bar_data:
        decision = TradeDecision(
            user_id=current_user.id,
            strategy_run_id=run.id,
            symbol=run.symbol,
            timeframe=run.timeframe,
            timestamp_of_bar=_to_utc(ts),
            regime=sig_info.get("regime"),
            signal=sig_info.get("signal"),
            confirmation_count=sig_info.get("confirmation_count"),
            entry_eligible=(sig_info.get("signal") == "buy"),
            cooldown_active=False,
            reason_summary=result.reason_summary,
        )
        db.add(decision)

    # Run backtest on the full data
    signals = result.signals_per_bar
    trailing_stop = strategy.trailing_stop_pct
    backtest_result = run_backtest(
        df=df.iloc[len(df) - len(signals) :],
        signals=signals,
        leverage=leverage,
        mode_name=mode,
        cooldown_bars=3,
        trailing_stop_pct=trailing_stop,
    )

    # Save BacktestTrade records
    for trade in backtest_result.all_trades:
        bt = BacktestTrade(
            user_id=current_user.id,
            strategy_run_id=run.id,
            entry_time=trade.entry_time,
            exit_time=trade.exit_time,
            entry_price=trade.entry_price,
            exit_price=trade.exit_price,
            return_pct=trade.return_pct,
            leveraged_return_pct=trade.leveraged_return_pct,
            pnl=trade.pnl,
            holding_hours=trade.holding_hours,
            exit_reason=trade.exit_reason,
            mode_name=mode,
        )
        db.add(bt)

    # Save single VariantBacktestResult for HMM modes
    vbr = VariantBacktestResult(
        user_id=current_user.id,
        strategy_run_id=run.id,
        mode_name=mode,
        variant_name=f"{mode}_default",
        family_name=mode,
        symbol=run.symbol,
        timeframe=run.timeframe,
        parameter_json=json.dumps({"leverage": leverage}),
        train_return=backtest_result.train_return,
        validation_return=backtest_result.validation_return,
        test_return=backtest_result.test_return,
        validation_score=backtest_result.validation_score,
        max_drawdown=backtest_result.max_drawdown,
        sharpe_like=backtest_result.sharpe_like,
        trade_count=backtest_result.trade_count,
        selected_winner=True,
    )
    db.add(vbr)

    return run


async def _run_optimizer_mode(
    run: StrategyRun,
    df,
    family: str,
    leverage: float,
    db: AsyncSession,
    current_user: User,
) -> StrategyRun:
    """Run AI Pick or Buy Low / Sell High optimizer, save results and artifact."""
    from app.optimizers.ai_pick_optimizer import AiPickOptimizer
    from app.optimizers.buy_low_sell_high_optimizer import BuyLowSellHighOptimizer

    optimizer = (
        AiPickOptimizer(leverage=leverage)
        if family == "ai_pick"
        else BuyLowSellHighOptimizer(leverage=leverage)
    )

    variant_results = optimizer.run_all(df)

    if not variant_results:
        run.error_message = "All optimizer variants failed."  # type: ignore[assignment]
        return run

    winner = variant_results[0]  # sorted by validation_score descending
    run.selected_variant_name = winner.variant_name  # type: ignore[assignment]
    run.selected_variant_score = winner.backtest.validation_score  # type: ignore[assignment]
    run.selected_variant_reason = (
        f"Highest validation_score={winner.backtest.validation_score:.4f} "
        f"(val_return={winner.backtest.validation_return:.2f}%, "
        f"max_dd={winner.backtest.max_drawdown:.2f}%)"
    )  # type: ignore[assignment]

    # Save all variant results
    for i, vr in enumerate(variant_results):
        bt = vr.backtest
        vbr = VariantBacktestResult(
            user_id=current_user.id,
            strategy_run_id=run.id,
            mode_name=run.mode_name,
            variant_name=vr.variant_name,
            family_name=vr.family_name,
            symbol=run.symbol,
            timeframe=run.timeframe,
            parameter_json=json.dumps(vr.parameters),
            train_return=bt.train_return,
            validation_return=bt.validation_return,
            test_return=bt.test_return,
            validation_score=bt.validation_score,
            max_drawdown=bt.max_drawdown,
            sharpe_like=bt.sharpe_like,
            trade_count=bt.trade_count,
            selected_winner=(i == 0),
        )
        db.add(vbr)

    # Save BacktestTrade records for winner only
    for trade in winner.backtest.all_trades:
        bt_trade = BacktestTrade(
            user_id=current_user.id,
            strategy_run_id=run.id,
            entry_time=trade.entry_time,
            exit_time=trade.exit_time,
            entry_price=trade.entry_price,
            exit_price=trade.exit_price,
            return_pct=trade.return_pct,
            leveraged_return_pct=trade.leveraged_return_pct,
            pnl=trade.pnl,
            holding_hours=trade.holding_hours,
            exit_reason=trade.exit_reason,
            mode_name=run.mode_name,
        )
        db.add(bt_trade)

    # Generate Pine Script artifact
    try:
        pine_code = generate_pine_script(winner, run.symbol)
        artifact = WinningStrategyArtifact(
            user_id=current_user.id,
            strategy_run_id=run.id,
            mode_name=run.mode_name,
            variant_name=winner.variant_name,
            symbol=run.symbol,
            pine_script_version="v5",
            pine_script_code=pine_code,
            notes=run.selected_variant_reason,
            selected_winner=True,
        )
        db.add(artifact)
    except Exception as exc:
        logger.warning("Pine Script generation failed for run_id=%d: %s", run.id, exc)

    return run


def _to_utc(ts) -> datetime | None:
    """Convert a pandas Timestamp or datetime to timezone-aware UTC."""
    try:
        if hasattr(ts, "to_pydatetime"):
            dt = ts.to_pydatetime()
        else:
            dt = ts
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None
