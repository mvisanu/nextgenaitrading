"""Pydantic v2 schemas for Price Alert Rule endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

VALID_ALERT_TYPES = [
    "entered_buy_zone",
    "near_buy_zone",
    "below_invalidation",
    "confidence_improved",
    "theme_score_increased",
    "macro_deterioration",
]


class AlertCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    alert_type: str
    # Accept both "threshold_json" (test/frontend convention) and "threshold" (legacy)
    threshold_json: dict = Field(
        default_factory=dict,
        description='e.g. {"proximity_pct": 2.0}',
    )
    threshold: dict | None = Field(
        default=None,
        description="Alias for threshold_json — deprecated, use threshold_json",
        exclude=True,
    )
    cooldown_minutes: int = Field(default=60, ge=1, le=10_080)  # max 1 week
    market_hours_only: bool = True

    @model_validator(mode="before")
    @classmethod
    def coerce_threshold(cls, values: dict) -> dict:
        """If only 'threshold' (legacy name) is supplied, copy it to threshold_json."""
        if isinstance(values, dict):
            if "threshold" in values and "threshold_json" not in values:
                values["threshold_json"] = values["threshold"]
        return values

    @field_validator("alert_type")
    @classmethod
    def validate_alert_type(cls, v: str) -> str:
        if v not in VALID_ALERT_TYPES:
            raise ValueError(
                f"alert_type must be one of: {', '.join(VALID_ALERT_TYPES)}"
            )
        return v

    @field_validator("ticker")
    @classmethod
    def uppercase_ticker(cls, v: str) -> str:
        return v.upper().strip()


class AlertUpdate(BaseModel):
    enabled: bool | None = None
    cooldown_minutes: int | None = Field(default=None, ge=1, le=10_080)
    market_hours_only: bool | None = None
    # Accept both field names for backward compatibility
    threshold_json: dict | None = None
    threshold: dict | None = Field(default=None, exclude=True)

    @model_validator(mode="before")
    @classmethod
    def coerce_threshold(cls, values: dict) -> dict:
        """If only 'threshold' (legacy name) is supplied, copy it to threshold_json."""
        if isinstance(values, dict):
            if "threshold" in values and "threshold_json" not in values:
                values["threshold_json"] = values["threshold"]
        return values


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    ticker: str
    alert_type: str
    # Expose as threshold_json (matches test expectations and frontend types)
    threshold_json: dict
    cooldown_minutes: int
    market_hours_only: bool
    enabled: bool
    last_triggered_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, rule: object) -> "AlertOut":
        return cls(
            id=rule.id,  # type: ignore[attr-defined]
            user_id=rule.user_id,  # type: ignore[attr-defined]
            ticker=rule.ticker,  # type: ignore[attr-defined]
            alert_type=rule.alert_type,  # type: ignore[attr-defined]
            threshold_json=rule.threshold_json,  # type: ignore[attr-defined]
            cooldown_minutes=rule.cooldown_minutes,  # type: ignore[attr-defined]
            market_hours_only=rule.market_hours_only,  # type: ignore[attr-defined]
            enabled=rule.enabled,  # type: ignore[attr-defined]
            last_triggered_at=rule.last_triggered_at,  # type: ignore[attr-defined]
            created_at=rule.created_at,  # type: ignore[attr-defined]
            updated_at=rule.updated_at,  # type: ignore[attr-defined]
        )
