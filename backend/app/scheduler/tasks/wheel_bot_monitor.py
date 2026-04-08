"""
Scheduler tasks for the Wheel Strategy Bot (V7).

wheel_bot_monitor     — every 15 min, market hours only; calls check_and_act()
wheel_bot_daily_summary — cron 21:05 UTC Mon–Fri; calls generate_daily_summary()
"""
from __future__ import annotations

import asyncio
import gc
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.broker.wheel_alpaca_client import WheelAlpacaClient
from app.db.session import AsyncSessionLocal
from app.models.wheel_bot import WheelBotSession
from app.services.wheel_bot_service import check_and_act, generate_daily_summary

logger = logging.getLogger(__name__)

# US Eastern market hours in UTC: 09:30–16:00 ET = 14:30–21:00 UTC (approximate)
# We use UTC hours 14–21 as a loose market-hours guard.
_MARKET_OPEN_UTC_HOUR = 14
_MARKET_CLOSE_UTC_HOUR = 21


def _is_market_hours() -> bool:
    """Return True if current UTC time is within approximate US market hours."""
    now_utc = datetime.now(timezone.utc)
    # Monday=0 … Friday=4
    if now_utc.weekday() > 4:
        return False
    return _MARKET_OPEN_UTC_HOUR <= now_utc.hour < _MARKET_CLOSE_UTC_HOUR


# ── Monitor task ──────────────────────────────────────────────────────────────

async def _run_monitor() -> None:
    """
    Check all active wheel bot sessions and advance the state machine.

    Single AsyncSessionLocal covers the full function body; one commit after the loop.
    """
    if not _is_market_hours():
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

            logger.info("wheel_bot_monitor: checking %d active session(s)", len(sessions))

            client = WheelAlpacaClient()
            errors = 0

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


def monitor_wheel_bots() -> None:
    """Synchronous APScheduler entry point for the 15-min monitor."""
    asyncio.run(_run_monitor())


# ── Daily summary task ────────────────────────────────────────────────────────

async def _run_daily_summary() -> None:
    """
    Generate and cache daily summaries for all active wheel bot sessions.

    Single AsyncSessionLocal for the full function body; one commit after the loop
    (generate_daily_summary commits per session internally — that's acceptable here
    since summaries are idempotent and low-frequency).
    """
    logger.info("wheel_bot_daily_summary: starting")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(WheelBotSession).where(WheelBotSession.status == "active")
            )
            sessions = result.scalars().all()

            if not sessions:
                logger.info("wheel_bot_daily_summary: no active sessions")
                return

            client = WheelAlpacaClient()
            errors = 0

            for session in sessions:
                try:
                    await generate_daily_summary(session, client, db)
                    logger.info(
                        "wheel_bot_daily_summary: session %d summary cached",
                        session.id,
                    )
                except Exception as exc:
                    errors += 1
                    logger.error(
                        "wheel_bot_daily_summary: session id=%d error: %s",
                        session.id,
                        exc,
                    )

            logger.info(
                "wheel_bot_daily_summary: complete — sessions=%d errors=%d",
                len(sessions),
                errors,
            )

    except Exception as exc:
        logger.exception("wheel_bot_daily_summary: job failed: %s", exc)
    finally:
        gc.collect()


def run_wheel_bot_daily_summary() -> None:
    """Synchronous APScheduler entry point for the daily summary cron."""
    asyncio.run(_run_daily_summary())
