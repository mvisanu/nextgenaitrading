"""Pydantic v2 schemas for the Wheel Strategy Bot."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.wheel_bot import WheelBotSession


class WheelBotSetupRequest(BaseModel):
    symbol: str = Field(default="TSLA", description="Underlying ticker symbol")
    dry_run: bool = Field(default=True, description="Paper trade only — no real orders")

    @field_validator("symbol", mode="before")
    @classmethod
    def uppercase_symbol(cls, v: str) -> str:
        return v.upper().strip()


class WheelBotSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    symbol: str
    dry_run: bool
    stage: str
    active_contract_symbol: Optional[str]
    active_order_id: Optional[str]
    active_premium_received: Optional[float]
    active_strike: Optional[float]
    active_expiry: Optional[str]
    shares_qty: int
    cost_basis_per_share: Optional[float]
    total_premium_collected: float
    status: str
    last_action: Optional[str]

    @classmethod
    def from_orm_session(cls, s: WheelBotSession) -> "WheelBotSessionResponse":
        return cls.model_validate(s)


class WheelBotSummaryResponse(BaseModel):
    session_id: int
    date: str
    stage: str
    symbol: str
    active_contract_symbol: Optional[str]
    shares_qty: int
    cost_basis_per_share: Optional[float]
    total_premium_collected: float
    account_equity: float
    account_cash: float
    total_return_pct: float
    last_action: Optional[str]
