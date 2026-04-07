from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TrailingBotSession(Base):
    __tablename__ = "trailing_bot_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[int] = mapped_column(
        ForeignKey("broker_credentials.id", ondelete="CASCADE"), nullable=False
    )

    # Position basics
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    initial_qty: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Alpaca order IDs
    initial_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stop_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Floor / trailing rules
    floor_price: Mapped[float] = mapped_column(Float, nullable=False)
    trailing_trigger_pct: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    trailing_trail_pct: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    trailing_step_pct: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)

    # Trailing state
    trailing_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trailing_high_water: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_floor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Ladder-in rules + fill tracking (JSON stored as Text)
    ladder_rules_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # dry_run flag
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Session status: "active" | "cancelled" | "stopped_out" | "completed"
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
