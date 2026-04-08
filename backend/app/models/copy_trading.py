from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CopyTradingSession(Base):
    __tablename__ = "copy_trading_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    copy_amount_usd: Mapped[float] = mapped_column(Float, default=300.0, nullable=False)
    target_politician_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_politician_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    credential_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("broker_credentials.id", ondelete="SET NULL"), nullable=True
    )


class CopiedPoliticianTrade(Base):
    __tablename__ = "copied_politician_trades"
    __table_args__ = (
        UniqueConstraint("user_id", "trade_id", name="uq_user_trade"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("copy_trading_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trade_id: Mapped[str] = mapped_column(String(300), nullable=False)
    politician_id: Mapped[str] = mapped_column(String(100), nullable=False)
    politician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    trade_type: Mapped[str] = mapped_column(String(10), nullable=False)
    trade_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    disclosure_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    alpaca_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    alpaca_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    copy_amount_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
