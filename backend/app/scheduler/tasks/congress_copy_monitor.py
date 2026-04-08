"""
Scheduler task: check active congress copy sessions every N minutes.

Per CLAUDE.md constraints:
- Single AsyncSessionLocal for full function body
- One db.commit() after the loop
- gc.collect() in finally block
- Per-session failures logged but do NOT abort remaining sessions
"""
from __future__ import annotations

import asyncio
import gc
import logging

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.congress_trade import CongressCopySession
from app.services.congress_copy_service import process_new_trades

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    logger.info("congress_copy_monitor: starting")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CongressCopySession).where(CongressCopySession.status == "active")
            )
            sessions = result.scalars().all()

            if not sessions:
                logger.info("congress_copy_monitor: no active sessions — nothing to do")
                return

            logger.info(
                "congress_copy_monitor: checking %d active session(s)", len(sessions)
            )

            errors = 0
            total_new = 0
            for session in sessions:
                try:
                    new_count = await process_new_trades(session, db)
                    total_new += new_count
                except Exception as exc:
                    errors += 1
                    logger.error(
                        "congress_copy_monitor: session id=%d error: %s",
                        session.id,
                        exc,
                    )

            await db.commit()
            logger.info(
                "congress_copy_monitor: complete — sessions=%d new_trades=%d errors=%d",
                len(sessions),
                total_new,
                errors,
            )
    except Exception as exc:
        logger.exception("congress_copy_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def run_congress_copy_monitor() -> None:
    """Synchronous APScheduler entry point."""
    asyncio.run(_run_monitor())
