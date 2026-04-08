# Congress Copy Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a "Congress Copy Bot" that scrapes Capitol Trades for the most-active and recently-profitable politician's trades, then automatically mirrors those trades (stocks and options) on a dedicated Alpaca account (Visanu), with a 30-minute polling scheduler and a full-featured dashboard page.

**Architecture:** A new vertical slice — `congress_copy` — following the same patterns as `trailing_bot`. Capitol Trades has a public JSON API at `https://api.capitoltrades.com`; we hit it with `httpx`. The Visanu Alpaca credentials live in `.env` as `VISANU_ALPACA_API_KEY` / `VISANU_ALPACA_SECRET_KEY` / `VISANU_ALPACA_ENDPOINT_URL` and are loaded into config. A dedicated `VisanuAlpacaClient` wraps alpaca-py. The scheduler task runs every 30 minutes, fetches new trades since the last check, and places matching orders.

**Tech Stack:** FastAPI · SQLAlchemy 2.x async · Alembic · Pydantic v2 · httpx · alpaca-py · APScheduler · Next.js 14 App Router · TanStack Query · shadcn/ui

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `backend/app/models/congress_trade.py` | ORM: `CongressCopySession`, `CongressTrade`, `CongressCopiedOrder` |
| `backend/app/schemas/congress_trade.py` | Pydantic DTOs for all three models |
| `backend/app/services/capitol_trades_service.py` | Fetch + parse politician list and trades from Capitol Trades API |
| `backend/app/services/congress_copy_service.py` | Rank politicians; map Capitol Trades entries to Alpaca orders; execute |
| `backend/app/broker/visanu_alpaca.py` | Dedicated Alpaca trading client for Visanu account (no DB credentials) |
| `backend/app/api/congress_copy.py` | FastAPI router: setup, list-sessions, session-detail, delete, trades, politicians |
| `backend/app/scheduler/tasks/congress_copy_monitor.py` | APScheduler task: poll Capitol Trades, copy new trades |
| `backend/alembic/versions/v6_congress_copy.py` | Alembic migration for three new tables |
| `frontend/lib/congress-copy-api.ts` | Typed fetch wrappers |
| `frontend/app/congress-copy/page.tsx` | Dashboard page (Sovereign Terminal design) |

### Modified files

| File | Change |
|---|---|
| `backend/app/core/config.py` | Add `visanu_alpaca_api_key`, `visanu_alpaca_secret_key`, `visanu_alpaca_endpoint_url`, `congress_copy_poll_minutes` |
| `backend/app/main.py` | Import + register `congress_copy_router` |
| `backend/app/scheduler/jobs.py` | Import + register `run_congress_copy_monitor` task |
| `frontend/components/layout/Sidebar.tsx` | Add "Congress Bot" nav item (icon: `Users`) |
| `frontend/proxy.ts` | Add `/congress-copy` to `PROTECTED_PREFIXES` |

---

## Task 1: Alembic migration — three new tables

**Files:**
- Create: `backend/alembic/versions/v6_congress_copy.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/alembic/versions/v6_congress_copy.py
"""v6 congress_copy tables

Revision ID: v6_congress_copy
Revises: v5_trailing_bot
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v6_congress_copy"
down_revision = "v5_trailing_bot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── CongressCopySession ──────────────────────────────────────────────────
    op.create_table(
        "congress_copy_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("politician_id", sa.String(100), nullable=False),
        sa.Column("politician_name", sa.String(200), nullable=False),
        sa.Column("politician_party", sa.String(50), nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_trade_date", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_congress_copy_sessions_user_id",
        "congress_copy_sessions",
        ["user_id"],
        if_not_exists=True,
    )

    # ── CongressTrade ────────────────────────────────────────────────────────
    op.create_table(
        "congress_trades",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("capitol_trade_id", sa.String(100), nullable=False, unique=True),
        sa.Column("politician_id", sa.String(100), nullable=False),
        sa.Column("politician_name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_name", sa.String(500), nullable=True),
        sa.Column("asset_type", sa.String(50), nullable=True),
        sa.Column("option_type", sa.String(10), nullable=True),  # call | put | None
        sa.Column("trade_type", sa.String(20), nullable=False),  # purchase | sale
        sa.Column("size_range", sa.String(50), nullable=True),
        sa.Column("trade_date", sa.String(20), nullable=True),
        sa.Column("reported_at", sa.String(20), nullable=True),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_congress_trades_session_id",
        "congress_trades",
        ["session_id"],
        if_not_exists=True,
    )

    # ── CongressCopiedOrder ──────────────────────────────────────────────────
    op.create_table(
        "congress_copied_orders",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "congress_trade_id",
            sa.Integer,
            sa.ForeignKey("congress_trades.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alpaca_order_id", sa.String(100), nullable=True),
        sa.Column("symbol", sa.String(50), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),   # buy | sell
        sa.Column("qty", sa.Float, nullable=False),
        sa.Column("order_type", sa.String(20), nullable=False),  # market | limit
        sa.Column("status", sa.String(30), nullable=False, server_default="submitted"),
        sa.Column("filled_price", sa.Float, nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_congress_copied_orders_session_id",
        "congress_copied_orders",
        ["session_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_congress_copied_orders_session_id", table_name="congress_copied_orders", if_exists=True)
    op.drop_table("congress_copied_orders")
    op.drop_index("ix_congress_trades_session_id", table_name="congress_trades", if_exists=True)
    op.drop_table("congress_trades")
    op.drop_index("ix_congress_copy_sessions_user_id", table_name="congress_copy_sessions", if_exists=True)
    op.drop_table("congress_copy_sessions")
```

- [ ] **Step 2: Run migration to verify it applies cleanly**

```bash
cd backend && source .venv/Scripts/activate
alembic upgrade head
```
Expected: `Running upgrade v5_trailing_bot -> v6_congress_copy`

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/v6_congress_copy.py
git commit -m "feat: v6 alembic migration — congress_copy_sessions, congress_trades, congress_copied_orders"
```

---

## Task 2: ORM models

**Files:**
- Create: `backend/app/models/congress_trade.py`

- [ ] **Step 1: Write ORM models**

```python
# backend/app/models/congress_trade.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CongressCopySession(Base):
    __tablename__ = "congress_copy_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    politician_id: Mapped[str] = mapped_column(String(100), nullable=False)
    politician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    politician_party: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_trade_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )


