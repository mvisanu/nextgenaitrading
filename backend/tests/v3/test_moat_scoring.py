"""
Unit tests for moat_scoring_service.py
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.moat_scoring_service import (
    HIGH_MOAT_TICKERS,
    MoatResult,
    get_moat_badge,
    score_moat,
)


class TestHighMoatTickersSeed:
    def test_nvda_seeded_correctly(self):
        result = score_moat("NVDA")
        assert result.score == 0.85
        assert result.source == "seed"
        assert "GPU" in result.description or "gpu" in result.description.lower()

    def test_isrg_seeded_correctly(self):
        result = score_moat("ISRG")
        assert result.score == 0.90
        assert result.source == "seed"

    def test_asml_highest_seed_score(self):
        result = score_moat("ASML")
        assert result.score == 0.95
        assert result.source == "seed"

    def test_ilmn_seeded(self):
        result = score_moat("ILMN")
        assert result.score == 0.80
        assert result.source == "seed"

    def test_v_seeded(self):
        result = score_moat("V")
        assert result.score == 0.80
        assert result.source == "seed"

    def test_ma_seeded(self):
        result = score_moat("MA")
        assert result.score == 0.80
        assert result.source == "seed"

    def test_lly_seeded(self):
        result = score_moat("LLY")
        assert result.score == 0.75
        assert result.source == "seed"

    def test_nvo_seeded(self):
        result = score_moat("NVO")
        assert result.score == 0.75
        assert result.source == "seed"

    def test_tsm_seeded(self):
        result = score_moat("TSM")
        assert result.score == 0.85
        assert result.source == "seed"

    def test_case_insensitive(self):
        result_upper = score_moat("NVDA")
        result_lower = score_moat("nvda")
        assert result_upper.score == result_lower.score


class TestHeuristicFallback:
    def test_mega_cap_returns_heuristic(self):
        """For a ticker not in HIGH_MOAT_TICKERS, use yfinance market cap heuristic."""
        mock_info = {"marketCap": 600_000_000_000, "sector": "Technology", "industry": "Software"}
        with patch("yfinance.Ticker") as mock_ticker:
            mock_ticker.return_value.info = mock_info
            result = score_moat("XYZ_NOT_IN_SEED")
        assert result.source == "heuristic"
        assert result.score == 0.65

    def test_yfinance_failure_returns_unavailable(self):
        with patch("yfinance.Ticker") as mock_ticker:
            mock_ticker.return_value.info = property(lambda self: (_ for _ in ()).throw(Exception("network")))
            # Simpler: make .info raise
            mock_ticker.return_value = MagicMock()
            type(mock_ticker.return_value).info = property(lambda self: (_ for _ in ()).throw(Exception("err")))
            result = score_moat("FAIL_TICKER")
        assert result.source == "unavailable"
        assert result.score == 0.50


class TestGetMoatBadge:
    def test_strong_badge(self):
        assert get_moat_badge(0.70) == "Strong"
        assert get_moat_badge(0.95) == "Strong"

    def test_moderate_badge(self):
        assert get_moat_badge(0.50) == "Moderate"
        assert get_moat_badge(0.30) == "Moderate"

    def test_low_badge(self):
        assert get_moat_badge(0.29) == "Low"
        assert get_moat_badge(0.0) == "Low"
