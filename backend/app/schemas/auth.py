"""
Auth schemas.

With Supabase handling registration and login, we only need UserOut
for the GET /auth/me endpoint response.
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="User primary key")
    email: str = Field(description="User email address")
    is_active: bool = Field(description="Whether the account is active")
    created_at: datetime = Field(description="Account creation timestamp")
