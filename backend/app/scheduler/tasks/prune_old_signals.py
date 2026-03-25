"""
Scheduler task: prune buy_now_signals rows older than settings.signal_prune_days.

Runs daily. Keeps the audit table from growing unboundedly while preserving
recent history for the tooltip / audit trail UI.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.buy_signal import BuyNowSignal

logger = logging.getLogger(__name__)


async def prune_old_signals() -> None:
    """
    Delete buy_now_signals rows older than settings.signal_prune_days days.

    The default retention window is 30 days (configurable via SIGNAL_PRUNE_DAYS).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.signal_prune_days)
    logger.info("prune_old_signals: pruning rows older than %s", cutoff.isoformat())

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                delete(BuyNowSignal).where(BuyNowSignal.created_at < cutoff)
            )
            if result.rowcount > 0:
                await db.commit()
            logger.info("prune_old_signals: deleted %d rows", result.rowcount)
    except Exception as exc:
        logger.exception("prune_old_signals: job failed: %s", exc)
