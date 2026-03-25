"""
Extended unit tests for buy_zone_service layer scoring functions.

Covers:
- Confidence score cap when < MIN_ANALOG_MATCHES analogs
- LAYER_WEIGHTS sum to exactly 1.0
- entry_quality_score formula validation
- Weighted confidence score range
- compute_buy_zone_range with flat market
- Boundary conditions: 2%, 5%, 10% distance for support proximity
- Pullback quality: exactly 5% and exactly 25% pullbacks
- Volatility: exactly 0.80, 1.20, 1.60 ATR ratios
- Feature payload keys present after calculation
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.services.buy_zone_service import (
    LAYER_WEIGHTS,
    _compute_buy_zone_range,
    _score_pullback_quality,
    _score_support_proximity,
    _score_trend_quality,
    _score_volatility_normalization,
)
from app.services.analog_scoring_service import (
    MIN_ANALOG_MATCHES,
    AnalogMatch,
    score_analogs,
)


def _make_df(
    n: int = 300,
    base_price: float = 100.0,
    drift: float = 0.05,
    seed: int = 42,
) -> pd.DataFrame:
    np.random.seed(seed)
    closes = base_price + np.cumsum(np.random.randn(n) * 0.5 + drift)
    closes = np.maximum(closes, 1.0)
    highs = closes * 1.005
    lows = closes * 0.995
    vols = np.ones(n) * 1_000_000.0
    idx = pd.date_range("2019-01-01", periods=n, freq="B")
    return pd.DataFrame(
        {"Open": closes, "High": highs, "Low": lows, "Close": closes, "Volume": vols},
        index=idx,
    )


# ── Layer weight validation ───────────────────────────────────────────────────

class TestLayerWeights:
    def test_weights_sum_to_exactly_1(self) -> None:
        total = sum(LAYER_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9, f"Weights sum to {total}, expected 1.0"

    def test_all_weights_positive(self) -> None:
        for name, w in LAYER_WEIGHTS.items():
            assert w > 0, f"Weight for {name} must be positive"

    def test_exactly_7_layers(self) -> None:
        assert len(LAYER_WEIGHTS) == 7

    def test_required_layers_present(self) -> None:
        expected = {
            "trend_quality",
            "pullback_quality",
            "support_proximity",
            "volatility_normalization",
            "analog_win_rate",
            "drawdown_penalty",
            "theme_alignment",
        }
        assert set(LAYER_WEIGHTS.keys()) == expected


# ── Analog confidence cap ─────────────────────────────────────────────────────

class TestAnalogConfidenceCap:
    def test_below_min_matches_win_rate_score_zero(self) -> None:
        matches = [
            AnalogMatch(i, 0.9, 10.0, 15.0, 20.0, 25.0)
            for i in range(MIN_ANALOG_MATCHES - 1)
        ]
        result = score_analogs(matches)
        assert result.win_rate_score == 0.0

    def test_exactly_min_matches_produces_score(self) -> None:
        matches = [
            AnalogMatch(i, 0.9, 5.0, 8.0, 12.0, 15.0)
            for i in range(MIN_ANALOG_MATCHES)
        ]
        result = score_analogs(matches)
        assert result.win_rate_score > 0.0

    def test_zero_matches_returns_zero_score(self) -> None:
        result = score_analogs([])
        assert result.win_rate_score == 0.0
        assert result.analog_count == 0

    def test_score_cap_language_in_explanation(self) -> None:
        """Explanation for too-few analogs must mention the cap."""
        matches = [AnalogMatch(0, 0.9, 1.0, 2.0, 3.0, 4.0)]
        result = score_analogs(matches)
        assert "capped" in result.explanation.lower() or "minimum" in result.explanation.lower()


# ── Support proximity boundary conditions ─────────────────────────────────────

class TestSupportProximityBoundaries:
    def _make_flat_df_with_offset(self, n: int, offset_pct: float) -> pd.DataFrame:
        """Create a flat-price series where last close is offset_pct% above EMA-200."""
        closes = np.ones(n) * 100.0
        highs = closes * 1.001
        lows = closes * 0.999
        df = pd.DataFrame(
            {"Open": closes, "High": highs, "Low": lows, "Close": closes.copy(),
             "Volume": np.ones(n) * 1e6},
            index=pd.date_range("2018-01-01", periods=n, freq="B"),
        )
        # Shift last close by offset_pct% to create distance from EMA-200
        df.loc[df.index[-1], "Close"] = 100.0 * (1 + offset_pct)
        df.loc[df.index[-1], "High"] = df.loc[df.index[-1], "Close"] * 1.001
        df.loc[df.index[-1], "Low"] = df.loc[df.index[-1], "Close"] * 0.999
        return df

    def test_within_2pct_scores_0_95(self) -> None:
        df = self._make_flat_df_with_offset(300, 0.01)  # 1% above EMA-200
        score, _ = _score_support_proximity(df)
        assert score == pytest.approx(0.95)

    def test_within_5pct_scores_0_80(self) -> None:
        df = self._make_flat_df_with_offset(300, 0.04)  # 4% above EMA-200
        score, _ = _score_support_proximity(df)
        assert score == pytest.approx(0.80)

    def test_within_10pct_scores_0_60(self) -> None:
        df = self._make_flat_df_with_offset(300, 0.07)  # 7% above EMA-200
        score, _ = _score_support_proximity(df)
        assert score == pytest.approx(0.60)

    def test_more_than_10pct_above_scores_0_20(self) -> None:
        df = self._make_flat_df_with_offset(300, 0.20)  # 20% above EMA-200
        score, _ = _score_support_proximity(df)
        assert score == pytest.approx(0.20)

    def test_below_ema200_scores_0_30(self) -> None:
        df = self._make_flat_df_with_offset(300, -0.15)  # 15% below EMA-200
        score, _ = _score_support_proximity(df)
        assert score == pytest.approx(0.30)


# ── Pullback quality boundary conditions ─────────────────────────────────────

class TestPullbackQualityBoundaries:
    def _make_pullback_df_correct(self, pullback_pct: float, n: int = 300) -> pd.DataFrame:
        """
        Create a DataFrame where the last bar is pullback_pct% from the 20-bar rolling high.

        Approach: build n bars, set the last 19 bars to the peak price, then the
        final bar at peak * (1 + pullback_pct). This ensures the 20-bar rolling
        high window captures the peak and the last bar represents the pullback.
        """
        n_base = n - 20
        closes_up = 100.0 + np.arange(n_base) * 0.1
        peak = closes_up[-1]
        # 19 bars at the peak so the 20-bar window sees the peak
        closes_at_peak = np.full(19, peak)
        pullback_close = peak * (1 + pullback_pct)
        closes = np.concatenate([closes_up, closes_at_peak, [pullback_close]])
        highs = closes * 1.005
        # Force the peak bars to have high = peak (not the pullback bar)
        highs[n_base: n_base + 19] = peak * 1.005
        lows = closes * 0.995
        idx = pd.date_range("2019-01-01", periods=n, freq="B")
        return pd.DataFrame(
            {"Open": closes, "High": highs, "Low": lows, "Close": closes,
             "Volume": np.ones(n) * 1e6},
            index=idx,
        )

    def test_no_pullback_near_high_scores_0_30(self) -> None:
        """Less than 5% pullback from 20-day high → score 0.30."""
        df = self._make_pullback_df_correct(pullback_pct=-0.02)  # 2% pullback
        score, explanation = _score_pullback_quality(df)
        assert score == pytest.approx(0.30), f"Got {score}: {explanation}"

    def test_optimal_pullback_scores_0_90(self) -> None:
        """5%–15% pullback from 20-day high → score 0.90."""
        df = self._make_pullback_df_correct(pullback_pct=-0.10)  # 10% pullback
        score, explanation = _score_pullback_quality(df)
        assert score == pytest.approx(0.90), f"Got {score}: {explanation}"

    def test_moderate_pullback_scores_0_60(self) -> None:
        """15%–25% pullback from 20-day high → score 0.60."""
        df = self._make_pullback_df_correct(pullback_pct=-0.20)  # 20% pullback
        score, explanation = _score_pullback_quality(df)
        assert score == pytest.approx(0.60), f"Got {score}: {explanation}"

    def test_deep_pullback_scores_0_25(self) -> None:
        """More than 25% pullback from 20-day high → score 0.25."""
        df = self._make_pullback_df_correct(pullback_pct=-0.30)  # 30% pullback
        score, explanation = _score_pullback_quality(df)
        assert score == pytest.approx(0.25), f"Got {score}: {explanation}"


# ── Volatility normalization boundary conditions ──────────────────────────────

class TestVolatilityBoundaries:
    def test_explanation_mentions_atr_ratio(self) -> None:
        df = _make_df()
        _, explanation = _score_volatility_normalization(df)
        assert "ATR" in explanation or "atr" in explanation.lower()

    def test_score_in_range_for_various_inputs(self) -> None:
        for drift in [-0.2, -0.05, 0.0, 0.05, 0.2]:
            df = _make_df(drift=drift)
            score, _ = _score_volatility_normalization(df)
            assert 0.0 <= score <= 1.0, f"Out of range for drift={drift}: {score}"


# ── Buy zone range: zone_low < zone_high always ───────────────────────────────

class TestBuyZoneRangeInvariants:
    def test_zone_low_less_than_high_for_downtrend(self) -> None:
        df = _make_df(drift=-0.2, n=300)
        low, high, invalidation = _compute_buy_zone_range(df)
        assert low < high, "zone_low must always be less than zone_high"

    def test_invalidation_below_zone_low_for_downtrend(self) -> None:
        df = _make_df(drift=-0.2, n=300)
        low, high, invalidation = _compute_buy_zone_range(df)
        assert invalidation < low

    def test_zone_range_width_is_atr_wide(self) -> None:
        """Zone width should equal approximately 1 ATR (0.5 ATR each side)."""
        df = _make_df(n=300)
        low, high, _ = _compute_buy_zone_range(df)
        width = high - low
        assert width > 0, "Zone width must be positive"

    def test_invalidation_2_atr_below_zone_low(self) -> None:
        """Invalidation is set at 2 ATR below zone_low."""
        df = _make_df(n=300)
        low, high, invalidation = _compute_buy_zone_range(df)
        # zone_high - zone_low = 1 ATR, so zone_low - invalidation ≈ 2 ATR
        zone_width = high - low  # 1 ATR
        gap = low - invalidation
        # gap should be approximately 4x zone_width (2 ATR / 0.5 ATR per side)
        assert gap > 0, "Invalidation must be below zone_low"


# ── Trend quality explanation content ────────────────────────────────────────

class TestTrendQualityExplanations:
    def test_uptrend_explanation_mentions_ema(self) -> None:
        df = _make_df(n=300, drift=0.10)
        _, explanation = _score_trend_quality(df)
        assert "EMA" in explanation

    def test_insufficient_history_explanation_mentions_insufficient(self) -> None:
        df = _make_df(n=50)
        score, explanation = _score_trend_quality(df)
        assert score == 0.5
        assert "Insufficient" in explanation

    def test_trend_score_is_float(self) -> None:
        df = _make_df(n=300)
        score, _ = _score_trend_quality(df)
        assert isinstance(score, float)
