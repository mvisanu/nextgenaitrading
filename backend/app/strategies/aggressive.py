"""
Aggressive Strategy
- Leverage: 4.0x
- Min confirmations: 5 out of 8 indicators
- Trailing stop: 5%
- Uses the same HMM + indicator logic as Conservative, with relaxed confirmation gate
"""
from __future__ import annotations

import pandas as pd

from app.strategies.base import BaseStrategy, SignalResult
from app.strategies.conservative import (
    _add_indicators,
    _compute_confirmations,
    _identify_bull_bear,
    _safe_fit_hmm,
)
import logging

logger = logging.getLogger(__name__)


class AggressiveStrategy(BaseStrategy):
    leverage = 4.0
    min_confirmations = 5
    trailing_stop_pct = 0.05

    def generate_signals(self, df: pd.DataFrame) -> SignalResult:
        df = _add_indicators(df)

        if len(df) < 60:
            return SignalResult(
                regime="unknown",
                signal="hold",
                confirmation_count=0,
                entry_eligible=False,
                cooldown_active=False,
                reason_summary="Insufficient data for HMM fitting",
            )

        features = df[["log_returns", "atr", "vol_ratio"]].values
        try:
            model, scaler = _safe_fit_hmm(features)
        except Exception as exc:
            logger.warning("HMM fit failed: %s", exc)
            return SignalResult(
                regime="unknown",
                signal="hold",
                confirmation_count=0,
                entry_eligible=False,
                cooldown_active=False,
                reason_summary=f"HMM fitting error: {exc}",
            )

        scaled_features = scaler.transform(features)
        states = model.predict(scaled_features)
        bull_state, bear_state = _identify_bull_bear(model, scaled_features)

        current_state = int(states[-1])
        regime = "bull" if current_state == bull_state else "bear"

        conf_count, conf_list = _compute_confirmations(df, -1)
        entry_eligible = regime == "bull" and conf_count >= self.min_confirmations

        signal: str
        if entry_eligible:
            signal = "buy"
        elif regime == "bear":
            signal = "sell"
        else:
            signal = "hold"

        bar_timestamps = []
        signals_per_bar = []
        for i, (state, ts) in enumerate(zip(states, df.index)):
            r = "bull" if state == bull_state else "bear"
            cc, _ = _compute_confirmations(df, i)
            s = "buy" if (r == "bull" and cc >= self.min_confirmations) else ("sell" if r == "bear" else "hold")
            bar_timestamps.append(ts)
            signals_per_bar.append({"regime": r, "signal": s, "confirmation_count": cc})

        return SignalResult(
            regime=regime,
            signal=signal,
            confirmation_count=conf_count,
            entry_eligible=entry_eligible,
            cooldown_active=False,
            reason_summary=(
                f"HMM regime={regime}, confirmations={conf_count}/{len(conf_list)}, "
                f"trailing_stop={self.trailing_stop_pct*100:.0f}%"
            ),
            bull_state_id=bull_state,
            bear_state_id=bear_state,
            current_state_id=current_state,
            bar_timestamps=bar_timestamps,
            signals_per_bar=signals_per_bar,
        )