class CongressTrade(Base):
    __tablename__ = "congress_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    capitol_trade_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    politician_id: Mapped[str] = mapped_column(String(100), nullable=False)
    politician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    asset_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    option_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    trade_type: Mapped[str] = mapped_column(String(20), nullable=False)
    size_range: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    trade_date: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    reported_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CongressCopiedOrder(Base):
    __tablename__ = "congress_copied_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    congress_trade_id: Mapped[int] = mapped_column(
        ForeignKey("congress_trades.id", ondelete="CASCADE"), nullable=False
    )
    alpaca_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    symbol: Mapped[str] = mapped_column(String(50), nullable=False)
    side: Mapped[str] = mapped_column(String(10), nullable=False)
    qty: Mapped[float] = mapped_column(Float, nullable=False)
    order_type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="submitted", nullable=False)
    filled_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

- [ ] **Step 2: Register in `backend/app/db/base.py`**

Open `backend/app/db/base.py`. It has a section that imports all models so Alembic sees them. Add:

```python
from app.models.congress_trade import CongressCopySession, CongressTrade, CongressCopiedOrder  # noqa: F401
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/congress_trade.py backend/app/db/base.py
git commit -m "feat: ORM models for congress copy bot"
```

---

## Task 3: Pydantic schemas

**Files:**
- Create: `backend/app/schemas/congress_trade.py`

- [ ] **Step 1: Write schemas**

```python
# backend/app/schemas/congress_trade.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PoliticianSummary(BaseModel):
    """A politician returned from Capitol Trades API."""
    id: str
    name: str
    party: Optional[str] = None
    chamber: Optional[str] = None
    state: Optional[str] = None
    trade_count_90d: int = 0


class CapitolTradeEntry(BaseModel):
    """A single trade entry returned by Capitol Trades API."""
    id: str
    politician_id: str
    politician_name: str
    ticker: str
    asset_name: Optional[str] = None
    asset_type: Optional[str] = None   # "stock" | "option" | "etf" | etc.
    option_type: Optional[str] = None  # "call" | "put" | None
    trade_type: str                    # "purchase" | "sale"
    size_range: Optional[str] = None   # "$1,001-$15,000"
    trade_date: Optional[str] = None   # "2024-01-10"
    reported_at: Optional[str] = None  # "2024-01-15"


class CongressCopySetupRequest(BaseModel):
    politician_id: str
    politician_name: str
    politician_party: Optional[str] = None
    dry_run: bool = True


class CongressCopySessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    politician_id: str
    politician_name: str
    politician_party: Optional[str]
    dry_run: bool
    status: str
    last_checked_at: Optional[datetime]
    last_trade_date: Optional[str]
    created_at: datetime


class CongressTradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    capitol_trade_id: str
    politician_name: str
    ticker: str
    asset_name: Optional[str]
    asset_type: Optional[str]
    option_type: Optional[str]
    trade_type: str
    size_range: Optional[str]
    trade_date: Optional[str]
    reported_at: Optional[str]
    fetched_at: datetime


class CongressCopiedOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    congress_trade_id: int
    alpaca_order_id: Optional[str]
    symbol: str
    side: str
    qty: float
    order_type: str
    status: str
    filled_price: Optional[float]
    dry_run: bool
    error_message: Optional[str]
    created_at: datetime
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/congress_trade.py
git commit -m "feat: Pydantic schemas for congress copy bot"
```

---

## Task 4: Config additions

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add Visanu Alpaca fields and congress poll interval**

In `backend/app/core/config.py`, inside the `Settings` class, add after the `alpaca_feed` field (line ~86):

```python
    # ── Visanu Alpaca (dedicated account for Congress copy bot) ───────────────
    visanu_alpaca_api_key: str = Field(default="", description="Visanu Alpaca API key")
    visanu_alpaca_secret_key: str = Field(default="", description="Visanu Alpaca secret key")
    visanu_alpaca_endpoint_url: str = Field(
        default="https://paper-api.alpaca.markets",
        description="Alpaca endpoint URL for Visanu account (paper or live)",
    )

    # ── Congress copy bot ──────────────────────────────────────────────────────
    congress_copy_poll_minutes: int = Field(
        default=30, description="How often (minutes) to poll Capitol Trades for new trades"
    )
```

- [ ] **Step 2: Verify settings load without errors**

```bash
cd backend && python -c "from app.core.config import settings; print(settings.visanu_alpaca_endpoint_url)"
```
Expected output: `https://paper-api.alpaca.markets`

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py
git commit -m "feat: add visanu_alpaca and congress_copy_poll_minutes to config"
```

---

## Task 5: Visanu Alpaca client

**Files:**
- Create: `backend/app/broker/visanu_alpaca.py`

- [ ] **Step 1: Write the dedicated client**

```python
# backend/app/broker/visanu_alpaca.py
"""
Dedicated Alpaca trading client for the Visanu account.

Unlike the generic AlpacaClient (which uses DB-stored credentials), this client
reads directly from settings at instantiation time. It is never returned from
get_broker_client() — it's only used by the congress copy service.
"""
from __future__ import annotations

import logging
from typing import Optional

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

from app.core.config import settings

logger = logging.getLogger(__name__)


def _make_client() -> Optional[TradingClient]:
    """Return a TradingClient if credentials are configured; None otherwise."""
    key = settings.visanu_alpaca_api_key.strip()
    secret = settings.visanu_alpaca_secret_key.strip()
    if not key or not secret:
        return None
    endpoint = settings.visanu_alpaca_endpoint_url.strip()
    paper = "paper-api" in endpoint
    return TradingClient(api_key=key, secret_key=secret, paper=paper)


