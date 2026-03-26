from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.strategy import TimeframeEnum


class LiveRunRequest(BaseModel):
    symbol: str = Field(description="Valid yfinance ticker")
    timeframe: TimeframeEnum = Field(default="1d")
    mode: Literal["conservative", "aggressive", "squeeze"] = Field(
        description="Strategy mode for signal check"
    )
    credential_id: int = Field(description="Broker credential ID to use")
    dry_run: bool = Field(
        default=True, description="True = simulate only, False = real order submission"
    )

    @field_validator("symbol")
    @classmethod
    def symbol_uppercase(cls, v: str) -> str:
        return v.strip().upper()


class ExecuteRequest(BaseModel):
    symbol: str = Field(description="Ticker to trade")
    side: Literal["buy", "sell"] = Field(description="Order side")
    quantity: float | None = Field(default=None, gt=0, description="Quantity in shares/units")
    notional_usd: float | None = Field(
        default=None, gt=0, description="Notional USD amount (alternative to quantity)"
    )
    credential_id: int = Field(description="Broker credential ID to use")
    dry_run: bool = Field(default=True)
    mode_name: str | None = Field(default=None)
    strategy_run_id: int | None = Field(default=None)

    @field_validator("symbol")
    @classmethod
    def symbol_uppercase(cls, v: str) -> str:
        return v.strip().upper()


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    symbol: str
    side: str
    order_type: str
    quantity: float | None
    notional_usd: float | None
    broker_order_id: str | None
    status: str
    filled_price: float | None
    filled_quantity: float | None
    mode_name: str | None
    dry_run: bool
    error_message: str | None


class PositionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    symbol: str
    position_side: str
    quantity: float
    avg_entry_price: float | None
    mark_price: float | None
    unrealized_pnl: float | None
    realized_pnl: float | None
    is_open: bool
    strategy_mode: str | None


class AccountStatus(BaseModel):
    credential_id: int = Field(description="Active credential ID")
    provider: str = Field(description="Broker provider name")
    profile_name: str = Field(description="Credential profile name")
    paper_trading: bool = Field(description="Whether paper trading is active")
    connected: bool = Field(description="Whether ping() succeeded")
    account_info: dict | None = Field(default=None, description="Raw account data if available")


class ConfirmationDetail(BaseModel):
    name: str
    met: bool
    value: str


class SqueezeData(BaseModel):
    """Bollinger Band Squeeze analysis for the current bar."""
    bb_upper: float = 0.0
    bb_lower: float = 0.0
    bb_middle: float = 0.0
    bb_width_pct: float = 0.0
    bb_width_percentile: float = 50.0
    is_squeeze: bool = False
    squeeze_strength: float = 0.0
    breakout_state: str = "none"
    breakout_confirmed: bool = False
    bars_since_squeeze: int = 0


class SignalCheckOut(BaseModel):
    """Slim response for /live/run-signal-check — matches the frontend SignalCheckResult type."""
    model_config = ConfigDict(from_attributes=True)

    symbol: str
    regime: str | None
    signal: str | None
    confirmation_count: int | None
    strategy_run_id: int
    reason: str | None = None
    confirmation_details: list[ConfirmationDetail] = []
    squeeze: SqueezeData | None = None


class BollingerOverlayBar(BaseModel):
    """Single bar of Bollinger Band overlay data for the chart."""
    time: str | int
    upper: float
    lower: float
    middle: float
    is_squeeze: bool = False


class LiveChartResponse(BaseModel):
    candles: list[dict] = Field(description="OHLCV bars for the price chart")
    bollinger: list[BollingerOverlayBar] | None = Field(
        default=None, description="Bollinger Band overlay data (when requested)"
    )
