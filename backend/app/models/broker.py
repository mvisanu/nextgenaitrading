from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BrokerCredential(Base):
    __tablename__ = "broker_credentials"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('alpaca', 'robinhood')",
            name="ck_broker_credentials_provider",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    profile_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Both fields stored Fernet-encrypted
    api_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    encrypted_secret_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    base_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    paper_trading: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
