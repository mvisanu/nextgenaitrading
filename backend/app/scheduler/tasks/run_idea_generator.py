"""
Scheduler task: run the V3 idea generator every 60 minutes during market hours.

Orchestrates all three idea sources (news, theme, technical), deduplicates,
scores, and persists the top 50 ideas to the generated_ideas table.
Also prunes ideas older than 24 hours.

Market hours guard: skips outside 9:30–16:00 ET weekdays.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.models.generated_idea import GeneratedIdea
from app.services.v3_idea_generator_service import run_idea_generator
from app.utils.market_hours import is_market_hours

logger = logging.getLogger(__name__)


async def run_idea_generator_job() -> None:
    """
    Execute the full V3 idea generation pipeline and persist results.

    Steps:
      1. Market hours guard
      2. run_idea_generator() — news + theme + technical → top 50
      3. Purge expired ideas (expires_at < now)
    """
    if not is_market_hours():
        logger.debug("run_idea_generator_job: outside market hours — skipping")
        return

    logger.info("run_idea_generator_job: starting")
    try:
        async with AsyncSessionLocal() as db:
            saved = await run_idea_generator(db)
            logger.info("run_idea_generator_job: saved %d ideas", len(saved))

        # Purge expired ideas from previous cycles
        async with AsyncSessionLocal() as db:
            now_utc = datetime.now(timezone.utc)
            result = await db.execute(
                delete(GeneratedIdea).where(GeneratedIdea.expires_at < now_utc)
            )
            if result.rowcount > 0:
                await db.commit()
                logger.info("run_idea_generator_job: purged %d expired ideas", result.rowcount)

    except Exception as exc:
        logger.exception("run_idea_generator_job: job failed: %s", exc)
