"""
Scheduler task: run the V3 news scanner every 60 minutes during market hours.

Fetches free RSS feeds, extracts ticker/theme mentions, and logs results.
The news scan output is consumed by run_idea_generator (which also runs hourly)
via news_scanner_service.scan_news().  This task is a standalone warmup/logging
pass that can be run independently to verify feed health.
"""
from __future__ import annotations

import logging

from app.services.news_scanner_service import scan_news
from app.utils.market_hours import is_market_hours

logger = logging.getLogger(__name__)


async def run_news_scanner() -> None:
    """
    Fetch all RSS feeds and log a summary.

    Market hours guard: skips outside 9:30–16:00 ET weekdays.
    Fails gracefully — any individual feed error is already handled
    inside news_scanner_service.scan_news().
    """
    if not is_market_hours():
        logger.debug("run_news_scanner: outside market hours — skipping")
        return

    logger.info("run_news_scanner: starting feed fetch")
    try:
        items = await scan_news()
        tickers_mentioned: set[str] = set()
        for item in items:
            tickers_mentioned.update(item.tickers_mentioned)

        logger.info(
            "run_news_scanner: fetched %d relevant items, %d unique tickers mentioned",
            len(items),
            len(tickers_mentioned),
        )
    except Exception as exc:
        logger.exception("run_news_scanner: job failed: %s", exc)
