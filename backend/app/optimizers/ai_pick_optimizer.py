"""
AI Pick Optimizer
- Indicator search: MACD + RSI + EMA variants
- Max 12 variants (TASKS.md OQ-04)
- Ranks by validation_score = validation_return / (1 + max_drawdown)
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import ta

from app.backtesting.engine import BacktestResult, run_backtest
from app.optimizers.base import BaseOptimizer, VariantResult

# Variant grid constants — 12 combinations
MACD_FAST = [8, 12]
MACD_SLOW = [21, 26]
RSI_WINDOWS = [10, 14]
EMA_SHORT = [10, 20]
EMA_LONG = [50, 100]
RSI_OVERSOLD = [30, 35]

MAX_VARIANTS = 12


def _generate_signals_for_params(df: pd.DataFrame, params: dict) -> list[dict]:
    """Generate buy/sell/hold signals for a set of indicator parameters."""
    df = df.copy()
    close = df["Close"]

    macd_ind = ta.trend.MACD(
        close,
        window_fast=params["macd_fast"],
        window_slow=params["macd_slow"],
        window_sign=9,
    )
    df["macd"] = macd_ind.macd()
    df["macd_signal"] = macd_ind.macd_signal()

    df["rsi"] = ta.momentum.RSIIndicator(close, window=params["rsi_window"]).rsi()
    df["ema_short"] = ta.trend.EMAIndicator(close, window=params["ema_short"]).ema_indicator()
    df["ema_long"] = ta.trend.EMAIndicator(close, window=params["ema_long"]).ema_indicator()

    df.dropna(inplace=True)

    signals = []
    for i in range(len(df)):
        row = df.iloc[i]
        buy = (
            row["macd"] > row["macd_signal"]
            and row["rsi"] < params["rsi_oversold"] + 20  # not overbought
            and row["ema_short"] > row["ema_long"]
        )
        sell = (
            row["macd"] < row["macd_signal"]
            or row["rsi"] > 70
            or row["ema_short"] < row["ema_long"]
        )
        if buy:
            sig = "buy"
        elif sell:
            sig = "sell"
        else:
            sig = "hold"
        signals.append({"signal": sig, "regime": "computed"})

    return signals


class AiPickOptimizer(BaseOptimizer):
    MAX_VARIANTS = 12

    def __init__(self, leverage: float = 2.0) -> None:
        self.leverage = leverage

    @property
    def family_name(self) -> str:
        return "ai_pick"

    def generate_variants(self) -> list[dict]:
        variants = []
        for mf in MACD_FAST:
            for rs in RSI_WINDOWS:
                for es in EMA_SHORT:
                    for oversold in RSI_OVERSOLD:
                        if len(variants) >= MAX_VARIANTS:
                            break
                        variants.append(
                            {
                                "macd_fast": mf,
                                "macd_slow": 26 if mf == 12 else 21,
                                "rsi_window": rs,
                                "ema_short": es,
                                "ema_long": 100 if es == 20 else 50,
                                "rsi_oversold": oversold,
                            }
                        )
        return variants[:MAX_VARIANTS]

    def run_variant(
        self, df: pd.DataFrame, params: dict, variant_name: str
    ) -> VariantResult:
        signals = _generate_signals_for_params(df, params)
        # Align df to match signals length (dropna inside signal generator)
        aligned_df = df.iloc[len(df) - len(signals) :].reset_index(drop=False)
        aligned_df.set_index(aligned_df.columns[0], inplace=True)

        result = run_backtest(
            df=aligned_df,
            signals=signals,
            leverage=self.leverage,
            mode_name="ai-pick",
            cooldown_bars=3,
        )
        return VariantResult(
            variant_name=variant_name,
            family_name=self.family_name,
            parameters=params,
            backtest=result,
        )
