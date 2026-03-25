"""
Scheduler task: refresh theme scores for all tracked tickers.

Runs every 360 minutes (configurable via THEME_SCORE_REFRESH_MINUTES).
Uses a system-level user_id=0 placeholder for the compute call
(theme scores are system-wide; user-specific context is injected via watchlist ideas).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.user import User
from app.services.theme_scoring_service import compute_theme_score

logger = logging.getLogger(__name__)


async def refresh_theme_scores() -> None:
    """
    Refresh theme scores for all tickers tracked across all users.
    Idempotent; overwrites the existing score row.
    """
    logger.info("refresh_theme_scores job starting")
    started_at = datetime.now(timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            # Collect all unique tickers
            result = await db.execute(
                select(WatchlistIdeaTicker.ticker).distinct()
            )
            tickers = [row[0] for row in result.fetchall()]
            logger.info("refresh_theme_scores: %d unique tickers", len(tickers))

            # Use the first active user as context (theme scores are system-wide)
            user_result = await db.execute(
                select(User).where(User.is_active.is_(True)).limit(1)
            )
            context_user = user_result.scalar_one_or_none()
            if not context_user:
                logger.warning("refresh_theme_scores: no active users found; skipping")
                return

            refreshed = errors = 0
            for ticker in tickers:
                try:
                    await compute_theme_score(ticker, context_user.id, db)
                    refreshed += 1
                except Exception as exc:
                    errors += 1
                    logger.error("refresh_theme_scores: error for %s: %s", ticker, exc)

            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
            logger.info(
                "refresh_theme_scores complete in %.1fs: refreshed=%d errors=%d",
                elapsed, refreshed, errors,
            )
    except Exception as exc:
        logger.exception("refresh_theme_scores job failed: %s", exc)
