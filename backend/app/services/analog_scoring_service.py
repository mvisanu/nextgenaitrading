"""
Historical Analog Scoring Service.

Finds historical windows in OHLCV data with a multi-factor state similar to the
current market state, then computes forward return distributions.

All functions are pure (no DB, no network) — inject external dependencies as parameters.

LANGUAGE RULE: Never use "guaranteed", "safe", "certain". Use "historically favorable",
"positive outcome rate", "scenario-based estimate". See prompt-feature.md Language Rules.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Minimum number of analog matches required to produce a meaningful score.
# Below this threshold, confidence is capped at 0.40.
MIN_ANALOG_MATCHES = 5


@dataclass
class AnalogMatch:
    """A single historical window that resembles the current market state."""
    index: int  # position in the DataFrame
    similarity_score: float  # 0.0–1.0; higher = more similar
    forward_return_5d: Optional[float]
    forward_return_20d: Optional[float]
    forward_return_60d: Optional[float]
    forward_return_120d: Optional[float]


@dataclass
class AnalogScoringResult:
    """Aggregated forward-return statistics from analog matches."""
    analog_count: int
    median_return_20d: float
    median_return_60d: float
    positive_rate_20d: float   # fraction of analogs with positive 20d return
    positive_rate_60d: float   # fraction of analogs with positive 60d return
    median_mae: float           # median max adverse excursion
    win_rate_score: float       # 0.0–1.0 sub-score for buy zone scoring
    explanation: str            # one explanation string for the buy zone pipeline


def _compute_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Compute RSI without external dependencies."""
    delta = prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    # When avg_loss == 0 (all gains), RSI is 100; handle with fillna after division
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    # Pure uptrend: avg_loss=0, rs=NaN → RSI should be 100
    rsi = rsi.where(avg_loss != 0, 100.0)
    return rsi


def _compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range."""
    high_low = df["High"] - df["Low"]
    high_prev = (df["High"] - df["Close"].shift(1)).abs()
    low_prev = (df["Low"] - df["Close"].shift(1)).abs()
    tr = pd.concat([high_low, high_prev, low_prev], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, min_periods=period).mean()


def _compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute the multi-factor feature vector for each bar.
    Features used for analog matching:
      - rsi_band: bucketed RSI (0=oversold<30, 1=neutral 30-70, 2=overbought>70)
      - atr_ratio: ATR / Close (normalised volatility)
      - trend_slope: 50-bar linear regression slope (normalised)
      - pullback_depth: (Close - 20-bar high) / (20-bar high) — negative means pullback
    """
    closes = df["Close"]
    highs = df["High"]

    rsi = _compute_rsi(closes, 14)
    atr = _compute_atr(df, 14)

    # ATR ratio: normalised volatility
    atr_ratio = atr / closes.replace(0, np.nan)

    # 50-bar trend slope using linear regression
    def rolling_slope(series: pd.Series, window: int) -> pd.Series:
        slopes = pd.Series(index=series.index, dtype=float)
        x = np.arange(window)
        for i in range(window, len(series) + 1):
            y = series.iloc[i - window: i].values
            if len(y) == window and not np.isnan(y).any():
                slope = np.polyfit(x, y, 1)[0]
                # Normalise by price level
                slopes.iloc[i - 1] = slope / y[-1]
            else:
                slopes.iloc[i - 1] = np.nan
        return slopes

    # Use simpler EMA-based trend approximation for performance
    ema50 = closes.ewm(span=50, min_periods=50).mean()
    trend_slope = (closes - ema50) / ema50.replace(0, np.nan)

    # Pullback depth: current close vs 20-bar rolling high
    rolling_high_20 = highs.rolling(20).max()
    pullback_depth = (closes - rolling_high_20) / rolling_high_20.replace(0, np.nan)

    features = pd.DataFrame(
        {
            "rsi": rsi,
            "atr_ratio": atr_ratio,
            "trend_slope": trend_slope,
            "pullback_depth": pullback_depth,
        },
        index=df.index,
    )
    return features.dropna()


