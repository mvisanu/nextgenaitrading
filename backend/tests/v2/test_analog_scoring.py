"""
Unit tests for analog_scoring_service.

Tests: historical window matching, forward return computation, edge cases.
All tests are pure — no DB, no network (yfinance mocked via fixtures).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.analog_scoring_service import (
    MIN_ANALOG_MATCHES,
    AnalogScoringResult,
    _compute_atr,
    _compute_features,
    _compute_rsi,
    find_analog_matches,
    score_analogs,
)


def _make_df(n: int = 300, trend: str = "up") -> pd.DataFrame:
    """Create a synthetic OHLCV DataFrame for testing."""
    np.random.seed(42)
    if trend == "up":
        closes = 100.0 + np.cumsum(np.random.randn(n) * 0.5 + 0.05)
    elif trend == "down":
        closes = 100.0 + np.cumsum(np.random.randn(n) * 0.5 - 0.05)
    else:
        closes = 100.0 + np.random.randn(n) * 2
    closes = np.maximum(closes, 1.0)
    highs = closes * (1 + np.abs(np.random.randn(n) * 0.01))
    lows = closes * (1 - np.abs(np.random.randn(n) * 0.01))
    volumes = np.random.randint(1_000_000, 10_000_000, n).astype(float)
    index = pd.date_range("2019-01-01", periods=n, freq="B")
    return pd.DataFrame(
        {"Open": closes, "High": highs, "Low": lows, "Close": closes, "Volume": volumes},
        index=index,
    )


class TestRSI:
    def test_rsi_range(self) -> None:
        df = _make_df(100)
        rsi = _compute_rsi(df["Close"], 14)
        valid = rsi.dropna()
        assert (valid >= 0).all() and (valid <= 100).all(), "RSI must be in [0, 100]"

    def test_rsi_overbought(self) -> None:
        """Strongly uptrending series should produce high RSI."""
        # Use a longer series so EWM with min_periods=14 produces enough valid values
        closes = pd.Series([100.0 + i * 3 for i in range(200)])
        rsi = _compute_rsi(closes, 14)
        valid = rsi.dropna()
        assert len(valid) > 0, "RSI series should have valid values after warmup"
        # Final RSI should be high (overbought) for a monotonically increasing series
        assert valid.iloc[-1] > 70, f"RSI should be overbought in strong uptrend, got {valid.iloc[-1]:.1f}"

    def test_rsi_oversold(self) -> None:
        """Strongly downtrending series should produce low RSI."""
        closes = pd.Series([100.0 - i * 2 for i in range(50)])
        rsi = _compute_rsi(closes, 14).dropna()
        assert rsi.iloc[-1] < 30, "RSI should be oversold in strong downtrend"


class TestATR:
    def test_atr_positive(self) -> None:
        df = _make_df(50)
        atr = _compute_atr(df, 14).dropna()
        assert (atr > 0).all(), "ATR must be positive"

    def test_atr_flat_market(self) -> None:
        """Flat market (no price movement) produces near-zero ATR."""
        n = 50
        closes = pd.Series([100.0] * n)
        highs = closes * 1.0001
        lows = closes * 0.9999
        df = pd.DataFrame({"High": highs, "Low": lows, "Close": closes})
        atr = _compute_atr(df, 14).dropna()
        assert atr.iloc[-1] < 0.05, "ATR should be near zero in flat market"


class TestFeatures:
    def test_features_shape(self) -> None:
        df = _make_df(300)
        features = _compute_features(df)
        assert set(features.columns) == {"rsi", "atr_ratio", "trend_slope", "pullback_depth"}
        assert len(features) > 0

    def test_features_no_nan(self) -> None:
        df = _make_df(300)
        features = _compute_features(df)
        assert not features.isnull().any().any(), "No NaN values after dropna"


class TestFindAnalogMatches:
    def test_returns_matches(self) -> None:
        df = _make_df(500)
        matches = find_analog_matches(df, top_n=10)
        assert len(matches) > 0
        assert len(matches) <= 10

    def test_insufficient_data(self) -> None:
        """Too few bars should return empty list."""
        df = _make_df(30)
        matches = find_analog_matches(df)
        assert matches == []

    def test_similarity_score_range(self) -> None:
        df = _make_df(500)
        matches = find_analog_matches(df, top_n=5)
        for m in matches:
            assert 0.0 < m.similarity_score <= 1.0

    def test_forward_returns_present(self) -> None:
        """Matches well within history should have non-None forward returns."""
        df = _make_df(400)
        matches = find_analog_matches(df, top_n=5)
        # At least the first few matches should have 20d forward return
        has_returns = [m for m in matches if m.forward_return_20d is not None]
        assert len(has_returns) > 0


class TestScoreAnalogs:
    def test_too_few_matches(self) -> None:
        """Below MIN_ANALOG_MATCHES, win_rate_score should be 0."""
        from app.services.analog_scoring_service import AnalogMatch
        matches = [
            AnalogMatch(i, 0.8, 2.0, 5.0, 10.0, 15.0)
            for i in range(MIN_ANALOG_MATCHES - 1)
        ]
        result = score_analogs(matches)
        assert result.win_rate_score == 0.0
        assert result.analog_count == MIN_ANALOG_MATCHES - 1

    def test_all_positive_returns(self) -> None:
        from app.services.analog_scoring_service import AnalogMatch
        matches = [
            AnalogMatch(i, 0.9, 1.0, 5.0, 10.0, 15.0)
            for i in range(10)
        ]
        result = score_analogs(matches)
        assert result.positive_rate_20d == 1.0
        assert result.positive_rate_60d == 1.0
        assert result.win_rate_score > 0.8

    def test_all_negative_returns(self) -> None:
        from app.services.analog_scoring_service import AnalogMatch
        matches = [
            AnalogMatch(i, 0.5, -1.0, -3.0, -8.0, -12.0)
            for i in range(10)
        ]
        result = score_analogs(matches)
        assert result.positive_rate_20d == 0.0
        assert result.positive_rate_60d == 0.0

    def test_explanation_contains_analog_count(self) -> None:
        from app.services.analog_scoring_service import AnalogMatch
        n = 15
        matches = [AnalogMatch(i, 0.8, 2.0, 4.0, 8.0, 12.0) for i in range(n)]
        result = score_analogs(matches)
        assert str(n) in result.explanation

    def test_median_mae_negative(self) -> None:
        """Median MAE should be negative when forward returns have losses."""
        from app.services.analog_scoring_service import AnalogMatch
        matches = [
            AnalogMatch(i, 0.7, -5.0, 3.0, 8.0, 12.0)
            for i in range(10)
        ]
        result = score_analogs(matches)
        assert result.median_mae < 0.0
