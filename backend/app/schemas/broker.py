from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CredentialCreate(BaseModel):
    provider: Literal["alpaca", "robinhood"] = Field(
        description="Broker provider: 'alpaca' or 'robinhood'"
    )
    profile_name: str = Field(
        min_length=1, max_length=100, description="Human-readable name for this credential"
    )
    api_key: str = Field(min_length=1, description="Broker API key (will be encrypted at rest)")
    secret_key: str = Field(
        min_length=1, description="Broker secret / private key (will be encrypted at rest)"
    )
    paper_trading: bool = Field(
        default=False, description="Whether to use paper trading mode (Alpaca only)"
    )
    base_url: str | None = Field(
        default=None, description="Optional override base URL for the broker"
    )


class CredentialUpdate(BaseModel):
    profile_name: str | None = Field(default=None, max_length=100)
    api_key: str | None = Field(default=None, min_length=1)
    secret_key: str | None = Field(default=None, min_length=1)
    paper_trading: bool | None = Field(default=None)
    base_url: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)


class CredentialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Credential primary key")
    user_id: int = Field(description="Owning user ID")
    provider: str = Field(description="Broker provider")
    profile_name: str = Field(description="Human-readable profile name")
    api_key_masked: str = Field(description="Masked API key (last 4 chars visible)")
    paper_trading: bool = Field(description="Whether paper trading is enabled")
    base_url: str | None = Field(default=None, description="Custom broker endpoint URL")
    is_active: bool = Field(description="Whether credential is active")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    @classmethod
    def from_orm_masked(cls, cred: object) -> "CredentialOut":
        """Build response with masked api_key — never returns raw or decrypted value."""
        from app.models.broker import BrokerCredential  # avoid circular at module level

        assert isinstance(cred, BrokerCredential)
        # api_key is stored encrypted; we show a generic mask — never decrypt for display
        return cls(
            id=cred.id,
            user_id=cred.user_id,
            provider=cred.provider,
            profile_name=cred.profile_name,
            api_key_masked="****(encrypted)",
            paper_trading=cred.paper_trading,
            base_url=cred.base_url,
            is_active=cred.is_active,
            created_at=cred.created_at,
            updated_at=cred.updated_at,
        )


class TestResult(BaseModel):
    ok: bool = Field(description="True if broker connection succeeded")
    detail: str | None = Field(default=None, description="Error detail if ok=False")
