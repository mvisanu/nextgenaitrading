from __future__ import annotations

from datetime import datetime

import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr = Field(description="User email address")
    password: str = Field(min_length=8, description="Password (minimum 8 characters)")

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr = Field(description="User email address")
    password: str = Field(description="User password")


class TokenResponse(BaseModel):
    """Returned on successful login/refresh — tokens are in HTTP-only cookies."""
    message: str = Field(default="Authenticated", description="Status message")
    user_id: int = Field(description="Authenticated user's ID")
    email: str = Field(description="Authenticated user's email")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="User primary key")
    email: str = Field(description="User email address")
    is_active: bool = Field(description="Whether the account is active")
    created_at: datetime = Field(description="Account creation timestamp")
