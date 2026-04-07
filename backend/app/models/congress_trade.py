from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CongressCopySession(Base):
    __tablename__ = "congress_copy_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    politician_id: Mapped[str] = mapped_column(String(100), nullable=False)
    politician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    politician_party: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_trade_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )


class CongressTrade(Base):
    __tablename__ = "congress_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    capitol_trade_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    politician_id: Mapped[str] = mapped_column(String(100), nullable=False)
    politician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    asset_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    option_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    trade_type: Mapped[str] = mapped_column(String(20), nullable=False)
    size_range: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    trade_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    reported_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CongressCopiedOrder(Base):
    __tablename__ = "congress_copied_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    congress_trade_id: Mapped[int] = mapped_column(
        ForeignKey("congress_trades.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alpaca_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    qty: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="submitted", nullable=False)
    filled_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
