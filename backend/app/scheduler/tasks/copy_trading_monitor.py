# backend/app/scheduler/tasks/copy_trading_monitor.py
"""
Scheduler task: poll Quiver Quant + copy new congressional trades every 15 minutes.

Fetches Quiver data once per run (shared across all active sessions).
A single AsyncSessionLocal covers the full function body; one db.commit() after processing.
"""
from __future__ import annotations

import asyncio
import gc
import logging

from app.db.session import AsyncSessionLocal
from app.services.copy_trading_service import process_active_sessions

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    logger.info("copy_trading_monitor: starting")
    try:
        async with AsyncSessionLocal() as db:
            await process_active_sessions(db)
            await db.commit()
        logger.info("copy_trading_monitor: complete")
    except Exception as exc:
        logger.exception("copy_trading_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def monitor_copy_trading() -> None:
    """Synchronous APScheduler entry point."""
    asyncio.run(_run_monitor())
