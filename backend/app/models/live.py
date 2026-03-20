from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BrokerOrder(Base):
    __tablename__ = "broker_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_run_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("strategy_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)  # "buy" | "sell"
    order_type: Mapped[str] = mapped_column(String(20), nullable=False, default="market")
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notional_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    broker_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    submitted_price_estimate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    filled_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    filled_quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mode_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_response_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PositionSnapshot(Base):
    __tablename__ = "position_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    position_side: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_entry_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    mark_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unrealized_pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    realized_pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    strategy_mode: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)


class CooldownState(Base):
    __tablename__ = "cooldown_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    cooldown_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_exit_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_exit_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TrailingStopState(Base):
    __tablename__ = "trailing_stop_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    entry_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    entry_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    highest_price_seen: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trailing_stop_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    trailing_stop_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
