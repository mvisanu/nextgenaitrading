"""
Buy Low / Sell High Optimizer
- Dip/cycle strategy variants using RSI oversold + Bollinger band dip logic
- Max 8 variants (TASKS.md OQ-04)
- Ranks by validation_score = validation_return / (1 + max_drawdown)
"""
from __future__ import annotations

import pandas as pd
import ta

from app.backtesting.engine import run_backtest
from app.optimizers.base import BaseOptimizer, VariantResult

MAX_VARIANTS = 8

# Parameter grid for dip/cycle variants
RSI_OVERSOLD_LEVELS = [25, 30, 35, 40]
BB_WINDOW = [14, 20]
CYCLE_HOLD_BARS = [5, 10]


def _generate_blsh_signals(df: pd.DataFrame, params: dict) -> list[dict]:
    """
    Buy Low / Sell High signal logic:
    - BUY: RSI < oversold threshold AND price < lower Bollinger band (dip entry)
    - SELL: RSI > 65 OR price > upper Bollinger band (cycle top exit)
    - HOLD: otherwise
    """
    df = df.copy()
    close = df["Close"]

    df["rsi"] = ta.momentum.RSIIndicator(close, window=14).rsi()
    bb = ta.volatility.BollingerBands(close, window=params["bb_window"])
    df["bb_lower"] = bb.bollinger_lband()
    df["bb_upper"] = bb.bollinger_hband()

    df.dropna(inplace=True)

    signals = []
    hold_remaining = 0

    for i in range(len(df)):
        row = df.iloc[i]

        if hold_remaining > 0:
            hold_remaining -= 1
            signals.append({"signal": "hold", "regime": "computed"})
            continue

        buy = row["rsi"] < params["rsi_oversold"] and row["Close"] < row["bb_lower"]
        sell = row["rsi"] > 65 or row["Close"] > row["bb_upper"]

        if buy:
            signals.append({"signal": "buy", "regime": "dip"})
            hold_remaining = params["cycle_hold_bars"]
        elif sell:
            signals.append({"signal": "sell", "regime": "top"})
        else:
            signals.append({"signal": "hold", "regime": "neutral"})

    return signals


class BuyLowSellHighOptimizer(BaseOptimizer):
    MAX_VARIANTS = 8

    def __init__(self, leverage: float = 2.0) -> None:
        self.leverage = leverage

    @property
    def family_name(self) -> str:
        return "buy_low_sell_high"

    def generate_variants(self) -> list[dict]:
        variants = []
        for oversold in RSI_OVERSOLD_LEVELS:
            for bbw in BB_WINDOW:
                for hold in CYCLE_HOLD_BARS:
                    if len(variants) >= MAX_VARIANTS:
                        break
                    variants.append(
                        {
                            "rsi_oversold": oversold,
                            "bb_window": bbw,
                            "cycle_hold_bars": hold,
                        }
                    )
        return variants[:MAX_VARIANTS]

    def run_variant(
        self, df: pd.DataFrame, params: dict, variant_name: str
    ) -> VariantResult:
        signals = _generate_blsh_signals(df, params)
        aligned_df = df.iloc[len(df) - len(signals) :].reset_index(drop=False)
        aligned_df.set_index(aligned_df.columns[0], inplace=True)

        result = run_backtest(
            df=aligned_df,
            signals=signals,
            leverage=self.leverage,
            mode_name="buy-low-sell-high",
            cooldown_bars=2,
        )
        return VariantResult(
            variant_name=variant_name,
            family_name=self.family_name,
            parameters=params,
            backtest=result,
        )
