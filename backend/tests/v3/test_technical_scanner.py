"""
Unit tests for the technical setup scoring in v3_idea_generator_service.py
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.v3_idea_generator_service import _compute_technical_setup_score


def _make_df(
    n: int = 300,
    trend: str = "up",   # "up" | "down" | "flat"
    rsi_target: str = "neutral",  # "neutral" | "overbought" | "oversold"
    vol_declining: bool = True,
) -> pd.DataFrame:
    np.random.seed(42)

    if trend == "up":
        closes = np.linspace(80.0, 150.0, n)
    elif trend == "down":
        closes = np.linspace(150.0, 80.0, n)
    else:
        closes = np.full(n, 100.0)

    highs = closes * 1.005
    lows = closes * 0.995

    if vol_declining and trend in ("down", "flat"):
        # Simulate declining volume on pullback
        vols = np.ones(n) * 1_000_000
        vols[-5:] = 500_000
    else:
        vols = np.ones(n) * 1_000_000

    idx = pd.date_range("2024-01-01", periods=n, freq="B")
    return pd.DataFrame(
        {"Open": closes, "High": highs, "Low": lows, "Close": closes, "Volume": vols},
        index=idx,
    )


class TestComputeTechnicalSetupScore:
    def test_strong_uptrend_high_score(self):
        """Clear uptrend: price above 50d and 200d MA → score >= 0.50."""
        df = _make_df(trend="up")
        score = _compute_technical_setup_score(df)
        assert score >= 0.50

    def test_downtrend_low_score(self):
        """Downtrend: price below both MAs → score <= 0.50."""
        df = _make_df(trend="down")
        score = _compute_technical_setup_score(df)
        assert score <= 0.50

    def test_insufficient_data_returns_0_5(self):
        df = pd.DataFrame({
            "Close": [100.0] * 30,
            "High": [101.0] * 30,
            "Low": [99.0] * 30,
            "Volume": [1e6] * 30,
        })
        score = _compute_technical_setup_score(df)
        assert score == 0.5

    def test_score_in_valid_range(self):
        """Score must always be between 0.0 and 1.0."""
        for trend in ("up", "down", "flat"):
            df = _make_df(trend=trend)
            score = _compute_technical_setup_score(df)
            assert 0.0 <= score <= 1.0, f"Score {score} out of range for trend={trend}"

    def test_score_increments_by_0_25(self):
        """Score uses 4 binary checks each worth 0.25."""
        df = _make_df(trend="up")
        score = _compute_technical_setup_score(df)
        # Should be a multiple of 0.25 (approximately)
        remainder = round(score % 0.25, 4)
        assert remainder < 0.001 or abs(remainder - 0.25) < 0.001

    def test_uptrend_passes_ma_checks(self):
        """Price above 50d + 200d in a clear uptrend — those two checks pass."""
        df = _make_df(trend="up", n=300)
        score = _compute_technical_setup_score(df)
        # At minimum, the two MA checks should pass → score >= 0.50
        assert score >= 0.50
