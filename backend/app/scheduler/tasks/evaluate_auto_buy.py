"""
Scheduler task: evaluate auto-buy for all users with auto-buy enabled.

Runs every 5 minutes (configurable via AUTO_BUY_EVAL_MINUTES).
Only processes users with AutoBuySettings.enabled=True.
"""
from __future__ import annotations

import gc
import logging
from datetime import datetime, timezone

from app.db.session import AsyncSessionLocal
from app.services.auto_buy_engine import evaluate_all_auto_buy

logger = logging.getLogger(__name__)


async def evaluate_auto_buy() -> None:
    """Evaluate auto-buy decisions for all tickers in enabled users' watchlists."""
    logger.info("evaluate_auto_buy job starting")
    started_at = datetime.now(timezone.utc)

    try:
        async with AsyncSessionLocal() as db:
            summary = await evaluate_all_auto_buy(db)
            elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
            logger.info(
                "evaluate_auto_buy complete in %.1fs: %s", elapsed, summary
            )
    except Exception as exc:
        logger.exception("evaluate_auto_buy job failed: %s", exc)
    finally:
        gc.collect()
