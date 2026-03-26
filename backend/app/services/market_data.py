"""
Market data loader — wraps yfinance with consistent column normalisation.
Symbol and interval are always passed as parameters, never hardcoded.
"""
from __future__ import annotations

import logging

import pandas as pd
import yfinance as yf
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"Open", "High", "Low", "Close", "Volume"}


def load_ohlcv(
    symbol: str, interval: str = "1d", period: str = "730d"
) -> pd.DataFrame:
    """
    Fetch OHLCV data from yfinance.
    Raises ValueError if the symbol returns no data or is missing required columns.
    """
    try:
        df = yf.download(symbol, period=period, interval=interval, auto_adjust=True, progress=False)
    except Exception as exc:
        raise ValueError(f"yfinance download failed for '{symbol}': {exc}") from exc

    # Flatten MultiIndex columns produced by newer yfinance versions
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    if df.empty:
        raise ValueError(
            f"Symbol '{symbol}' returned no usable data for interval={interval}, period={period}"
        )

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"Symbol '{symbol}' returned no usable data (missing columns: {missing})"
        )

    df = df[list(REQUIRED_COLUMNS)].copy()
    df.dropna(inplace=True)
    return df


def validate_symbol(symbol: str) -> None:
    """
    Validate that a symbol is fetchable from yfinance.
    Raises HTTP 422 with a clear message if not found.
    """
    try:
        load_ohlcv(symbol, interval="1d", period="5d")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Symbol '{symbol}' not found or returned no data",
        ) from exc


def load_ohlcv_for_strategy(symbol: str, timeframe: str) -> pd.DataFrame:
    """
    Load OHLCV data for strategy/backtest use.
    Period length is chosen per timeframe to ensure enough bars remain after
    indicator warmup (EMA-50 alone consumes the first 50 bars).
    """
    interval_map = {
        "1m": "1m",
        "2m": "2m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1h",
        "2h": "1h",   # yfinance does not support 2h natively; resample from 1h
        "3h": "1h",   # yfinance does not support 3h natively; resample from 1h
        "4h": "1h",   # yfinance does not support 4h natively; resample from 1h
        "1d": "1d",
        "1wk": "1wk",
        "1mo": "1mo",
    }
    yf_interval = interval_map.get(timeframe, "1d")

    # yfinance data availability / period choices:
    #   1m        → max ~7 days
    #   2m–30m    → max ~60 days
    #   1h–4h     → max ~730 days (we cap at 60d to stay within yfinance limits)
    #   1d        → 730d  (~730 bars, plenty after indicator warmup)
    #   1wk       → 3650d (~520 bars; needs >60 after EMA-50 warmup consumes 50)
    #   1mo       → max   (~300+ bars depending on ticker history)
    if timeframe == "1m":
        period = "7d"
    elif timeframe in ("2m", "5m", "15m", "30m"):
        period = "60d"
    elif timeframe in ("1h", "2h", "3h", "4h"):
        period = "60d"
    elif timeframe == "1wk":
        # 730d (~104 bars) leaves only ~54 bars after EMA-50 warmup — below the 60-bar
        # minimum required by the strategy. Fetch 10 years to get ~500 weekly bars.
        period = "3650d"
    elif timeframe == "1mo":
        # 730d yields only ~24 monthly bars — far too few. Fetch the maximum available
        # history so we have enough bars after indicator warmup (EMA-50 needs 50+).
        period = "max"
    else:
        period = "730d"

    df = load_ohlcv(symbol, interval=yf_interval, period=period)

    # Resample 1h -> Nh if timeframe is 2h/3h/4h
    if timeframe in ("2h", "3h", "4h") and yf_interval == "1h":
        df = _resample_hours(df, int(timeframe[0]))

    return df


def _resample_hours(df: pd.DataFrame, hours: int) -> pd.DataFrame:
    """Resample 1h OHLCV to Nh bars."""
    df = df.copy()
    df.index = pd.to_datetime(df.index, utc=True)
    resampled = df.resample(f"{hours}h").agg(
        {
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }
    )
    resampled.dropna(inplace=True)
    return resampled


_INTRADAY_INTERVALS = {"1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h", "2h", "3h", "4h"}


def df_to_candles(df: pd.DataFrame, interval: str = "1d") -> list[dict]:
    """Convert OHLCV DataFrame to chart-ready [{time, open, high, low, close, volume}] list.

    For intraday intervals the ``time`` field is a Unix timestamp (int seconds)
    so that Lightweight Charts renders hours/minutes on the x-axis.  For daily+
    intervals the field stays as an ISO date string ``"YYYY-MM-DD"``.
    """
    intraday = interval in _INTRADAY_INTERVALS
    candles = []
    for ts, row in df.iterrows():
        if intraday and hasattr(ts, "timestamp"):
            time_val: int | str = int(ts.timestamp())
        elif hasattr(ts, "strftime"):
            time_val = ts.strftime("%Y-%m-%d")
        else:
            time_val = str(ts)[:10]
        candles.append(
            {
                "time": time_val,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]),
            }
        )
    return candles
