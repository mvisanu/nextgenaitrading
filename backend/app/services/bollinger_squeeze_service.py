"""
Bollinger Band Squeeze detection service.

Pure calculation utilities — no API or DB dependencies.
Computes Bollinger Bands, band width, percentile ranking,
squeeze detection, and breakout state.
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Default parameters ─────────────────────────────────────────────────────────

BB_LENGTH = 20
BB_MULTIPLIER = 2.0
LOOKBACK_BARS = 120
SQUEEZE_PERCENTILE = 15  # squeeze when width <= 15th percentile of lookback


def compute_bollinger_bands(
    close: pd.Series,
    length: int = BB_LENGTH,
    multiplier: float = BB_MULTIPLIER,
) -> pd.DataFrame:
    """
    Compute Bollinger Bands, band width, and width percentile.

    Returns DataFrame with columns:
        bb_middle, bb_upper, bb_lower, bb_width, bb_width_pct, bb_width_percentile
    """
    middle = close.rolling(window=length, min_periods=length).mean()
    std = close.rolling(window=length, min_periods=length).std(ddof=0)

    upper = middle + (std * multiplier)
    lower = middle - (std * multiplier)

    # Band width as percentage of middle band (avoid divide-by-zero)
    bb_width = upper - lower
    bb_width_pct = np.where(middle > 0, (bb_width / middle) * 100, 0.0)

    # Rolling percentile ranking of band width
    bb_width_series = pd.Series(bb_width_pct, index=close.index)
    bb_width_percentile = bb_width_series.rolling(
        window=LOOKBACK_BARS, min_periods=min(LOOKBACK_BARS, 30)
    ).apply(_percentile_rank, raw=True)

    return pd.DataFrame({
        "bb_middle": middle,
        "bb_upper": upper,
        "bb_lower": lower,
        "bb_width": bb_width,
        "bb_width_pct": bb_width_pct,
        "bb_width_percentile": bb_width_percentile,
    }, index=close.index)


def _percentile_rank(values: np.ndarray) -> float:
    """Percentile rank of the last value in the window."""
    if len(values) < 2:
        return 50.0
    current = values[-1]
    count_below = np.sum(values[:-1] < current)
    return (count_below / (len(values) - 1)) * 100


def detect_squeeze(
    bb_width_percentile: float,
    threshold: float = SQUEEZE_PERCENTILE,
) -> bool:
    """Squeeze is active when band width is at or below the threshold percentile."""
    if np.isnan(bb_width_percentile):
        return False
    return bb_width_percentile <= threshold


def compute_squeeze_strength(bb_width_percentile: float) -> float:
    """
    Squeeze strength score 0-100 (higher = tighter squeeze).
    Maps percentile inversely: percentile 0 → strength 100, percentile 15 → strength ~80.
    Returns 0 if not in squeeze territory (percentile > SQUEEZE_PERCENTILE).
    """
    if np.isnan(bb_width_percentile) or bb_width_percentile > SQUEEZE_PERCENTILE:
        return 0.0
    # Linear mapping: 0 percentile = 100 strength, SQUEEZE_PERCENTILE = 50 strength
    return max(0.0, 100.0 - (bb_width_percentile / SQUEEZE_PERCENTILE) * 50.0)


def detect_breakout(
    df: pd.DataFrame,
    row_idx: int,
) -> dict:
    """
    Detect breakout direction after a squeeze.

    Returns dict with:
        breakout_state: 'none' | 'bullish' | 'bearish'
        breakout_confirmed: bool
        bars_since_squeeze: int
    """
    row = df.iloc[row_idx]
    close = row["Close"]
    bb_upper = row.get("bb_upper", 0.0)
    bb_lower = row.get("bb_lower", 0.0)

    # Check if squeeze was active in recent bars (look back up to 10 bars)
    squeeze_was_active = False
    bars_since = 0
    start = max(0, row_idx - 10)
    for i in range(row_idx - 1, start - 1, -1):
        pct = df.iloc[i].get("bb_width_percentile", 50.0)
        if not np.isnan(pct) and pct <= SQUEEZE_PERCENTILE:
            squeeze_was_active = True
            bars_since = row_idx - i
            break

    if not squeeze_was_active:
        return {
            "breakout_state": "none",
            "breakout_confirmed": False,
            "bars_since_squeeze": 0,
        }

    # Breakout detection
    breakout_state = "none"
    breakout_confirmed = False

    if close > bb_upper and bb_upper > 0:
        breakout_state = "bullish"
        # Volume confirmation: current volume > 20-bar average
        vol_ratio = row.get("vol_ratio", 1.0)
        breakout_confirmed = bool(vol_ratio > 1.0)
    elif close < bb_lower and bb_lower > 0:
        breakout_state = "bearish"
        vol_ratio = row.get("vol_ratio", 1.0)
        breakout_confirmed = bool(vol_ratio > 1.0)

    return {
        "breakout_state": breakout_state,
        "breakout_confirmed": breakout_confirmed,
        "bars_since_squeeze": bars_since,
    }


def compute_squeeze_analysis(df: pd.DataFrame, row_idx: int = -1) -> dict:
    """
    Full squeeze analysis for a single bar.

    Expects df to already have bb_upper, bb_lower, bb_width_pct, bb_width_percentile columns
    (from _add_indicators or compute_bollinger_bands).

    Returns a dict suitable for API serialization.
    """
    row = df.iloc[row_idx]

    bb_width_pct = float(row.get("bb_width_pct", 0.0))
    bb_width_percentile = float(row.get("bb_width_percentile", 50.0))
    is_squeeze = detect_squeeze(bb_width_percentile)
    squeeze_strength = compute_squeeze_strength(bb_width_percentile)
    breakout = detect_breakout(df, row_idx if row_idx >= 0 else len(df) + row_idx)

    return {
        "bb_upper": float(row.get("bb_upper", 0.0)),
        "bb_lower": float(row.get("bb_lower", 0.0)),
        "bb_middle": float(row.get("bb_middle", 0.0)),
        "bb_width_pct": round(bb_width_pct, 4),
        "bb_width_percentile": round(bb_width_percentile, 1),
        "is_squeeze": is_squeeze,
        "squeeze_strength": round(squeeze_strength, 1),
        "breakout_state": breakout["breakout_state"],
        "breakout_confirmed": breakout["breakout_confirmed"],
        "bars_since_squeeze": breakout["bars_since_squeeze"],
    }
