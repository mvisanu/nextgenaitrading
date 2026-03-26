"""
Bollinger Band Squeeze Strategy

Detects volatility compression (squeeze) and breakout direction.
Uses the same HMM regime detection as Conservative/Aggressive, but adds
Bollinger squeeze-specific confirmations:
  1. BB width percentile (squeeze tightness)
  2. Squeeze active (width <= 15th percentile)
  3. EMA 20 > EMA 50 (uptrend)
  4. Volume confirmation (> 80% of 20-bar avg)
  5. ADX trending (> 20)
  6. RSI not overbought (< 70)
  7. Breakout direction (close above upper BB after squeeze)
  8. OBV increasing

Signal logic:
  - BUY if bull regime + squeeze breakout bullish + >= 6/8 confirmations
  - SELL if bear regime + bearish breakout
  - HOLD otherwise (squeeze forming = "wait for breakout")
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from app.strategies.base import BaseStrategy, SignalResult
from app.strategies.conservative import (
    _add_indicators,
    _identify_bull_bear,
    _safe_fit_hmm,
)
from app.services.bollinger_squeeze_service import (
    compute_bollinger_bands,
    compute_squeeze_analysis,
    detect_squeeze,
)

logger = logging.getLogger(__name__)

SQUEEZE_CONFIRMATION_LABELS = [
    "RSI < 70 (not overbought)",
    "EMA 20 > EMA 50 (uptrend)",
    "ADX > 20 (trending)",
    "Volume > 80% of 20-bar avg",
    "OBV increasing",
    "BB Squeeze active",
    "Breakout direction (bullish)",
    "Breakout volume confirmed",
]


def _add_squeeze_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Extend the standard indicators with Bollinger squeeze columns."""
    df = _add_indicators(df)
    bb = compute_bollinger_bands(df["Close"])
    for col in bb.columns:
        df[col] = bb[col]
    df.dropna(inplace=True)
    return df


def _compute_squeeze_confirmations(
    df: pd.DataFrame, row_idx: int, squeeze_data: dict
) -> tuple[int, list[bool]]:
    """
    Compute 8 binary squeeze-specific confirmation signals.
    Returns (count_true, list_of_booleans).
    """
    row = df.iloc[row_idx]
    confirms = []

    # 1. RSI < 70
    rsi_val = row.get("rsi", 50.0)
    confirms.append(bool(rsi_val < 70))

    # 2. EMA 20 > EMA 50
    ema20 = row.get("ema_20", row["Close"])
    ema50 = row.get("ema_50", row["Close"])
    confirms.append(bool(ema20 > ema50))

    # 3. ADX > 20
    adx_val = row.get("adx", 0.0)
    confirms.append(bool(adx_val > 20))

    # 4. Volume > 80% of 20-bar avg
    vol_ratio = row.get("vol_ratio", 1.0)
    confirms.append(bool(vol_ratio > 0.8))

    # 5. OBV increasing
    obv_diff = row.get("obv_diff", 0.0)
    confirms.append(bool(obv_diff > 0))

    # 6. Squeeze active
    confirms.append(bool(squeeze_data["is_squeeze"]))

    # 7. Bullish breakout
    confirms.append(bool(squeeze_data["breakout_state"] == "bullish"))

    # 8. Breakout volume confirmed
    confirms.append(bool(squeeze_data["breakout_confirmed"]))

    return sum(confirms), confirms


