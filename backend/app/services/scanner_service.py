"""
Scanner service.

Core scanning logic that runs ConservativeStrategy over a list of tickers
and produces EstimatedBuyPriceOut / ScanResultOut results.

Design decisions:
- Runs strategy synchronously in a thread pool to keep the event loop free.
- One bad ticker never fails the whole scan (try/except per ticker).
- Notifications are dispatched only for BUY signals.
- Buy price estimation follows a clear priority:
    1. signal == "buy"  → current price (entry now)
    2. buy_zone_low/high available → midpoint of zone
    3. Bollinger lower band available in indicators → use that
    4. Fallback → None (data insufficient)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.scanner import EstimatedBuyPriceOut, ScanResultOut
from app.services.market_data import load_ohlcv_for_strategy
from app.services.notification_service import dispatch_notification
from app.strategies.conservative import (
    ConservativeStrategy,
    _add_indicators,
)

logger = logging.getLogger(__name__)

# Default timeframe used by the scanner — daily bars give the most reliable HMM fit
SCANNER_TIMEFRAME = "1d"

_strategy = ConservativeStrategy()


def _run_strategy_sync(ticker: str) -> dict:
    """
    Load OHLCV and run ConservativeStrategy entirely in the calling thread.
    Returns a plain dict so it can cross the asyncio/thread boundary safely.
    """
    df_raw = load_ohlcv_for_strategy(ticker, SCANNER_TIMEFRAME)
    df = _add_indicators(df_raw)

    result = _strategy.generate_signals(df_raw)

    current_price: float = float(df_raw["Close"].iloc[-1])

    # Bollinger lower band from the indicator-enriched frame (if enough bars)
    bb_lower: Optional[float] = None
    if len(df) > 0 and "bb_lower" in df.columns:
        val = df["bb_lower"].iloc[-1]
        if val > 0:
            bb_lower = float(val)

    # Per-indicator confirmation details from the last bar
    details = result.confirmation_details  # list[dict] with "name" / "met" / "value"

    # Labels for unmet confirmations
    confirmations_needed = [d["name"] for d in details if not d.get("met", False)]

    return {
        "result": result,
        "current_price": current_price,
        "bb_lower": bb_lower,
        "confirmations_needed": confirmations_needed,
    }


def _estimate_buy_price(
    signal: str,
    current_price: float,
    buy_zone_low: Optional[float],
    buy_zone_high: Optional[float],
    bb_lower: Optional[float],
) -> Optional[float]:
    """
    Estimate the best entry price based on available signal data.

    Priority:
      1. signal == "buy" → enter at current price
      2. buy zone available → midpoint of low/high
      3. Bollinger lower band → use as a mean-reversion target
      4. Fallback → None
    """
    if signal == "buy":
        return round(current_price, 4)
    if buy_zone_low is not None and buy_zone_high is not None:
        return round((buy_zone_low + buy_zone_high) / 2.0, 4)
    if bb_lower is not None:
        return round(bb_lower, 4)
    return None


async def estimate_buy_price(
    ticker: str,
    db: AsyncSession,  # noqa: ARG001 — reserved for future DB-backed enrichment
) -> EstimatedBuyPriceOut:
    """
    Load market data, run ConservativeStrategy, and return an enriched
    signal result with an estimated entry price for a single ticker.

    Raises ValueError if market data cannot be fetched.
    """
    ticker = ticker.upper().strip()
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _run_strategy_sync, ticker)

    result = data["result"]
    current_price: float = data["current_price"]
    bb_lower: Optional[float] = data["bb_lower"]
    confirmations_needed: list[str] = data["confirmations_needed"]

    # No DB-backed buy zone yet at single-ticker scan level; future: query StockBuyZoneSnapshot
    buy_zone_low: Optional[float] = None
    buy_zone_high: Optional[float] = None

    estimated = _estimate_buy_price(
        result.signal, current_price, buy_zone_low, buy_zone_high, bb_lower
    )

    return EstimatedBuyPriceOut(
        ticker=ticker,
        estimated_buy_price=estimated,
        current_price=current_price,
        signal=result.signal,
        regime=result.regime,
        confirmation_count=result.confirmation_count,
        min_confirmations=_strategy.min_confirmations,
        confirmations_needed=confirmations_needed,
        buy_zone_low=buy_zone_low,
        buy_zone_high=buy_zone_high,
    )


async def scan_watchlist(
    tickers: list[str],
    user_id: int,
    db: AsyncSession,
) -> list[ScanResultOut]:
    """
    Scan a list of tickers for the given user.

    For every ticker:
    - Run ConservativeStrategy via estimate_buy_price
    - Dispatch a notification if the signal is "buy"
    - Wrap the result in ScanResultOut

    One failing ticker is logged and skipped; it never aborts the full scan.
    """
    results: list[ScanResultOut] = []
    scanned_at = datetime.now(timezone.utc)

    for raw_ticker in tickers:
        ticker = raw_ticker.upper().strip()
        try:
            ebp = await estimate_buy_price(ticker, db)

            notification_sent = False
            if ebp.signal == "buy":
                try:
                    await dispatch_notification(
                        user_id=user_id,
                        subject=f"BUY signal — {ticker}",
                        body=(
                            f"{ticker} has triggered a BUY signal "
                            f"({ebp.confirmation_count}/{_strategy.min_confirmations} confirmations met). "
                            f"Regime: {ebp.regime}. "
                            f"Estimated entry: {ebp.estimated_buy_price}"
                        ),
                        metadata={
                            "ticker": ticker,
                            "signal": ebp.signal,
                            "regime": ebp.regime,
                            "confirmation_count": ebp.confirmation_count,
                            "estimated_buy_price": ebp.estimated_buy_price,
                            "current_price": ebp.current_price,
                        },
                    )
                    notification_sent = True
                except Exception as exc:
                    logger.error(
                        "scan_watchlist: notification failed for %s user_id=%d: %s",
                        ticker, user_id, exc,
                    )

            results.append(
                ScanResultOut(
                    ticker=ebp.ticker,
                    estimated_buy_price=ebp.estimated_buy_price,
                    current_price=ebp.current_price,
                    signal=ebp.signal,
                    regime=ebp.regime,
                    confirmation_count=ebp.confirmation_count,
                    min_confirmations=ebp.min_confirmations,
                    confirmations_needed=ebp.confirmations_needed,
                    buy_zone_low=ebp.buy_zone_low,
                    buy_zone_high=ebp.buy_zone_high,
                    notification_sent=notification_sent,
                    scanned_at=scanned_at,
                )
            )
        except Exception as exc:
            logger.error(
                "scan_watchlist: failed for ticker=%s user_id=%d: %s",
                ticker, user_id, exc,
            )

    return results
