"""
Pydantic schemas for commodity alert preferences.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


def _normalise_phone(raw: str) -> str:
    """Strip non-digits, then prepend +1 if no country code."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        digits = "1" + digits
    return "+" + digits


class CommodityAlertPrefsOut(BaseModel):
    email_enabled: bool
    alert_email: Optional[str]
    sms_enabled: bool
    alert_phone: Optional[str]
    symbols: list[str]
    min_confidence: int
    cooldown_minutes: int
    last_alerted_at: Optional[datetime]
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommodityAlertPrefsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    alert_email: Optional[str] = None
    sms_enabled: Optional[bool] = None
    alert_phone: Optional[str] = None
    symbols: Optional[list[str]] = None
    min_confidence: Optional[int] = None
    cooldown_minutes: Optional[int] = None

    @field_validator("alert_email")
    @classmethod
    def _validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v

    @field_validator("alert_phone")
    @classmethod
    def _validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10 or len(digits) > 15:
            raise ValueError("Phone must be 10-15 digits")
        return _normalise_phone(v)

    @field_validator("symbols")
    @classmethod
    def _validate_symbols(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        cleaned = [s.strip().upper() for s in v if s.strip()]
        if len(cleaned) > 10:
            raise ValueError("Maximum 10 symbols per alert preference")
        return cleaned

    @field_validator("min_confidence")
    @classmethod
    def _validate_confidence(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if not (1 <= v <= 100):
            raise ValueError("min_confidence must be 1-100")
        return v

    @field_validator("cooldown_minutes")
    @classmethod
    def _validate_cooldown(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if not (5 <= v <= 1440):
            raise ValueError("cooldown_minutes must be 5-1440")
        return v

    @model_validator(mode="after")
    def _require_contact_when_enabled(self) -> "CommodityAlertPrefsUpdate":
        if self.email_enabled and not self.alert_email:
            raise ValueError("alert_email is required when email_enabled=true")
        if self.sms_enabled and not self.alert_phone:
            raise ValueError("alert_phone is required when sms_enabled=true")
        return self
