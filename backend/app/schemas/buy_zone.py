"""
Pydantic v2 schemas for Buy Zone endpoints.

NOTE: Language rules — never use "guaranteed profit", "safe entry", "certain to go up".
Always use probabilistic language: "historically favorable", "confidence score",
"positive outcome rate", "expected drawdown". See prompt-feature.md Section: Language Rules.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class BuyZoneOut(BaseModel):
    """Response schema for GET /stocks/{ticker}/buy-zone and POST recalculate."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    ticker: str
    current_price: float = Field(description="Most recent closing price used for calculation")
    buy_zone_low: float = Field(description="Lower bound of the historically favorable entry area")
    buy_zone_high: float = Field(description="Upper bound of the historically favorable entry area")
    confidence_score: float = Field(
        ge=0.0, le=1.0, description="Composite confidence score (0.0–1.0)"
    )
    entry_quality_score: float = Field(
        ge=0.0, le=1.0, description="Entry quality score (0.0–1.0)"
    )
    expected_return_30d: float = Field(
        description="Scenario-based estimate of 30-day return (percent)"
    )
    expected_return_90d: float = Field(
        description="Scenario-based estimate of 90-day return (percent)"
    )
    expected_drawdown: float = Field(
        description="Expected max adverse excursion (negative percent)"
    )
    positive_outcome_rate_30d: float = Field(
        ge=0.0, le=1.0, description="Historical positive outcome rate at 30 days (0.0–1.0)"
    )
    positive_outcome_rate_90d: float = Field(
        ge=0.0, le=1.0, description="Historical positive outcome rate at 90 days (0.0–1.0)"
    )
    invalidation_price: float = Field(
        description="Price level that invalidates the thesis; stop-loss reference only"
    )
    horizon_days: int = Field(description="Recommended time horizon in calendar days")
    # feature_payload_json is intentionally excluded from API responses (FR-A07)
    explanation: list[str] = Field(
        description="Human-readable reasoning strings, one per scoring layer"
    )
    model_version: str
    created_at: datetime

    @classmethod
    def from_snapshot(cls, snap: object) -> "BuyZoneOut":
        """Build from ORM StockBuyZoneSnapshot, mapping explanation_json to explanation."""
        return cls(
            id=snap.id,  # type: ignore[attr-defined]
            user_id=snap.user_id,  # type: ignore[attr-defined]
            ticker=snap.ticker,  # type: ignore[attr-defined]
            current_price=snap.current_price,  # type: ignore[attr-defined]
            buy_zone_low=snap.buy_zone_low,  # type: ignore[attr-defined]
            buy_zone_high=snap.buy_zone_high,  # type: ignore[attr-defined]
            confidence_score=snap.confidence_score,  # type: ignore[attr-defined]
            entry_quality_score=snap.entry_quality_score,  # type: ignore[attr-defined]
            expected_return_30d=snap.expected_return_30d,  # type: ignore[attr-defined]
            expected_return_90d=snap.expected_return_90d,  # type: ignore[attr-defined]
            expected_drawdown=snap.expected_drawdown,  # type: ignore[attr-defined]
            positive_outcome_rate_30d=snap.positive_outcome_rate_30d,  # type: ignore[attr-defined]
            positive_outcome_rate_90d=snap.positive_outcome_rate_90d,  # type: ignore[attr-defined]
            invalidation_price=snap.invalidation_price,  # type: ignore[attr-defined]
            horizon_days=snap.horizon_days,  # type: ignore[attr-defined]
            explanation=snap.explanation_json,  # type: ignore[attr-defined]
            model_version=snap.model_version,  # type: ignore[attr-defined]
            created_at=snap.created_at,  # type: ignore[attr-defined]
        )
