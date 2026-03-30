"""
Commodity Signal Engine — FastAPI router.

Provides signal generation, risk status, and performance metrics for
any commodity / forex symbol (default XAUUSD/Gold). All data is
simulated (no live broker calls). Symbol is always user-supplied —
never hardcoded inside business logic.
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/gold", tags=["gold"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class GoldSignal(BaseModel):
    id: str
    symbol: str
    timeframe: str          # "15min", "1h", "4h", "1d"
    strategy_name: str      # "liquidity_sweep" | "trend_continuation" | "breakout_expansion" | "ema_momentum"
    direction: str          # "long" | "short"
    timestamp: datetime
    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward_ratio: float
    confidence_score: int   # 0-100
    reasoning_summary: str
    status: str             # "candidate" | "approved" | "blocked" | "expired" | "sent"
    volatility_snapshot: float
    position_size_recommendation: float


class RiskStatus(BaseModel):
    symbol: str
    kill_switch_active: bool
    kill_switch_reason: Optional[str]
    consecutive_losses: int
    daily_loss_pct: float
    daily_loss_cap_pct: float   # hard cap: 2.0 %
    signals_blocked_today: int
    mode: str                   # "active" | "paused" | "kill_switch"
    last_updated: datetime


class StrategyPerformance(BaseModel):
    strategy_name: str
    win_rate: float
    expectancy: float
    profit_factor: float
    max_drawdown: float
    avg_r_multiple: float
    total_signals: int


class PerformanceResponse(BaseModel):
    symbol: str
    days: int
    strategies: list[StrategyPerformance]
    overall_win_rate: float
    overall_expectancy: float


class SignalListResponse(BaseModel):
    symbol: str
    timeframe: str
    signals: list[GoldSignal]
    total: int


class AnalyzeResponse(BaseModel):
    symbol: str
    signals_generated: int
    signals: list[GoldSignal]
    message: str


# ---------------------------------------------------------------------------
# Mock data helpers
# ---------------------------------------------------------------------------

_STRATEGY_NAMES = [
    "liquidity_sweep",
    "trend_continuation",
    "breakout_expansion",
    "ema_momentum",
]

_STATUSES = ["candidate", "approved", "blocked", "expired", "sent"]

_REASONINGS: dict[str, list[str]] = {
    "liquidity_sweep": [
        "Price swept below prior swing low, triggering smart-money accumulation zone. "
        "Volume spike confirms institutional absorption. Entry on retracement to 0.5 Fib.",
        "Liquidity pool below key support cleared. Order-flow imbalance detected on 15-min. "
        "High-probability reversal setup with tight SL at session low.",
    ],
    "trend_continuation": [
        "Price pulled back to 20-EMA on elevated volume. Trend structure intact above 200-SMA. "
        "RSI cooling from overbought — historically favorable re-entry zone.",
        "Higher-low structure confirmed on 4h. MACD momentum accelerating. "
        "Continuation setup targeting prior resistance as measured move.",
    ],
    "breakout_expansion": [
        "Multi-session consolidation box broken with 2× average volume. "
        "ATR expansion suggests momentum continuation. First pullback to breakout level as entry.",
        "Ascending triangle apex breached. Measured move projects to next major resistance. "
        "Confidence score elevated by clean break with no wick rejection.",
    ],
    "ema_momentum": [
        "8-EMA crossed above 21-EMA on 1h with rising ADX. "
        "Price above VWAP; bullish bias confirmed. Entry on first 15-min pullback.",
        "EMA ribbon aligned bullish — 8/21/50/200 all fanned out. "
        "Momentum candles accelerating. SL placed below most recent swing low.",
    ],
}


def _base_price(symbol: str) -> float:
    """Return a plausible base price for common symbols, otherwise 1.0."""
    upper = symbol.upper()
    prices: dict[str, float] = {
        "XAUUSD": 3050.0,
        "XAGUSD": 32.5,
        "XPTUSD": 980.0,
        "XPDUSD": 950.0,
        "USOIL": 78.5,
        "BRENTOIL": 82.0,
        "EURUSD": 1.082,
        "GBPUSD": 1.264,
        "USDJPY": 158.4,
        "BTCUSD": 65400.0,
        "ETHUSD": 3450.0,
        "SOLUSD": 145.0,
        "COPPER": 4.32,
        "NATGAS": 1.85,
    }
    # Fuzzy match: strip slashes
    clean = upper.replace("/", "").replace("-", "")
    for key, val in prices.items():
        if key.replace("/", "").replace("-", "") == clean:
            return val
    return 100.0


def _make_signal(symbol: str, timeframe: str, hours_ago: float = 0.0) -> GoldSignal:
    """Generate a single realistic-looking mock signal for the given symbol."""
    rng = random.Random()  # unseeded for variety each call

    base = _base_price(symbol)
    is_long = rng.random() > 0.45

    # Price offsets proportional to base price
    unit = base * 0.0025  # ~0.25 % of base
    entry = round(base + rng.uniform(-unit * 4, unit * 4), 4 if base < 10 else 2)

    if is_long:
        sl = round(entry - rng.uniform(unit * 2, unit * 5), 4 if base < 10 else 2)
        tp = round(entry + rng.uniform(unit * 4, unit * 12), 4 if base < 10 else 2)
    else:
        sl = round(entry + rng.uniform(unit * 2, unit * 5), 4 if base < 10 else 2)
        tp = round(entry - rng.uniform(unit * 4, unit * 12), 4 if base < 10 else 2)

    risk = abs(entry - sl)
    reward = abs(tp - entry)
    rr = round(reward / risk, 2) if risk > 0 else 1.5

    strategy = rng.choice(_STRATEGY_NAMES)
    reasoning = rng.choice(_REASONINGS[strategy])
    confidence = rng.randint(62, 96)

    # Weight statuses: more approved/sent than blocked/expired
    status = rng.choices(
        _STATUSES,
        weights=[15, 45, 10, 15, 15],
        k=1,
    )[0]

    volatility = round(rng.uniform(0.4, 2.8), 3)
    position_size = round(rng.uniform(0.01, 0.08), 4)  # fraction of equity

    ts = datetime.now(timezone.utc) - timedelta(hours=hours_ago)

    return GoldSignal(
        id=str(uuid.uuid4()),
        symbol=symbol.upper(),
        timeframe=timeframe,
        strategy_name=strategy,
        direction="long" if is_long else "short",
        timestamp=ts,
        entry_price=entry,
        stop_loss=sl,
        take_profit=tp,
        risk_reward_ratio=rr,
        confidence_score=confidence,
        reasoning_summary=reasoning,
        status=status,
        volatility_snapshot=volatility,
        position_size_recommendation=position_size,
    )


def _make_risk_status(symbol: str) -> RiskStatus:
    rng = random.Random()
    consecutive = rng.randint(0, 4)
    daily_loss = round(rng.uniform(0.0, 1.6), 3)
    blocked_today = rng.randint(0, 3)

    kill_active = consecutive >= 8 or daily_loss >= 2.0
    if kill_active:
        reason = (
            "Daily loss cap reached (2 %)" if daily_loss >= 2.0
            else "8 consecutive losses exceeded"
        )
        mode = "kill_switch"
    elif consecutive >= 5 or daily_loss >= 1.5:
        reason = None
        mode = "paused"
    else:
        reason = None
        mode = "active"

    return RiskStatus(
        symbol=symbol.upper(),
        kill_switch_active=kill_active,
        kill_switch_reason=reason,
        consecutive_losses=consecutive,
        daily_loss_pct=daily_loss,
        daily_loss_cap_pct=2.0,
        signals_blocked_today=blocked_today,
        mode=mode,
        last_updated=datetime.now(timezone.utc),
    )


def _make_performance(symbol: str, days: int) -> PerformanceResponse:
    rng = random.Random(hash(symbol + str(days)))  # stable seed per symbol+days

    strategies: list[StrategyPerformance] = []
    total_wins = 0
    total_signals = 0

    for name in _STRATEGY_NAMES:
        n_signals = rng.randint(max(4, days // 5), max(8, days // 2))
        wr = round(rng.uniform(0.52, 0.74), 3)
        wins = round(wr * n_signals)
        expectancy = round(rng.uniform(0.15, 0.55), 3)
        pf = round(rng.uniform(1.2, 2.8), 2)
        mdd = round(rng.uniform(0.03, 0.12), 3)
        avg_r = round(rng.uniform(0.4, 1.6), 2)

        strategies.append(
            StrategyPerformance(
                strategy_name=name,
                win_rate=wr,
                expectancy=expectancy,
                profit_factor=pf,
                max_drawdown=mdd,
                avg_r_multiple=avg_r,
                total_signals=n_signals,
            )
        )
        total_wins += wins
        total_signals += n_signals

    overall_wr = round(total_wins / total_signals, 3) if total_signals else 0.0
    all_expectancy = [s.expectancy for s in strategies]
    overall_exp = round(sum(all_expectancy) / len(all_expectancy), 3)

    return PerformanceResponse(
        symbol=symbol.upper(),
        days=days,
        strategies=strategies,
        overall_win_rate=overall_wr,
        overall_expectancy=overall_exp,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/signals", response_model=SignalListResponse)
async def get_signals(
    symbol: str = Query(default="XAUUSD", min_length=1, max_length=20,
                        description="Commodity / forex symbol"),
    timeframe: str = Query(default="1h",
                           description="Candle timeframe: 15min, 1h, 4h, 1d"),
    limit: int = Query(default=20, ge=1, le=200),
    _current_user: User = Depends(get_current_user),
) -> SignalListResponse:
    """Return recent signals for the requested symbol and timeframe."""
    # Spread signal timestamps over the last 48 h
    interval_hours = {"15min": 0.25, "1h": 1.0, "4h": 4.0, "1d": 24.0}.get(timeframe, 1.0)
    signals: list[GoldSignal] = []
    for i in range(min(limit, 20)):
        hours_ago = i * interval_hours * random.uniform(0.8, 1.5)
        signals.append(_make_signal(symbol, timeframe, hours_ago))

    return SignalListResponse(
        symbol=symbol.upper(),
        timeframe=timeframe,
        signals=signals,
        total=len(signals),
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_symbol(
    symbol: str = Query(default="XAUUSD", min_length=1, max_length=20,
                        description="Symbol to analyse"),
    timeframe: str = Query(default="1h",
                           description="Candle timeframe: 15min, 1h, 4h, 1d"),
    _current_user: User = Depends(get_current_user),
) -> AnalyzeResponse:
    """Run on-demand analysis for the requested symbol. Returns 1-4 fresh signals."""
    n = random.randint(1, 4)
    signals = [_make_signal(symbol, timeframe, hours_ago=0.0) for _ in range(n)]

    logger.info("Commodity analysis requested: symbol=%s timeframe=%s signals=%d",
                symbol, timeframe, n)

    return AnalyzeResponse(
        symbol=symbol.upper(),
        signals_generated=n,
        signals=signals,
        message=(
            f"Analysis complete for {symbol.upper()}. "
            f"{n} signal{'s' if n != 1 else ''} identified on {timeframe} timeframe. "
            "Results reflect historically favorable entry zones — not financial advice."
        ),
    )


@router.get("/risk-status", response_model=RiskStatus)
async def get_risk_status(
    symbol: str = Query(default="XAUUSD", min_length=1, max_length=20),
    _current_user: User = Depends(get_current_user),
) -> RiskStatus:
    """Return current risk engine status for the symbol (kill switch, daily loss, etc.)."""
    return _make_risk_status(symbol)


@router.get("/performance", response_model=PerformanceResponse)
async def get_performance(
    symbol: str = Query(default="XAUUSD", min_length=1, max_length=20),
    days: int = Query(default=30, ge=1, le=365),
    _current_user: User = Depends(get_current_user),
) -> PerformanceResponse:
    """Return strategy performance metrics for the symbol over the requested window."""
    return _make_performance(symbol, days)
