"""
Scheduler task: run the V3 live scanner every 5 minutes during market hours.

For each user who has at least one ticker in the user_watchlist table:
  1. Call live_scanner_service.scan_user_watchlist(user_id)
  2. buy_signal_service handles notification dispatch if all_conditions_pass=True

Market hours guard uses the canonical utils/market_hours.py implementation
(DST-aware US/Eastern timezone).

Idempotency: the 4-hour cooldown inside evaluate_buy_signal prevents
duplicate STRONG_BUY notifications across multiple consecutive 5-minute runs.
"""
from __future__ import annotations

import gc
import logging

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.user_watchlist import UserWatchlist
from app.services.live_scanner_service import scan_user_watchlist
from app.utils.market_hours import is_market_hours

logger = logging.getLogger(__name__)


async def run_live_scanner() -> None:
    """
    Scan all users' V3 watchlist tickers and dispatch BUY signals.

    Skips execution outside NYSE market hours.
    Per-user failures are logged but do not abort the remaining users.
    """
    if not is_market_hours():
        logger.debug("run_live_scanner: outside market hours — skipping")
        return

    logger.info("run_live_scanner: starting")

    try:
        async with AsyncSessionLocal() as db:
            # Collect distinct users with at least one watchlist entry
            users_result = await db.execute(
                select(User.id)
                .join(UserWatchlist, UserWatchlist.user_id == User.id)
                .distinct()
            )
            user_ids: list[int] = [row[0] for row in users_result.fetchall()]

        if not user_ids:
            logger.info("run_live_scanner: no users with watchlist tickers — nothing to scan")
            return

        logger.info("run_live_scanner: scanning watchlists for %d user(s)", len(user_ids))
        total_strong = 0
        total_errors = 0

        for user_id in user_ids:
            try:
                async with AsyncSessionLocal() as db:
                    results = await scan_user_watchlist(user_id=user_id, db=db)
                total_strong += sum(1 for r in results if r.signal and r.signal.all_conditions_pass)
                total_errors += sum(1 for r in results if r.error)
            except Exception as exc:
                total_errors += 1
                logger.error("run_live_scanner: error for user_id=%d: %s", user_id, exc)

        logger.info(
            "run_live_scanner: complete — users=%d strong_buys=%d errors=%d",
            len(user_ids), total_strong, total_errors,
        )

    except Exception as exc:
        logger.exception("run_live_scanner: job failed: %s", exc)
    finally:
        gc.collect()
