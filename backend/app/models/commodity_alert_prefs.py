"""
ORM model for per-user commodity signal alert preferences.

One row per user (UNIQUE on user_id). Stores destination email / phone
number and per-symbol watchlist for real-time commodity buy-signal alerts.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CommodityAlertPrefs(Base):
    __tablename__ = "commodity_alert_prefs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Email channel ──────────────────────────────────────────────────────────
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alert_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # ── SMS channel ────────────────────────────────────────────────────────────
    sms_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Store in E.164 format: +18509241429 — plain digits accepted, normalised on save
    alert_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # ── Which symbols to watch ─────────────────────────────────────────────────
    # JSON list of symbol strings, e.g. ["XAUUSD", "XAGUSD"]
    symbols: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # ── Signal quality gate ────────────────────────────────────────────────────
    min_confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=70)

    # ── Cooldown — prevents spam ───────────────────────────────────────────────
    cooldown_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    last_alerted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ── Lifecycle ──────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
