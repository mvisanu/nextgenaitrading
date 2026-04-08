"""
Scheduler task: monitor active trailing bot sessions every 5 minutes.

For each active TrailingBotSession:
  1. Load the associated BrokerCredential
  2. Instantiate the broker client via factory
  3. Call adjust_trailing_stop() to evaluate and update the stop order

Per-session failures are logged but do not abort processing of remaining sessions.
A single AsyncSessionLocal covers the full function body; one db.commit() after the loop.
"""
from __future__ import annotations

import asyncio
import gc
import logging

from sqlalchemy import select

from app.broker.factory import get_broker_client
from app.db.session import AsyncSessionLocal
from app.models.broker import BrokerCredential
from app.models.trailing_bot import TrailingBotSession
from app.services.trailing_bot_service import adjust_trailing_stop

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    """
    Check all active trailing bot sessions and adjust stop orders as needed.

    Uses a single AsyncSessionLocal for the full function body with one commit
    after the loop, in compliance with the CLAUDE.md constraint against opening
    sessions inside a loop body.
    """
    logger.info("trailing_bot_monitor: starting")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TrailingBotSession).where(TrailingBotSession.status == "active")
            )
            sessions = result.scalars().all()

            if not sessions:
                logger.info("trailing_bot_monitor: no active sessions — nothing to do")
                return

            logger.info(
                "trailing_bot_monitor: checking %d active session(s)", len(sessions)
            )

            errors = 0
            for session in sessions:
                try:
                    cred_result = await db.execute(
                        select(BrokerCredential).where(
                            BrokerCredential.id == session.credential_id
                        )
                    )
                    cred = cred_result.scalar_one_or_none()
                    if cred is None:
                        logger.warning(
                            "trailing_bot_monitor: session id=%d has no credential (id=%d) — skipping",
                            session.id,
                            session.credential_id,
                        )
                        errors += 1
                        continue

                    broker = get_broker_client(cred)
                    await adjust_trailing_stop(session, broker, db)

                except Exception as exc:
                    errors += 1
                    logger.error(
                        "trailing_bot_monitor: session id=%d error: %s",
                        session.id,
                        exc,
                    )

            await db.commit()

            logger.info(
                "trailing_bot_monitor: complete — sessions=%d errors=%d",
                len(sessions),
                errors,
            )

    except Exception as exc:
        logger.exception("trailing_bot_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def monitor_trailing_bots() -> None:
    """Synchronous APScheduler entry point."""
    asyncio.run(_run_monitor())
