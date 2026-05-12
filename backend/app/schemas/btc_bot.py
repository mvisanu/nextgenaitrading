from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class BtcBotSessionCreateRequest(BaseModel):
    initial_buy_usd: Optional[Decimal] = Field(
        default=None,
        gt=0,
        description="Override default initial buy size. Falls back to BTC_BOT_INITIAL_USD env when omitted.",
    )


class BtcBotSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: str
    original_entry_price: Optional[Decimal]
    blended_entry_price: Optional[Decimal]
    total_qty: Decimal
    initial_buy_usd: Decimal
    current_floor: Optional[Decimal]
    trailing_active: bool
    trailing_high: Optional[Decimal]
    ladder_next: int
    cooldown_until: Optional[datetime]
    realized_pnl: Optional[Decimal]
    last_action_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    ended_at: Optional[datetime]


class BtcBotActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    user_id: int
    action: str
    btc_price: Optional[Decimal]
    qty_delta: Optional[Decimal]
    usd_delta: Optional[Decimal]
    floor_before: Optional[Decimal]
    floor_after: Optional[Decimal]
    alpaca_order_id: Optional[str]
    notes: Optional[str]
    created_at: datetime


class BtcBotSessionDetailResponse(BaseModel):
    """Session row with its full action history."""

    session: BtcBotSessionResponse
    actions: list[BtcBotActionResponse]
