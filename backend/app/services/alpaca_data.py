"""
Alpaca Historical Market Data client.

Used as the primary data source for US stocks and ETFs when
ALPACA_DATA_KEY / ALPACA_DATA_SECRET are configured.  Falls back
gracefully to yfinance when keys are absent or a request fails.

Alpaca free tier uses the IEX feed (15-min delayed for free accounts);
paid SIP subscription gives real-time consolidated tape data.

Unsupported by Alpaca (always handled by yfinance):
  - Futures / commodities  (=F, .CMX, .NYM)
  - Forex                  (=X)
  - Crypto                 (BTC-USD, ETH-USD, etc.)
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import TYPE_CHECKING

import pandas as pd

if TYPE_CHECKING:
    from alpaca.data.historical import StockHistoricalDataClient

logger = logging.getLogger(__name__)

# Patterns that indicate a symbol NOT supported by Alpaca equities feed
_YFINANCE_ONLY_RE = re.compile(
    r"(=F|=X|\.(CMX|NYM|CBT|NYB|CME)$|^[A-Z]+-USD$|^[A-Z]+-[A-Z]{3,}$)",
    re.IGNORECASE,
)


def is_alpaca_supported(symbol: str) -> bool:
    """Return True if the symbol can be fetched from Alpaca's equity/ETF feed.

    Plain US equity/ETF tickers (1-5 uppercase letters) qualify.
    Futures, forex, crypto, and yfinance-specific suffixes do not.
    """
    if _YFINANCE_ONLY_RE.search(symbol):
        return False
    # Must be plain letters only (no dots, equals, hyphens)
    return bool(re.fullmatch(r"[A-Z]{1,5}", symbol.upper()))


@lru_cache(maxsize=1)
def _get_client() -> "StockHistoricalDataClient | None":
    """Return a cached StockHistoricalDataClient, or None if keys not configured.

    Key resolution order:
      1. ALPACA_DATA_KEY / ALPACA_DATA_SECRET  (data-specific override)
      2. ALPACA_API_KEY  / ALPACA_SECRET_KEY   (standard trading keys, reused for data)
    """
    try:
        from app.core.config import settings
        from alpaca.data.historical import StockHistoricalDataClient

        key = settings.alpaca_data_key.strip() or settings.alpaca_api_key.strip()
        secret = settings.alpaca_data_secret.strip() or settings.alpaca_secret_key.strip()
        if not key or not secret:
            return None
        client = StockHistoricalDataClient(api_key=key, secret_key=secret)
        logger.info("Alpaca data client initialised (key=...%s)", key[-4:])
        return client
    except Exception as exc:
        logger.warning("Alpaca data client init failed: %s", exc)
        return None


def _period_to_start(period: str) -> datetime:
    """Convert a yfinance-style period string to an absolute UTC start datetime."""
    now = datetime.now(tz=timezone.utc)
    if period == "max":
        return datetime(2010, 1, 1, tzinfo=timezone.utc)
    m = re.fullmatch(r"(\d+)(d|mo|y)", period)
    if not m:
        return now - timedelta(days=730)
    value, unit = int(m.group(1)), m.group(2)
    if unit == "d":
        return now - timedelta(days=value)
    if unit == "mo":
        return now - timedelta(days=value * 30)
    return now - timedelta(days=value * 365)


def _interval_to_timeframe(interval: str):
    """Map yfinance interval string to alpaca-py TimeFrame."""
    from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

    mapping = {
        "1m":  TimeFrame(1,  TimeFrameUnit.Minute),
        "2m":  TimeFrame(2,  TimeFrameUnit.Minute),
        "5m":  TimeFrame(5,  TimeFrameUnit.Minute),
        "15m": TimeFrame(15, TimeFrameUnit.Minute),
        "30m": TimeFrame(30, TimeFrameUnit.Minute),
        "1h":  TimeFrame(1,  TimeFrameUnit.Hour),
        "2h":  TimeFrame(2,  TimeFrameUnit.Hour),
        "3h":  TimeFrame(3,  TimeFrameUnit.Hour),
        "4h":  TimeFrame(4,  TimeFrameUnit.Hour),
        "1d":  TimeFrame(1,  TimeFrameUnit.Day),
        "1wk": TimeFrame(1,  TimeFrameUnit.Week),
        "1mo": TimeFrame(1,  TimeFrameUnit.Month),
    }
    tf = mapping.get(interval)
    if tf is None:
        raise ValueError(f"Unsupported interval for Alpaca: '{interval}'")
    return tf


def load_ohlcv_alpaca(
    symbol: str,
    interval: str = "1d",
    period: str = "730d",
) -> pd.DataFrame:
    """Fetch OHLCV bars from Alpaca and return a DataFrame matching the yfinance
    schema: DatetimeIndex, columns Open/High/Low/Close/Volume (title-cased).

    Raises ValueError on any failure so the caller can fall back to yfinance.
    """
    client = _get_client()
    if client is None:
        raise ValueError("Alpaca data client not configured")

    from alpaca.data.requests import StockBarsRequest

    timeframe = _interval_to_timeframe(interval)
    start = _period_to_start(period)

    request = StockBarsRequest(
        symbol_or_symbols=symbol.upper(),
        timeframe=timeframe,
        start=start,
        adjustment="all",  # split + dividend adjusted (equivalent to auto_adjust)
    )

    bars = client.get_stock_bars(request)
    df = bars.df  # MultiIndex: (symbol, timestamp)

    if df.empty:
        raise ValueError(f"Alpaca returned no data for '{symbol}' interval={interval}")

    # Flatten MultiIndex — drop symbol level, keep timestamp as index
    if isinstance(df.index, pd.MultiIndex):
        df = df.xs(symbol.upper(), level="symbol")

    df.index = pd.to_datetime(df.index, utc=True)

    # Rename to title-case to match yfinance schema expected by the rest of the app
    rename = {
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "volume": "Volume",
    }
    df = df.rename(columns=rename)

    missing = {"Open", "High", "Low", "Close", "Volume"} - set(df.columns)
    if missing:
        raise ValueError(f"Alpaca response missing columns: {missing}")

    return df[["Open", "High", "Low", "Close", "Volume"]].dropna()
