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
    Load 730 days of OHLCV for strategy/backtest use.
    Maps timeframe parameter to yfinance interval.
    """
    interval_map = {
        "1d": "1d",
        "1h": "1h",
        "4h": "1h",   # yfinance does not support 4h natively; use 1h and resample downstream
        "1wk": "1wk",
    }
    yf_interval = interval_map.get(timeframe, "1d")

    # yfinance 1h data only available for ~730 days on some symbols
    period = "730d" if timeframe in ("1d", "1wk") else "60d"

    df = load_ohlcv(symbol, interval=yf_interval, period=period)

    # Resample 1h -> 4h if timeframe is "4h"
    if timeframe == "4h" and yf_interval == "1h":
        df = _resample_to_4h(df)

    return df


def _resample_to_4h(df: pd.DataFrame) -> pd.DataFrame:
    """Resample 1h OHLCV to 4h bars."""
    df = df.copy()
    df.index = pd.to_datetime(df.index, utc=True)
    resampled = df.resample("4h").agg(
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


def df_to_candles(df: pd.DataFrame) -> list[dict]:
    """Convert OHLCV DataFrame to chart-ready [{time, open, high, low, close, volume}] list."""
    candles = []
    for ts, row in df.iterrows():
        t = ts
        if hasattr(t, "strftime"):
            time_str = t.strftime("%Y-%m-%d")
        else:
            time_str = str(t)[:10]
        candles.append(
            {
                "time": time_str,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]),
            }
        )
    return candles
