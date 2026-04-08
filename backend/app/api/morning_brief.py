"""
Morning Brief — daily TA analysis for a fixed crypto watchlist.

GET /api/v1/morning-brief

Returns EMA-200 / RSI-14 / MACD(12,26,9) analysis for 6 major crypto pairs.
Results are cached for the current UTC hour to avoid redundant yfinance calls.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.market_data import load_ohlcv

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/morning-brief", tags=["morning-brief"])

# ---------------------------------------------------------------------------
# Fixed watchlist — never user-configurable
# ---------------------------------------------------------------------------

WATCHLIST = [
    {"symbol": "BTCUSDT",  "name": "Bitcoin",   "yf": "BTC-USD"},
    {"symbol": "ETHUSDT",  "name": "Ethereum",  "yf": "ETH-USD"},
    {"symbol": "SOLUSDT",  "name": "Solana",    "yf": "SOL-USD"},
    {"symbol": "XRPUSDT",  "name": "XRP",       "yf": "XRP-USD"},
    {"symbol": "LINKUSDT", "name": "Chainlink", "yf": "LINK-USD"},
    {"symbol": "PEPEUSDT", "name": "PEPE",      "yf": "PEPE-USD"},
]

# ---------------------------------------------------------------------------
# In-process cache keyed to UTC hour string e.g. "2026-04-05T09"
# ---------------------------------------------------------------------------

_cache: dict[str, "MorningBriefResponse"] = {}


def _current_hour_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

from pydantic import BaseModel


class MorningBriefRow(BaseModel):
    symbol: str
    name: str
    price: Optional[float]
    ema200: Optional[float]
    price_vs_ema200: str
    rsi: Optional[float]
    macd_bias: str
    bias: str
    signal: str


class MorningBriefResponse(BaseModel):
    rows: list[MorningBriefRow]
    analyzed_at: str   # ISO datetime string
    timeframe: str = "1D"


# ---------------------------------------------------------------------------
# TA helpers
# ---------------------------------------------------------------------------

def _compute_ema200(close: pd.Series) -> float:
    """EMA-200 using standard ewm(span=200, adjust=False)."""
    return float(close.ewm(span=200, adjust=False).mean().iloc[-1])


def _compute_rsi(close: pd.Series, period: int = 14) -> float:
    """RSI-14 using Wilder's EWM: ewm(com=period-1, adjust=False)."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean().iloc[-1]
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean().iloc[-1]
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return float(100 - 100 / (1 + rs))


def _compute_macd(close: pd.Series) -> tuple[float, float]:
    """Standard MACD(12,26,9). Returns (macd_line, signal_line)."""
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    return float(macd_line.iloc[-1]), float(signal_line.iloc[-1])


# ---------------------------------------------------------------------------
# Per-coin analysis
# ---------------------------------------------------------------------------

def _analyze_coin(entry: dict) -> MorningBriefRow:
    symbol = entry["symbol"]
    name = entry["name"]
    yf_ticker = entry["yf"]

    error_row = MorningBriefRow(
        symbol=symbol,
        name=name,
        price=None,
        ema200=None,
        price_vs_ema200="N/A",
        rsi=None,
        macd_bias="N/A",
        bias="N/A",
        signal="Data unavailable",
    )

    try:
        df = load_ohlcv(yf_ticker, interval="1d", period="800d")
    except Exception as exc:
        logger.warning("load_ohlcv failed for %s: %s", yf_ticker, exc)
        return error_row

    if df is None or len(df) < 200:
        logger.warning("Insufficient data for %s (%d rows)", yf_ticker, len(df) if df is not None else 0)
        return error_row

    # Ensure Close column exists
    if "Close" not in df.columns:
        logger.warning("No Close column for %s", yf_ticker)
        return error_row

    try:
        close = df["Close"].dropna()
        if len(close) < 30:
            return error_row

        price = float(close.iloc[-1])
        ema200 = _compute_ema200(close)
        rsi = _compute_rsi(close)
        macd_line, signal_line = _compute_macd(close)

        # Derived fields
        pct_diff = (price - ema200) / ema200 * 100
        if pct_diff > 2.0:
            price_vs_ema200 = "Above"
        elif pct_diff < -2.0:
            price_vs_ema200 = "Below"
        else:
            price_vs_ema200 = "Near"

        macd_bias = "Bullish" if macd_line > signal_line else "Bearish"

        # Bias: count bullish conditions
        above_ema200 = price_vs_ema200 == "Above"
        rsi_above_50 = rsi > 50
        macd_bullish = macd_bias == "Bullish"
        bullish_count = sum([above_ema200, rsi_above_50, macd_bullish])

        if bullish_count >= 2 and price_vs_ema200 != "Below":
            bias = "Bullish"
        elif bullish_count <= 1 and price_vs_ema200 == "Below":
            bias = "Bearish"
        else:
            bias = "Neutral"

        # Signal
        if bias == "Bullish" and rsi > 70:
            signal = "Extended, avoid chasing"
        elif bias == "Bullish" and macd_bias == "Bullish":
            signal = "Trend intact, buy dips only"
        elif bias == "Bullish":
            signal = "Momentum improving"
        elif bias == "Bearish" and rsi < 32:
            signal = "Oversold, watch for bounce"
        elif bias == "Bearish" and macd_bias == "Bearish":
            signal = "Bearish structure remains"
        elif bias == "Bearish":
            signal = "Weak momentum, wait"
        else:
            signal = "Near EMA 200, decision zone"

        return MorningBriefRow(
            symbol=symbol,
            name=name,
            price=round(price, 6),
            ema200=round(ema200, 6),
            price_vs_ema200=price_vs_ema200,
            rsi=round(rsi, 2),
            macd_bias=macd_bias,
            bias=bias,
            signal=signal,
        )

    except Exception as exc:
        logger.exception("TA computation failed for %s: %s", yf_ticker, exc)
        return error_row


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=MorningBriefResponse)
async def get_morning_brief(
    current_user: User = Depends(get_current_user),
) -> MorningBriefResponse:
    """
    Daily technical analysis for the fixed crypto watchlist.
    Results are cached for the current UTC hour.
    """
    hour_key = _current_hour_key()

    if hour_key in _cache:
        logger.debug("Morning brief cache hit: %s", hour_key)
        return _cache[hour_key]

    logger.info("Computing morning brief for hour %s", hour_key)

    rows = await asyncio.to_thread(lambda: [_analyze_coin(entry) for entry in WATCHLIST])

    analyzed_at = datetime.now(timezone.utc).isoformat()
    response = MorningBriefResponse(
        rows=rows,
        analyzed_at=analyzed_at,
        timeframe="1D",
    )

    # Evict all old keys, store current hour
    _cache.clear()
    _cache[hour_key] = response

    return response
