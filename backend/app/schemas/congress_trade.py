from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PoliticianSummary(BaseModel):
    id: str
    name: str
    party: Optional[str] = None
    chamber: Optional[str] = None
    state: Optional[str] = None
    trade_count_90d: int = 0


class CapitolTradeEntry(BaseModel):
    id: str
    politician_id: str
    politician_name: str
    ticker: str
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    option_type: Optional[str] = None
    trade_type: str
    size_range: Optional[str] = None
    trade_date: Optional[str] = None
    reported_at: Optional[str] = None


class CongressCopySetupRequest(BaseModel):
    politician_id: str
    politician_name: str
    politician_party: Optional[str] = None
    dry_run: bool = True


class CongressCopySessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    politician_id: str
    politician_name: str
    politician_party: Optional[str] = None
    dry_run: bool
    status: str
    last_checked_at: Optional[datetime] = None
    last_trade_date: Optional[str] = None
    created_at: datetime


class CongressTradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    capitol_trade_id: str
    politician_name: str
    ticker: str
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None
    option_type: Optional[str] = None
    trade_type: str
    size_range: Optional[str] = None
    trade_date: Optional[str] = None
    reported_at: Optional[str] = None
    fetched_at: datetime


class CongressCopiedOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    congress_trade_id: int
    alpaca_order_id: Optional[str] = None
    symbol: str
    side: str
    qty: float
    order_type: str
    status: str
    filled_price: Optional[float] = None
    dry_run: bool
    error_message: Optional[str] = None
    created_at: datetime
