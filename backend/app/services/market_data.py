"""
Market data loader — primary source is Alpaca (stocks/ETFs when keys configured),
falling back to yfinance for everything else (commodities, forex, crypto, futures).
Symbol and interval are always passed as parameters, never hardcoded.
"""
from __future__ import annotations

import logging
import re

import pandas as pd
import yfinance as yf
from fastapi import HTTPException, status

from app.services.alpaca_data import is_alpaca_supported, load_ohlcv_alpaca

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"Open", "High", "Low", "Close", "Volume"}

# Maps common commodity/forex/index display symbols to their yfinance tickers.
# Matching strips "/" and "-" so XAU-USD, XAU/USD, XAUUSD all resolve.
_SYMBOL_MAP: dict[str, str] = {
    # Commodities
    "XAUUSD": "GC=F",
    "XAGUSD": "SI=F",
    "XPTUSD": "PL=F",
    "XPDUSD": "PA=F",
    "USOIL": "CL=F",
    "BRENTOIL": "BZ=F",
    "COPPER": "HG=F",
    "NATGAS": "NG=F",
    # Crypto
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "SOLUSD": "SOL-USD",
    # Forex
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    # Market indices (display → yfinance ticker)
    "SPX": "^GSPC",    # S&P 500
    "NDQ": "^NDX",     # NASDAQ-100
    "DJI": "^DJI",     # Dow Jones Industrial Average
    "VIX": "^VIX",     # CBOE Volatility Index
    "DXY": "DX-Y.NYB", # US Dollar Index
    "RUT": "^RUT",     # Russell 2000
    "FTSE": "^FTSE",   # FTSE 100
    "DAX": "^GDAXI",   # DAX
    "NKY": "^N225",    # Nikkei 225
}


# Futures contract month codes (CME/NYMEX standard)
_FUTURES_CONTRACT_RE = re.compile(r'^([A-Z]{2,3})[FGHJKMNQUVXZ]\d{2}$')

# Exchange suffix required by yfinance for specific contract-month tickers.
# Roots not listed here fall back to =F (may not work for all).
_FUTURES_EXCHANGE: dict[str, str] = {
    # COMEX metals
    "GC": ".CMX",   # Gold
    "MGC": ".CMX",  # Micro Gold
    "SI": ".CMX",   # Silver
    "SIL": ".CMX",  # Micro Silver
    "HG": ".CMX",   # Copper
    # NYMEX energy + platinum group
    "CL": ".NYM",   # WTI Crude Oil
    "QM": ".NYM",   # Mini Crude
    "NG": ".NYM",   # Natural Gas
    "RB": ".NYM",   # RBOB Gasoline
    "HO": ".NYM",   # Heating Oil
    "BZ": ".NYM",   # Brent Crude
    "PL": ".NYM",   # Platinum
    "PA": ".NYM",   # Palladium
}


def normalize_symbol(symbol: str) -> str:
    """Translate display symbols to yfinance tickers.

    Handles three cases:
    1. Named commodity/forex displays: XAU-USD / XAUUSD / XAU/USD → GC=F
    2. Specific futures contracts:      GCM26 → GCM26.CMX, CLN26 → CLN26.NYM
    3. Everything else passed through unchanged (stocks, crypto, ETFs, etc.)
    """
    upper = symbol.upper()
    key = upper.replace("/", "").replace("-", "")

    # Case 1: named map lookup
    if key in _SYMBOL_MAP:
        return _SYMBOL_MAP[key]

    # Case 2: specific futures contract — append correct exchange suffix
    m = _FUTURES_CONTRACT_RE.match(key)
    if m and "." not in key and "=" not in key:
        root = m.group(1)
        suffix = _FUTURES_EXCHANGE.get(root, "=F")
        return key + suffix

    return symbol


def load_ohlcv(
    symbol: str, interval: str = "1d", period: str = "730d"
) -> pd.DataFrame:
    """
    Fetch OHLCV data.  For plain US stocks/ETFs, tries Alpaca first when keys
    are configured (more reliable, official feed).  Falls back to yfinance for
    all other symbols (commodities, forex, crypto, futures) and whenever the
    Alpaca call fails.
    """
    if is_alpaca_supported(symbol):
        try:
            df = load_ohlcv_alpaca(symbol, interval=interval, period=period)
            logger.debug("Alpaca data: %s rows for %s [%s]", len(df), symbol, interval)
            return df
        except Exception as exc:
            logger.warning(
                "Alpaca data fetch failed for '%s' (%s), falling back to yfinance: %s",
                symbol, interval, exc,
            )

    return _load_ohlcv_yfinance(symbol, interval=interval, period=period)


def _load_ohlcv_yfinance(
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
    # Cap at 750 rows — enough for all indicators (EMA-200 needs 200+ bars) while
    # keeping memory bounded. Keeps the most recent rows.
    if len(df) > 750:
        df = df.iloc[-750:].copy()
    return df


def validate_symbol(symbol: str) -> None:
    """
    Validate that a symbol is fetchable from yfinance.
    Raises HTTP 422 with a clear message if not found.
    """
    try:
        load_ohlcv(normalize_symbol(symbol), interval="1d", period="5d")
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
    symbol = normalize_symbol(symbol)
    interval_map = {
        "1m": "1m",
        "2m": "2m",
        "3m": "5m",   # yfinance has no 3m; use 5m as nearest supported
        "5m": "5m",
        "10m": "15m", # yfinance has no 10m; use 15m as nearest supported
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
    elif timeframe in ("2m", "3m", "5m", "10m", "15m", "30m"):
        period = "60d"
    elif timeframe in ("1h", "2h", "3h", "4h"):
        period = "60d"
    elif timeframe == "1wk":
        # 730d (~104 bars) leaves only ~54 bars after EMA-50 warmup — below the 60-bar
        # minimum required by the strategy. 5 years (~260 weekly bars) is sufficient
        # and uses far less memory than the previous 10-year fetch.
        period = "1825d"
    elif timeframe == "1mo":
        # 5 years (~60 monthly bars) is sufficient after EMA-50 warmup (needs 50+).
        # Avoids loading the entire ticker history which can be 20+ years of data.
        period = "1825d"
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
