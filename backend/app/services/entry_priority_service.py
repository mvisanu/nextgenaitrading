"""
Entry priority scoring — V3 idea quality layer.

Two chart conditions qualify as high-priority entries and boost idea_score:

Priority 1: Near 52-week low
  Trigger:   current price <= 52-week low * 1.10 (within 10%)
  Badge:     "Near 52-week low — historically attractive entry area"
  Boost:     +0.15 to idea_score

Priority 2: At weekly chart support
  Trigger:   price within 2x ATR of most recent swing low on 1W chart
             over the past 52 weekly bars
  Badge:     "At weekly support — historically favorable entry zone"
  Boost:     +0.10 to idea_score

Both can be true simultaneously — boosts are additive (max +0.25 combined).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_NEAR_52W_LOW_THRESHOLD = 1.10   # within 10% of 52w low
_WEEKLY_SUPPORT_ATR_MULT = 2.0   # within 2x weekly ATR of weekly swing low


@dataclass
class EntryPriorityResult:
    near_52w_low: bool
    at_weekly_support: bool
    entry_priority: str           # "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD"
    score_boost: float            # additive boost (0.0, 0.10, 0.15, 0.25)
    near_52w_low_pct: float | None = None   # how far from low (informational)
    weekly_support_level: float | None = None  # detected support price


def _detect_weekly_swing_low(weekly_df: pd.DataFrame) -> float | None:
    """
    Find the most recent swing-low pivot on the weekly chart.

    A swing low is defined as a bar whose Low is lower than the preceding
    and following bar's Low.  We scan from most recent to oldest.
    """
    lows = weekly_df["Low"].values
    n = len(lows)
    if n < 3:
        return None

    # Scan from second-to-last bar backwards (last bar can't be a confirmed pivot)
    for i in range(n - 2, 0, -1):
        if lows[i] < lows[i - 1] and lows[i] < lows[i + 1]:
            return float(lows[i])
    return None


def _compute_weekly_atr(weekly_df: pd.DataFrame) -> float:
    """Compute a simple 14-period EWM ATR on the weekly OHLCV data."""
    high = weekly_df["High"]
    low = weekly_df["Low"]
    close = weekly_df["Close"]

    tr = pd.concat(
        [
            high - low,
            (high - close.shift(1)).abs(),
            (low - close.shift(1)).abs(),
        ],
        axis=1,
    ).max(axis=1)

    atr = tr.ewm(com=13, min_periods=3).mean()
    val = float(atr.iloc[-1])
    return val if not np.isnan(val) else 0.0


def check_entry_priority(ticker: str) -> EntryPriorityResult:
    """
    Evaluate both entry priority conditions for a ticker.

    Uses yfinance for data.  Gracefully returns STANDARD if data is
    unavailable.

    Parameters
    ----------
    ticker:
        Stock ticker symbol (case-insensitive).

    Returns
    -------
    EntryPriorityResult

    Examples
    --------
    >>> r = check_entry_priority("AAPL")  # doctest: +SKIP
    >>> r.entry_priority in ("52W_LOW", "WEEKLY_SUPPORT", "BOTH", "STANDARD")
    True
    """
    t = ticker.upper()

    try:
        info = yf.Ticker(t).info
        current_price: float = info.get("regularMarketPrice") or info.get("currentPrice") or 0.0
        low_52w: float = info.get("fiftyTwoWeekLow") or 0.0
    except Exception as exc:
        logger.warning("entry_priority: yfinance .info failed for %s: %s", t, exc)
        return EntryPriorityResult(
            near_52w_low=False,
            at_weekly_support=False,
            entry_priority="STANDARD",
            score_boost=0.0,
        )

    if current_price <= 0 or low_52w <= 0:
        return EntryPriorityResult(
            near_52w_low=False,
            at_weekly_support=False,
            entry_priority="STANDARD",
            score_boost=0.0,
        )

    # ── Condition 1: near 52-week low ─────────────────────────────────────────
    near_52w_threshold = low_52w * _NEAR_52W_LOW_THRESHOLD
    near_52w_low = current_price <= near_52w_threshold
    near_52w_pct = (current_price - low_52w) / low_52w if low_52w > 0 else None

    # ── Condition 2: at weekly chart support ──────────────────────────────────
    at_weekly_support = False
    weekly_support_level: float | None = None

    try:
        weekly_df = yf.download(t, period="2y", interval="1wk", auto_adjust=True, progress=False)
        if isinstance(weekly_df.columns, pd.MultiIndex):
            weekly_df.columns = weekly_df.columns.get_level_values(0)

        # Keep most recent 52 weekly bars
        if not weekly_df.empty and len(weekly_df) >= 4:
            weekly_df = weekly_df.tail(52).copy()
            swing_low = _detect_weekly_swing_low(weekly_df)
            if swing_low is not None:
                weekly_atr = _compute_weekly_atr(weekly_df)
                threshold = _WEEKLY_SUPPORT_ATR_MULT * weekly_atr
                if weekly_atr > 0 and abs(current_price - swing_low) <= threshold:
                    at_weekly_support = True
                    weekly_support_level = swing_low
    except Exception as exc:
        logger.warning("entry_priority: weekly data failed for %s: %s", t, exc)

    # ── Determine entry_priority label and boost ──────────────────────────────
    boost = 0.0
    if near_52w_low:
        boost += 0.15
    if at_weekly_support:
        boost += 0.10

    if near_52w_low and at_weekly_support:
        priority = "BOTH"
    elif near_52w_low:
        priority = "52W_LOW"
    elif at_weekly_support:
        priority = "WEEKLY_SUPPORT"
    else:
        priority = "STANDARD"

    return EntryPriorityResult(
        near_52w_low=near_52w_low,
        at_weekly_support=at_weekly_support,
        entry_priority=priority,
        score_boost=round(boost, 4),
        near_52w_low_pct=round(near_52w_pct, 4) if near_52w_pct is not None else None,
        weekly_support_level=round(weekly_support_level, 4) if weekly_support_level else None,
    )
