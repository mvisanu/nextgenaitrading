"""Earnings / events calendar gate.

Returns days until next earnings event for a given symbol.
Uses yfinance calendar; results are cached in-memory (LRU, 60-min TTL).
"""
from __future__ import annotations

import logging
import time
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# Simple in-process TTL cache: {symbol: (timestamp, value)}
_CACHE: dict[str, tuple[float, Optional[int]]] = {}
_TTL = 3600  # 60 minutes


async def get_days_to_earnings(symbol: str) -> Optional[int]:
    """Return calendar days until next earnings, or None if > 60 days away."""
    now = time.monotonic()
    cached = _CACHE.get(symbol)
    if cached and (now - cached[0]) < _TTL:
        return cached[1]

    result: Optional[int] = None
    try:
        import yfinance as yf
        from datetime import date

        ticker = yf.Ticker(symbol)
        calendar = ticker.calendar
        if calendar is not None and not calendar.empty:
            # calendar is a DataFrame; earnings date is in the "Earnings Date" row
            if hasattr(calendar, "loc"):
                try:
                    earnings_dates = calendar.loc["Earnings Date"]
                    if hasattr(earnings_dates, "__iter__"):
                        for ed in earnings_dates:
                            try:
                                ed_date = ed.date() if hasattr(ed, "date") else None
                                if ed_date and ed_date >= date.today():
                                    days = (ed_date - date.today()).days
                                    if days <= 60:
                                        result = days
                                    break
                            except Exception:
                                continue
                except Exception:
                    pass
    except Exception as exc:
        logger.debug("get_days_to_earnings(%s) failed: %s", symbol, exc)

    _CACHE[symbol] = (now, result)
    return result
