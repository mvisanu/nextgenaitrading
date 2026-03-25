"""
Scheduler task: scan all users' watchlists every 15 minutes during market hours.

Market hours guard:
  NYSE / NASDAQ: Monday–Friday 09:30–16:00 US/Eastern.
  The guard uses UTC offsets (ET = UTC-5 standard, UTC-4 daylight).
  A conservative window of 13:30–21:00 UTC covers both EST and EDT without
  pulling in a tz dependency.  Scans are skipped on weekends entirely.

Idempotency:
  Each run is fully independent — no shared state is written between runs.
  APScheduler is configured with coalesce=True and max_instances=1,
  so a slow scan that overruns its 15-minute slot is never double-scheduled.

Per-user isolation:
  Each user's tickers are scanned independently and notified individually.
  One user's failure does not abort other users' scans.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.user import User
from app.services.scanner_service import scan_watchlist

logger = logging.getLogger(__name__)

# UTC window that covers NYSE/NASDAQ market hours in both EST (UTC-5) and EDT (UTC-4).
# NYSE opens 09:30 ET = 13:30 UTC (EDT) / 14:30 UTC (EST).
# NYSE closes 16:00 ET = 20:00 UTC (EDT) / 21:00 UTC (EST).
# We use 13:30–21:00 UTC to handle both offsets conservatively.
_MARKET_OPEN_UTC_HOUR = 13
_MARKET_OPEN_UTC_MINUTE = 30
_MARKET_CLOSE_UTC_HOUR = 21
_MARKET_CLOSE_UTC_MINUTE = 0


def _is_market_hours(now: datetime) -> bool:
    """Return True if now falls within the NYSE/NASDAQ market hours window (UTC)."""
    # Weekends: Saturday=5, Sunday=6
    if now.weekday() >= 5:
        return False

    open_minutes = _MARKET_OPEN_UTC_HOUR * 60 + _MARKET_OPEN_UTC_MINUTE
    close_minutes = _MARKET_CLOSE_UTC_HOUR * 60 + _MARKET_CLOSE_UTC_MINUTE
    current_minutes = now.hour * 60 + now.minute

    return open_minutes <= current_minutes < close_minutes


async def scan_all_watchlists() -> None:
    """
    Scan every active user's watchlist tickers and dispatch BUY-signal notifications.

    Skips runs outside NYSE/NASDAQ market hours to avoid stale after-hours signals.
    """
    now = datetime.now(timezone.utc)

    if not _is_market_hours(now):
        logger.debug(
            "scan_all_watchlists: outside market hours (%02d:%02d UTC weekday=%d) — skipping",
            now.hour, now.minute, now.weekday(),
        )
        return

    logger.info("scan_all_watchlists job starting at %s UTC", now.isoformat())
    started_at = now

    try:
        async with AsyncSessionLocal() as db:
            # Collect all users who have at least one watchlist idea
            users_result = await db.execute(
                select(User.id)
                .join(WatchlistIdea, WatchlistIdea.user_id == User.id)
                .distinct()
            )
            user_ids: list[int] = [row[0] for row in users_result.fetchall()]

            if not user_ids:
                logger.info("scan_all_watchlists: no users with watchlist ideas — nothing to scan")
                return

            logger.info("scan_all_watchlists: scanning watchlists for %d user(s)", len(user_ids))

            total_buy_signals = 0
            total_errors = 0

            for user_id in user_ids:
                try:
                    # Fetch this user's unique tickers
                    tickers_result = await db.execute(
                        select(WatchlistIdeaTicker.ticker)
                        .join(WatchlistIdea, WatchlistIdea.id == WatchlistIdeaTicker.idea_id)
                        .where(WatchlistIdea.user_id == user_id)
                        .distinct()
                    )
                    tickers: list[str] = [row[0] for row in tickers_result.fetchall()]

                    if not tickers:
                        continue

                    results = await scan_watchlist(tickers, user_id, db)

                    buy_count = sum(1 for r in results if r.signal == "buy")
                    total_buy_signals += buy_count

                    logger.info(
                        "scan_all_watchlists: user_id=%d scanned=%d buy_signals=%d notifications=%d",
                        user_id,
                        len(results),
                        buy_count,
                        sum(1 for r in results if r.notification_sent),
                    )

                except Exception as exc:
                    total_errors += 1
                    logger.error(
                        "scan_all_watchlists: error for user_id=%d: %s", user_id, exc
                    )

            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
            logger.info(
                "scan_all_watchlists complete in %.1fs: users=%d total_buy_signals=%d errors=%d",
                elapsed, len(user_ids), total_buy_signals, total_errors,
            )

    except Exception as exc:
        logger.exception("scan_all_watchlists job failed: %s", exc)
