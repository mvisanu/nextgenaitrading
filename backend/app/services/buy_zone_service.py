"""
Buy Zone Service — orchestrates the layered scoring pipeline.

LANGUAGE RULE: Never use "guaranteed profit", "safe entry", "certain to go up".
Use "historically favorable buy zone", "high-probability entry area",
"confidence score", "expected drawdown", "scenario-based estimate",
"positive outcome rate". See prompt-feature.md Section: Language Rules.

Pipeline layers (weights sum to 1.0):
  1. Trend quality         0.20 — Is the long-term trend intact?
  2. Pullback quality      0.20 — Is the pullback shallow and orderly?
  3. Support proximity     0.20 — How close is price to a key support level?
  4. Volatility normaliz.  0.10 — Is volatility manageable vs ATR baseline?
  5. Analog win rate       0.20 — What did similar past setups produce forward?
  6. Drawdown penalty      0.05 — Penalise setups with high historical MAE
  7. Theme alignment bonus 0.05 — Bonus if theme score is elevated
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.theme_score import StockThemeScore
from app.services.analog_scoring_service import (
    MIN_ANALOG_MATCHES,
    find_analog_matches,
    score_analogs,
)
from app.services.market_data import load_ohlcv

logger = logging.getLogger(__name__)

MODEL_VERSION = "v2.0"

# ── Scoring layer weights ─────────────────────────────────────────────────────
LAYER_WEIGHTS = {
    "trend_quality": 0.20,
    "pullback_quality": 0.20,
    "support_proximity": 0.20,
    "volatility_normalization": 0.10,
    "analog_win_rate": 0.20,
    "drawdown_penalty": 0.05,
    "theme_alignment": 0.05,
}


@dataclass
class BuyZoneResult:
    ticker: str
    current_price: float
    buy_zone_low: float
    buy_zone_high: float
    confidence_score: float          # 0.0 – 1.0
    entry_quality_score: float       # 0.0 – 1.0
    expected_return_30d: float       # percent
    expected_return_90d: float       # percent
    expected_drawdown: float         # percent, negative
    positive_outcome_rate_30d: float # 0.0 – 1.0
    positive_outcome_rate_90d: float # 0.0 – 1.0
    invalidation_price: float
    time_horizon_days: int
    explanation: list[str]           # human-readable reasoning steps
    model_version: str
    feature_payload: dict = field(default_factory=dict)


# ── Layer scoring functions (pure, testable) ──────────────────────────────────

def _score_trend_quality(df: pd.DataFrame) -> tuple[float, str]:
    """Score: is the long-term trend intact? Uses EMA-50 vs EMA-200 relationship."""
    closes = df["Close"]
    ema50 = closes.ewm(span=50, min_periods=50).mean()
    ema200 = closes.ewm(span=200, min_periods=200).mean()

    if ema50.isna().iloc[-1] or ema200.isna().iloc[-1]:
        return 0.5, "Insufficient history for trend quality assessment (EMA-200 not warmed up)"

    last_close = float(closes.iloc[-1])
    last_ema50 = float(ema50.iloc[-1])
    last_ema200 = float(ema200.iloc[-1])

    if last_ema50 > last_ema200 and last_close > last_ema50:
        score = 0.90
        msg = f"Long-term trend intact: EMA-50 ({last_ema50:.2f}) above EMA-200 ({last_ema200:.2f}); price above both"
    elif last_ema50 > last_ema200:
        score = 0.65
        msg = f"Trend structure intact (EMA-50 > EMA-200) but price ({last_close:.2f}) has pulled back below EMA-50 ({last_ema50:.2f})"
    elif last_close > last_ema200:
        score = 0.40
        msg = f"Trend mixed: price ({last_close:.2f}) above EMA-200 ({last_ema200:.2f}) but EMA-50 ({last_ema50:.2f}) has crossed below"
    else:
        score = 0.15
        msg = f"Trend deteriorated: price ({last_close:.2f}) and EMA-50 ({last_ema50:.2f}) both below EMA-200 ({last_ema200:.2f})"

    return score, msg


def _score_pullback_quality(df: pd.DataFrame) -> tuple[float, str]:
    """Score: is the pullback shallow and orderly?"""
    closes = df["Close"]
    rolling_high_20 = df["High"].rolling(20).max()
    rolling_high_60 = df["High"].rolling(60).max()

    last_close = float(closes.iloc[-1])
    high_20 = float(rolling_high_20.iloc[-1]) if not np.isnan(rolling_high_20.iloc[-1]) else last_close
    high_60 = float(rolling_high_60.iloc[-1]) if not np.isnan(rolling_high_60.iloc[-1]) else last_close

    pullback_20 = (last_close - high_20) / high_20 if high_20 > 0 else 0.0
    pullback_60 = (last_close - high_60) / high_60 if high_60 > 0 else 0.0

    # Shallow pullback (< 10%) from 20-day high is ideal for a high-probability entry area
    if pullback_20 > -0.05:
        score = 0.30  # very little pullback — may not be a good entry area yet
        msg = f"Price ({last_close:.2f}) near 20-day high ({high_20:.2f}); minimal pullback ({pullback_20:.1%}) — may not represent a discounted entry"
    elif pullback_20 > -0.15:
        score = 0.90  # optimal shallow pullback
        msg = f"Orderly pullback of {pullback_20:.1%} from 20-day high ({high_20:.2f}) — historically favorable entry area depth"
    elif pullback_20 > -0.25:
        score = 0.60
        msg = f"Moderate pullback of {pullback_20:.1%} from 20-day high; 60-day drawdown: {pullback_60:.1%}"
    else:
        score = 0.25
        msg = f"Deep pullback of {pullback_20:.1%} from 20-day high; elevated downside risk"

    return score, msg


def _score_support_proximity(df: pd.DataFrame) -> tuple[float, str]:
    """Score: how close is price to a key support level? Uses 200-day MA as primary support."""
    closes = df["Close"]
    ema200 = closes.ewm(span=200, min_periods=200).mean()
    last_close = float(closes.iloc[-1])

    if ema200.isna().iloc[-1]:
        return 0.50, "Insufficient history for support proximity (EMA-200 not available)"

    last_ema200 = float(ema200.iloc[-1])
    distance_pct = (last_close - last_ema200) / last_ema200

    if abs(distance_pct) <= 0.02:
        score = 0.95
        msg = f"Price is within 2% of the 200-day moving average support band ({last_ema200:.2f})"
    elif abs(distance_pct) <= 0.05:
        score = 0.80
        msg = f"Price is within 5% of the 200-day moving average support band ({last_ema200:.2f})"
    elif abs(distance_pct) <= 0.10:
        score = 0.60
        msg = f"Price is within 10% of the 200-day moving average support band ({last_ema200:.2f})"
    elif distance_pct > 0.10:
        score = 0.20
        msg = f"Price ({last_close:.2f}) is {distance_pct:.1%} above EMA-200 ({last_ema200:.2f}) — not near key support"
    else:
        score = 0.30
        msg = f"Price ({last_close:.2f}) is {abs(distance_pct):.1%} below EMA-200 ({last_ema200:.2f}) — support has been breached"

    return score, msg


def _score_volatility_normalization(df: pd.DataFrame) -> tuple[float, str]:
    """Score: is current volatility manageable relative to its own baseline?"""
    closes = df["Close"]
    high = df["High"]
    low = df["Low"]

    tr = pd.concat(
        [
            high - low,
            (high - closes.shift(1)).abs(),
            (low - closes.shift(1)).abs(),
        ],
        axis=1,
    ).max(axis=1)

    atr_14 = tr.ewm(com=13, min_periods=14).mean()
    atr_pct = atr_14 / closes.replace(0, np.nan)

    # Historical median ATR% as baseline
    median_atr_pct = float(atr_pct.median())
    current_atr_pct = float(atr_pct.iloc[-1]) if not np.isnan(atr_pct.iloc[-1]) else median_atr_pct

    if median_atr_pct == 0:
        return 0.50, "Could not compute ATR baseline"

    ratio = current_atr_pct / median_atr_pct

    if ratio <= 0.80:
        score = 0.85
        msg = f"Volatility is subdued: ATR ratio {ratio:.2f}x of historical median — low-turbulence environment"
    elif ratio <= 1.20:
        score = 0.70
        msg = f"Volatility is near historical norm: ATR ratio {ratio:.2f}x of median"
    elif ratio <= 1.60:
        score = 0.45
        msg = f"Volatility is elevated: ATR ratio {ratio:.2f}x of median — wider expected swings"
    else:
        score = 0.20
        msg = f"Volatility is high: ATR ratio {ratio:.2f}x of median — position sizing should account for elevated risk"

    return score, msg


def _compute_buy_zone_range(df: pd.DataFrame) -> tuple[float, float, float]:
    """
    Derive buy zone range from ATR-adjusted support bands.

    Returns (buy_zone_low, buy_zone_high, invalidation_price).
    The zone is centred on the 200-day EMA with ±0.5 ATR band.
    Invalidation is set at 2 ATR below the zone low.
    """
    closes = df["Close"]
    high = df["High"]
    low = df["Low"]

    ema200 = closes.ewm(span=200, min_periods=1).mean()
    tr = pd.concat(
        [
            high - low,
            (high - closes.shift(1)).abs(),
            (low - closes.shift(1)).abs(),
        ],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(com=13, min_periods=1).mean()

    support = float(ema200.iloc[-1])
    atr_val = float(atr.iloc[-1])

    zone_low = support - 0.5 * atr_val
    zone_high = support + 0.5 * atr_val
    invalidation = zone_low - 2.0 * atr_val

    return zone_low, zone_high, invalidation


async def _get_theme_score(ticker: str, db: AsyncSession) -> float:
    """Fetch the latest theme score for a ticker. Returns 0.0 if not found."""
    result = await db.execute(
        select(StockThemeScore).where(StockThemeScore.ticker == ticker.upper())
    )
    ts = result.scalar_one_or_none()
    return float(ts.theme_score_total) if ts else 0.0


async def calculate_buy_zone(ticker: str, db: AsyncSession, user_id: Optional[int] = None) -> BuyZoneResult:
    """
    Execute the full layered buy zone scoring pipeline for a ticker.

    Layers:
    1. Load OHLCV via market_data.load_ohlcv (reuses existing data loader)
    2. Trend quality layer
    3. Pullback quality layer
    4. Support proximity layer
    5. Volatility normalization layer
    6. Historical analog scoring layer
    7. Theme alignment bonus
    8. Composite confidence and zone range calculation
    9. Persist snapshot to DB
    """
    ticker = ticker.upper()
    logger.info("Calculating buy zone for %s (user_id=%s)", ticker, user_id)

    # Step 1: Load OHLCV data
    try:
        df = load_ohlcv(ticker, interval="1d", period="730d")
    except ValueError as exc:
        raise ValueError(f"Cannot compute buy zone: {exc}") from exc

    if len(df) < 60:
        raise ValueError(f"Insufficient data for {ticker}: only {len(df)} bars")

    current_price = float(df["Close"].iloc[-1])
    explanations: list[str] = []
    layer_scores: dict[str, float] = {}

    # Step 2–5: Technical layers
    s_trend, e_trend = _score_trend_quality(df)
    layer_scores["trend_quality"] = s_trend
    explanations.append(e_trend)

    s_pullback, e_pullback = _score_pullback_quality(df)
    layer_scores["pullback_quality"] = s_pullback
    explanations.append(e_pullback)

    s_support, e_support = _score_support_proximity(df)
    layer_scores["support_proximity"] = s_support
    explanations.append(e_support)

    s_vol, e_vol = _score_volatility_normalization(df)
    layer_scores["volatility_normalization"] = s_vol
    explanations.append(e_vol)

    # Step 6: Analog scoring layer
    matches = find_analog_matches(df)
    analog_result = score_analogs(matches)
    layer_scores["analog_win_rate"] = analog_result.win_rate_score
    explanations.append(analog_result.explanation)

    # Drawdown penalty layer: penalise setups with high historical MAE
    if analog_result.median_mae < -15.0:
        drawdown_score = 0.20
        explanations.append(
            f"Elevated historical drawdown risk: median max adverse excursion {analog_result.median_mae:.1f}% from similar setups"
        )
    elif analog_result.median_mae < -8.0:
        drawdown_score = 0.55
        explanations.append(
            f"Moderate drawdown risk: median max adverse excursion {analog_result.median_mae:.1f}% from similar setups"
        )
    else:
        drawdown_score = 0.85
        explanations.append(
            f"Manageable drawdown risk: median max adverse excursion {analog_result.median_mae:.1f}% from similar setups"
        )
    layer_scores["drawdown_penalty"] = drawdown_score

    # Step 7: Theme alignment bonus
    theme_score = await _get_theme_score(ticker, db)
    if theme_score >= 0.70:
        theme_bonus = 1.0
        explanations.append(
            f"Theme score elevated at {theme_score:.0%} — strong thematic tailwind identified"
        )
    elif theme_score >= 0.40:
        theme_bonus = 0.60
        explanations.append(f"Moderate theme alignment score: {theme_score:.0%}")
    else:
        theme_bonus = 0.20
        explanations.append(f"Low theme alignment score: {theme_score:.0%}")
    layer_scores["theme_alignment"] = theme_bonus

    # Step 8: Compute weighted confidence score
    confidence_score = sum(
        layer_scores[k] * LAYER_WEIGHTS[k] for k in LAYER_WEIGHTS
    )

    # Cap confidence if too few analogs were found
    if analog_result.analog_count < MIN_ANALOG_MATCHES:
        confidence_score = min(confidence_score, 0.40)

    confidence_score = round(min(1.0, max(0.0, confidence_score)), 4)

    # Entry quality score: only technical layers (exclude theme bonus)
    entry_quality_score = round(
        min(
            1.0,
            (
                layer_scores["trend_quality"] * 0.30
                + layer_scores["pullback_quality"] * 0.30
                + layer_scores["support_proximity"] * 0.25
                + layer_scores["volatility_normalization"] * 0.15
            ),
        ),
        4,
    )

    # Step 9: Compute buy zone range
    zone_low, zone_high, invalidation = _compute_buy_zone_range(df)

    # Forward return estimates from analog scoring
    expected_return_30d = round(analog_result.median_return_20d, 2)  # use 20d as proxy for 30d
    expected_return_90d = round(analog_result.median_return_60d, 2)
    expected_drawdown = round(analog_result.median_mae, 2)
    pos_rate_30d = round(analog_result.positive_rate_20d, 4)
    pos_rate_90d = round(analog_result.positive_rate_60d, 4)

    result = BuyZoneResult(
        ticker=ticker,
        current_price=current_price,
        buy_zone_low=round(zone_low, 4),
        buy_zone_high=round(zone_high, 4),
        confidence_score=confidence_score,
        entry_quality_score=entry_quality_score,
        expected_return_30d=expected_return_30d,
        expected_return_90d=expected_return_90d,
        expected_drawdown=expected_drawdown,
        positive_outcome_rate_30d=pos_rate_30d,
        positive_outcome_rate_90d=pos_rate_90d,
        invalidation_price=round(invalidation, 4),
        time_horizon_days=30,
        explanation=explanations,
        model_version=MODEL_VERSION,
        feature_payload={
            "ohlcv_bars": len(df),
            "layer_scores": layer_scores,
            "analog_count": analog_result.analog_count,
            "theme_score": theme_score,
        },
    )

    # Persist snapshot
    snapshot = StockBuyZoneSnapshot(
        user_id=user_id,
        ticker=ticker,
        current_price=result.current_price,
        buy_zone_low=result.buy_zone_low,
        buy_zone_high=result.buy_zone_high,
        confidence_score=result.confidence_score,
        entry_quality_score=result.entry_quality_score,
        expected_return_30d=result.expected_return_30d,
        expected_return_90d=result.expected_return_90d,
        expected_drawdown=result.expected_drawdown,
        positive_outcome_rate_30d=result.positive_outcome_rate_30d,
        positive_outcome_rate_90d=result.positive_outcome_rate_90d,
        invalidation_price=result.invalidation_price,
        horizon_days=result.time_horizon_days,
        explanation_json=result.explanation,
        feature_payload_json=result.feature_payload,
        model_version=result.model_version,
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)

    logger.info(
        "Buy zone calculated for %s: confidence=%.2f zone=[%.2f, %.2f]",
        ticker,
        confidence_score,
        zone_low,
        zone_high,
    )
    return result


async def get_or_calculate_buy_zone(
    ticker: str,
    db: AsyncSession,
    user_id: Optional[int] = None,
    max_age_minutes: int = 60,
) -> tuple[StockBuyZoneSnapshot, bool]:
    """
    Return the latest snapshot if it is fresher than max_age_minutes.
    Otherwise trigger a recalculation.

    Returns (snapshot, was_recalculated).
    """
    ticker = ticker.upper()
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)

    result = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == ticker)
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .limit(1)
    )
    snapshot = result.scalar_one_or_none()

    if snapshot and snapshot.created_at >= cutoff:
        return snapshot, False

    # Recalculate
    bz = await calculate_buy_zone(ticker, db, user_id=user_id)
    # Fetch the newly persisted snapshot
    result2 = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == ticker)
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .limit(1)
    )
    new_snap = result2.scalar_one()
    return new_snap, True
