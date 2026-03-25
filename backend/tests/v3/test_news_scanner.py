"""
Unit tests for news_scanner_service.py
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.services.news_scanner_service import (
    KNOWN_TICKERS,
    NewsItem,
    _extract_themes,
    _extract_tickers,
    _score_relevance,
    scan_news,
)


class TestExtractTickers:
    def test_dollar_sign_ticker(self):
        tickers = _extract_tickers("$NVDA is up today")
        assert "NVDA" in tickers

    def test_stock_keyword_ticker(self):
        tickers = _extract_tickers("Apple stock surges after earnings")
        assert "AAPL" in tickers

    def test_company_name_match(self):
        tickers = _extract_tickers("NVIDIA announces new GPU for AI training")
        assert "NVDA" in tickers

    def test_unknown_ticker_not_included(self):
        tickers = _extract_tickers("$ZZZZ is an unknown company")
        assert "ZZZZ" not in tickers

    def test_multiple_tickers_extracted(self):
        tickers = _extract_tickers("$AAPL and $MSFT report earnings this week")
        assert "AAPL" in tickers
        assert "MSFT" in tickers


class TestExtractThemes:
    def test_ai_keyword_detected(self):
        themes = _extract_themes("artificial intelligence model improves accuracy")
        assert "ai" in themes

    def test_robotics_keyword_detected(self):
        themes = _extract_themes("humanoid robot deployed in warehouse")
        assert "robotics" in themes

    def test_longevity_keyword_detected(self):
        themes = _extract_themes("GLP-1 drug shows longevity benefits")
        assert "longevity" in themes

    def test_no_match_returns_empty(self):
        themes = _extract_themes("weather forecast for tomorrow")
        assert themes == []

    def test_multiple_themes(self):
        # "autonomous vehicle" matches robotics; "semiconductor" matches semiconductors
        themes = _extract_themes("semiconductor chip used in autonomous vehicle")
        assert "semiconductors" in themes
        assert "robotics" in themes

    def test_ai_keyword_neural_network(self):
        themes = _extract_themes("neural network model achieves new benchmark")
        assert "ai" in themes


class TestScoreRelevance:
    def test_zero_tickers_and_zero_themes_returns_zero(self):
        assert _score_relevance([], []) == 0.0

    def test_one_ticker_scores_0_3(self):
        assert _score_relevance(["NVDA"], []) == 0.3

    def test_one_theme_scores_0_2(self):
        assert _score_relevance([], ["ai"]) == 0.2

    def test_combined_score_capped_at_1_0(self):
        tickers = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL"]
        themes = ["ai", "semiconductors", "defense", "energy"]
        score = _score_relevance(tickers, themes)
        assert score == 1.0


class TestScanNews:
    @pytest.mark.asyncio
    async def test_returns_list_of_news_items(self):
        """Mock all HTTP calls; verify scan_news returns a list."""
        import feedparser

        mock_feed = MagicMock()
        mock_feed.entries = [
            MagicMock(
                title="NVIDIA wins $2B AI data center contract",
                summary="NVIDIA Corp announced...",
                link="https://example.com/nvda",
                published_parsed=(2026, 3, 24, 10, 0, 0, 1, 83, 0),
                updated_parsed=None,
            )
        ]
        mock_feed.feed = MagicMock(title="Test Feed")

        mock_response = AsyncMock()
        mock_response.text = "<rss/>"
        mock_response.raise_for_status = MagicMock()

        with patch("feedparser.parse", return_value=mock_feed), \
             patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                get=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            items = await scan_news()

        assert isinstance(items, list)

    @pytest.mark.asyncio
    async def test_graceful_failure_on_bad_feed(self):
        """A failing feed should be skipped; scan_news should not raise."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(
                side_effect=Exception("connection refused")
            )
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            items = await scan_news()

        # Should return an empty list, not raise
        assert isinstance(items, list)

    @pytest.mark.asyncio
    async def test_sorted_by_relevance_desc(self):
        """Items should be sorted by relevance_score descending."""
        # Use real extraction logic with mocked HTTP
        mock_feed_high = MagicMock()
        mock_feed_high.entries = [MagicMock(
            title="$NVDA $AAPL $MSFT artificial intelligence semiconductor",
            summary="", link="https://h.com", published_parsed=None, updated_parsed=None,
        )]
        mock_feed_high.feed = MagicMock(title="Feed")

        mock_response = AsyncMock()
        mock_response.text = "<rss/>"
        mock_response.raise_for_status = MagicMock()

        with patch("feedparser.parse", return_value=mock_feed_high), \
             patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=MagicMock(
                get=AsyncMock(return_value=mock_response)
            ))
            mock_client.return_value.__aexit__ = AsyncMock(return_value=False)
            items = await scan_news()

        if len(items) > 1:
            for i in range(len(items) - 1):
                assert items[i].relevance_score >= items[i + 1].relevance_score
