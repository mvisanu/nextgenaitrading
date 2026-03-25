"""
Pydantic v2 schemas for V3 generated ideas.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GeneratedIdeaOut(BaseModel):
    """
    Auto-generated idea card — returned by GET /api/ideas/generated.

    LANGUAGE RULE: No text in this schema or derived UI implies guarantees.
    Use "historically favorable", "confidence score", "positive outcome rate".
    """
    id: int
    ticker: str
    company_name: str

    # Source info
    source: str           # "news" | "theme" | "technical"
    reason_summary: str
    news_headline: Optional[str] = None
    news_url: Optional[str] = None
    news_source: Optional[str] = None
    catalyst_type: Optional[str] = None

    # Price / zone
    current_price: float
    buy_zone_low: Optional[float] = None
    buy_zone_high: Optional[float] = None
    ideal_entry_price: Optional[float] = None

    # Scores
    confidence_score: float
    historical_win_rate_90d: Optional[float] = None
    theme_tags: list[str] = Field(default_factory=list)
    megatrend_tags: list[str] = Field(default_factory=list)
    moat_score: float
    moat_description: Optional[str] = None
    financial_quality_score: float
    financial_flags: list[str] = Field(default_factory=list)
    near_52w_low: bool
    at_weekly_support: bool
    entry_priority: str   # "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD"
    idea_score: float

    # Lifecycle
    generated_at: datetime
    expires_at: datetime
    added_to_watchlist: bool

    model_config = {"from_attributes": True}


class LastScanOut(BaseModel):
    """Response for GET /api/ideas/generated/last-scan."""
    last_scan_at: Optional[datetime]
    ideas_generated: int
    next_scan_at: Optional[datetime] = None


class AddToWatchlistResponse(BaseModel):
    """Response for POST /api/ideas/generated/{id}/add-to-watchlist."""
    ticker: str
    watchlist_entry_created: bool
    alert_rule_created: bool
    idea_id: int
