"""Pydantic v2 schemas for Auto-Buy endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AutoBuySettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    enabled: bool
    paper_mode: bool
    confidence_threshold: float
    max_trade_amount: float
    max_position_percent: float
    max_expected_drawdown: float
    allow_near_earnings: bool
    allowed_account_ids: list
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, s: object) -> "AutoBuySettingsOut":
        return cls(
            id=s.id,  # type: ignore[attr-defined]
            user_id=s.user_id,  # type: ignore[attr-defined]
            enabled=s.enabled,  # type: ignore[attr-defined]
            paper_mode=s.paper_mode,  # type: ignore[attr-defined]
            confidence_threshold=s.confidence_threshold,  # type: ignore[attr-defined]
            max_trade_amount=s.max_trade_amount,  # type: ignore[attr-defined]
            max_position_percent=s.max_position_percent,  # type: ignore[attr-defined]
            max_expected_drawdown=s.max_expected_drawdown,  # type: ignore[attr-defined]
            allow_near_earnings=s.allow_near_earnings,  # type: ignore[attr-defined]
            allowed_account_ids=s.allowed_account_ids_json,  # type: ignore[attr-defined]
            created_at=s.created_at,  # type: ignore[attr-defined]
            updated_at=s.updated_at,  # type: ignore[attr-defined]
        )


class AutoBuySettingsUpdate(BaseModel):
    enabled: bool | None = None
    paper_mode: bool | None = None
    current_password: str | None = Field(
        default=None,
        description="Required when setting paper_mode=False (real trading)",
    )
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    max_trade_amount: float | None = Field(default=None, gt=0)
    max_position_percent: float | None = Field(default=None, gt=0.0, le=1.0)
    max_expected_drawdown: float | None = Field(default=None, le=0.0)
    allow_near_earnings: bool | None = None
    allowed_account_ids: list | None = None


class AutoBuyDecisionLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    ticker: str
    decision_state: str
    reason_codes: list = Field(description="List of {check, result} dicts per safeguard")
    signal_payload: dict
    order_payload: Optional[dict]
    dry_run: bool
    created_at: datetime

    @classmethod
    def from_orm(cls, log: object) -> "AutoBuyDecisionLogOut":
        return cls(
            id=log.id,  # type: ignore[attr-defined]
            user_id=log.user_id,  # type: ignore[attr-defined]
            ticker=log.ticker,  # type: ignore[attr-defined]
            decision_state=log.decision_state,  # type: ignore[attr-defined]
            reason_codes=log.reason_codes_json,  # type: ignore[attr-defined]
            signal_payload=log.signal_payload_json,  # type: ignore[attr-defined]
            order_payload=log.order_payload_json,  # type: ignore[attr-defined]
            dry_run=log.dry_run,  # type: ignore[attr-defined]
            created_at=log.created_at,  # type: ignore[attr-defined]
        )


class DryRunRequest(BaseModel):
    credential_id: Optional[int] = Field(
        default=None, description="Broker credential to simulate against (optional for dry-run)"
    )


class OpportunityOut(BaseModel):
    """Aggregated view of a ticker across buy zone, theme score, and alerts."""
    ticker: str
    current_price: float
    buy_zone_low: Optional[float] = None
    buy_zone_high: Optional[float] = None
    distance_pct: Optional[float] = Field(
        default=None, description="Percent distance from current price to buy_zone_high"
    )
    confidence_score: Optional[float] = None
    entry_quality_score: Optional[float] = None
    theme_score: Optional[float] = None
    alert_active: bool = False
    auto_buy_eligible: bool = False
    last_updated: Optional[datetime] = None
    rank_score: float = 0.0
