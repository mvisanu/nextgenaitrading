"""
Unit tests for financial_quality_service.py
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.financial_quality_service import (
    FinancialQualityResult,
    get_financial_quality_label,
    score_financial_quality,
)


def _mock_yfinance(info: dict):
    """Context manager: patch yfinance.Ticker().info with the given dict."""
    from unittest.mock import MagicMock
    mock = MagicMock()
    mock.info = info
    return patch("yfinance.Ticker", return_value=mock)


class TestScoreFinancialQuality:
    def test_all_positive_fields_gives_high_score(self):
        info = {
            "revenueGrowth": 0.30,
            "earningsGrowth": 0.25,
            "grossMargins": 0.55,
            "operatingMargins": 0.20,
        }
        with _mock_yfinance(info):
            result = score_financial_quality("NVDA")
        assert result.financials_available is True
        assert result.score >= 0.70
        assert "revenue_growth_positive" in " ".join(result.flags)

    def test_all_negative_fields_gives_low_score(self):
        info = {
            "revenueGrowth": -0.10,
            "earningsGrowth": -0.20,
            "grossMargins": 0.10,
            "operatingMargins": -0.05,
        }
        with _mock_yfinance(info):
            result = score_financial_quality("BAD_CO")
        assert result.score < 0.50

    def test_missing_data_returns_unavailable(self):
        """Fewer than 2 available fields → financials_unavailable."""
        info = {}  # no financial fields
        with _mock_yfinance(info):
            result = score_financial_quality("MISSING")
        assert result.financials_available is False
        assert result.score == 0.5
        assert "financials_unavailable" in result.flags

    def test_yfinance_exception_returns_unavailable(self):
        with patch("yfinance.Ticker", side_effect=Exception("network error")):
            result = score_financial_quality("CRASH_CO")
        assert result.financials_available is False
        assert result.score == 0.5

    def test_high_revenue_growth_offsets_negative_earnings(self):
        """Strong revenue growth (>=20%) compensates for negative earnings."""
        info = {
            "revenueGrowth": 0.50,
            "earningsGrowth": -0.10,
            "grossMargins": 0.60,
            "operatingMargins": 0.15,
        }
        with _mock_yfinance(info):
            result = score_financial_quality("GROWTH_CO")
        # Revenue offsets should prevent the score from collapsing
        assert result.score >= 0.40
        assert any("offset" in f for f in result.flags)

    def test_strong_margins_adds_to_score(self):
        info = {
            "revenueGrowth": 0.15,
            "earningsGrowth": 0.10,
            "grossMargins": 0.70,
            "operatingMargins": 0.30,
        }
        with _mock_yfinance(info):
            result = score_financial_quality("HIGH_MARGIN")
        assert any("gross_margins_strong" in f for f in result.flags)
        assert any("operating_margins_strong" in f for f in result.flags)

    def test_score_capped_at_1_0(self):
        info = {
            "revenueGrowth": 2.0,
            "earningsGrowth": 2.0,
            "grossMargins": 0.99,
            "operatingMargins": 0.99,
        }
        with _mock_yfinance(info):
            result = score_financial_quality("PERFECT_CO")
        assert result.score <= 1.0


class TestGetFinancialQualityLabel:
    def test_strong_label(self):
        assert get_financial_quality_label(0.80, True) == "Strong"

    def test_moderate_label(self):
        assert get_financial_quality_label(0.55, True) == "Moderate"

    def test_weak_label(self):
        assert get_financial_quality_label(0.20, True) == "Weak"

    def test_unavailable_label(self):
        assert get_financial_quality_label(0.5, False) == "Financials unavailable"
