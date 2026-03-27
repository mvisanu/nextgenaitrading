"""
ORM models for the Optional Auto-Buy Execution feature.

AutoBuySettings — per-user configuration (one row per user, unique constraint).
AutoBuyDecisionLog — immutable audit trail of every auto-buy decision.

IMPORTANT: auto-buy is disabled by default (enabled=False) and must be
explicitly turned on by the user after confirming they understand the risks.
Paper mode is the default when enabled; real execution requires explicit opt-in.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# All possible decision states — see auto_buy_engine.py for state machine logic
DECISION_STATES = {
    "candidate",        # ticker is tracked, evaluation pending
    "ready_to_alert",   # in buy zone but auto-buy not enabled
    "ready_to_buy",     # all safeguards passed, order can be submitted
    "blocked_by_risk",  # one or more safeguards failed
    "order_submitted",  # order sent to broker
    "order_filled",     # confirmed fill received
    "order_rejected",   # broker rejected
    "cancelled",        # user cancelled or rule changed
}


class AutoBuySettings(Base):
    __tablename__ = "auto_buy_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    # Master switch — disabled by default; must be explicitly enabled by user
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Paper mode default — real execution requires paper_mode=False plus explicit confirmation
    paper_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    confidence_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.70)
    max_trade_amount: Mapped[float] = mapped_column(Float, nullable=False, default=1000.0)
    max_position_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    # Negative value: block if expected drawdown exceeds this magnitude
    max_expected_drawdown: Mapped[float] = mapped_column(Float, nullable=False, default=-0.10)
    allow_near_earnings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # List of broker credential IDs allowed for auto-buy execution
    allowed_account_ids_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Execution scheduling fields
    execution_timeframe: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default=None)
    start_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, default=None)
    end_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, default=None)
    target_buy_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    target_sell_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AutoBuyDecisionLog(Base):
    __tablename__ = "auto_buy_decision_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    decision_state: Mapped[str] = mapped_column(String(30), nullable=False)
    # List of {check: str, result: "PASSED"|"FAILED: <reason>"} dicts
    reason_codes_json: Mapped[list] = mapped_column(JSON, nullable=False)
    # Buy zone snapshot data used for this decision
    signal_payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Populated only when decision_state == "order_submitted" or "ready_to_buy"
    order_payload_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
