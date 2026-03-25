"""
Buy signal service — V3 10-condition gate.

A "STRONG BUY" signal fires ONLY when ALL 10 conditions pass simultaneously.
If even one fails the signal is suppressed and the suppressed_reason records
the first failing condition name.

Every evaluation is persisted to buy_now_signals for audit transparency
regardless of pass/fail outcome.

Condition names (canonical):
  1.  price_inside_backtest_buy_zone
  2.  above_50d_moving_average
  3.  above_200d_moving_average
  4.  rsi_not_overbought          (RSI 30–55)
  5.  volume_declining_on_pullback
  6.  near_proven_support_level   (within 1.5x ATR of support)
  7.  trend_regime_not_bearish    (HMM-derived via BuyZoneResult scoring)
  8.  backtest_confidence_above_threshold (>= 0.65)
  9.  not_near_earnings           (defaults to True per OQ-03)
  10. no_duplicate_signal_in_cooldown (4-hour cooldown)
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.buy_signal import BuyNowSignal
from app.models.buy_zone import StockBuyZoneSnapshot
from app.services.buy_zone_service import get_or_calculate_buy_zone
from app.services.notification_service import dispatch_notification

logger = logging.getLogger(__name__)

# ── Gate constants ────────────────────────────────────────────────────────────
RSI_LOW = 30.0
RSI_HIGH = 55.0
NEAR_SUPPORT_ATR_MULT = 1.5
BACKTEST_CONFIDENCE_THRESHOLD = 0.65
COOLDOWN_HOURS = 4

ALL_CONDITIONS = [
    "price_inside_backtest_buy_zone",
    "above_50d_moving_average",
    "above_200d_moving_average",
    "rsi_not_overbought",
    "volume_declining_on_pullback",
    "near_proven_support_level",
    "trend_regime_not_bearish",
    "backtest_confidence_above_threshold",
    "not_near_earnings",
    "no_duplicate_signal_in_cooldown",
]


def _compute_rsi(closes: pd.Series, period: int = 14) -> float:
    """Compute RSI for the final bar of a close series."""
    delta = closes.diff()
    gain = delta.clip(lower=0).ewm(com=period - 1, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).ewm(com=period - 1, min_periods=period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    val = float(rsi.iloc[-1])
    return val if not np.isnan(val) else 50.0


def _compute_atr(df: pd.DataFrame, period: int = 14) -> float:
    """Compute ATR for the final bar."""
    high, low, close = df["High"], df["Low"], df["Close"]
    tr = pd.concat(
        [high - low, (high - close.shift(1)).abs(), (low - close.shift(1)).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(com=period - 1, min_periods=period).mean()
    val = float(atr.iloc[-1])
    return val if not np.isnan(val) else 0.0


def _compute_ma(closes: pd.Series, period: int) -> float:
    """Simple moving average of the last *period* closes."""
    if len(closes) < period:
        return float(closes.mean())
    return float(closes.rolling(period).mean().iloc[-1])


def _volume_declining_on_pullback(df: pd.DataFrame) -> bool:
    """
    Check if volume is declining on the recent pullback.

    Heuristic: average volume over the last 5 bars is less than average
    volume over the 5 bars before that, and price has been falling
    (last close < close 5 bars ago).
    """
    if len(df) < 12:
        return True  # insufficient data — optimistic assumption

    vol = df["Volume"].values
    close = df["Close"].values

    recent_vol_avg = float(np.mean(vol[-5:]))
    prior_vol_avg = float(np.mean(vol[-10:-5]))
    price_falling = close[-1] < close[-6]

    # Volume should be declining when price is pulling back (healthy)
    if price_falling:
        return recent_vol_avg < prior_vol_avg * 1.05  # slight tolerance
    # If price isn't falling we can't confirm a healthy pullback
    return False


def _near_support(current_price: float, df: pd.DataFrame) -> bool:
    """
    Check if current_price is within NEAR_SUPPORT_ATR_MULT * ATR of the EMA-200 support.
    """
    closes = df["Close"]
    ema200 = float(closes.ewm(span=200, min_periods=1).mean().iloc[-1])
    atr = _compute_atr(df)
    if atr <= 0:
        return False
    return abs(current_price - ema200) <= NEAR_SUPPORT_ATR_MULT * atr


def _trend_regime_bullish(snapshot: StockBuyZoneSnapshot) -> bool:
    """
    Proxy for HMM regime: use the buy zone service confidence score.
    confidence_score >= 0.50 from the layered pipeline indicates a
    non-bearish regime (trend quality + pullback quality layers dominate).
    """
    return float(snapshot.confidence_score) >= 0.50


async def _has_cooldown_active(ticker: str, user_id: int, db: AsyncSession) -> bool:
    """Return True if a STRONG_BUY signal was emitted for this ticker in the last 4 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=COOLDOWN_HOURS)
    result = await db.execute(
        select(BuyNowSignal).where(
            and_(
                BuyNowSignal.user_id == user_id,
                BuyNowSignal.ticker == ticker,
                BuyNowSignal.all_conditions_pass.is_(True),
                BuyNowSignal.created_at >= cutoff,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def evaluate_buy_signal(
    ticker: str,
    user_id: int,
    db: AsyncSession,
    alert_enabled: bool = True,
) -> BuyNowSignal:
    """
    Execute the 10-condition gate for one ticker / user pair and persist the result.

    Steps
    -----
    1. Load or recalculate buy zone snapshot (max 60 min stale).
    2. Fetch live OHLCV from yfinance (1d interval, 2y period for MAs).
    3. Evaluate all 10 conditions independently.
    4. Persist BuyNowSignal (pass or fail).
    5. If all pass AND alert_enabled: dispatch in-app + email notification.

    Parameters
    ----------
    ticker:
        Stock ticker symbol.
    user_id:
        Authenticated user whose watchlist triggered this evaluation.
    db:
        Async SQLAlchemy session.
    alert_enabled:
        When False, skip notification dispatch even if all conditions pass.

    Returns
    -------
    BuyNowSignal
        The persisted signal record.
    """
    ticker = ticker.upper()
    logger.info("evaluate_buy_signal: %s for user_id=%d", ticker, user_id)

    # ── Step 1: get buy zone snapshot ────────────────────────────────────────
    snapshot, _ = await get_or_calculate_buy_zone(ticker, db, user_id=user_id, max_age_minutes=60)

    buy_zone_low = float(snapshot.buy_zone_low)
    buy_zone_high = float(snapshot.buy_zone_high)
    backtest_confidence = float(snapshot.confidence_score)
    backtest_win_rate_90d = float(snapshot.positive_outcome_rate_90d)
    invalidation_price = float(snapshot.invalidation_price)
    expected_drawdown = float(snapshot.expected_drawdown)

    # Ideal entry: weighted midpoint (baseline = zone midpoint)
    ideal_entry_price = round((buy_zone_low + buy_zone_high) / 2, 4)

    # ── Step 2: load live OHLCV ───────────────────────────────────────────────
    try:
        df = yf.download(ticker, period="2y", interval="1d", auto_adjust=True, progress=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.dropna()
    except Exception as exc:
        logger.error("evaluate_buy_signal: yfinance failed for %s: %s", ticker, exc)
        raise RuntimeError(f"Cannot evaluate {ticker}: data unavailable") from exc

    if len(df) < 50:
        raise RuntimeError(f"Insufficient data for {ticker}: {len(df)} bars")

    current_price = float(df["Close"].iloc[-1])
    closes = df["Close"]

    # ── Step 3: evaluate conditions ───────────────────────────────────────────
    ma50 = _compute_ma(closes, 50)
    ma200 = _compute_ma(closes, 200)
    rsi = _compute_rsi(closes)
    atr = _compute_atr(df)

    conditions: dict[str, bool] = {}

    conditions["price_inside_backtest_buy_zone"] = buy_zone_low <= current_price <= buy_zone_high
    conditions["above_50d_moving_average"] = current_price > ma50
    conditions["above_200d_moving_average"] = current_price > ma200
    conditions["rsi_not_overbought"] = RSI_LOW <= rsi <= RSI_HIGH
    conditions["volume_declining_on_pullback"] = _volume_declining_on_pullback(df)
    conditions["near_proven_support_level"] = _near_support(current_price, df)
    conditions["trend_regime_not_bearish"] = _trend_regime_bullish(snapshot)
    conditions["backtest_confidence_above_threshold"] = backtest_confidence >= BACKTEST_CONFIDENCE_THRESHOLD

    # OQ-03: default not_near_earnings to True (optimistic; live lookup deferred to V4)
    conditions["not_near_earnings"] = True

    # Cooldown check
    cooldown_active = await _has_cooldown_active(ticker, user_id, db)
    conditions["no_duplicate_signal_in_cooldown"] = not cooldown_active

    # ── Step 4: gate evaluation ───────────────────────────────────────────────
    all_pass = all(conditions[c] for c in ALL_CONDITIONS)
    suppressed_reason: Optional[str] = None
    if not all_pass:
        for c in ALL_CONDITIONS:
            if not conditions[c]:
                suppressed_reason = c
                break

    signal_strength = "STRONG_BUY" if all_pass else "SUPPRESSED"

    signal = BuyNowSignal(
        user_id=user_id,
        ticker=ticker,
        buy_zone_low=buy_zone_low,
        buy_zone_high=buy_zone_high,
        ideal_entry_price=ideal_entry_price,
        backtest_confidence=backtest_confidence,
        backtest_win_rate_90d=backtest_win_rate_90d,
        current_price=current_price,
        price_in_zone=conditions["price_inside_backtest_buy_zone"],
        above_50d_ma=conditions["above_50d_moving_average"],
        above_200d_ma=conditions["above_200d_moving_average"],
        rsi_value=round(rsi, 2),
        rsi_confirms=conditions["rsi_not_overbought"],
        volume_confirms=conditions["volume_declining_on_pullback"],
        near_support=conditions["near_proven_support_level"],
        trend_regime_bullish=conditions["trend_regime_not_bearish"],
        not_near_earnings=conditions["not_near_earnings"],
        no_duplicate_in_cooldown=conditions["no_duplicate_signal_in_cooldown"],
        all_conditions_pass=all_pass,
        signal_strength=signal_strength,
        suppressed_reason=suppressed_reason,
        invalidation_price=invalidation_price,
        expected_drawdown=expected_drawdown,
    )
    db.add(signal)
    await db.commit()
    await db.refresh(signal)

    logger.info(
        "evaluate_buy_signal: %s user_id=%d all_pass=%s suppressed_by=%s",
        ticker, user_id, all_pass, suppressed_reason,
    )

    # ── Step 5: dispatch notification if all pass ─────────────────────────────
    if all_pass and alert_enabled:
        subject = f"NextGenStock: Strong buy signal triggered for {ticker}"
        body = (
            f"STRONG BUY SIGNAL — {ticker}\n"
            f"All conditions confirmed. Historically favorable entry zone: "
            f"${buy_zone_low:.2f} – ${buy_zone_high:.2f}\n"
            f"Ideal entry: ${ideal_entry_price:.2f} | "
            f"Confidence: {backtest_confidence:.0%} | "
            f"90-day win rate: {backtest_win_rate_90d:.0%}\n"
            f"Worst historical drawdown: {expected_drawdown:.1%} | "
            f"Invalidation: ${invalidation_price:.2f}\n\n"
            f"This is based on historical data, not a guarantee."
        )
        await dispatch_notification(
            user_id=user_id,
            subject=subject,
            body=body,
            metadata={
                "ticker": ticker,
                "signal_id": signal.id,
                "buy_zone_low": buy_zone_low,
                "buy_zone_high": buy_zone_high,
                "ideal_entry_price": ideal_entry_price,
                "confidence": backtest_confidence,
                "win_rate_90d": backtest_win_rate_90d,
            },
        )

    return signal
