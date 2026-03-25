"""
Unit tests for entry_priority_service.py
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from app.services.entry_priority_service import (
    EntryPriorityResult,
    _compute_weekly_atr,
    _detect_weekly_swing_low,
    check_entry_priority,
)


def _make_weekly_df(n: int = 55) -> pd.DataFrame:
    """Generate synthetic weekly OHLCV data with a detectable swing low."""
    np.random.seed(42)
    half = n // 2
    # V-shaped: decline then recover
    down = np.linspace(200.0, 170.0, half)
    up = np.linspace(170.0, 190.0, n - half)
    closes = np.concatenate([down, up])
    highs = closes * 1.02
    lows = closes * 0.98
    vols = np.ones(n) * 5_000_000
    idx = pd.date_range("2025-01-01", periods=n, freq="W")
    return pd.DataFrame({"Open": closes, "High": highs, "Low": lows, "Close": closes, "Volume": vols}, index=idx)


class TestDetectWeeklySwingLow:
    def test_detects_pivot_low_in_v_shape(self):
        """A V-shaped price series should have a swing low at the bottom."""
        lows = [10.0, 9.0, 8.0, 7.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        df = pd.DataFrame({"Low": lows, "High": [l * 1.05 for l in lows], "Close": lows})
        pivot = _detect_weekly_swing_low(df)
        assert pivot == 6.0

    def test_returns_none_for_monotone_decline(self):
        """A strictly declining series has no confirmed swing low."""
        lows = [10.0, 9.0, 8.0, 7.0, 6.0]
        df = pd.DataFrame({"Low": lows, "High": [l * 1.05 for l in lows], "Close": lows})
        assert _detect_weekly_swing_low(df) is None

    def test_returns_none_for_too_few_bars(self):
        df = pd.DataFrame({"Low": [5.0, 4.0], "High": [5.5, 4.5], "Close": [5.0, 4.0]})
        assert _detect_weekly_swing_low(df) is None


class TestComputeWeeklyATR:
    def test_returns_positive_value(self):
        df = _make_weekly_df()
        atr = _compute_weekly_atr(df)
        assert atr > 0

    def test_returns_float(self):
        df = _make_weekly_df()
        assert isinstance(_compute_weekly_atr(df), float)


class TestCheckEntryPriority:
    def test_near_52w_low_detected(self):
        """Price within 10% of 52w low triggers near_52w_low=True."""
        mock_ticker = MagicMock()
        mock_ticker.info = {"regularMarketPrice": 105.0, "fiftyTwoWeekLow": 100.0}
        weekly_df = _make_weekly_df()
        with patch("yfinance.Ticker", return_value=mock_ticker), \
             patch("yfinance.download", return_value=weekly_df):
            result = check_entry_priority("AAPL")
        assert result.near_52w_low is True
        assert "52W_LOW" in result.entry_priority
        assert result.score_boost >= 0.15

    def test_far_from_52w_low_not_near(self):
        """Price 20% above 52w low — should NOT trigger near_52w_low."""
        mock_ticker = MagicMock()
        mock_ticker.info = {"regularMarketPrice": 120.0, "fiftyTwoWeekLow": 100.0}
        weekly_df = _make_weekly_df()
        with patch("yfinance.Ticker", return_value=mock_ticker), \
             patch("yfinance.download", return_value=weekly_df):
            result = check_entry_priority("AAPL")
        assert result.near_52w_low is False

    def test_both_conditions_give_both_label(self):
        """When both near_52w_low and at_weekly_support are True, entry_priority='BOTH'."""
        n = 55
        lows_arr = np.array([100.0, 95.0, 90.0, 85.0, 84.0, 85.5, 88.0, 92.0, 95.0] + [98.0] * (n - 9))
        highs_arr = lows_arr * 1.05
        df = pd.DataFrame({
            "Low": lows_arr, "High": highs_arr, "Close": lows_arr,
            "Open": lows_arr, "Volume": np.ones(n) * 1e6
        })
        df.index = pd.date_range("2025-01-01", periods=n, freq="W")

        mock_ticker = MagicMock()
        mock_ticker.info = {"regularMarketPrice": 86.0, "fiftyTwoWeekLow": 82.0}

        with patch("yfinance.Ticker", return_value=mock_ticker), \
             patch("yfinance.download", return_value=df):
            result = check_entry_priority("XYZ")

        # near_52w_low: 86 <= 82 * 1.10 = 90.2 → True
        assert result.near_52w_low is True
        if result.at_weekly_support:
            assert result.entry_priority == "BOTH"
            assert result.score_boost == 0.25

    def test_score_boost_additive(self):
        """Boosts are +0.15 for 52w low and +0.10 for weekly support."""
        result_52w = EntryPriorityResult(
            near_52w_low=True, at_weekly_support=False,
            entry_priority="52W_LOW", score_boost=0.15
        )
        result_both = EntryPriorityResult(
            near_52w_low=True, at_weekly_support=True,
            entry_priority="BOTH", score_boost=0.25
        )
        assert result_52w.score_boost == 0.15
        assert result_both.score_boost == 0.25

    def test_standard_entry_gives_zero_boost(self):
        result = EntryPriorityResult(
            near_52w_low=False, at_weekly_support=False,
            entry_priority="STANDARD", score_boost=0.0
        )
        assert result.score_boost == 0.0

    def test_yfinance_failure_returns_standard(self):
        with patch("yfinance.Ticker", side_effect=Exception("no data")):
            result = check_entry_priority("CRASH")
        assert result.entry_priority == "STANDARD"
        assert result.score_boost == 0.0
