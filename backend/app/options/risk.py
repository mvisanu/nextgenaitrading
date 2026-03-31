"""P&L and risk modeling for options strategies.

Runs before every order submission — never post-execution.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from .signals import OptionsSignal, SignalConfig

logger = logging.getLogger(__name__)

CREDIT_STRATEGIES = {
    "cash_secured_put",
    "covered_call",
    "iron_condor",
    "iron_butterfly",
    "bull_put_spread",
    "bear_call_spread",
}

DEBIT_STRATEGIES = {
    "bull_call_debit",
    "bear_put_debit",
    "long_straddle",
    "long_strangle",
}


@dataclass
class OptionsRiskModel:
    max_profit: float
    max_loss: float
    breakeven_prices: list[float]
    profit_at_expiry: dict[float, float]   # underlying price → P&L
    probability_of_profit: float           # derived from delta
    risk_reward_ratio: float
    theta_per_day: float
    days_to_expiry: int
    margin_required: float
    passes_risk_gate: bool
    risk_gate_failures: list[str]

    def to_dict(self) -> dict:
        return {
            "max_profit": self.max_profit,
            "max_loss": self.max_loss,
            "breakeven_prices": self.breakeven_prices,
            "profit_at_expiry": {str(k): v for k, v in self.profit_at_expiry.items()},
            "probability_of_profit": self.probability_of_profit,
            "risk_reward_ratio": self.risk_reward_ratio,
            "theta_per_day": self.theta_per_day,
            "days_to_expiry": self.days_to_expiry,
            "margin_required": self.margin_required,
            "passes_risk_gate": self.passes_risk_gate,
            "risk_gate_failures": self.risk_gate_failures,
        }


def _payoff_at_expiry(
    strategy: str,
    legs: list,
    underlying_prices: list[float],
    premium: float,
) -> dict[float, float]:
    """Compute P&L at expiry across a price range."""
    result: dict[float, float] = {}
    for S in underlying_prices:
        pnl = 0.0
        for leg in legs:
            K = leg.strike
            is_call = leg.option_type == "call"
            intrinsic = max(S - K, 0) if is_call else max(K - S, 0)
            pnl += intrinsic * 100  # 1 contract = 100 shares
        # Credit strategies: start with received premium
        if strategy in CREDIT_STRATEGIES:
            pnl = premium * 100 - pnl  # we sold premium
        else:
            pnl = pnl - premium * 100   # we paid premium
        result[round(S, 2)] = round(pnl, 2)
    return result


def model_risk(
    signal: OptionsSignal,
    config: SignalConfig,
    underlying_price: float,
) -> OptionsRiskModel:
    """Build full risk model from a signal."""
    legs = signal.contract_legs
    if not legs:
        return OptionsRiskModel(
            max_profit=0.0,
            max_loss=0.0,
            breakeven_prices=[],
            profit_at_expiry={},
            probability_of_profit=0.0,
            risk_reward_ratio=0.0,
            theta_per_day=0.0,
            days_to_expiry=0,
            margin_required=0.0,
            passes_risk_gate=False,
            risk_gate_failures=["No contracts in signal"],
        )

    # Premium: use mid price of first leg
    premium = legs[0].mid if legs else 0.0
    for leg in legs[1:]:
        if signal.strategy in ("iron_condor", "iron_butterfly"):
            premium += leg.mid  # combined credit
        elif signal.strategy in DEBIT_STRATEGIES:
            premium = abs(legs[0].mid - (legs[1].mid if len(legs) > 1 else 0))

    # P&L at expiry across ±20% price range (41 points)
    step = underlying_price * 0.40 / 40
    prices = [round(underlying_price * 0.80 + step * i, 2) for i in range(41)]
    profit_at_expiry = _payoff_at_expiry(signal.strategy, legs, prices, premium)

    max_profit = max(profit_at_expiry.values(), default=0.0)
    max_loss = min(profit_at_expiry.values(), default=0.0)

    # Breakeven(s): prices where P&L crosses zero
    sorted_prices = sorted(profit_at_expiry.keys())
    breakevens: list[float] = []
    for i in range(len(sorted_prices) - 1):
        p1, p2 = sorted_prices[i], sorted_prices[i + 1]
        v1, v2 = profit_at_expiry[p1], profit_at_expiry[p2]
        if v1 * v2 <= 0:
            if v2 - v1 != 0:
                be = p1 - v1 * (p2 - p1) / (v2 - v1)
                breakevens.append(round(be, 2))

    # POP from primary leg delta
    primary_delta = abs(legs[0].delta)
    if signal.strategy in CREDIT_STRATEGIES:
        pop = 1.0 - primary_delta  # sell OTM → POP ≈ 1 - |delta|
    else:
        pop = primary_delta

    # Risk/reward
    rr = 0.0
    if max_loss < 0 and max_profit > 0:
        rr = round(max_profit / abs(max_loss), 2)

    # Theta per day (sum of legs)
    theta_per_day = sum(c.theta * 100 for c in legs)

    # DTE from first leg
    from datetime import date
    dte = max((legs[0].expiration - date.today()).days, 0)

    # Margin
    if signal.strategy in ("naked_call", "naked_put"):
        margin_required = legs[0].strike * 100 * 0.20
    else:
        margin_required = abs(max_loss) if max_loss < 0 else premium * 100

    # Risk gate checks
    failures: list[str] = []
    if abs(max_loss) > config.max_single_trade_loss:
        failures.append(
            f"Max loss ${abs(max_loss):.0f} exceeds limit ${config.max_single_trade_loss:.0f}"
        )
    if pop < config.min_pop:
        failures.append(f"POP {pop:.0%} below minimum {config.min_pop:.0%}")
    min_rr = (
        config.min_risk_reward_credit
        if signal.strategy in CREDIT_STRATEGIES
        else config.min_risk_reward_debit
    )
    if rr > 0 and rr < min_rr:
        failures.append(f"Risk/reward {rr:.1f} below minimum {min_rr:.1f}")

    return OptionsRiskModel(
        max_profit=round(max_profit, 2),
        max_loss=round(max_loss, 2),
        breakeven_prices=breakevens,
        profit_at_expiry=profit_at_expiry,
        probability_of_profit=round(pop, 4),
        risk_reward_ratio=rr,
        theta_per_day=round(theta_per_day, 4),
        days_to_expiry=dte,
        margin_required=round(margin_required, 2),
        passes_risk_gate=len(failures) == 0,
        risk_gate_failures=failures,
    )
