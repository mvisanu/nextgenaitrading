"""Pydantic v2 DTOs for the Options Trading Engine API."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ─── Options Chain ────────────────────────────────────────────────────────────

class OptionContractOut(BaseModel):
    symbol: str
    expiration: date
    strike: float
    option_type: Literal["call", "put"]
    bid: float
    ask: float
    mid: float
    volume: int
    open_interest: int
    implied_volatility: float
    delta: float
    gamma: float
    theta: float
    vega: float
    illiquid: bool


class ExpirationsOut(BaseModel):
    symbol: str
    expirations: list[date]


class ScanFilterIn(BaseModel):
    symbol: str
    expiration: date
    min_delta: float = Field(default=0.10, ge=0.0, le=1.0)
    max_delta: float = Field(default=0.50, ge=0.0, le=1.0)
    min_oi: int = Field(default=100, ge=0)
    min_volume: int = Field(default=0, ge=0)
    min_iv_rank: float = Field(default=0.0, ge=0.0, le=100.0)
    strategy_bias: Literal["bullish", "bearish", "neutral", "any"] = "any"
    underlying_price: float = Field(default=100.0, gt=0.0)


# ─── IV ───────────────────────────────────────────────────────────────────────

class IVRankOut(BaseModel):
    symbol: str
    current_iv: float
    iv_rank: float
    iv_percentile: float


# ─── Signals ─────────────────────────────────────────────────────────────────

class SignalLegOut(BaseModel):
    symbol: str
    strike: float
    option_type: Literal["call", "put"]
    expiration: date
    delta: float
    theta: float


class OptionsSignalOut(BaseModel):
    symbol: str
    strategy: str
    confidence: float
    iv_rank: float
    iv_percentile: float
    underlying_trend: str
    days_to_earnings: Optional[int]
    signal_time: datetime
    blocked: bool
    block_reason: Optional[str]
    legs: list[SignalLegOut]


# ─── Risk model ───────────────────────────────────────────────────────────────

class OptionsRiskModelOut(BaseModel):
    max_profit: float
    max_loss: float
    breakeven_prices: list[float]
    profit_at_expiry: dict[str, float]
    probability_of_profit: float
    risk_reward_ratio: float
    theta_per_day: float
    days_to_expiry: int
    margin_required: float
    passes_risk_gate: bool
    risk_gate_failures: list[str]


# ─── Positions ────────────────────────────────────────────────────────────────

class OptionsPositionOut(BaseModel):
    id: int
    symbol: str
    strategy: str
    legs: list[dict]
    broker: str
    order_id: Optional[str]
    status: str
    max_profit: float
    max_loss: float
    breakeven_prices: list[float]
    probability_of_profit: float
    iv_rank_at_entry: float
    days_to_expiry_at_entry: int
    dry_run: bool
    opened_at: datetime
    closed_at: Optional[datetime]
    realized_pnl: Optional[float]

    model_config = {"from_attributes": True}


# ─── Execution ────────────────────────────────────────────────────────────────

class ExecuteSignalIn(BaseModel):
    symbol: str
    strategy: str
    legs: list[SignalLegOut]
    iv_rank: float
    iv_percentile: float
    underlying_trend: str
    confidence: float
    dry_run: bool = True
    underlying_price: float = Field(default=100.0, gt=0.0)


class ExecutionResultOut(BaseModel):
    symbol: str
    status: str
    block_reason: Optional[str]
    order_id: Optional[str]
    dry_run: bool
    risk_model: Optional[OptionsRiskModelOut]


class OptionsExecutionOut(BaseModel):
    id: int
    symbol: str
    status: str
    block_reason: Optional[str]
    dry_run: bool
    executed_at: datetime

    model_config = {"from_attributes": True}


# ─── Portfolio Greeks ─────────────────────────────────────────────────────────

class PortfolioGreeksOut(BaseModel):
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    position_count: int
