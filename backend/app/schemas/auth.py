from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(description="User email address")
    password: str = Field(min_length=8, description="Password (minimum 8 characters)")


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
