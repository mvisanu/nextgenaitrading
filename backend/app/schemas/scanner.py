"""
Pydantic v2 schemas for the Scanner API.

EstimatedBuyPriceOut — single-ticker signal + buy zone estimate
ScanResultOut         — extends EstimatedBuyPriceOut with notification metadata
GeneratedIdeaOut      — auto-generated idea from the stock universe scan
ScanRequest           — request body for watchlist scans
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ScanRequest(BaseModel):
    """Request body for scanner endpoints that accept a list of tickers."""

    tickers: list[str] = Field(
        min_length=1,
        max_length=50,
        description="List of ticker symbols to scan (e.g. ['AAPL', 'MSFT'])",
    )


class EstimatedBuyPriceOut(BaseModel):
    """Per-ticker signal enriched with a buy price estimate and confirmation breakdown."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str
    estimated_buy_price: Optional[float] = Field(
        default=None,
        description=(
            "Estimated entry price. Current price when signal=buy; "
            "buy zone midpoint or Bollinger lower when signal=hold/sell."
        ),
    )
    current_price: float
    signal: str = Field(description="'buy' | 'sell' | 'hold'")
    regime: Optional[str] = Field(default=None, description="'bull' | 'bear' | 'unknown'")
    confirmation_count: int = Field(description="Number of confirmations met (0–8)")
    min_confirmations: int = Field(default=7, description="Minimum confirmations required for a buy signal")
    confirmations_needed: list[str] = Field(
        default_factory=list,
        description="Labels of unmet confirmation conditions",
    )
    buy_zone_low: Optional[float] = None
    buy_zone_high: Optional[float] = None


class ScanResultOut(EstimatedBuyPriceOut):
    """Scan result — extends EstimatedBuyPriceOut with per-run metadata."""

    notification_sent: bool = Field(
        default=False,
        description="True when a BUY-signal notification was dispatched for this ticker.",
    )
    scanned_at: datetime


class GeneratedIdeaOut(BaseModel):
    """Auto-generated investment idea produced by scanning the stock universe."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str
    title: str
    thesis: str
    signal: str = Field(description="'buy' | 'sell' | 'hold'")
    regime: Optional[str] = Field(default=None)
    confirmation_count: int
    momentum_20d: float = Field(description="20-day price return (%)")
    momentum_60d: float = Field(description="60-day price return (%)")
    volume_score: float = Field(description="Normalised volume vs 20-bar average (0–1 capped)")
    theme_score: Optional[float] = Field(default=None, description="Theme alignment score if available")
    composite_score: float = Field(description="Blended ranking score used to select top ideas")
    current_price: float
    tags: list[str] = Field(default_factory=list)
    generated_at: datetime
