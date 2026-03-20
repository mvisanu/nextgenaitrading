"""
Backtesting engine.

- 60/20/20 train/validation/test split on OHLCV data
- Leverage compounding on returns
- Cooldown: no re-entry for N bars after exit
- Trailing stop: track highest price, exit when price drops X% from peak
- Returns BacktestResult with trade list and performance metrics
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class TradeRecord:
    entry_time: datetime | None
    exit_time: datetime | None
    entry_price: float
    exit_price: float
    return_pct: float
    leveraged_return_pct: float
    pnl: float
    holding_hours: float | None
    exit_reason: str
    mode_name: str


@dataclass
class SplitMetrics:
    total_return: float          # Compounded % return
    trade_count: int
    max_drawdown: float
    sharpe_like: float


@dataclass
class BacktestResult:
    mode_name: str
    train_metrics: SplitMetrics
    validation_metrics: SplitMetrics
    test_metrics: SplitMetrics
    all_trades: list[TradeRecord]
    validation_score: float       # validation_return / (1 + max_drawdown)
    # Convenience shortcuts
    train_return: float = 0.0
    validation_return: float = 0.0
    test_return: float = 0.0
    max_drawdown: float = 0.0
    sharpe_like: float = 0.0
    trade_count: int = 0

    def __post_init__(self) -> None:
        self.train_return = self.train_metrics.total_return
        self.validation_return = self.validation_metrics.total_return
        self.test_return = self.test_metrics.total_return
        self.max_drawdown = self.validation_metrics.max_drawdown
        self.sharpe_like = self.validation_metrics.sharpe_like
        self.trade_count = len(self.all_trades)


def _compute_metrics(trades: list[TradeRecord], leverage: float) -> SplitMetrics:
    if not trades:
        return SplitMetrics(total_return=0.0, trade_count=0, max_drawdown=0.0, sharpe_like=0.0)

    returns = [t.return_pct / 100.0 for t in trades]
    leveraged = [r * leverage for r in returns]

    # Compounded equity curve
    equity = 1.0
    peak = 1.0
    max_dd = 0.0
    equity_curve = []
    for r in leveraged:
        equity *= (1 + r)
        equity_curve.append(equity)
        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak
        if dd > max_dd:
            max_dd = dd

    total_return = (equity - 1.0) * 100.0

    # Sharpe-like: mean(leveraged_returns) / std(leveraged_returns)
    arr = np.array(leveraged)
    sharpe = float(arr.mean() / arr.std()) if arr.std() > 0 else 0.0

    return SplitMetrics(
        total_return=total_return,
        trade_count=len(trades),
        max_drawdown=max_dd * 100.0,
        sharpe_like=sharpe,
    )


def _simulate_split(
    df: pd.DataFrame,
    signals: list[dict],
    leverage: float,
    cooldown_bars: int,
    trailing_stop_pct: float | None,
    mode_name: str,
) -> list[TradeRecord]:
    """
    Simulate trades on a price series given a list of per-bar signals.
    signals: list of {"signal": "buy"|"sell"|"hold", "regime": str}
    """
    trades: list[TradeRecord] = []
    in_position = False
    entry_price = 0.0
    entry_time: datetime | None = None
    highest_price = 0.0
    cooldown_remaining = 0

    prices = df["Close"].values
    timestamps = df.index.tolist()

    n = min(len(prices), len(signals))

    for i in range(n):
        price = float(prices[i])
        sig = signals[i].get("signal", "hold")
        ts = timestamps[i]
        ts_dt = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts

        if cooldown_remaining > 0:
            cooldown_remaining -= 1

        if in_position:
            if price > highest_price:
                highest_price = price

            # Trailing stop check
            exit_reason = None
            if trailing_stop_pct and highest_price > 0:
                stop_price = highest_price * (1 - trailing_stop_pct)
                if price <= stop_price:
                    exit_reason = "trailing_stop"

            # Signal-based exit
            if sig == "sell" and exit_reason is None:
                exit_reason = "signal"

            if exit_reason:
                ret = (price - entry_price) / entry_price
                lev_ret = ret * leverage
                holding = None
                if entry_time and ts_dt:
                    try:
                        delta = ts_dt - entry_time
                        holding = delta.total_seconds() / 3600.0
                    except Exception:
                        pass
                trades.append(
                    TradeRecord(
                        entry_time=entry_time,
                        exit_time=ts_dt,
                        entry_price=entry_price,
                        exit_price=price,
                        return_pct=ret * 100.0,
                        leveraged_return_pct=lev_ret * 100.0,
                        pnl=lev_ret * 100.0,  # relative to 1 unit
                        holding_hours=holding,
                        exit_reason=exit_reason,
                        mode_name=mode_name,
                    )
                )
                in_position = False
                cooldown_remaining = cooldown_bars
        else:
            if sig == "buy" and cooldown_remaining == 0:
                in_position = True
                entry_price = price
                entry_time = ts_dt
                highest_price = price

    # Close any open position at last bar
    if in_position and n > 0:
        price = float(prices[n - 1])
        ts_dt = timestamps[n - 1]
        ts_dt = ts_dt.to_pydatetime() if hasattr(ts_dt, "to_pydatetime") else ts_dt
        ret = (price - entry_price) / entry_price
        lev_ret = ret * leverage
        trades.append(
            TradeRecord(
                entry_time=entry_time,
                exit_time=ts_dt,
                entry_price=entry_price,
                exit_price=price,
                return_pct=ret * 100.0,
                leveraged_return_pct=lev_ret * 100.0,
                pnl=lev_ret * 100.0,
                holding_hours=None,
                exit_reason="end_of_data",
                mode_name=mode_name,
            )
        )

    return trades


def run_backtest(
    df: pd.DataFrame,
    signals: list[dict],
    leverage: float,
    mode_name: str,
    cooldown_bars: int = 3,
    trailing_stop_pct: float | None = None,
) -> BacktestResult:
    """
    Run a full 60/20/20 backtests on OHLCV data + precomputed signals.

    df and signals must be aligned (same length and order).
    """
    n = min(len(df), len(signals))
    if n < 10:
        empty = SplitMetrics(total_return=0.0, trade_count=0, max_drawdown=0.0, sharpe_like=0.0)
        return BacktestResult(
            mode_name=mode_name,
            train_metrics=empty,
            validation_metrics=empty,
            test_metrics=empty,
            all_trades=[],
            validation_score=0.0,
        )

    train_end = int(n * 0.60)
    val_end = int(n * 0.80)

    splits = {
        "train": (df.iloc[:train_end], signals[:train_end]),
        "validation": (df.iloc[train_end:val_end], signals[train_end:val_end]),
        "test": (df.iloc[val_end:], signals[val_end:]),
    }

    all_trades: list[TradeRecord] = []
    split_trades: dict[str, list[TradeRecord]] = {}

    for split_name, (split_df, split_sigs) in splits.items():
        t = _simulate_split(
            split_df,
            split_sigs,
            leverage=leverage,
            cooldown_bars=cooldown_bars,
            trailing_stop_pct=trailing_stop_pct,
            mode_name=mode_name,
        )
        split_trades[split_name] = t
        all_trades.extend(t)

    train_metrics = _compute_metrics(split_trades["train"], leverage)
    val_metrics = _compute_metrics(split_trades["validation"], leverage)
    test_metrics = _compute_metrics(split_trades["test"], leverage)

    # validation_score = validation_return / (1 + max_drawdown)
    val_score = val_metrics.total_return / (1.0 + val_metrics.max_drawdown / 100.0 + 1e-9)

    return BacktestResult(
        mode_name=mode_name,
        train_metrics=train_metrics,
        validation_metrics=val_metrics,
        test_metrics=test_metrics,
        all_trades=all_trades,
        validation_score=val_score,
    )
