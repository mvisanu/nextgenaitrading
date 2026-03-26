"""
News feed API — serves live RSS news items for the dashboard news panel.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.news_scanner_service import scan_news

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/news", tags=["news"])


class NewsItemOut(BaseModel):
    headline: str
    source: str
    published_at: Optional[str] = None
    url: str
    snippet: str
    tickers_mentioned: list[str] = []
    theme_tags: list[str] = []
    relevance_score: float = 0.0


@router.get("", response_model=list[NewsItemOut])
async def get_news_feed(
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=50, ge=1, le=200),
    ticker: Optional[str] = Query(default=None, description="Filter by ticker symbol"),
) -> list[NewsItemOut]:
    """Fetch latest news from RSS feeds, optionally filtered by ticker."""
    items = await scan_news()

    if ticker:
        ticker_upper = ticker.strip().upper()
        # Normalize yfinance crypto symbols: BTC-USD → BTC, ETH-USD → ETH
        base_ticker = ticker_upper.split("-")[0] if "-" in ticker_upper else ticker_upper
        filtered = [
            i for i in items
            if base_ticker in i.tickers_mentioned or ticker_upper in i.tickers_mentioned
        ]
        # Fallback: search headlines if structured ticker matching found nothing
        if not filtered:
            search = base_ticker.lower()
            filtered = [
                i for i in items
                if search in i.headline.lower() or search in i.snippet.lower()
            ]
        # If still empty, return all news (unfiltered) so panel is never blank
        if filtered:
            items = filtered

    return [
        NewsItemOut(
            headline=item.headline,
            source=item.source,
            published_at=item.published_at.isoformat() if item.published_at else None,
            url=item.url,
            snippet=item.snippet,
            tickers_mentioned=item.tickers_mentioned,
            theme_tags=item.theme_tags,
            relevance_score=item.relevance_score,
        )
        for item in items[:limit]
    ]