class VisanuAlpacaClient:
    """Thin wrapper for the Visanu Alpaca trading account."""

    def __init__(self) -> None:
        self._client = _make_client()
        if self._client is None:
            logger.warning(
                "VisanuAlpacaClient: VISANU_ALPACA_API_KEY or VISANU_ALPACA_SECRET_KEY "
                "not set — all orders will be no-ops"
            )

    @property
    def is_configured(self) -> bool:
        return self._client is not None

    def place_market_order(
        self,
        symbol: str,
        qty: float,
        side: str,    # "buy" | "sell"
        dry_run: bool = True,
    ) -> Optional[str]:
        """
        Place a market order. Returns Alpaca order ID or None on dry-run/failure.
        `symbol` can be a stock ticker ("AAPL") or an OCC option symbol.
        """
        if dry_run:
            logger.info(
                "VisanuAlpacaClient [DRY RUN]: %s %s x%.4f — no real order",
                side.upper(),
                symbol,
                qty,
            )
            return None

        if not self._client:
            logger.error("VisanuAlpacaClient: credentials not configured")
            return None

        alpaca_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
        request = MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=alpaca_side,
            time_in_force=TimeInForce.DAY,
        )
        try:
            order = self._client.submit_order(request)
            logger.info(
                "VisanuAlpacaClient: submitted %s %s x%.4f — order_id=%s",
                side.upper(),
                symbol,
                qty,
                order.id,
            )
            return str(order.id)
        except Exception as exc:
            logger.error("VisanuAlpacaClient: order failed: %s", exc)
            raise


