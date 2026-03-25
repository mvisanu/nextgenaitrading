"""
Live scanner service — V3 batch watchlist evaluator.

Wraps buy_signal_service.evaluate_buy_signal() for per-user watchlist
batch processing.  Used by the run_live_scanner scheduler task and by
POST /api/scanner/run-now.

Per-user isolation: failures for one ticker do not abort the rest.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.buy_signal import BuyNowSignal
from app.models.user_watchlist import UserWatchlist
from app.services.buy_signal_service import evaluate_buy_signal

logger = logging.getLogger(__name__)


@dataclass
class LiveScanResult:
    ticker: str
    signal: BuyNowSignal | None
    error: str | None = None


async def scan_user_watchlist(
    user_id: int,
    db: AsyncSession,
) -> list[LiveScanResult]:
    """
    Evaluate the 10-condition buy signal gate for every ticker in a user's
    V3 watchlist (user_watchlist table).

    Parameters
    ----------
    user_id:
        Authenticated user whose watchlist to scan.
    db:
        Async SQLAlchemy session.

    Returns
    -------
    list[LiveScanResult]
        One result per watchlist ticker.  Errors are captured per-ticker;
        the overall function never raises.

    Examples
    --------
    >>> # Typically called from run_live_scanner scheduler task:
    >>> # results = await scan_user_watchlist(user_id=1, db=session)
    >>> # strong_buys = [r for r in results if r.signal and r.signal.all_conditions_pass]
    """
    # Load user's watchlist tickers
    wl_result = await db.execute(
        select(UserWatchlist).where(UserWatchlist.user_id == user_id)
    )
    watchlist_rows = list(wl_result.scalars().all())

    if not watchlist_rows:
        logger.debug("live_scanner: user_id=%d has no watchlist tickers", user_id)
        return []

    results: list[LiveScanResult] = []
    for row in watchlist_rows:
        ticker = row.ticker
        try:
            signal = await evaluate_buy_signal(
                ticker=ticker,
                user_id=user_id,
                db=db,
                alert_enabled=row.alert_enabled,
            )
            results.append(LiveScanResult(ticker=ticker, signal=signal))
            logger.debug(
                "live_scanner: %s user_id=%d all_pass=%s",
                ticker, user_id, signal.all_conditions_pass,
            )
        except Exception as exc:
            logger.error(
                "live_scanner: error evaluating %s for user_id=%d: %s",
                ticker, user_id, exc,
            )
            results.append(LiveScanResult(ticker=ticker, signal=None, error=str(exc)))

    strong_buys = sum(1 for r in results if r.signal and r.signal.all_conditions_pass)
    logger.info(
        "live_scanner: user_id=%d scanned=%d strong_buys=%d errors=%d",
        user_id,
        len(results),
        strong_buys,
        sum(1 for r in results if r.error),
    )
    return results
