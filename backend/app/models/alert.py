"""
ORM model for price alert rules.

Six supported alert types:
  entered_buy_zone     — price moved inside buy_zone_low..buy_zone_high
  near_buy_zone        — price within proximity_pct% of buy_zone_low
  below_invalidation   — price dropped below invalidation_price
  confidence_improved  — confidence_score increased by >= 0.10
  theme_score_increased — theme_score_total increased by >= 0.15
  macro_deterioration  — theme score dropped sharply or sector tailwind reversed
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

VALID_ALERT_TYPES = {
    "entered_buy_zone",
    "near_buy_zone",
    "below_invalidation",
    "confidence_improved",
    "theme_score_increased",
    "macro_deterioration",
}


class PriceAlertRule(Base):
    __tablename__ = "price_alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # Type-specific parameters e.g. {"proximity_pct": 2.0} for near_buy_zone
    threshold_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    market_hours_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
