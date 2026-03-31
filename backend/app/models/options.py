"""ORM models for the Options Trading Engine.

OptionsPosition  — open/closed options positions per user
OptionsExecution — immutable execution audit log
IVHistory        — daily IV snapshots for IV rank/percentile computation
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey,
    Integer, JSON, String, UniqueConstraint, func, ARRAY,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OptionsPosition(Base):
    __tablename__ = "options_positions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    strategy: Mapped[str] = mapped_column(String(50), nullable=False)
    legs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    broker: Mapped[str] = mapped_column(String(30), nullable=False, default="alpaca")
    order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    entry_credit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    entry_debit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_profit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_loss: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    breakeven_prices: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    probability_of_profit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    iv_rank_at_entry: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    days_to_expiry_at_entry: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    realized_pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class OptionsExecution(Base):
    __tablename__ = "options_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    signal: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    risk_model: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    order_request: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    order_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    block_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class IVHistory(Base):
    __tablename__ = "iv_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    iv: Mapped[float] = mapped_column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_iv_history_symbol_date"),
    )