def find_analog_matches(
    df: pd.DataFrame,
    lookback_bars: int = 252 * 5,  # 5 years of daily bars
    top_n: int = 20,
) -> list[AnalogMatch]:
    """
    Find the top_n historical windows most similar to the current bar.

    Similarity is measured as the inverse Euclidean distance in the 4-factor
    feature space (RSI, ATR ratio, trend slope, pullback depth), each
    standardised to zero mean / unit variance before distance computation.

    Returns at most top_n matches. The most recent bar (current state) is
    excluded from the search window.
    """
    if len(df) < 60:
        logger.warning("Insufficient data for analog scoring: %d bars", len(df))
        return []

    features = _compute_features(df)
    if len(features) < 10:
        return []

    current_idx = features.index[-1]
    current_vec = features.loc[current_idx].values

    # Standardise features using the full history (excluding current bar)
    historical = features.iloc[:-1]
    if len(historical) < MIN_ANALOG_MATCHES:
        return []

    mu = historical.mean()
    sigma = historical.std().replace(0, 1e-9)
    current_norm = (current_vec - mu.values) / sigma.values
    hist_norm = (historical - mu) / sigma

    # Euclidean distance in standardised space
    diffs = hist_norm.values - current_norm
    distances = np.linalg.norm(diffs, axis=1)
    sorted_indices = np.argsort(distances)[:top_n]

    closes = df["Close"]
    results: list[AnalogMatch] = []

    for pos in sorted_indices:
        bar_idx = historical.index[pos]
        loc = df.index.get_loc(bar_idx)
        sim = float(1.0 / (1.0 + distances[pos]))

        def _fwd_return(days: int) -> Optional[float]:
            target = loc + days
            if target >= len(df):
                return None
            entry_price = float(closes.iloc[loc])
            if entry_price == 0:
                return None
            return float((closes.iloc[target] - entry_price) / entry_price * 100)

        results.append(
            AnalogMatch(
                index=loc,
                similarity_score=sim,
                forward_return_5d=_fwd_return(5),
                forward_return_20d=_fwd_return(20),
                forward_return_60d=_fwd_return(60),
                forward_return_120d=_fwd_return(120),
            )
        )

    return results


def score_analogs(matches: list[AnalogMatch]) -> AnalogScoringResult:
    """
    Aggregate forward return statistics from analog matches into a sub-score.

    Returns AnalogScoringResult with:
    - median returns at 20d and 60d
    - positive outcome rates at 20d and 60d
    - median max adverse excursion (approximated as min forward return across horizons)
    - win_rate_score: 0.0–1.0 composite
    - explanation: one human-readable string for the buy zone pipeline
    """
    n = len(matches)
    if n < MIN_ANALOG_MATCHES:
        return AnalogScoringResult(
            analog_count=n,
            median_return_20d=0.0,
            median_return_60d=0.0,
            positive_rate_20d=0.5,
            positive_rate_60d=0.5,
            median_mae=0.0,
            win_rate_score=0.0,
            explanation=(
                f"Only {n} historical analog setups found — "
                f"minimum {MIN_ANALOG_MATCHES} required for reliable scoring; "
                "confidence is capped at 0.40"
            ),
        )

    returns_20 = [m.forward_return_20d for m in matches if m.forward_return_20d is not None]
    returns_60 = [m.forward_return_60d for m in matches if m.forward_return_60d is not None]

    median_20 = float(np.median(returns_20)) if returns_20 else 0.0
    median_60 = float(np.median(returns_60)) if returns_60 else 0.0

    pos_rate_20 = float(np.mean([r > 0 for r in returns_20])) if returns_20 else 0.5
    pos_rate_60 = float(np.mean([r > 0 for r in returns_60])) if returns_60 else 0.5

    # Approximate MAE as worst single-period return across 5/20/60d horizons
    maes = []
    for m in matches:
        candidates = [
            r for r in [m.forward_return_5d, m.forward_return_20d, m.forward_return_60d]
            if r is not None
        ]
        if candidates:
            maes.append(min(candidates))
    median_mae = float(np.median(maes)) if maes else 0.0

    # Composite win rate score: blend of 20d and 60d positive outcome rates
    win_rate_score = min(1.0, (pos_rate_20 * 0.4 + pos_rate_60 * 0.6))

    explanation = (
        f"{n} historical analog setups over the past 5 years produced "
        f"+{median_20:.1f}% median 20-day return and +{median_60:.1f}% median 60-day return; "
        f"historical positive outcome rate at 60 days: {pos_rate_60:.0%}; "
        f"historical max adverse excursion from similar setups: {median_mae:.1f}%"
    )

    return AnalogScoringResult(
        analog_count=n,
        median_return_20d=median_20,
        median_return_60d=median_60,
        positive_rate_20d=pos_rate_20,
        positive_rate_60d=pos_rate_60,
        median_mae=median_mae,
        win_rate_score=win_rate_score,
        explanation=explanation,
    )
