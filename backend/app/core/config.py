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
    pool_size: int = Field(default=2, description="SQLAlchemy connection pool size")
    max_overflow: int = Field(
        default=3, description="SQLAlchemy connection pool max overflow"
    )

    # ── JWT ────────────────────────────────────────────────────────────────────
    secret_key: str = Field(description="HMAC secret for JWT signing (legacy)")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=15)
    refresh_token_expire_days: int = Field(default=7)

    # ── Supabase Auth ────────────────────────────────────────────────────────
    supabase_url: str = Field(default="", description="Supabase project URL")
    supabase_anon_key: str = Field(default="", description="Supabase anon/public key")
    supabase_jwt_secret: str = Field(default="", description="Supabase JWT secret for token verification")
    supabase_service_role_key: str = Field(default="", description="Supabase service role key (server-side only)")

    # ── Fernet encryption ──────────────────────────────────────────────────────
    encryption_key: str = Field(description="Base64-URL Fernet key for broker creds")

    # ── Frontend URL (used in notification emails) ─────────────────────────────
    frontend_base_url: str = Field(
        default="http://localhost:3000",
        description="Base URL of the frontend app; used in alert email links. Set to https://nextgenaitrading.vercel.app in production.",
    )

    # ── CORS ───────────────────────────────────────────────────────────────────
    # On Render, set CORS_ORIGINS to:
    #   http://localhost:3000,https://nextgenaitrading.vercel.app
    # Never use "*" — credentials require an explicit origin.
    cors_origins: str = Field(
        default="http://localhost:3000,https://nextgenaitrading.vercel.app",
        description=(
            "Comma-separated list of allowed CORS origins. "
            "Production Render env var must include https://nextgenaitrading.vercel.app"
        ),
    )

    # ── Cookies ────────────────────────────────────────────────────────────────
    cookie_secure: bool = Field(
        default=False,
        description="Must be True in production (HTTPS). Set COOKIE_SECURE=true.",
    )
    cookie_samesite: str = Field(default="lax")

    # ── Debug / environment ──────────────────────────────────────────────────
    debug: bool = Field(default=False, description="Set DEBUG=true for development mode")

    # ── Broker URLs ────────────────────────────────────────────────────────────
    alpaca_base_url: str = Field(default="https://api.alpaca.markets")
    alpaca_data_url: str = Field(default="https://data.alpaca.markets")
    alpaca_paper_url: str = Field(default="https://paper-api.alpaca.markets")
    robinhood_base_url: str = Field(default="https://trading.robinhood.com")

    # ── Alpaca Market Data (optional — enables Alpaca data feed for stocks/ETFs) ─
    # Accepts ALPACA_API_KEY / ALPACA_SECRET_KEY (standard naming) or the more
    # specific ALPACA_DATA_KEY / ALPACA_DATA_SECRET as overrides.
    alpaca_api_key: str = Field(default="", description="Alpaca API key (trading + data)")
    alpaca_secret_key: str = Field(default="", description="Alpaca secret key (trading + data)")
    alpaca_data_key: str = Field(default="", description="Override key for Alpaca market data only")
    alpaca_data_secret: str = Field(default="", description="Override secret for Alpaca market data only")
    alpaca_feed: str = Field(default="iex", description="Alpaca data feed: iex (free/delayed) or sip (paid/real-time)")

    # ── Visanu Alpaca (dedicated account for Congress copy bot) ───────────────
    visanu_alpaca_api_key: str = Field(default="", description="Visanu Alpaca API key")
    visanu_alpaca_secret_key: str = Field(default="", description="Visanu Alpaca secret key")
    visanu_alpaca_endpoint_url: str = Field(
        default="https://paper-api.alpaca.markets",
        description="Alpaca endpoint URL for Visanu account (paper or live)",
    )
    visanu_alpaca_paper: bool = Field(default=True, description="Use Alpaca paper trading for Visanu account")

    # ── Scheduler ──────────────────────────────────────────────────────────────
    scheduler_enable: bool = Field(default=True, description="Enable APScheduler background jobs")
    buy_zone_refresh_minutes: int = Field(default=120, description="Interval for buy zone snapshot refresh")
    theme_score_refresh_minutes: int = Field(default=720, description="Interval for theme score refresh")
    alert_eval_minutes: int = Field(default=10, description="Interval for alert evaluation")
    auto_buy_eval_minutes: int = Field(default=10, description="Interval for auto-buy evaluation")
    watchlist_scan_minutes: int = Field(default=30, description="Interval for watchlist scanner job (market hours only)")

    # ── Notifications ──────────────────────────────────────────────────────────
    notification_email_enabled: bool = Field(default=False, description="Enable email notifications")
    notification_webhook_enabled: bool = Field(default=False, description="Enable webhook notifications")
    notification_webhook_url: str = Field(default="", description="Webhook URL for notifications")

    # ── SMTP (commodity alert emails) ──────────────────────────────────────────
    smtp_host: str = Field(default="", description="SMTP server host (e.g. smtp.gmail.com)")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_user: str = Field(default="", description="SMTP login username")
    smtp_pass: str = Field(default="", description="SMTP login password / app password")
    smtp_from: str = Field(default="", description="From address (defaults to smtp_user)")

    # ── Twilio (commodity alert SMS) ───────────────────────────────────────────
    twilio_account_sid: str = Field(default="", description="Twilio Account SID")
    twilio_auth_token: str = Field(default="", description="Twilio Auth Token")
    twilio_from_number: str = Field(default="", description="Twilio sender number in E.164 (+1...)")

    # ── Commodity alerts scheduler ─────────────────────────────────────────────
    commodity_alert_minutes: int = Field(default=30, description="Interval for commodity signal check (minutes)")

    # ── Congress copy bot ──────────────────────────────────────────────────────
    congress_copy_poll_minutes: int = Field(
        default=30, description="How often (minutes) to poll Capitol Trades for new trades"
    )

    # ── Options engine ────────────────────────────────────────────────────────
    risk_free_rate: float = Field(default=0.05, description="Risk-free rate for Black-Scholes Greeks")
    options_earnings_block_days: int = Field(default=5, description="Block new options entries within N days of earnings")
    options_min_iv_rank: float = Field(default=30.0, description="Minimum IV rank to generate a signal")
    options_max_single_trade_loss: float = Field(default=500.0, description="Max allowed loss per options trade ($)")
    options_min_pop: float = Field(default=0.60, description="Minimum probability of profit")
    options_scanner_symbols: str = Field(default="AAPL,TSLA,NVDA,SPY,QQQ,AMZN,MSFT,META,GOOGL,AMD", description="Comma-separated symbols for options scanner")
    options_active_broker: str = Field(default="alpaca", description="Active options broker name")

    # ── V3 scanner settings ────────────────────────────────────────────────────
    live_scanner_minutes: int = Field(default=15, description="V3 live scanner interval (minutes)")
    idea_generator_minutes: int = Field(default=120, description="V3 idea generator interval (minutes)")
    signal_prune_days: int = Field(default=30, description="Days to retain buy_now_signals rows")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return v.strip()

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list (splits on comma).
        In debug mode, also allows common local dev ports so E2E tests
        running on a different port than 3000 work without .env changes."""
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.debug:
            for port in (3000, 3001, 3002, 3003, 3004, 3005, 5173, 8080):
                origin = f"http://localhost:{port}"
                if origin not in origins:
                    origins.append(origin)
        return origins


settings = Settings()  # type: ignore[call-arg]
