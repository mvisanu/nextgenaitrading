"""
Real commodity signal evaluation service.

Uses yfinance to fetch live OHLCV data for the requested symbol and applies
a 4-condition technical gate to determine if a BUY signal is active.

Gate conditions (all 4 must pass for a BUY):
  1. EMA-8 > EMA-21  (short-term momentum is bullish)
  2. Price > EMA-50   (medium-term uptrend intact)
  3. RSI-14 < 70      (not overbought)
  4. Volume ≥ 1.05×   20-day average (volume confirmation)

Symbol mapping (yfinance tickers):
  XAUUSD  → GC=F   (Gold futures)
  XAGUSD  → SI=F   (Silver futures)
  XPTUSD  → PL=F   (Platinum futures)
  USOIL   → CL=F   (WTI Crude Oil futures)
  BRENTOIL→ BZ=F   (Brent Crude futures)
  COPPER  → HG=F   (Copper futures)
  NATGAS  → NG=F   (Natural Gas futures)
  BTCUSD  → BTC-USD
  ETHUSD  → ETH-USD
  EURUSD  → EURUSD=X
  GBPUSD  → GBPUSD=X
  USDJPY  → USDJPY=X
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

# ── Symbol map ────────────────────────────────────────────────────────────────
_YFINANCE_MAP: dict[str, str] = {
    "XAUUSD": "GC=F",
    "XAGUSD": "SI=F",
    "XPTUSD": "PL=F",
    "XPDUSD": "PA=F",
    "USOIL": "CL=F",
    "BRENTOIL": "BZ=F",
    "COPPER": "HG=F",
    "NATGAS": "NG=F",
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
    "SOLUSD": "SOL-USD",
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
}


def _to_yf_ticker(symbol: str) -> str:
    upper = symbol.upper().replace("/", "").replace("-", "")
    for key, val in _YFINANCE_MAP.items():
        if key.replace("/", "").replace("-", "") == upper:
            return val
    # Fall through: try symbol as-is (handles things like GC=F directly)
    return symbol


@dataclass
class SignalResult:
    symbol: str
    yf_ticker: str
    current_price: float
    ema8: float
    ema21: float
    ema50: float
    rsi14: float
    volume: float
    avg_volume_20d: float
    # Gate conditions
    ema_cross: bool      # EMA-8 > EMA-21
    above_ema50: bool    # price > EMA-50
    rsi_ok: bool         # RSI < 70
    volume_ok: bool      # volume >= 1.05 × avg
    # Verdict
    buy_signal: bool
    confidence: int       # 0-100 based on how many gates pass + margin
    reason: str


def _compute_rsi(close: pd.Series, period: int = 14) -> float:
    # Use Wilder's smoothed RSI (EWM with com=period-1) to match buy_signal_service.py.
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, float("nan"))
    rsi = 100 - (100 / (1 + rs))
    return float(rsi.iloc[-1])


def evaluate_signal(symbol: str) -> Optional[SignalResult]:
    """
    Download recent daily OHLCV data and evaluate buy conditions.

    Returns None if data cannot be fetched or is insufficient.
    """
    yf_ticker = _to_yf_ticker(symbol)
    try:
        df: pd.DataFrame = yf.download(
            yf_ticker,
            period="3mo",
            interval="1d",
            progress=False,
            auto_adjust=True,
        )
    except Exception as exc:
        logger.warning("yfinance download failed for %s (%s): %s", symbol, yf_ticker, exc)
        return None

    if df is None or len(df) < 55:
        logger.warning("Insufficient data for %s (%s): %d rows", symbol, yf_ticker, len(df) if df is not None else 0)
        return None

    # Flatten MultiIndex columns if present (yfinance ≥0.2.x)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    close = df["Close"].dropna()
    volume = df["Volume"].dropna()

    if len(close) < 55:
        return None

    ema8 = float(close.ewm(span=8, adjust=False).mean().iloc[-1])
    ema21 = float(close.ewm(span=21, adjust=False).mean().iloc[-1])
    ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])
    current_price = float(close.iloc[-1])

    try:
        rsi14 = _compute_rsi(close)
    except Exception:
        rsi14 = 50.0

    current_vol = float(volume.iloc[-1]) if len(volume) > 0 else 0.0
    avg_vol_20 = float(volume.rolling(20).mean().iloc[-1]) if len(volume) >= 20 else current_vol

    # Gate evaluation
    ema_cross = ema8 > ema21
    above_ema50 = current_price > ema50
    rsi_ok = rsi14 < 70.0
    volume_ok = (current_vol >= avg_vol_20 * 1.05) if avg_vol_20 > 0 else False

    gates_passed = sum([ema_cross, above_ema50, rsi_ok, volume_ok])
    buy_signal = gates_passed == 4

    # Confidence: base 25 per gate + bonus for strong margins
    confidence = gates_passed * 20
    if ema_cross and (ema8 - ema21) / ema21 > 0.005:
        confidence += 5
    if above_ema50 and (current_price - ema50) / ema50 > 0.01:
        confidence += 5
    if rsi14 < 55:
        confidence += 5
    if volume_ok and avg_vol_20 > 0 and current_vol >= avg_vol_20 * 1.3:
        confidence += 5
    confidence = min(confidence, 100)

    # Build human-readable reason
    parts: list[str] = []
    if ema_cross:
        parts.append(f"EMA-8 ({ema8:.2f}) > EMA-21 ({ema21:.2f}) ✓")
    else:
        parts.append(f"EMA-8 ({ema8:.2f}) < EMA-21 ({ema21:.2f}) ✗")
    if above_ema50:
        parts.append(f"Price ({current_price:.2f}) > EMA-50 ({ema50:.2f}) ✓")
    else:
        parts.append(f"Price ({current_price:.2f}) < EMA-50 ({ema50:.2f}) ✗")
    if rsi_ok:
        parts.append(f"RSI-14 {rsi14:.1f} < 70 ✓")
    else:
        parts.append(f"RSI-14 {rsi14:.1f} ≥ 70 (overbought) ✗")
    if volume_ok:
        parts.append(f"Volume {current_vol:,.0f} ≥ 1.05× avg ✓")
    else:
        parts.append(f"Volume below threshold ✗")

    reason = " | ".join(parts)

    return SignalResult(
        symbol=symbol.upper(),
        yf_ticker=yf_ticker,
        current_price=current_price,
        ema8=ema8,
        ema21=ema21,
        ema50=ema50,
        rsi14=rsi14,
        volume=current_vol,
        avg_volume_20d=avg_vol_20,
        ema_cross=ema_cross,
        above_ema50=above_ema50,
        rsi_ok=rsi_ok,
        volume_ok=volume_ok,
        buy_signal=buy_signal,
        confidence=confidence,
        reason=reason,
    )
