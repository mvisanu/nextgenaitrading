from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Reusable timeframe type
TimeframeEnum = Literal["1d", "1h", "4h", "1wk"]


class StrategyRunRequest(BaseModel):
    """
    Base request for all strategy run endpoints.
    Matches the canonical RunStrategyRequest shape from the PRD.
    """
    symbol: str = Field(description="Valid yfinance ticker, e.g. 'AAPL', 'BTC-USD'")
    timeframe: TimeframeEnum = Field(default="1d", description="OHLCV bar interval")
    mode: Literal["conservative", "aggressive", "ai-pick", "buy-low-sell-high"] = Field(
        description="Strategy execution mode"
    )
    leverage: float | None = Field(
        default=None,
        ge=0.1,
        le=10.0,
        description="Leverage multiplier; defaults to mode default if not supplied",
    )
    dry_run: bool = Field(default=True, description="Dry-run mode — no live orders submitted")

    @field_validator("symbol")
    @classmethod
    def symbol_uppercase(cls, v: str) -> str:
        return v.strip().upper()


class StrategyRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    run_type: str
    mode_name: str
    symbol: str
    timeframe: str
    leverage: float
    min_confirmations: int | None
    trailing_stop_pct: float | None
    current_regime: str | None
    current_signal: str | None
    confirmation_count: int | None
    selected_variant_name: str | None
    selected_variant_score: float | None
    notes: str | None
    error_message: str | None


class TradeDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    strategy_run_id: int
    created_at: datetime
    symbol: str
    timeframe: str
    timestamp_of_bar: datetime | None
    regime: str | None
    signal: str | None
    confirmation_count: int | None
    entry_eligible: bool
    cooldown_active: bool
    reason_summary: str | None
