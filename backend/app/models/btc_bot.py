from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BtcBotSession(Base):
    __tablename__ = "btc_bot_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("broker_credentials.id", ondelete="SET NULL"), nullable=True
    )

    # active | cooldown | ended | error
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    def __init__(self, **kwargs: object) -> None:
        kwargs.setdefault("status", "active")
        kwargs.setdefault("total_qty", Decimal("0"))
        kwargs.setdefault("initial_buy_usd", Decimal("10000"))
        kwargs.setdefault("trailing_active", False)
        kwargs.setdefault("ladder_next", 0)
        super().__init__(**kwargs)

    original_entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    blended_entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    total_qty: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"), nullable=False)
    initial_buy_usd: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), default=Decimal("10000"), nullable=False
    )
    current_floor: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    trailing_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trailing_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    ladder_next: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cooldown_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    realized_pnl: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    last_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class BtcBotAction(Base):
    __tablename__ = "btc_bot_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("btc_bot_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)

    btc_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    qty_delta: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    usd_delta: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    floor_before: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    floor_after: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    alpaca_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
