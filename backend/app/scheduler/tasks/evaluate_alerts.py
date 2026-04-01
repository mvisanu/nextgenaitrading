"""
Scheduler task: evaluate all enabled price alert rules.

Runs every 5 minutes (configurable via ALERT_EVAL_MINUTES).
Evaluation is idempotent — concurrent runs are safe because each rule
uses last_triggered_at for cooldown enforcement.
"""
from __future__ import annotations

import gc
import logging
from datetime import datetime, timezone

from app.db.session import AsyncSessionLocal
from app.services.alert_engine_service import evaluate_all_alerts

logger = logging.getLogger(__name__)


async def evaluate_alerts() -> None:
    """Evaluate all enabled alert rules and dispatch any triggered notifications."""
    logger.info("evaluate_alerts job starting")
    started_at = datetime.now(timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            summary = await evaluate_all_alerts(db)
            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
            logger.info(
                "evaluate_alerts complete in %.1fs: %s", elapsed, summary
            )
    except Exception as exc:
        logger.exception("evaluate_alerts job failed: %s", exc)
    finally:
        gc.collect()
