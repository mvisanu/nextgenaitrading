from __future__ import annotations

from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolves to backend/.env regardless of working directory
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = Field(
        description="Async PostgreSQL URL (postgresql+asyncpg://...)"
    )
    pool_size: int = Field(default=5, description="SQLAlchemy connection pool size")
    max_overflow: int = Field(
        default=10, description="SQLAlchemy connection pool max overflow"
    )

    # ── JWT ────────────────────────────────────────────────────────────────────
    secret_key: str = Field(description="HMAC secret for JWT signing")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=15)
    refresh_token_expire_days: int = Field(default=7)

    # ── Fernet encryption ──────────────────────────────────────────────────────
    encryption_key: str = Field(description="Base64-URL Fernet key for broker creds")

    # ── CORS ───────────────────────────────────────────────────────────────────
    cors_origins: str = Field(
        default="http://localhost:3000",
        description="Comma-separated list of allowed CORS origins",
    )

    # ── Cookies ────────────────────────────────────────────────────────────────
    cookie_secure: bool = Field(default=False)
    cookie_samesite: str = Field(default="lax")

    # ── Broker URLs ────────────────────────────────────────────────────────────
    alpaca_base_url: str = Field(default="https://api.alpaca.markets")
    alpaca_data_url: str = Field(default="https://data.alpaca.markets")
    alpaca_paper_url: str = Field(default="https://paper-api.alpaca.markets")
    robinhood_base_url: str = Field(default="https://trading.robinhood.com")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list (splits on comma)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]
