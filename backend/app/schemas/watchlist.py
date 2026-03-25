"""
Pydantic v2 schemas for the V3 user watchlist endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class WatchlistAddRequest(BaseModel):
    """Request body for POST /api/watchlist."""
    ticker: str = Field(..., min_length=1, max_length=20, description="Stock ticker symbol")

    @field_validator("ticker")
    @classmethod
    def normalise_ticker(cls, v: str) -> str:
        return v.upper().strip()


class WatchlistItemOut(BaseModel):
    """One row in the user's watchlist — as returned by GET /api/watchlist."""
    id: int
    ticker: str
    alert_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WatchlistAlertToggleRequest(BaseModel):
    """Request body for PATCH /api/watchlist/{ticker}/alert."""
    enabled: bool


class BuyNowSignalOut(BaseModel):
    """
    Full signal result for one ticker — returned by GET /api/opportunities
    alongside the watchlist row.  Exposes every condition flag so the UI
    can render a per-condition tooltip.
    """
    id: int
    user_id: int
    ticker: str

    # Backtest layer
    buy_zone_low: float
    buy_zone_high: float
    ideal_entry_price: float
    backtest_confidence: float
    backtest_win_rate_90d: float

    # Live technical layer
    current_price: float
    price_in_zone: bool
    above_50d_ma: bool
    above_200d_ma: bool
    rsi_value: float
    rsi_confirms: bool
    volume_confirms: bool
    near_support: bool
    trend_regime_bullish: bool
    not_near_earnings: bool
    no_duplicate_in_cooldown: bool

    # Decision
    all_conditions_pass: bool
    signal_strength: str
    suppressed_reason: Optional[str]

    # Risk
    invalidation_price: float
    expected_drawdown: float

    created_at: datetime

    model_config = {"from_attributes": True}


class WatchlistOpportunityOut(BaseModel):
    """
    Combined watchlist row + signal data for the Opportunities page table.

    distance_to_zone_pct:
      positive = price is above the zone (not yet in zone)
      negative = price is below the zone (inside or below)
    """
    ticker: str
    alert_enabled: bool
    created_at: datetime

    # Buy zone (from latest StockBuyZoneSnapshot or BuyNowSignal)
    buy_zone_low: Optional[float] = None
    buy_zone_high: Optional[float] = None
    ideal_entry_price: Optional[float] = None
    current_price: Optional[float] = None
    distance_to_zone_pct: Optional[float] = None

    # Confidence metrics
    backtest_confidence: Optional[float] = None
    backtest_win_rate_90d: Optional[float] = None

    # Signal status
    signal_strength: Optional[str] = None          # "STRONG_BUY" | "SUPPRESSED" | None (no eval yet)
    all_conditions_pass: bool = False
    suppressed_reason: Optional[str] = None

    # Individual condition flags (may be None if no signal evaluated yet)
    price_in_zone: Optional[bool] = None
    above_50d_ma: Optional[bool] = None
    above_200d_ma: Optional[bool] = None
    rsi_value: Optional[float] = None
    rsi_confirms: Optional[bool] = None
    volume_confirms: Optional[bool] = None
    near_support: Optional[bool] = None
    trend_regime_bullish: Optional[bool] = None
    not_near_earnings: Optional[bool] = None
    no_duplicate_in_cooldown: Optional[bool] = None

    # Risk metadata
    invalidation_price: Optional[float] = None
    expected_drawdown: Optional[float] = None

    last_signal_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