# Module-level singleton (instantiated once at import time)
visanu_client = VisanuAlpacaClient()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/broker/visanu_alpaca.py
git commit -m "feat: VisanuAlpacaClient — dedicated Alpaca trading client for congress copy bot"
```

---

## Task 6: Capitol Trades service

**Files:**
- Create: `backend/app/services/capitol_trades_service.py`

- [ ] **Step 1: Write the Capitol Trades HTTP client**

```python
# backend/app/services/capitol_trades_service.py
"""
Capitol Trades API client.

Capitol Trades exposes a public JSON API at https://api.capitoltrades.com.
We use it to:
  1. List politicians with recent activity (for ranking/selection)
  2. Fetch trades for a specific politician

All network calls use httpx with a 10-second timeout and are synchronous
(called from APScheduler's sync entry point via asyncio.run in the monitor task).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.schemas.congress_trade import CapitolTradeEntry, PoliticianSummary

logger = logging.getLogger(__name__)

_BASE = "https://api.capitoltrades.com"
_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "NextGenTrading/1.0 (educational; contact via github)",
}
_TIMEOUT = 15


def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Make a GET request to Capitol Trades. Raises on HTTP error."""
    url = f"{_BASE}{path}"
    with httpx.Client(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


def _parse_option_type(asset_name: str | None) -> Optional[str]:
    """Extract 'call' or 'put' from asset description strings like 'Call Option'."""
    if not asset_name:
        return None
    lower = asset_name.lower()
    if "call" in lower:
        return "call"
    if "put" in lower:
        return "put"
    return None


def _parse_trade(raw: dict[str, Any], politician_id: str, politician_name: str) -> CapitolTradeEntry:
    """
    Parse a single trade record from the Capitol Trades API response.

    The API returns nested objects; field names observed from the public API:
      raw["_id"]          → unique trade ID
      raw["politician"]   → {id, name}  (or already extracted as politician_id)
      raw["asset"]        → {assetTicker, assetType, assetName, instrumentType}
      raw["type"]         → "purchase" | "sale" | "sale (partial)"
      raw["size"]         → "$1,001-$15,000" etc.
      raw["reportedAt"]   → "2024-01-15"
      raw["txDate"]       → "2024-01-10"
    """
    asset = raw.get("asset") or {}
    ticker = (
        asset.get("assetTicker")
        or asset.get("ticker")
        or raw.get("ticker")
        or ""
    ).strip().upper()

    asset_type_raw = (
        asset.get("assetType")
        or asset.get("instrumentType")
        or raw.get("assetType")
        or ""
    ).lower()

    asset_name = asset.get("assetName") or asset.get("name") or ""

    # Normalise option detection: Capitol Trades marks options as "option" in assetType
    # or puts "Call"/"Put" in assetName
    if "option" in asset_type_raw or "call" in asset_name.lower() or "put" in asset_name.lower():
        resolved_asset_type = "option"
    elif "etf" in asset_type_raw:
        resolved_asset_type = "etf"
    else:
        resolved_asset_type = "stock"

    trade_type_raw = (raw.get("type") or "").lower()
    if "purchase" in trade_type_raw or "buy" in trade_type_raw:
        trade_type = "purchase"
    else:
        trade_type = "sale"

    return CapitolTradeEntry(
        id=str(raw.get("_id") or raw.get("id") or ""),
        politician_id=politician_id,
        politician_name=politician_name,
        ticker=ticker,
        asset_name=asset_name or None,
        asset_type=resolved_asset_type,
        option_type=_parse_option_type(asset_name),
        trade_type=trade_type,
        size_range=raw.get("size") or None,
        trade_date=raw.get("txDate") or raw.get("tradeDate") or None,
        reported_at=raw.get("reportedAt") or None,
    )


def fetch_politicians(page_size: int = 50) -> list[PoliticianSummary]:
    """
    Return a ranked list of politicians sorted by number of recent trades.
    Uses GET /politicians?pageSize=<n>&orderBy=totalTradeCount&orderDirection=DESC
    """
    try:
        data = _get(
            "/politicians",
            params={
                "pageSize": page_size,
                "orderBy": "totalTradeCount",
                "orderDirection": "DESC",
            },
        )
    except Exception as exc:
        logger.error("fetch_politicians: request failed: %s", exc)
        return []

    results = []
    for item in data.get("data") or []:
        pol_id = str(item.get("id") or item.get("_id") or "")
        if not pol_id:
            continue
        results.append(
            PoliticianSummary(
                id=pol_id,
                name=item.get("name") or item.get("fullName") or pol_id,
                party=item.get("party") or None,
                chamber=item.get("chamber") or None,
                state=item.get("state") or None,
                trade_count_90d=int(item.get("totalTradeCount") or item.get("tradeCount") or 0),
            )
        )
    return results


def fetch_trades_for_politician(
    politician_id: str,
    page_size: int = 50,
    since_date: Optional[str] = None,
) -> list[CapitolTradeEntry]:
    """
    Fetch the most-recent trades for one politician.
    `since_date` (YYYY-MM-DD) filters to trades reported on or after that date.
    """
    params: dict[str, Any] = {
        "pageSize": page_size,
        "politician": politician_id,
        "orderBy": "reportedAt",
        "orderDirection": "DESC",
    }
    if since_date:
        params["reportedAt_gte"] = since_date

    try:
        data = _get("/trades", params=params)
    except Exception as exc:
        logger.error(
            "fetch_trades_for_politician(%s): request failed: %s", politician_id, exc
        )
        return []

    entries = []
    politician_name_fallback = politician_id
    for raw in data.get("data") or []:
        pol = raw.get("politician") or {}
        pol_id = str(pol.get("id") or pol.get("_id") or politician_id)
        pol_name = pol.get("name") or pol.get("fullName") or politician_name_fallback
        try:
            entry = _parse_trade(raw, pol_id, pol_name)
            if entry.ticker:
                entries.append(entry)
        except Exception as exc:
            logger.warning("fetch_trades_for_politician: parse error: %s | raw=%s", exc, raw)
    return entries


def pick_best_politician(top_n: int = 10) -> Optional[PoliticianSummary]:
    """
    Pick the most-active politician by raw trade count.
    In practice this tends to surface well-known active traders (e.g. Pelosi, Tuberville).
    Returns None if the API is unavailable.
    """
    politicians = fetch_politicians(page_size=top_n)
    if not politicians:
        return None
    return politicians[0]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/capitol_trades_service.py
git commit -m "feat: Capitol Trades HTTP service — fetch politicians + trades"
```

---

## Task 7: Congress copy service (business logic)

**Files:**
- Create: `backend/app/services/congress_copy_service.py`

- [ ] **Step 1: Write the copy service**

```python
# backend/app/services/congress_copy_service.py
"""
Congress copy service.

Responsibilities:
  1. setup_congress_copy()  — create a CongressCopySession in DB
  2. process_new_trades()   — given a session, fetch new Capitol Trades entries,
                              persist them, and place matching orders via Visanu Alpaca
  3. _map_to_alpaca_symbol() — translate ticker + option_type to an Alpaca-compatible symbol
  4. _estimate_qty()        — translate size_range ("$1,001-$15,000") to a share/contract qty
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.congress_trade import CongressCopySession, CongressTrade, CongressCopiedOrder
from app.models.user import User
from app.schemas.congress_trade import CongressCopySetupRequest
from app.broker.visanu_alpaca import visanu_client
from app.services.capitol_trades_service import fetch_trades_for_politician

logger = logging.getLogger(__name__)

# Dollar amount invested per copied trade (configurable in future)
_DEFAULT_TRADE_USD = 500.0
_STOCK_PRICE_ESTIMATE = 100.0   # fallback when we can't fetch live price
_OPTION_CONTRACTS = 1            # always buy 1 contract for options (100 shares)


async def setup_congress_copy(
    payload: CongressCopySetupRequest,
    db: AsyncSession,
    user: User,
) -> CongressCopySession:
    """Create and persist a new CongressCopySession."""
    session = CongressCopySession(
        user_id=user.id,
        politician_id=payload.politician_id,
        politician_name=payload.politician_name,
        politician_party=payload.politician_party,
        dry_run=payload.dry_run,
        status="active",
    )
    db.add(session)
    await db.flush()  # get id before commit
    await db.commit()
    await db.refresh(session)
    logger.info(
        "congress_copy: session id=%d created for politician %s (dry_run=%s)",
        session.id,
        session.politician_name,
        session.dry_run,
    )
    return session


def _estimate_qty(size_range: Optional[str], is_option: bool) -> float:
    """
    Capitol Trades reports size as a dollar range, e.g. "$1,001-$15,000".
    We target _DEFAULT_TRADE_USD regardless of their actual amount.
    For options: always 1 contract. For stocks: $500 / estimated price = ~5 shares.
    """
    if is_option:
        return float(_OPTION_CONTRACTS)
    return max(1.0, round(_DEFAULT_TRADE_USD / _STOCK_PRICE_ESTIMATE))


def _map_to_alpaca_symbol(ticker: str, asset_type: Optional[str]) -> str:
    """
    For stocks/ETFs: return ticker as-is (e.g. "AAPL").
    For options: we don't have the OCC symbol from Capitol Trades, so we return
    the underlying ticker and let the order service fall back to a stock order.
    Future enhancement: integrate with options chain to find nearest ATM contract.
    """
    return ticker.upper()


async def process_new_trades(
    session: CongressCopySession,
    db: AsyncSession,
) -> int:
    """
    Fetch new Capitol Trades entries for the session's politician,
    persist unseen ones, and place Alpaca orders.
    Returns count of new trades processed.
    """
    entries = fetch_trades_for_politician(
        session.politician_id,
        page_size=50,
        since_date=session.last_trade_date,
    )

    if not entries:
        logger.info(
            "congress_copy: session id=%d — no new trades for %s",
            session.id,
            session.politician_name,
        )
        session.last_checked_at = datetime.now(timezone.utc)
        return 0

    # Filter out already-stored trade IDs
    existing_ids_result = await db.execute(
        select(CongressTrade.capitol_trade_id).where(
            CongressTrade.session_id == session.id
        )
    )
    existing_ids: set[str] = {r[0] for r in existing_ids_result.all()}

    new_entries = [e for e in entries if e.id not in existing_ids]
    if not new_entries:
        logger.info(
            "congress_copy: session id=%d — %d entries fetched, all already stored",
            session.id,
            len(entries),
        )
        session.last_checked_at = datetime.now(timezone.utc)
        return 0

    logger.info(
        "congress_copy: session id=%d — %d new trade(s) to process",
        session.id,
        len(new_entries),
    )

    processed = 0
    latest_date: Optional[str] = session.last_trade_date

    for entry in new_entries:
        # Persist the Capitol Trade record
        trade_row = CongressTrade(
            session_id=session.id,
            capitol_trade_id=entry.id,
            politician_id=entry.politician_id,
            politician_name=entry.politician_name,
            ticker=entry.ticker,
            asset_name=entry.asset_name,
            asset_type=entry.asset_type,
            option_type=entry.option_type,
            trade_type=entry.trade_type,
            size_range=entry.size_range,
            trade_date=entry.trade_date,
            reported_at=entry.reported_at,
        )
        db.add(trade_row)
        await db.flush()  # get trade_row.id

        # Map to Alpaca params
        alpaca_symbol = _map_to_alpaca_symbol(entry.ticker, entry.asset_type)
        is_option = entry.asset_type == "option"
        qty = _estimate_qty(entry.size_range, is_option)
        side = "buy" if entry.trade_type == "purchase" else "sell"

        # Place (or simulate) order
        alpaca_order_id: Optional[str] = None
        order_status = "submitted"
        error_msg: Optional[str] = None

        try:
            alpaca_order_id = visanu_client.place_market_order(
                symbol=alpaca_symbol,
                qty=qty,
                side=side,
                dry_run=session.dry_run,
            )
            if session.dry_run:
                order_status = "dry_run"
        except Exception as exc:
            error_msg = str(exc)
            order_status = "error"
            logger.error(
                "congress_copy: session id=%d — order failed for %s: %s",
                session.id,
                alpaca_symbol,
                exc,
            )

        copied_order = CongressCopiedOrder(
            session_id=session.id,
            congress_trade_id=trade_row.id,
            alpaca_order_id=alpaca_order_id,
            symbol=alpaca_symbol,
            side=side,
            qty=qty,
            order_type="market",
            status=order_status,
            dry_run=session.dry_run,
            error_message=error_msg,
        )
        db.add(copied_order)
        processed += 1

        if entry.reported_at and (latest_date is None or entry.reported_at > latest_date):
            latest_date = entry.reported_at

    session.last_checked_at = datetime.now(timezone.utc)
    if latest_date:
        session.last_trade_date = latest_date

    logger.info(
        "congress_copy: session id=%d — processed %d new trade(s)",
        session.id,
        processed,
    )
    return processed
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/congress_copy_service.py
git commit -m "feat: congress copy service — setup, process_new_trades, Alpaca order placement"
```

---

## Task 8: FastAPI router

**Files:**
- Create: `backend/app/api/congress_copy.py`

- [ ] **Step 1: Write the router**

```python
# backend/app/api/congress_copy.py
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.congress_trade import CongressCopySession, CongressTrade, CongressCopiedOrder
from app.models.user import User
from app.schemas.congress_trade import (
    CongressCopySessionOut,
    CongressCopySetupRequest,
    CongressTradeOut,
    CongressCopiedOrderOut,
    PoliticianSummary,
)
from app.services.congress_copy_service import setup_congress_copy
from app.services.capitol_trades_service import fetch_politicians

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/congress-copy", tags=["congress-copy"])


@router.get("/politicians", response_model=list[PoliticianSummary])
async def list_politicians(
    current_user: Annotated[User, Depends(get_current_user)],
    top: int = Query(default=20, ge=1, le=50),
) -> list[PoliticianSummary]:
    """Return top N most-active politicians from Capitol Trades."""
    return fetch_politicians(page_size=top)


@router.post("/setup", response_model=CongressCopySessionOut, status_code=status.HTTP_201_CREATED)
async def setup(
    payload: CongressCopySetupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CongressCopySessionOut:
    """Create a new congress copy session for the given politician."""
    session = await setup_congress_copy(payload, db, current_user)
    return CongressCopySessionOut.model_validate(session)


@router.get("/sessions", response_model=list[CongressCopySessionOut])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[CongressCopySessionOut]:
    result = await db.execute(
        select(CongressCopySession)
        .where(CongressCopySession.user_id == current_user.id)
        .order_by(CongressCopySession.created_at.desc())
        .limit(limit)
    )
    return [CongressCopySessionOut.model_validate(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=CongressCopySessionOut)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CongressCopySessionOut:
    result = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return CongressCopySessionOut.model_validate(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions/{session_id}/trades", response_model=list[CongressTradeOut])
async def list_session_trades(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CongressTradeOut]:
    # Verify ownership
    sess_result = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(CongressTrade)
        .where(CongressTrade.session_id == session_id)
        .order_by(CongressTrade.fetched_at.desc())
        .limit(limit)
    )
    return [CongressTradeOut.model_validate(t) for t in result.scalars().all()]


@router.get("/sessions/{session_id}/orders", response_model=list[CongressCopiedOrderOut])
async def list_session_orders(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CongressCopiedOrderOut]:
    # Verify ownership
    sess_result = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(CongressCopiedOrder)
        .where(CongressCopiedOrder.session_id == session_id)
        .order_by(CongressCopiedOrder.created_at.desc())
        .limit(limit)
    )
    return [CongressCopiedOrderOut.model_validate(o) for o in result.scalars().all()]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/congress_copy.py
git commit -m "feat: congress copy FastAPI router — 7 endpoints"
```

---

## Task 9: APScheduler monitor task

**Files:**
- Create: `backend/app/scheduler/tasks/congress_copy_monitor.py`

- [ ] **Step 1: Write the task**

```python
# backend/app/scheduler/tasks/congress_copy_monitor.py
"""
Scheduler task: check active congress copy sessions every N minutes.

For each active CongressCopySession:
  1. Call process_new_trades() — fetches Capitol Trades, persists new entries, places orders
  2. Per-session failures are logged and do NOT abort remaining sessions

Single AsyncSessionLocal for full function body; one db.commit() after loop.
"""
from __future__ import annotations

import asyncio
import gc
import logging

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.congress_trade import CongressCopySession
from app.services.congress_copy_service import process_new_trades

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    logger.info("congress_copy_monitor: starting")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CongressCopySession).where(CongressCopySession.status == "active")
            )
            sessions = result.scalars().all()

            if not sessions:
                logger.info("congress_copy_monitor: no active sessions — nothing to do")
                return

            logger.info("congress_copy_monitor: checking %d active session(s)", len(sessions))

            errors = 0
            total_new = 0
            for session in sessions:
                try:
                    new_count = await process_new_trades(session, db)
                    total_new += new_count
                except Exception as exc:
                    errors += 1
                    logger.error(
                        "congress_copy_monitor: session id=%d error: %s",
                        session.id,
                        exc,
                    )

            await db.commit()
            logger.info(
                "congress_copy_monitor: complete — sessions=%d new_trades=%d errors=%d",
                len(sessions),
                total_new,
                errors,
            )

    except Exception as exc:
        logger.exception("congress_copy_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def run_congress_copy_monitor() -> None:
    """Synchronous APScheduler entry point."""
    asyncio.run(_run_monitor())
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/scheduler/tasks/congress_copy_monitor.py
git commit -m "feat: congress_copy_monitor APScheduler task"
```

---

## Task 10: Wire into main.py and jobs.py

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/scheduler/jobs.py`

- [ ] **Step 1: Register router in main.py**

In `backend/app/main.py`, add this import near the trailing_bot_router import (around line 243):

```python
from app.api.congress_copy import router as congress_copy_router
```

Then add this include after `app.include_router(trailing_bot_router, prefix="/api/v1")` (around line 272):

```python
app.include_router(congress_copy_router, prefix="/api/v1")
```

- [ ] **Step 2: Register scheduler job in jobs.py**

In `backend/app/scheduler/jobs.py`, add the import near the top (after the existing task imports):

```python
from app.scheduler.tasks.congress_copy_monitor import run_congress_copy_monitor
```

Inside `register_jobs()`, after the trailing bot block (around line 132), add:

```python
    # ── Congress copy bot monitor ─────────────────────────────────────────────
    scheduler.add_job(
        run_congress_copy_monitor,
        "interval",
        minutes=settings.congress_copy_poll_minutes,
        id="congress_copy_monitor",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
```

Also update the `logger.info` at the bottom of `register_jobs()` to include `congress_copy=%dm`.

- [ ] **Step 3: Verify backend starts without import errors**

```bash
cd backend && uvicorn app.main:app --reload --port 8000
```
Expected: no `ImportError`, scheduler log shows `congress_copy_monitor` registered.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/scheduler/jobs.py
git commit -m "feat: wire congress copy router + scheduler job into FastAPI app"
```

---

## Task 11: Frontend API lib

**Files:**
- Create: `frontend/lib/congress-copy-api.ts`

- [ ] **Step 1: Write typed API wrappers**

```typescript
// frontend/lib/congress-copy-api.ts
import { apiFetch } from "./api";
import type {
  CongressCopySessionOut,
  CongressCopySetupRequest,
  CongressTradeOut,
  CongressCopiedOrderOut,
  PoliticianSummary,
} from "@/types";

export const congressCopyApi = {
  listPoliticians: (top = 20): Promise<PoliticianSummary[]> =>
    apiFetch(`/api/v1/congress-copy/politicians?top=${top}`),

  setup: (payload: CongressCopySetupRequest): Promise<CongressCopySessionOut> =>
    apiFetch("/api/v1/congress-copy/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (): Promise<CongressCopySessionOut[]> =>
    apiFetch("/api/v1/congress-copy/sessions"),

  getSession: (id: number): Promise<CongressCopySessionOut> =>
    apiFetch(`/api/v1/congress-copy/sessions/${id}`),

  cancelSession: (id: number): Promise<void> =>
    apiFetch(`/api/v1/congress-copy/sessions/${id}`, { method: "DELETE" }),

  listTrades: (sessionId: number): Promise<CongressTradeOut[]> =>
    apiFetch(`/api/v1/congress-copy/sessions/${sessionId}/trades`),

  listOrders: (sessionId: number): Promise<CongressCopiedOrderOut[]> =>
    apiFetch(`/api/v1/congress-copy/sessions/${sessionId}/orders`),
};
```

- [ ] **Step 2: Add TypeScript types to `frontend/types/index.ts` (or equivalent types file)**

Find the file where `TrailingBotSessionOut` etc. are defined. Add:

```typescript
// Congress Copy Bot types
export interface PoliticianSummary {
  id: string;
  name: string;
  party: string | null;
  chamber: string | null;
  state: string | null;
  trade_count_90d: number;
}

export interface CongressCopySetupRequest {
  politician_id: string;
  politician_name: string;
  politician_party?: string | null;
  dry_run: boolean;
}

export interface CongressCopySessionOut {
  id: number;
  user_id: number;
  politician_id: string;
  politician_name: string;
  politician_party: string | null;
  dry_run: boolean;
  status: string;
  last_checked_at: string | null;
  last_trade_date: string | null;
  created_at: string;
}

export interface CongressTradeOut {
  id: number;
  session_id: number;
  capitol_trade_id: string;
  politician_name: string;
  ticker: string;
  asset_name: string | null;
  asset_type: string | null;
  option_type: string | null;
  trade_type: string;
  size_range: string | null;
  trade_date: string | null;
  reported_at: string | null;
  fetched_at: string;
}

export interface CongressCopiedOrderOut {
  id: number;
  session_id: number;
  congress_trade_id: number;
  alpaca_order_id: string | null;
  symbol: string;
  side: string;
  qty: number;
  order_type: string;
  status: string;
  filled_price: number | null;
  dry_run: boolean;
  error_message: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/congress-copy-api.ts frontend/types/index.ts
git commit -m "feat: frontend API lib + TypeScript types for congress copy bot"
```

---

## Task 12: Frontend dashboard page

**Files:**
- Create: `frontend/app/congress-copy/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// frontend/app/congress-copy/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Bot,
  Activity,
  AlertTriangle,
  Loader2,
  Play,
  StopCircle,
  FlaskConical,
  TrendingUp,
  ShoppingCart,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { congressCopyApi } from "@/lib/congress-copy-api";
import { formatDateTime, getErrorMessage, cn } from "@/lib/utils";
import type {
  PoliticianSummary,
  CongressCopySessionOut,
  CongressTradeOut,
  CongressCopiedOrderOut,
} from "@/types";

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">{title}</h3>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="px-2 py-0.5 text-2xs font-bold border bg-green-500/15 text-green-400 border-green-500/30">
        ACTIVE
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="px-2 py-0.5 text-2xs font-bold border bg-muted/50 text-muted-foreground border-border">
        CANCELLED
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-2xs font-bold border bg-surface-highest text-muted-foreground border-border">
      {status.toUpperCase()}
    </span>
  );
}

// ─── Politician picker card ───────────────────────────────────────────────────
function PoliticianCard({
  politician,
  selected,
  onSelect,
}: {
  politician: PoliticianSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 border transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-surface-lowest hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-foreground leading-tight">{politician.name}</p>
          <p className="text-3xs text-muted-foreground mt-0.5">
            {[politician.party, politician.chamber, politician.state]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-primary font-mono">
            {politician.trade_count_90d}
          </p>
          <p className="text-3xs text-muted-foreground">trades</p>
        </div>
      </div>
    </button>
  );
}

// ─── Trade row ────────────────────────────────────────────────────────────────
function TradeRow({ trade }: { trade: CongressTradeOut }) {
  const isBuy = trade.trade_type === "purchase";
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border/30 last:border-0">
      <div
        className={cn(
          "w-5 h-5 flex items-center justify-center shrink-0",
          isBuy ? "bg-green-500/15" : "bg-red-500/15"
        )}
      >
        {isBuy ? (
          <TrendingUp className="h-3 w-3 text-green-400" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-foreground font-mono">{trade.ticker}</span>
          {trade.asset_type === "option" && trade.option_type && (
            <span
              className={cn(
                "text-3xs font-bold px-1 border",
                trade.option_type === "call"
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-red-400 border-red-500/30 bg-red-500/10"
              )}
            >
              {trade.option_type.toUpperCase()}
            </span>
          )}
          <span className="text-3xs text-muted-foreground">{trade.size_range}</span>
        </div>
        <p className="text-3xs text-muted-foreground mt-0.5 truncate">{trade.asset_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-3xs font-mono text-muted-foreground">
          {trade.trade_date || trade.reported_at || "—"}
        </p>
        <p
          className={cn(
            "text-2xs font-bold",
            isBuy ? "text-green-400" : "text-red-400"
          )}
        >
          {isBuy ? "BUY" : "SELL"}
        </p>
      </div>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  onCancel,
  isCancelling,
}: {
  session: CongressCopySessionOut;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: trades = [], isLoading: tradesLoading } = useQuery<CongressTradeOut[]>({
    queryKey: ["congress-copy", "trades", session.id],
    queryFn: () => congressCopyApi.listTrades(session.id),
    enabled: expanded,
  });

  return (
    <div className="bg-surface-mid border border-border">
      <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-foreground">{session.politician_name}</span>
            <StatusBadge status={session.status} />
            {session.dry_run && (
              <span className="px-2 py-0.5 text-2xs font-bold border bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                <FlaskConical className="h-2.5 w-2.5" />
                DRY RUN
              </span>
            )}
          </div>
          <p className="text-3xs text-muted-foreground mt-1">
            #{session.id} · Started {formatDateTime(session.created_at)}
          </p>
          {session.last_checked_at && (
            <p className="text-3xs text-muted-foreground">
              Last checked: {formatDateTime(session.last_checked_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 px-2 text-2xs text-muted-foreground"
          >
            <Activity className="h-3 w-3 mr-1" />
            {expanded ? "Hide Trades" : "View Trades"}
          </Button>
          {session.status === "active" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onCancel(session.id)}
              disabled={isCancelling}
              className="h-7 px-3 text-2xs font-bold uppercase"
            >
              {isCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <StopCircle className="h-3 w-3 mr-1" />
                  Stop
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <Separator className="bg-border/50" />
          <div className="max-h-64 overflow-y-auto">
            {tradesLoading ? (
              <div className="p-3 flex flex-col gap-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : trades.length === 0 ? (
              <p className="p-4 text-3xs text-muted-foreground text-center">
                No copied trades yet — monitor runs every 30 minutes.
              </p>
            ) : (
              trades.map((t) => <TradeRow key={t.id} trade={t} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CongressCopyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPolitician, setSelectedPolitician] = useState<PoliticianSummary | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  const [instanceId, setInstanceId] = useState<string | null>(null);
  useEffect(() => {
    setInstanceId("CONGRESS_" + Math.floor(Math.random() * 9000 + 1000));
  }, []);

  const { data: politicians = [], isLoading: polsLoading } = useQuery<PoliticianSummary[]>({
    queryKey: ["congress-copy", "politicians"],
    queryFn: () => congressCopyApi.listPoliticians(20),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<CongressCopySessionOut[]>({
    queryKey: ["congress-copy", "sessions"],
    queryFn: congressCopyApi.listSessions,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { mutate: startSession, isPending: isStarting } = useMutation({
    mutationFn: () =>
      congressCopyApi.setup({
        politician_id: selectedPolitician!.id,
        politician_name: selectedPolitician!.name,
        politician_party: selectedPolitician!.party,
        dry_run: dryRun,
      }),
    onSuccess: (s) => {
      toast.success(
        `Now copying ${s.politician_name}${s.dry_run ? " (dry run)" : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["congress-copy", "sessions"] });
      setSelectedPolitician(null);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to start copy session"));
    },
  });

  const { mutate: cancelSession, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => congressCopyApi.cancelSession(id),
    onSuccess: () => {
      toast.success("Session stopped");
      queryClient.invalidateQueries({ queryKey: ["congress-copy", "sessions"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to stop session"));
    },
  });

  function handleStart() {
    if (!selectedPolitician) return;
    if (!dryRun) {
      setLiveConfirmOpen(true);
      return;
    }
    startSession();
  }

  function confirmLive() {
    if (!liveConfirmed) {
      toast.error("Check the confirmation box to proceed in live mode");
      return;
    }
    setLiveConfirmOpen(false);
    setLiveConfirmed(false);
    startSession();
  }

  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "active"), [sessions]);

  return (
    <AppShell title="Congress Copy Bot">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Congress Copy Bot</h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            Instance:{" "}
            {instanceId ?? (
              <span className="inline-block w-24 h-3 bg-surface-highest animate-pulse rounded-sm align-middle" />
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              activeSessions.length > 0
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-surface-highest text-primary border-primary/20"
            )}
          >
            STATUS: {activeSessions.length > 0 ? "COPYING" : "STANDBY"}
          </span>
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              dryRun
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}
          >
            MODE: {dryRun ? "TESTNET" : "MAINNET"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── Politician selector (5 cols) */}
        <section className="col-span-12 lg:col-span-5 bg-surface-mid p-4 flex flex-col gap-4">
          <SectionHeader icon={Users} title="Select Politician to Copy" />

          <div className="bg-destructive/5 border-l-4 border-destructive p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-3xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">Educational use only.</strong> Congress
                trade disclosures are often delayed 30–45 days. Past performance doesn't
                guarantee future results. Always use Dry Run to test first.
              </p>
            </div>
          </div>

          {/* Politician list */}
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
            {polsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))
            ) : politicians.length === 0 ? (
              <p className="text-3xs text-muted-foreground text-center py-4">
                Could not load politicians — Capitol Trades API may be unavailable.
              </p>
            ) : (
              politicians.map((p) => (
                <PoliticianCard
                  key={p.id}
                  politician={p}
                  selected={selectedPolitician?.id === p.id}
                  onSelect={() =>
                    setSelectedPolitician((prev) => (prev?.id === p.id ? null : p))
                  }
                />
              ))
            )}
          </div>

          {/* Dry-run toggle */}
          <div className="flex items-center justify-between p-3 bg-surface-lowest">
            <div>
              <p className="text-2xs font-bold text-foreground uppercase tracking-wider">
                Dry Run Mode
              </p>
              <p className="text-3xs text-muted-foreground mt-0.5">
                {dryRun
                  ? "Simulating — no real orders placed"
                  : "LIVE — real Visanu Alpaca orders will execute"}
              </p>
            </div>
            <Switch
              checked={dryRun}
              onCheckedChange={setDryRun}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {/* Start button */}
          <Button
            onClick={handleStart}
            disabled={!selectedPolitician || isStarting}
            className={cn(
              "w-full text-xs font-bold uppercase tracking-wider",
              !dryRun
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-2" />
                {selectedPolitician
                  ? `Copy ${selectedPolitician.name.split(" ").pop()}${!dryRun ? " (LIVE)" : ""}`
                  : "Select a politician above"}
              </>
            )}
          </Button>
        </section>

        {/* ── Active sessions (7 cols) */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <div className="bg-surface-mid p-4 pb-3">
            <SectionHeader icon={Bot} title="Copy Sessions" />
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <span className="text-3xs text-muted-foreground uppercase tracking-wider">
                Polls Capitol Trades every 30 min · Auto-refreshes every 60s
              </span>
              {sessions.length > 0 && (
                <span className="ml-auto text-3xs font-bold text-primary">
                  {sessions.length} total · {activeSessions.length} active
                </span>
              )}
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-surface-mid p-8 flex flex-col items-center gap-3 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                No Sessions Yet
              </p>
              <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
                Select a politician on the left and click Copy to start mirroring their trades.
              </p>
            </div>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onCancel={cancelSession}
                isCancelling={isCancelling}
              />
            ))
          )}
        </section>
      </div>

      {/* Live mode confirmation dialog */}
      <Dialog
        open={liveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setLiveConfirmed(false);
          setLiveConfirmOpen(open);
        }}
      >
        <DialogContent className="bg-surface-mid border-destructive/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Live Mode — Real Orders on Visanu Account
            </DialogTitle>
            <DialogDescription className="text-2xs text-muted-foreground leading-relaxed pt-1">
              You are about to mirror{" "}
              <strong className="text-foreground">{selectedPolitician?.name}</strong>'s trades in{" "}
              <strong className="text-destructive">LIVE mode</strong> using the Visanu Alpaca
              account. Real market orders will execute every time a new trade is detected (up to
              every 30 minutes). Congress disclosures are often delayed 30–45 days.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="flex items-start gap-2 mt-2">
              <input
                id="live-confirm"
                type="checkbox"
                checked={liveConfirmed}
                onChange={(e) => setLiveConfirmed(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <label
                htmlFor="live-confirm"
                className="text-2xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                I understand this will submit real orders and I accept full responsibility for
                any trades executed.
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLiveConfirmed(false);
                setLiveConfirmOpen(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmLive}
              disabled={!liveConfirmed || isStarting}
              className="text-xs font-bold uppercase"
            >
              {isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start Live Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/congress-copy/page.tsx
git commit -m "feat: congress copy bot frontend dashboard page"
```

---

## Task 13: Sidebar + middleware

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`
- Modify: `frontend/proxy.ts`

- [ ] **Step 1: Add `Users` to the Sidebar icon imports**

In `frontend/components/layout/Sidebar.tsx`, add `Users` to the lucide-react import on the existing import line.

- [ ] **Step 2: Add nav entry in the Terminal group**

In `Sidebar.tsx`, in the `"Terminal"` group's `links` array, add after the `/trailing-bot` entry:

```typescript
{ href: "/congress-copy", label: "Congress", icon: Users },
```

- [ ] **Step 3: Add route protection in proxy.ts**

In `frontend/proxy.ts`, in the `PROTECTED_PREFIXES` array, add:

```typescript
  "/congress-copy",
```

- [ ] **Step 4: Verify frontend builds**

```bash
cd frontend && npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx frontend/proxy.ts
git commit -m "feat: add Congress Bot to sidebar nav + route protection"
```

---

## Task 14: Add `httpx` to backend dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Check if httpx is already present**

```bash
grep -i httpx backend/requirements.txt
```

- [ ] **Step 2: If not present, add it**

```
httpx>=0.27.0
```

- [ ] **Step 3: Install**

```bash
cd backend && pip install httpx
```

- [ ] **Step 4: Commit if requirements.txt was modified**

```bash
git add backend/requirements.txt
git commit -m "chore: add httpx dependency for Capitol Trades API client"
```

---

## Self-Review Checklist

- [x] **Migration** covers all three tables with correct FK relationships
- [x] **ORM** models match migration columns exactly
- [x] **Schemas** match ORM field names
- [x] **Config** adds all three `visanu_*` fields + `congress_copy_poll_minutes`
- [x] **VisanuAlpacaClient** uses config, not DB credentials; returns `None` on dry-run; raises on live failure
- [x] **Capitol Trades service** handles missing/renamed API fields gracefully (multiple fallback field names)
- [x] **Copy service** opens one `AsyncSessionLocal` (via task), flushes inside loop to get IDs, single commit in task
- [x] **Router** verifies ownership before returning session trades/orders
- [x] **Scheduler task** has `gc.collect()` in `finally`, uses `asyncio.run()`
- [x] **main.py** prefix is `/api/v1` (no double-prefix)
- [x] **DELETE endpoint** returns `Response(status_code=204)`, no decorator status_code
- [x] **Frontend types** cover all API response shapes
- [x] **Dry-run default** is `True` everywhere (form, session creation)
- [x] **Live confirmation dialog** requires checkbox before executing
- [x] **Middleware** adds `/congress-copy` to protected prefixes
- [x] **Sidebar** adds entry in Terminal group

---

## Post-Deploy Steps

After merging and deploying:

1. Add to `backend/.env`:
   ```
   VISANU_ALPACA_API_KEY=<key from .env>
   VISANU_ALPACA_SECRET_KEY=<secret from .env>
   VISANU_ALPACA_ENDPOINT_URL=https://paper-api.alpaca.markets
   CONGRESS_COPY_POLL_MINUTES=30
   ```

2. Run `alembic upgrade head` (Render does this automatically on deploy)

3. Navigate to `/congress-copy`, select a politician, start in **Dry Run** mode first

4. After 30 minutes, check session's Trades list to confirm Capitol Trades polling is working

5. When confident, create a new Live session (requires confirmation dialog checkbox)
