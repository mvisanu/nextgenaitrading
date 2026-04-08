"""
Scheduler tasks for the Wheel Strategy Bot.

wheel_bot_monitor_task  — runs every 15 minutes during market hours.
    For each active WheelBotSession: call check_and_act(), commit once after loop.

wheel_bot_daily_summary_task — cron at 16:05 ET (21:05 UTC) Mon-Fri.
    For each active session: generate_daily_summary(), store as JSON, commit once.

CLAUDE.md constraints:
  - Single AsyncSessionLocal outside the loop
  - One db.commit() after the loop
  - gc.collect() in finally
"""
from __future__ import annotations

import asyncio
import gc
import json
import logging

from sqlalchemy import select

from app.broker.wheel_alpaca_client import WheelAlpacaClient
from app.db.session import AsyncSessionLocal
from app.models.wheel_bot import WheelBotSession
from app.services.wheel_bot_service import check_and_act, generate_daily_summary
from app.utils.market_hours import is_market_hours

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    """
    Check all active wheel bot sessions and execute check_and_act logic.

    Uses a single AsyncSessionLocal for the full function body with one commit
    after the loop, in compliance with the CLAUDE.md constraint against opening
    sessions inside a loop body.
    """
    if not is_market_hours():
        logger.debug("wheel_bot_monitor: outside market hours — skipping")
        return

    logger.info("wheel_bot_monitor: starting")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(WheelBotSession).where(WheelBotSession.status == "active")
            )
            sessions = result.scalars().all()

            if not sessions:
                logger.info("wheel_bot_monitor: no active sessions — nothing to do")
                return

            logger.info(
                "wheel_bot_monitor: checking %d active session(s)", len(sessions)
            )

            errors = 0
            client = WheelAlpacaClient()

            for session in sessions:
                try:
                    await check_and_act(session, client, db)

                except Exception as exc:
                    errors += 1
                    logger.error(
                        "wheel_bot_monitor: session id=%d error: %s",
                        session.id,
                        exc,
                    )

            await db.commit()

            logger.info(
                "wheel_bot_monitor: complete — sessions=%d errors=%d",
                len(sessions),
                errors,
            )

    except Exception as exc:
        logger.exception("wheel_bot_monitor: job failed: %s", exc)
    finally:
        gc.collect()


async def _run_daily_summary() -> None:
    """
    Generate daily summary for each active wheel bot session.

    Stores summary JSON in session.last_summary_json. Uses a single AsyncSessionLocal
    for the full function body with one commit after the loop.
    """
    logger.info("wheel_bot_daily_summary: starting")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(WheelBotSession).where(WheelBotSession.status == "active")
            )
            sessions = result.scalars().all()

            if not sessions:
                logger.info("wheel_bot_daily_summary: no active sessions — nothing to do")
                return

            logger.info(
                "wheel_bot_daily_summary: generating summaries for %d session(s)",
                len(sessions),
            )

            errors = 0
            client = WheelAlpacaClient()

            for session in sessions:
                try:
                    summary = await generate_daily_summary(session, client)
                    session.last_summary_json = json.dumps(summary)
                    logger.info(
                        "wheel_bot_daily_summary: session id=%d — premium_collected=$%.2f equity=$%.2f return=%.2f%%",
                        session.id,
                        summary.get("total_premium_collected", 0.0),
                        summary.get("account_equity", 0.0),
                        summary.get("total_return_pct", 0.0),
                    )

                except Exception as exc:
                    errors += 1
                    logger.error(
                        "wheel_bot_daily_summary: session id=%d error: %s",
                        session.id,
                        exc,
                    )

            await db.commit()

            logger.info(
                "wheel_bot_daily_summary: complete — sessions=%d errors=%d",
                len(sessions),
                errors,
            )

    except Exception as exc:
        logger.exception("wheel_bot_daily_summary: job failed: %s", exc)
    finally:
        gc.collect()


def monitor_wheel_bots() -> None:
    """Synchronous APScheduler entry point — 15-minute interval during market hours."""
    asyncio.run(_run_monitor())


def wheel_bot_daily_summary() -> None:
    """Synchronous APScheduler entry point — daily at 16:05 ET (21:05 UTC Mon-Fri)."""
    asyncio.run(_run_daily_summary())