def compute_squeeze_confirmation_details(
    df: pd.DataFrame, row_idx: int, squeeze_data: dict
) -> list[dict]:
    """Return detailed per-indicator results for the signal check UI."""
    row = df.iloc[row_idx]
    details = []

    rsi_val = row.get("rsi", 50.0)
    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[0],
        "met": bool(rsi_val < 70),
        "value": f"RSI = {rsi_val:.1f}",
    })

    ema20 = row.get("ema_20", row["Close"])
    ema50 = row.get("ema_50", row["Close"])
    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[1],
        "met": bool(ema20 > ema50),
        "value": f"EMA20 = {ema20:.2f}, EMA50 = {ema50:.2f}",
    })

    adx_val = row.get("adx", 0.0)
    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[2],
        "met": bool(adx_val > 20),
        "value": f"ADX = {adx_val:.1f}",
    })

    vol_ratio = row.get("vol_ratio", 1.0)
    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[3],
        "met": bool(vol_ratio > 0.8),
        "value": f"Vol ratio = {vol_ratio:.2f}x",
    })

    obv_diff = row.get("obv_diff", 0.0)
    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[4],
        "met": bool(obv_diff > 0),
        "value": f"OBV diff = {obv_diff:,.0f}",
    })

    pct = squeeze_data["bb_width_percentile"]
    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[5],
        "met": squeeze_data["is_squeeze"],
        "value": f"Width pctl = {pct:.1f}% (squeeze ≤ 15%)",
    })

    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[6],
        "met": squeeze_data["breakout_state"] == "bullish",
        "value": f"Breakout = {squeeze_data['breakout_state']}",
    })

    details.append({
        "name": SQUEEZE_CONFIRMATION_LABELS[7],
        "met": squeeze_data["breakout_confirmed"],
        "value": "Vol > avg" if squeeze_data["breakout_confirmed"] else "Not confirmed",
    })

    return details


class BollingerSqueezeStrategy(BaseStrategy):
    leverage = 2.5
    min_confirmations = 6
    trailing_stop_pct = None

    def generate_signals(self, df: pd.DataFrame) -> SignalResult:
        df = _add_squeeze_indicators(df)

        if len(df) < 60:
            return SignalResult(
                regime="unknown",
                signal="hold",
                confirmation_count=0,
                entry_eligible=False,
                cooldown_active=False,
                reason_summary="Insufficient data for analysis",
            )

        # HMM regime detection (same as conservative/aggressive)
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

        # Squeeze analysis on current bar
        squeeze_data = compute_squeeze_analysis(df, -1)

        conf_count, conf_list = _compute_squeeze_confirmations(df, -1, squeeze_data)
        conf_details = compute_squeeze_confirmation_details(df, -1, squeeze_data)

        # Signal logic
        entry_eligible = (
            regime == "bull"
            and squeeze_data["is_squeeze"]
            and conf_count >= self.min_confirmations
        )

        signal: str
        if entry_eligible and squeeze_data["breakout_state"] == "bullish":
            signal = "buy"
        elif squeeze_data["breakout_state"] == "bearish" and regime == "bear":
            signal = "sell"
        elif squeeze_data["is_squeeze"]:
            signal = "hold"  # squeeze forming, wait for breakout
        else:
            signal = "hold"

        # Descriptive reason
        squeeze_desc = "active" if squeeze_data["is_squeeze"] else "inactive"
        breakout_desc = squeeze_data["breakout_state"]
        reason = (
            f"BB Squeeze {squeeze_desc} (pctl={squeeze_data['bb_width_percentile']:.1f}%), "
            f"breakout={breakout_desc}, regime={regime}, confirms={conf_count}/{len(conf_list)}"
        )

        # Per-bar signals
        bar_timestamps = []
        signals_per_bar = []
        for i, (state, ts) in enumerate(zip(states, df.index)):
            r = "bull" if state == bull_state else "bear"
            sq = compute_squeeze_analysis(df, i)
            cc, _ = _compute_squeeze_confirmations(df, i, sq)
            is_buy = (
                r == "bull"
                and sq["is_squeeze"]
                and sq["breakout_state"] == "bullish"
                and cc >= self.min_confirmations
            )
            s = "buy" if is_buy else ("sell" if r == "bear" and sq["breakout_state"] == "bearish" else "hold")
            bar_timestamps.append(ts)
            signals_per_bar.append({"regime": r, "signal": s, "confirmation_count": cc})

        return SignalResult(
            regime=regime,
            signal=signal,
            confirmation_count=conf_count,
            entry_eligible=entry_eligible,
            cooldown_active=False,
            reason_summary=reason,
            confirmation_details=conf_details,
            bull_state_id=bull_state,
            bear_state_id=bear_state,
            current_state_id=current_state,
            bar_timestamps=bar_timestamps,
            signals_per_bar=signals_per_bar,
        )
