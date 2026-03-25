"""
Unit tests for theme_scoring_service.

Tests: tier-override mapping, sector mapping, composite score formula,
       per-theme score blending, boundary values, unknown tickers.
All DB calls are mocked; yfinance calls are patched.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.theme_scoring_service import (
    SUPPORTED_THEMES,
    TICKER_THEME_OVERRIDES,
    SECTOR_TO_THEMES,
    _get_sector_themes,
    compute_theme_score,
)


class TestGetSectorThemes:
    def test_technology_sector_maps_to_correct_themes(self) -> None:
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            themes, score, explanation = _get_sector_themes("NVDA")
        assert "ai" in themes
        assert "semiconductors" in themes
        assert score == 0.5

    def test_industrials_sector_maps_to_correct_themes(self) -> None:
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Industrials"}
            themes, score, _ = _get_sector_themes("GE")
        assert "robotics" in themes or "aerospace" in themes or "defense" in themes

    def test_unknown_sector_returns_empty_themes(self) -> None:
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Totally Unknown Sector"}
            themes, score, explanation = _get_sector_themes("XYZ")
        assert themes == []
        assert score == 0.1

    def test_missing_sector_returns_empty_themes(self) -> None:
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {}
            themes, score, _ = _get_sector_themes("NOINFO")
        assert themes == []
        assert score == 0.1

    def test_yfinance_exception_returns_fallback(self) -> None:
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.side_effect = Exception("Network error")
            themes, score, explanation = _get_sector_themes("FAIL")
        assert themes == []
        assert score == 0.1
        assert "unavailable" in explanation.lower() or "failed" in explanation.lower()

    def test_energy_sector_maps_to_renewable(self) -> None:
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Energy"}
            themes, _, _ = _get_sector_themes("NEE")
        assert "renewable_energy" in themes or "power_infrastructure" in themes


class TestTickerThemeOverrides:
    def test_nvda_has_ai_semiconductor_data_centers(self) -> None:
        assert "ai" in TICKER_THEME_OVERRIDES["NVDA"]
        assert "semiconductors" in TICKER_THEME_OVERRIDES["NVDA"]
        assert "data_centers" in TICKER_THEME_OVERRIDES["NVDA"]

    def test_all_override_themes_are_supported(self) -> None:
        """Every theme in TICKER_THEME_OVERRIDES must be a SUPPORTED_THEME."""
        for ticker, themes in TICKER_THEME_OVERRIDES.items():
            for theme in themes:
                assert theme in SUPPORTED_THEMES, (
                    f"Ticker {ticker} has unsupported theme '{theme}'"
                )

    def test_supported_themes_list_has_10_entries(self) -> None:
        assert len(SUPPORTED_THEMES) == 10


class TestComputeThemeScore:
    """Unit tests for compute_theme_score with mocked DB and yfinance."""

    def _make_db(self, user_ideas=None, existing_ts=None):
        """Create a mocked AsyncSession that returns specified ideas and theme score."""
        db = AsyncMock()

        # Mock execute for WatchlistIdea query
        ideas_result = MagicMock()
        ideas_result.scalars.return_value.all.return_value = user_ideas or []

        # Mock execute for StockThemeScore query
        ts_result = MagicMock()
        ts_result.scalar_one_or_none.return_value = existing_ts

        # Alternate responses: first call → ideas, second call → theme score
        db.execute = AsyncMock(side_effect=[ideas_result, ts_result])
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()
        return db

    @pytest.mark.asyncio
    async def test_curated_ticker_nvda_scores_high(self) -> None:
        db = self._make_db()
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            result = await compute_theme_score("NVDA", user_id=1, db=db)
        # NVDA has 3 curated themes set to 0.80 each, tech sector adds more
        assert result.theme_score_total > 0.10
        assert result.ticker == "NVDA"

    @pytest.mark.asyncio
    async def test_unknown_ticker_scores_low(self) -> None:
        db = self._make_db()
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {}  # no sector
            result = await compute_theme_score("UNKNWN", user_id=1, db=db)
        assert result.theme_score_total < 0.30  # no overrides, no sector themes

    @pytest.mark.asyncio
    async def test_user_ideas_boost_score(self) -> None:
        idea = MagicMock()
        idea.tags_json = ["ai", "semiconductors"]
        idea.conviction_score = 9
        db = self._make_db(user_ideas=[idea])
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            result = await compute_theme_score("NEWSTOCK", user_id=1, db=db)
        assert result.user_conviction_score > 0.0
        assert result.user_conviction_score == pytest.approx(0.9, abs=0.01)

    @pytest.mark.asyncio
    async def test_theme_score_total_bounded_0_1(self) -> None:
        idea = MagicMock()
        idea.tags_json = SUPPORTED_THEMES  # all themes
        idea.conviction_score = 10
        db = self._make_db(user_ideas=[idea])
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            result = await compute_theme_score("NVDA", user_id=1, db=db)
        assert 0.0 <= result.theme_score_total <= 1.0

    @pytest.mark.asyncio
    async def test_existing_db_record_is_updated_not_inserted(self) -> None:
        existing_ts = MagicMock()
        existing_ts.theme_score_total = 0.50
        db = self._make_db(existing_ts=existing_ts)
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            await compute_theme_score("NVDA", user_id=1, db=db)
        # db.add should NOT be called (update path)
        db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_no_existing_db_record_is_inserted(self) -> None:
        db = self._make_db(existing_ts=None)
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            await compute_theme_score("NVDA", user_id=1, db=db)
        # db.add should be called once (insert path)
        db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_ticker_uppercased(self) -> None:
        db = self._make_db()
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {}
            result = await compute_theme_score("nvda", user_id=1, db=db)
        assert result.ticker == "NVDA"

    @pytest.mark.asyncio
    async def test_narrative_momentum_score_bounded(self) -> None:
        db = self._make_db()
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {"sector": "Technology"}
            result = await compute_theme_score("MSFT", user_id=1, db=db)
        assert 0.0 <= result.narrative_momentum_score <= 1.0

    @pytest.mark.asyncio
    async def test_conviction_score_normalisation(self) -> None:
        """Conviction 10/10 → user_conviction_score = 1.0."""
        idea = MagicMock()
        idea.tags_json = []
        idea.conviction_score = 10
        db = self._make_db(user_ideas=[idea])
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {}
            result = await compute_theme_score("TEST", user_id=1, db=db)
        assert result.user_conviction_score == pytest.approx(1.0, abs=0.01)

    @pytest.mark.asyncio
    async def test_multiple_ideas_average_conviction(self) -> None:
        idea1 = MagicMock()
        idea1.tags_json = []
        idea1.conviction_score = 6
        idea2 = MagicMock()
        idea2.tags_json = []
        idea2.conviction_score = 10
        db = self._make_db(user_ideas=[idea1, idea2])
        with patch("app.services.theme_scoring_service.yf") as mock_yf:
            mock_yf.Ticker.return_value.info = {}
            result = await compute_theme_score("TEST", user_id=1, db=db)
        # avg conviction = 8 → 0.8
        assert result.user_conviction_score == pytest.approx(0.8, abs=0.01)
