from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.strategy import TimeframeEnum


class BacktestRunRequest(BaseModel):
    symbol: str = Field(description="Valid yfinance ticker")
    timeframe: TimeframeEnum = Field(default="1d")
    mode: Literal["conservative", "aggressive", "ai-pick", "buy-low-sell-high"] = Field(
        description="Strategy mode to backtest"
    )
    leverage: float | None = Field(default=None, ge=0.1, le=10.0)

    @field_validator("symbol")
    @classmethod
    def symbol_uppercase(cls, v: str) -> str:
        return v.strip().upper()


class BacktestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    mode_name: str
    symbol: str
    timeframe: str
    leverage: float
    selected_variant_name: str | None
    selected_variant_score: float | None
    error_message: str | None


class BacktestTradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    strategy_run_id: int
    entry_time: datetime | None
    exit_time: datetime | None
    entry_price: float
    exit_price: float
    return_pct: float
    leveraged_return_pct: float
    pnl: float
    holding_hours: float | None
    exit_reason: str | None
    mode_name: str


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    variant_name: str
    family_name: str
    parameter_json: str
    train_return: float
    validation_return: float
    test_return: float
    validation_score: float
    max_drawdown: float
    sharpe_like: float
    trade_count: int
    selected_winner: bool


class ChartDataResponse(BaseModel):
    """Chart-ready arrays for the backtest price chart."""
    candles: list[dict] = Field(description="OHLCV bars [{time, open, high, low, close, volume}]")
    signals: list[dict] = Field(description="Trade markers [{time, position, color, shape, text}]")
    equity: list[dict] = Field(description="Equity curve [{date, equity}]")
