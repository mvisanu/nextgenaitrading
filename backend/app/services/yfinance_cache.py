"""
Shared yfinance .info TTL cache.

Both entry_priority_service and financial_quality_service call yf.Ticker(t).info
for every ticker in IDEA_UNIVERSE during idea generation. The .info response is
a large JSON blob (~15-25 KB each). Caching with a 30-minute TTL saves ~15-25 MB
of peak memory and eliminates duplicate HTTP round-trips during the same scheduler
run.

Usage:
    from app.services.yfinance_cache import get_ticker_info

    info = get_ticker_info("NVDA")  # cached for INFO_CACHE_TTL seconds
"""
from __future__ import annotations

import logging
import time

import yfinance as yf

logger = logging.getLogger(__name__)

INFO_CACHE_TTL: float = 1800.0  # 30 minutes

# ticker -> (info_dict, timestamp)
_info_cache: dict[str, tuple[dict, float]] = {}


def get_ticker_info(ticker: str) -> dict:
    """Return yf.Ticker(ticker).info, served from TTL cache when fresh."""
    t = ticker.upper()
    now = time.monotonic()
    cached = _info_cache.get(t)
    if cached is not None:
        info, ts = cached
        if (now - ts) < INFO_CACHE_TTL:
            return info

    try:
        info = yf.Ticker(t).info
        _info_cache[t] = (info, now)
        return info
    except Exception as exc:
        logger.warning("yfinance_cache: .info failed for %s: %s", t, exc)
        # Return stale entry if available, otherwise empty dict
        if cached is not None:
            return cached[0]
        return {}
