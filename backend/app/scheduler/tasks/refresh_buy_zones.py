"""
Scheduler task: refresh buy zone snapshots for all tracked tickers.

Runs every 60 minutes (configurable via BUY_ZONE_REFRESH_MINUTES).
All tickers from active users' watchlist ideas are refreshed.
Snapshots newer than the refresh interval are skipped (idempotent).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select

from app.db.session import AsyncSessionLocal
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.services.buy_zone_service import calculate_buy_zone

logger = logging.getLogger(__name__)


async def refresh_buy_zones() -> None:
    """
    Refresh buy zone snapshots for all tickers tracked by any user.
    Idempotent: skips tickers with a snapshot newer than 60 minutes.
    """
    logger.info("refresh_buy_zones job starting")
    started_at = datetime.now(timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            # Collect all unique tickers from all users' ideas
            result = await db.execute(
                select(WatchlistIdeaTicker.ticker).distinct()
            )
            tickers = [row[0] for row in result.fetchall()]
            logger.info("refresh_buy_zones: found %d unique tickers to check", len(tickers))

            cutoff = datetime.now(timezone.utc) - timedelta(minutes=60)
            refreshed = skipped = errors = 0

            for ticker in tickers:
                try:
                    # Check if fresh snapshot exists
                    snap_result = await db.execute(
                        select(StockBuyZoneSnapshot)
                        .where(StockBuyZoneSnapshot.ticker == ticker)
                        .order_by(desc(StockBuyZoneSnapshot.created_at))
                        .limit(1)
                    )
                    snap = snap_result.scalar_one_or_none()

                    if snap and snap.created_at >= cutoff:
                        skipped += 1
                        continue

                    await calculate_buy_zone(ticker, db, user_id=None)
                    refreshed += 1
                    logger.debug("refresh_buy_zones: refreshed %s", ticker)
                except Exception as exc:
                    errors += 1
                    logger.error("refresh_buy_zones: error for %s: %s", ticker, exc)

            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
            logger.info(
                "refresh_buy_zones complete in %.1fs: refreshed=%d skipped=%d errors=%d",
                elapsed, refreshed, skipped, errors,
            )
    except Exception as exc:
        logger.exception("refresh_buy_zones job failed: %s", exc)
