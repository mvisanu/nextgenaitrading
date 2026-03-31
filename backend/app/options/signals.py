"""Options signal generation.

Evaluates IV rank + price action + earnings gate + delta/theta thresholds
to produce an OptionsSignal for a given symbol.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .broker.base import OptionContract

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────

class SignalConfig(BaseModel):
    earnings_block_days: int = Field(default=5, ge=0)
    min_iv_rank: float = Field(default=30.0, ge=0.0, le=100.0)
    min_pop: float = Field(default=0.60, ge=0.0, le=1.0)
    min_risk_reward_credit: float = Field(default=3.0, ge=0.0)
    min_risk_reward_debit: float = Field(default=2.0, ge=0.0)
    max_single_trade_loss: float = Field(default=500.0, gt=0.0)
    # Delta targets per strategy
    csp_delta_target: float = Field(default=0.25)
    cc_delta_target: float = Field(default=0.30)
    condor_short_delta: float = Field(default=0.16)


# ─── Signal dataclass ─────────────────────────────────────────────────────────

@dataclass
class OptionsSignal:
    symbol: str
    strategy: str
    contract_legs: list[OptionContract]
    confidence: float                   # 0.0–1.0
    iv_rank: float
    iv_percentile: float
    underlying_trend: str               # "bullish", "bearish", "neutral"
    days_to_earnings: Optional[int]
    signal_time: datetime
    blocked: bool
    block_reason: Optional[str]

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "strategy": self.strategy,
            "confidence": self.confidence,
            "iv_rank": self.iv_rank,
            "iv_percentile": self.iv_percentile,
            "underlying_trend": self.underlying_trend,
            "days_to_earnings": self.days_to_earnings,
            "signal_time": self.signal_time.isoformat(),
            "blocked": self.blocked,
            "block_reason": self.block_reason,
            "legs": [
                {
                    "symbol": c.symbol,
                    "strike": c.strike,
                    "option_type": c.option_type,
                    "expiration": c.expiration.isoformat(),
                    "delta": c.delta,
                    "theta": c.theta,
                }
                for c in self.contract_legs
            ],
        }


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _blocked(symbol: str, reason: str) -> OptionsSignal:
    return OptionsSignal(
        symbol=symbol,
        strategy="none",
        contract_legs=[],
        confidence=0.0,
        iv_rank=0.0,
        iv_percentile=0.0,
        underlying_trend="neutral",
        days_to_earnings=None,
        signal_time=datetime.utcnow(),
        blocked=True,
        block_reason=reason,
    )


def _select_strategy(
    iv_rank: float,
    underlying_trend: str,
) -> str:
    """Strategy selection matrix from the spec."""
    if underlying_trend == "bullish" and iv_rank >= 50:
        return "cash_secured_put"
    if underlying_trend == "bearish" and iv_rank >= 50:
        return "covered_call"
    if underlying_trend == "neutral" and iv_rank >= 50:
        return "iron_condor"
    if underlying_trend == "bullish" and iv_rank < 30:
        return "bull_call_debit"
    if underlying_trend == "bearish" and iv_rank < 30:
        return "bear_put_debit"
    if underlying_trend == "neutral" and iv_rank < 30:
        return "long_straddle"
    # 30–50 range: default to defined-risk spread
    if underlying_trend == "bullish":
        return "bull_put_spread"
    if underlying_trend == "bearish":
        return "bear_call_spread"
    return "iron_condor"


def _select_contracts(
    chain: list[OptionContract],
    strategy: str,
    config: SignalConfig,
) -> list[OptionContract]:
    """Pick contracts matching delta thresholds for the chosen strategy."""
    puts = [c for c in chain if c.option_type == "put" and not c.illiquid]
    calls = [c for c in chain if c.option_type == "call" and not c.illiquid]

    def closest_delta(contracts: list[OptionContract], target: float) -> Optional[OptionContract]:
        candidates = [c for c in contracts if c.open_interest >= 100]
        if not candidates:
            return None
        return min(candidates, key=lambda c: abs(abs(c.delta) - target))

    if strategy == "cash_secured_put":
        c = closest_delta(puts, config.csp_delta_target)
        return [c] if c else []

    if strategy == "covered_call":
        c = closest_delta(calls, config.cc_delta_target)
        return [c] if c else []

    if strategy == "iron_condor":
        short_put = closest_delta(puts, config.condor_short_delta)
        short_call = closest_delta(calls, config.condor_short_delta)
        if short_put and short_call:
            return [short_put, short_call]
        return []

    if strategy in ("bull_call_debit", "bear_put_debit"):
        opt_type = "call" if "call" in strategy else "put"
        pool = calls if opt_type == "call" else puts
        c = closest_delta(pool, 0.40)
        return [c] if c else []

    if strategy == "long_straddle":
        atm_call = closest_delta(calls, 0.50)
        atm_put = closest_delta(puts, 0.50)
        if atm_call and atm_put:
            return [atm_call, atm_put]
        return []

    if strategy in ("bull_put_spread", "bear_call_spread"):
        pool = puts if "put" in strategy else calls
        short_leg = closest_delta(pool, 0.30)
        return [short_leg] if short_leg else []

    return []


def _confidence(iv_rank: float, iv_pct: float, underlying_trend: str) -> float:
    score = 0.0
    score += min(iv_rank / 100, 1.0) * 0.4
    score += min(iv_pct / 100, 1.0) * 0.3
    if underlying_trend in ("bullish", "bearish"):
        score += 0.3
    else:
        score += 0.15
    return round(min(score, 1.0), 3)


# ─── Public API ───────────────────────────────────────────────────────────────

def evaluate_signal(
    symbol: str,
    chain: list[OptionContract],
    iv_rank: float,
    iv_pct: float,
    underlying_trend: str,
    days_to_earnings: Optional[int],
    config: SignalConfig,
) -> OptionsSignal:
    """Evaluate a signal following the gating order from the spec."""
    # 1. Earnings gate — hard block
    if days_to_earnings is not None and days_to_earnings <= config.earnings_block_days:
        return _blocked(symbol, f"Earnings in {days_to_earnings} days (block window: {config.earnings_block_days})")

    # 2. IV rank gate
    if iv_rank < config.min_iv_rank:
        return _blocked(symbol, f"IV rank {iv_rank:.1f} below minimum {config.min_iv_rank:.1f}")

    # 3. Strategy selection
    strategy = _select_strategy(iv_rank, underlying_trend)

    # 4. Contract selection
    legs = _select_contracts(chain, strategy, config)
    if not legs:
        return _blocked(symbol, f"No contracts matched delta/theta thresholds for {strategy}")

    # 5. Confidence score
    confidence = _confidence(iv_rank, iv_pct, underlying_trend)

    return OptionsSignal(
        symbol=symbol,
        strategy=strategy,
        contract_legs=legs,
        confidence=confidence,
        iv_rank=iv_rank,
        iv_percentile=iv_pct,
        underlying_trend=underlying_trend,
        days_to_earnings=days_to_earnings,
        signal_time=datetime.utcnow(),
        blocked=False,
        block_reason=None,
    )
