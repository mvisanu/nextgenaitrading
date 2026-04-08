# Politician Copy-Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-user politician copy-trading web feature (V6) that mirrors congressional stock disclosures (via Quiver Quantitative) onto each user's Alpaca account, with a scheduler-driven backend and a Next.js frontend page.

**Architecture:** Layered service architecture following the trailing-bot (V5) pattern. A shared APScheduler task polls Quiver Quant every 15 min and processes all active sessions in a single DB session. The standalone `politician-copy-trading/` CLI bot is left untouched.

**Tech Stack:** FastAPI · SQLAlchemy async · Alembic · Pydantic v2 · alpaca-py · Next.js 14 App Router · TanStack Query · shadcn/ui · requests (sync HTTP wrapped in asyncio.to_thread)

---

## File Map

**Create:**
- `backend/app/models/copy_trading.py` — `CopyTradingSession` + `CopiedPoliticianTrade` ORM models
- `backend/app/schemas/copy_trading.py` — Pydantic DTOs
- `backend/app/services/politician_scraper_service.py` — Quiver Quant HTTP + caching + trade parsing
- `backend/app/services/politician_ranker_service.py` — ranking algorithm
- `backend/app/services/copy_trading_service.py` — session CRUD + trade execution
- `backend/app/api/copy_trading.py` — FastAPI router
- `backend/app/scheduler/tasks/copy_trading_monitor.py` — APScheduler task
- `backend/alembic/versions/v6_copy_trading.py` — migration
- `backend/tests/v6/__init__.py`
- `backend/tests/v6/test_politician_scraper_service.py`
- `backend/tests/v6/test_politician_ranker_service.py`
- `backend/tests/v6/test_copy_trading_service.py`
- `frontend/lib/copy-trading-api.ts` — typed fetch wrappers
- `frontend/app/copy-trading/page.tsx` — page

**Modify:**
- `backend/app/scheduler/jobs.py` — register `monitor_copy_trading` job every 15 min
- `backend/app/main.py` — import + include copy_trading router
- `frontend/types/index.ts` — add copy-trading TypeScript interfaces
- `frontend/components/layout/Sidebar.tsx` — add nav link
- `frontend/proxy.ts` — add `/copy-trading` to PROTECTED_PREFIXES

---

## Task 1: Alembic Migration v6

**Files:**
- Create: `backend/alembic/versions/v6_copy_trading.py`

- [ ] **Step 1: Create migration file**

```python
# backend/alembic/versions/v6_copy_trading.py
"""v6 copy_trading tables

Revision ID: v6_copy_trading
Revises: v5_trailing_bot
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v6_copy_trading"
down_revision = "v5_trailing_bot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "copy_trading_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("copy_amount_usd", sa.Float, nullable=False, server_default="300"),
        sa.Column("target_politician_id", sa.String(100), nullable=True),
        sa.Column("target_politician_name", sa.String(200), nullable=True),
        sa.Column(
            "activated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_copy_trading_sessions_user_id",
        "copy_trading_sessions",
        ["user_id"],
        if_not_exists=True,
    )

    op.create_table(
        "copied_politician_trades",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("copy_trading_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("trade_id", sa.String(300), nullable=False),
        sa.Column("politician_id", sa.String(100), nullable=False),
        sa.Column("politician_name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("trade_type", sa.String(10), nullable=False),
        sa.Column("trade_date", sa.Date, nullable=True),
        sa.Column("disclosure_date", sa.Date, nullable=True),
        sa.Column("amount_low", sa.Float, nullable=True),
        sa.Column("amount_high", sa.Float, nullable=True),
        sa.Column("alpaca_order_id", sa.String(100), nullable=True),
        sa.Column("alpaca_status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("copy_amount_usd", sa.Float, nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_copied_politician_trades_user_id",
        "copied_politician_trades",
        ["user_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_copied_politician_trades_session_id",
        "copied_politician_trades",
        ["session_id"],
        if_not_exists=True,
    )
    op.create_unique_constraint(
        "uq_user_trade",
        "copied_politician_trades",
        ["user_id", "trade_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_copied_politician_trades_session_id", table_name="copied_politician_trades", if_exists=True)
    op.drop_index("ix_copied_politician_trades_user_id", table_name="copied_politician_trades", if_exists=True)
    op.drop_table("copied_politician_trades")
    op.drop_index("ix_copy_trading_sessions_user_id", table_name="copy_trading_sessions", if_exists=True)
    op.drop_table("copy_trading_sessions")
```

- [ ] **Step 2: Apply migration**

```bash
cd backend && source .venv/Scripts/activate
alembic upgrade head
```
Expected output ends with: `Running upgrade v5_trailing_bot -> v6_copy_trading`

- [ ] **Step 3: Verify tables exist**

```bash
python -c "
import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT table_name FROM information_schema.tables WHERE table_name IN ('copy_trading_sessions','copied_politician_trades')\"))
        print([row[0] for row in r])

asyncio.run(check())
"
```
Expected: `['copy_trading_sessions', 'copied_politician_trades']` (order may vary)

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/v6_copy_trading.py
git commit -m "feat: v6 alembic migration — copy_trading_sessions + copied_politician_trades"
```

---

## Task 2: ORM Models

**Files:**
- Create: `backend/app/models/copy_trading.py`

- [ ] **Step 1: Write models**

```python
# backend/app/models/copy_trading.py
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CopyTradingSession(Base):
    __tablename__ = "copy_trading_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    copy_amount_usd: Mapped[float] = mapped_column(Float, default=300.0, nullable=False)
    target_politician_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    target_politician_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CopiedPoliticianTrade(Base):
    __tablename__ = "copied_politician_trades"
    __table_args__ = (
        UniqueConstraint("user_id", "trade_id", name="uq_user_trade"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("copy_trading_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trade_id: Mapped[str] = mapped_column(String(300), nullable=False)
    politician_id: Mapped[str] = mapped_column(String(100), nullable=False)
    politician_name: Mapped[str] = mapped_column(String(200), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    trade_type: Mapped[str] = mapped_column(String(10), nullable=False)
    trade_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    disclosure_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount_low: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount_high: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    alpaca_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    alpaca_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    copy_amount_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

- [ ] **Step 2: Verify models import cleanly**

```bash
cd backend && python -c "from app.models.copy_trading import CopyTradingSession, CopiedPoliticianTrade; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/copy_trading.py
git commit -m "feat: copy trading ORM models (CopyTradingSession + CopiedPoliticianTrade)"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/copy_trading.py`

- [ ] **Step 1: Write schemas**

```python
# backend/app/schemas/copy_trading.py
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    copy_amount_usd: float = Field(default=300.0, gt=0, description="USD per copied trade")
    dry_run: bool = True
    target_politician_id: Optional[str] = Field(
        default=None,
        description="BioGuideID to pin; null = auto-rank",
    )


class CopyTradingSessionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    status: str
    dry_run: bool
    copy_amount_usd: float
    target_politician_id: Optional[str]
    target_politician_name: Optional[str]
    activated_at: str
    cancelled_at: Optional[str]

    @classmethod
    def from_orm(cls, s: object) -> "CopyTradingSessionOut":
        return cls(
            id=s.id,
            status=s.status,
            dry_run=s.dry_run,
            copy_amount_usd=s.copy_amount_usd,
            target_politician_id=s.target_politician_id,
            target_politician_name=s.target_politician_name,
            activated_at=s.activated_at.isoformat() if s.activated_at else "",
            cancelled_at=s.cancelled_at.isoformat() if s.cancelled_at else None,
        )


class CopiedTradeOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    session_id: int
    trade_id: str
    politician_id: str
    politician_name: str
    ticker: str
    asset_type: str
    trade_type: str
    trade_date: Optional[str]
    disclosure_date: Optional[str]
    amount_low: Optional[float]
    amount_high: Optional[float]
    alpaca_order_id: Optional[str]
    alpaca_status: str
    copy_amount_usd: Optional[float]
    dry_run: bool
    created_at: str
    notes: Optional[str]

    @classmethod
    def from_orm(cls, t: object) -> "CopiedTradeOut":
        return cls(
            id=t.id,
            session_id=t.session_id,
            trade_id=t.trade_id,
            politician_id=t.politician_id,
            politician_name=t.politician_name,
            ticker=t.ticker,
            asset_type=t.asset_type,
            trade_type=t.trade_type,
            trade_date=t.trade_date.isoformat() if t.trade_date else None,
            disclosure_date=t.disclosure_date.isoformat() if t.disclosure_date else None,
            amount_low=t.amount_low,
            amount_high=t.amount_high,
            alpaca_order_id=t.alpaca_order_id,
            alpaca_status=t.alpaca_status,
            copy_amount_usd=t.copy_amount_usd,
            dry_run=t.dry_run,
            created_at=t.created_at.isoformat() if t.created_at else "",
            notes=t.notes,
        )


class PoliticianRankingOut(BaseModel):
    politician_id: str
    politician_name: str
    total_trades: int
    buy_trades: int
    win_rate: float
    avg_excess_return: float
    recent_trade_count: int
    score: float
    best_trades: list[str]
```

- [ ] **Step 2: Verify schemas import cleanly**

```bash
cd backend && python -c "from app.schemas.copy_trading import CreateSessionRequest, CopyTradingSessionOut, CopiedTradeOut, PoliticianRankingOut; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/copy_trading.py
git commit -m "feat: copy trading Pydantic schemas"
```

---

## Task 4: Politician Scraper Service

**Files:**
- Create: `backend/app/services/politician_scraper_service.py`
- Create: `backend/tests/v6/__init__.py`
- Create: `backend/tests/v6/test_politician_scraper_service.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/v6/__init__.py
# (empty)
```

```python
# backend/tests/v6/test_politician_scraper_service.py
"""
Tests for politician_scraper_service.py — Quiver Quant trade parsing + caching.
"""
from __future__ import annotations
import time
from unittest.mock import MagicMock, patch, AsyncMock
import pytest

from app.services.politician_scraper_service import (
    PoliticianTrade,
    _parse_quiver_record,
    _build_trade_id,
    get_politician_trades,
)


def _make_quiver_record(**overrides) -> dict:
    base = {
        "Representative": "Jonathan Jackson",
        "BioGuideID": "J000309",
        "Ticker": "AAPL",
        "TickerType": "Stock",
        "Transaction": "Purchase",
        "TransactionDate": "2026-03-01",
        "ReportDate": "2026-03-15",
        "Range": "$15,001 - $50,000",
        "Amount": "0",
        "Description": "",
        "ExcessReturn": 5.2,
        "PriceChange": 8.1,
    }
    base.update(overrides)
    return base


def test_parse_quiver_record_buy():
    rec = _make_quiver_record()
    trade = _parse_quiver_record(rec)
    assert trade is not None
    assert trade.ticker == "AAPL"
    assert trade.trade_type == "buy"
    assert trade.asset_type == "stock"
    assert trade.politician_id == "J000309"
    assert trade.politician_name == "Jonathan Jackson"
    assert trade.amount_low == 15001.0
    assert trade.amount_high == 50000.0
    assert trade.excess_return == 5.2


def test_parse_quiver_record_sell():
    rec = _make_quiver_record(Transaction="Sale (Full)")
    trade = _parse_quiver_record(rec)
    assert trade is not None
    assert trade.trade_type == "sell"


def test_parse_quiver_record_option():
    rec = _make_quiver_record(TickerType="Option", Description="AAPL call strike $180 expiry 2026-06-20")
    trade = _parse_quiver_record(rec)
    assert trade is not None
    assert trade.asset_type == "option"
    assert trade.option_type == "call"
    assert trade.option_strike == 180.0


def test_parse_quiver_record_skips_empty_ticker():
    rec = _make_quiver_record(Ticker="")
    trade = _parse_quiver_record(rec)
    assert trade is None


def test_parse_quiver_record_skips_na_ticker():
    rec = _make_quiver_record(Ticker="N/A")
    trade = _parse_quiver_record(rec)
    assert trade is None


def test_build_trade_id_is_stable():
    rec = _make_quiver_record()
    id1 = _build_trade_id(rec)
    id2 = _build_trade_id(rec)
    assert id1 == id2
    assert "J000309" in id1
    assert "AAPL" in id1


def test_get_politician_trades_filters_by_id():
    trades = [
        PoliticianTrade(
            trade_id="J000309_AAPL_2026-03-01_buy",
            politician_id="J000309",
            politician_name="Jonathan Jackson",
            ticker="AAPL",
            asset_type="stock",
            trade_type="buy",
            trade_date=None,
            disclosure_date=None,
            amount_low=15001.0,
            amount_high=50000.0,
        ),
        PoliticianTrade(
            trade_id="P000197_MSFT_2026-03-02_buy",
            politician_id="P000197",
            politician_name="Nancy Pelosi",
            ticker="MSFT",
            asset_type="stock",
            trade_type="buy",
            trade_date=None,
            disclosure_date=None,
            amount_low=1001.0,
            amount_high=15000.0,
        ),
    ]
    result = get_politician_trades("J000309", trades)
    assert len(result) == 1
    assert result[0].ticker == "AAPL"


def test_get_politician_trades_returns_empty_when_no_match():
    result = get_politician_trades("NOBODY", [])
    assert result == []
```

- [ ] **Step 2: Run failing tests**

```bash
cd backend && python -m pytest tests/v6/test_politician_scraper_service.py -v 2>&1 | tail -20
```
Expected: multiple `FAILED` or `ERROR` lines (functions not yet defined)

- [ ] **Step 3: Write the service**

```python
# backend/app/services/politician_scraper_service.py
"""
Async wrapper around Quiver Quantitative congressional trading API.
Fetches and caches recent disclosures; parses them into PoliticianTrade objects.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

import requests

logger = logging.getLogger(__name__)

QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}
_CACHE_TTL = 300  # 5 minutes
_cache_trades: list["PoliticianTrade"] = []
_cache_time: float = 0.0


@dataclass
class PoliticianTrade:
    trade_id: str
    politician_id: str
    politician_name: str
    ticker: str
    asset_type: str      # "stock" | "etf" | "option"
    trade_type: str      # "buy" | "sell"
    trade_date: Optional[date]
    disclosure_date: Optional[date]
    amount_low: float
    amount_high: float
    comment: str = ""
    option_type: Optional[str] = None
    option_strike: Optional[float] = None
    option_expiry: Optional[str] = None
    excess_return: Optional[float] = None
    price_change: Optional[float] = None


def _parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _parse_range(range_str: str, amount_str: str) -> tuple[float, float]:
    if range_str:
        clean = re.sub(r"[$,]", "", range_str)
        parts = re.split(r"\s*[-–]\s*", clean.strip())
        try:
            if len(parts) == 2:
                return float(parts[0]), float(parts[1])
            if len(parts) == 1:
                v = float(parts[0])
                return v, v
        except ValueError:
            pass
    try:
        v = float(amount_str or 0)
        return v, v
    except ValueError:
        return 0.0, 0.0


def _build_trade_id(rec: dict) -> str:
    politician_id = rec.get("BioGuideID") or (rec.get("Representative") or "").lower().replace(" ", "-")
    ticker = (rec.get("Ticker") or "").strip().upper()
    tx_date = rec.get("TransactionDate", "")
    trade_type = "buy" if "purchase" in (rec.get("Transaction") or "").lower() else "sell"
    return f"{politician_id}_{ticker}_{tx_date}_{trade_type}"


def _parse_quiver_record(rec: dict) -> Optional[PoliticianTrade]:
    ticker = (rec.get("Ticker") or "").strip().upper()
    if not ticker or ticker in ("N/A", "--", ""):
        return None

    politician_name = rec.get("Representative") or "Unknown"
    politician_id = rec.get("BioGuideID") or politician_name.lower().replace(" ", "-")

    trade_type = "buy" if "purchase" in (rec.get("Transaction") or "").lower() else "sell"

    ticker_type = (rec.get("TickerType") or "stock").lower()
    if "option" in ticker_type:
        asset_type = "option"
    elif "etf" in ticker_type:
        asset_type = "etf"
    else:
        asset_type = "stock"

    amount_low, amount_high = _parse_range(
        rec.get("Range") or "", rec.get("Amount") or ""
    )

    description = rec.get("Description") or ""
    option_type = option_strike = option_expiry = None
    if asset_type == "option" and description:
        cp = re.search(r"\b(call|put)\b", description, re.IGNORECASE)
        if cp:
            option_type = cp.group(1).lower()
        strike = re.search(r"\$?([\d.]+)\s*strike", description, re.IGNORECASE)
        if strike:
            option_strike = float(strike.group(1))
        exp = re.search(r"exp(?:iry|iration)?[:\s]*([\d/\-]+)", description, re.IGNORECASE)
        if exp:
            option_expiry = exp.group(1)

    return PoliticianTrade(
        trade_id=_build_trade_id(rec),
        politician_id=politician_id,
        politician_name=politician_name,
        ticker=ticker,
        asset_type=asset_type,
        trade_type=trade_type,
        trade_date=_parse_date(rec.get("TransactionDate") or ""),
        disclosure_date=_parse_date(rec.get("ReportDate") or ""),
        amount_low=amount_low,
        amount_high=amount_high,
        comment=description,
        option_type=option_type,
        option_strike=option_strike,
        option_expiry=option_expiry,
        excess_return=rec.get("ExcessReturn"),
        price_change=rec.get("PriceChange"),
    )


def _fetch_raw() -> list[PoliticianTrade]:
    """Synchronous Quiver Quant fetch. Returns empty list on error."""
    global _cache_trades, _cache_time
    try:
        resp = requests.get(QUIVER_URL, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        records = resp.json()
    except Exception as exc:
        logger.error("Quiver Quant fetch failed: %s", exc)
        return _cache_trades  # return stale cache

    trades = [t for rec in records if (t := _parse_quiver_record(rec)) is not None]
    _cache_trades = trades
    _cache_time = time.time()
    logger.info("Loaded %d congressional trades from Quiver Quant", len(trades))
    return trades


async def fetch_congressional_trades(force: bool = False) -> list[PoliticianTrade]:
    """Async wrapper around _fetch_raw(). Caches results for 5 minutes."""
    global _cache_trades, _cache_time
    if not force and _cache_trades and (time.time() - _cache_time) < _CACHE_TTL:
        logger.debug("Returning cached congressional trades (%d)", len(_cache_trades))
        return _cache_trades
    return await asyncio.to_thread(_fetch_raw)


def get_politician_trades(
    politician_id: str,
    all_trades: list[PoliticianTrade],
) -> list[PoliticianTrade]:
    """Filter all_trades to those belonging to the given politician (by BioGuideID)."""
    pid_lower = politician_id.lower()
    return [
        t for t in all_trades
        if t.politician_id.lower() == pid_lower or t.politician_name.lower().replace(" ", "-") == pid_lower
    ]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/v6/test_politician_scraper_service.py -v 2>&1 | tail -20
```
Expected: all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/politician_scraper_service.py backend/tests/v6/__init__.py backend/tests/v6/test_politician_scraper_service.py
git commit -m "feat: politician scraper service — Quiver Quant HTTP + trade parsing"
```

---

## Task 5: Politician Ranker Service

**Files:**
- Create: `backend/app/services/politician_ranker_service.py`
- Create: `backend/tests/v6/test_politician_ranker_service.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/v6/test_politician_ranker_service.py
"""Tests for politician_ranker_service.py — scoring and ranking logic."""
from __future__ import annotations
import math
from datetime import date, timedelta

import pytest

from app.services.politician_scraper_service import PoliticianTrade
from app.services.politician_ranker_service import (
    PoliticianScore,
    rank_politicians,
    get_best_politician,
)


def _trade(politician_id: str, ticker: str, excess_return: float, days_ago: int = 5) -> PoliticianTrade:
    disc = date.today() - timedelta(days=days_ago)
    return PoliticianTrade(
        trade_id=f"{politician_id}_{ticker}_{disc}_buy",
        politician_id=politician_id,
        politician_name=politician_id.replace("-", " ").title(),
        ticker=ticker,
        asset_type="stock",
        trade_type="buy",
        trade_date=disc,
        disclosure_date=disc,
        amount_low=15001.0,
        amount_high=50000.0,
        excess_return=excess_return,
        price_change=excess_return + 1.0,
    )


def test_rank_politicians_returns_top_scores():
    trades = [
        _trade("j-jackson", "AAPL", 8.0),
        _trade("j-jackson", "GEV", 5.0),
        _trade("j-jackson", "BK", 3.0),
        _trade("j-jackson", "MSFT", -1.0),
        _trade("j-jackson", "TSLA", 2.0),
        _trade("n-pelosi", "NVDA", 1.0),
        _trade("n-pelosi", "AMZN", -0.5),
        _trade("n-pelosi", "GOOG", 0.5),
        _trade("n-pelosi", "SPY", -2.0),
        _trade("n-pelosi", "META", 3.0),
    ]
    scores = rank_politicians(trades, lookback_days=90, min_trades=5)
    assert len(scores) >= 1
    # j-jackson has higher avg excess return so should rank first
    assert scores[0].politician_id == "j-jackson"
    assert scores[0].buy_trades == 5
    assert scores[0].win_rate == 80.0  # 4 out of 5 positive


def test_rank_politicians_excludes_below_min_trades():
    trades = [
        _trade("j-jackson", "AAPL", 5.0),
        _trade("j-jackson", "GEV", 3.0),
        _trade("n-pelosi", "NVDA", 10.0),  # only 1 trade
    ]
    scores = rank_politicians(trades, lookback_days=90, min_trades=2)
    ids = [s.politician_id for s in scores]
    assert "j-jackson" in ids
    assert "n-pelosi" not in ids  # only 1 trade, below min


def test_rank_politicians_excludes_old_trades():
    old_trade = _trade("j-jackson", "AAPL", 5.0, days_ago=200)
    new_trade = _trade("n-pelosi", "NVDA", 2.0, days_ago=10)
    trades = [old_trade] + [_trade("n-pelosi", f"T{i}", 1.0, days_ago=10) for i in range(4)]
    scores = rank_politicians(trades, lookback_days=90, min_trades=1)
    ids = [s.politician_id for s in scores]
    assert "n-pelosi" in ids
    assert "j-jackson" not in ids  # trade too old


def test_score_formula_higher_excess_beats_higher_volume():
    """
    Politician A: 14 trades, 92% win rate, +8.3% avg excess
    Politician B: 83 trades, 42% win rate, -0.5% avg excess
    A should score higher (log-scaled recency prevents B from dominating).
    """
    # A: 13 wins + 1 loss
    a_trades = [_trade("jackson", f"S{i}", 8.3) for i in range(13)]
    a_trades.append(_trade("jackson", "LOSE", -1.0))
    # B: 35 wins + 48 losses
    b_wins = [_trade("cisneros", f"W{i}", 0.5) for i in range(35)]
    b_losses = [_trade("cisneros", f"L{i}", -0.5) for i in range(48)]
    all_trades = a_trades + b_wins + b_losses
    scores = rank_politicians(all_trades, lookback_days=90, min_trades=5)
    assert scores[0].politician_id == "jackson"


def test_get_best_politician_returns_top_when_no_pin():
    trades = [
        _trade("j-jackson", f"T{i}", 5.0 - i * 0.5) for i in range(5)
    ] + [
        _trade("n-pelosi", f"P{i}", 3.0 - i * 0.5) for i in range(5)
    ]
    best = get_best_politician(trades, target_politician_id=None)
    assert best is not None
    assert best.politician_id == "j-jackson"


def test_get_best_politician_respects_pin():
    trades = [
        _trade("j-jackson", f"T{i}", 5.0) for i in range(5)
    ] + [
        _trade("n-pelosi", f"P{i}", 1.0) for i in range(5)
    ]
    best = get_best_politician(trades, target_politician_id="n-pelosi")
    assert best is not None
    assert best.politician_id == "n-pelosi"


def test_get_best_politician_returns_none_when_pin_not_found():
    trades = [_trade("j-jackson", f"T{i}", 5.0) for i in range(5)]
    best = get_best_politician(trades, target_politician_id="nobody")
    assert best is None
```

- [ ] **Step 2: Run failing tests**

```bash
cd backend && python -m pytest tests/v6/test_politician_ranker_service.py -v 2>&1 | tail -20
```
Expected: `ImportError` or `FAILED` (service not yet written)

- [ ] **Step 3: Write the service**

```python
# backend/app/services/politician_ranker_service.py
"""
Ranks politicians by trading performance using pre-fetched Quiver trade data.
Scoring formula: (win_rate * 1.5) + (avg_excess_return * 5.0) + log1p(recent_count) * 3.0
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from app.services.politician_scraper_service import PoliticianTrade

logger = logging.getLogger(__name__)


@dataclass
class PoliticianScore:
    politician_id: str
    politician_name: str
    total_trades: int
    buy_trades: int
    win_rate: float           # % of buys with ExcessReturn > 0
    avg_excess_return: float  # average % vs SPY
    recent_trade_count: int   # trades in last 30 days
    score: float
    best_trades: list[str] = field(default_factory=list)


def _score(
    politician_id: str,
    politician_name: str,
    trades: list[PoliticianTrade],
    today: date,
) -> PoliticianScore:
    buy_trades = [t for t in trades if t.trade_type == "buy"]
    recent_count = sum(
        1 for t in trades
        if t.disclosure_date and (today - t.disclosure_date).days <= 30
    )
    scored = [t for t in buy_trades if t.excess_return is not None]

    if not scored:
        win_rate = avg_excess = avg_price = 0.0
        best: list[str] = []
    else:
        wins = [t for t in scored if t.excess_return > 0]
        win_rate = len(wins) / len(scored) * 100
        avg_excess = sum(t.excess_return for t in scored) / len(scored)
        avg_price = sum(
            t.price_change for t in scored if t.price_change is not None
        ) / max(1, len(scored))
        top = sorted(wins, key=lambda t: t.excess_return, reverse=True)[:5]
        best = [f"{t.ticker} +{t.excess_return:.1f}% vs SPY" for t in top]

    recency_bonus = math.log1p(recent_count) * 3.0
    composite = (win_rate * 1.5) + (avg_excess * 5.0) + recency_bonus

    return PoliticianScore(
        politician_id=politician_id,
        politician_name=politician_name,
        total_trades=len(trades),
        buy_trades=len(buy_trades),
        win_rate=win_rate,
        avg_excess_return=avg_excess,
        recent_trade_count=recent_count,
        score=composite,
        best_trades=best,
    )


def rank_politicians(
    all_trades: list[PoliticianTrade],
    lookback_days: int = 90,
    min_trades: int = 5,
    top_n: int = 10,
) -> list[PoliticianScore]:
    today = date.today()
    cutoff = today - timedelta(days=lookback_days)

    by_politician: dict[str, list[PoliticianTrade]] = {}
    for t in all_trades:
        disc = t.disclosure_date
        if disc is None or disc < cutoff:
            continue
        by_politician.setdefault(t.politician_id, []).append(t)

    scores: list[PoliticianScore] = []
    for pid, trades in by_politician.items():
        if len(trades) < min_trades:
            continue
        pname = trades[0].politician_name
        scores.append(_score(pid, pname, trades, today))

    scores.sort(key=lambda s: s.score, reverse=True)
    return scores[:top_n]


def get_best_politician(
    all_trades: list[PoliticianTrade],
    target_politician_id: Optional[str] = None,
    lookback_days: int = 90,
    min_trades: int = 5,
) -> Optional[PoliticianScore]:
    if target_politician_id:
        pinned = [t for t in all_trades if t.politician_id.lower() == target_politician_id.lower()]
        if not pinned:
            logger.warning("No trades found for pinned politician %s", target_politician_id)
            return None
        pname = pinned[0].politician_name
        return _score(target_politician_id, pname, pinned, date.today())

    ranked = rank_politicians(all_trades, lookback_days=lookback_days, min_trades=min_trades)
    if not ranked:
        logger.warning("No politicians qualified for ranking")
        return None
    logger.info(
        "Best politician: %s (score=%.1f, win_rate=%.0f%%, avg_excess=%.1f%%)",
        ranked[0].politician_name, ranked[0].score, ranked[0].win_rate, ranked[0].avg_excess_return,
    )
    return ranked[0]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/v6/test_politician_ranker_service.py -v 2>&1 | tail -20
```
Expected: all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/politician_ranker_service.py backend/tests/v6/test_politician_ranker_service.py
git commit -m "feat: politician ranker service — scoring and ranking algorithm"
```

---

## Task 6: Copy Trading Service

**Files:**
- Create: `backend/app/services/copy_trading_service.py`
- Create: `backend/tests/v6/test_copy_trading_service.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/v6/test_copy_trading_service.py
"""Tests for copy_trading_service.py — session creation, trade execution, seeding."""
from __future__ import annotations
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.copy_trading_service import (
    _execute_stock_trade,
    _execute_options_trade,
    _should_skip_sell,
)
from app.services.politician_scraper_service import PoliticianTrade
from app.broker.base import OrderResult


def _make_trade(
    ticker: str = "AAPL",
    trade_type: str = "buy",
    asset_type: str = "stock",
    option_type: str | None = None,
    option_strike: float | None = None,
    option_expiry: str | None = None,
) -> PoliticianTrade:
    return PoliticianTrade(
        trade_id=f"J000309_{ticker}_2026-03-01_{trade_type}",
        politician_id="J000309",
        politician_name="Jonathan Jackson",
        ticker=ticker,
        asset_type=asset_type,
        trade_type=trade_type,
        trade_date=date(2026, 3, 1),
        disclosure_date=date(2026, 3, 15),
        amount_low=15001.0,
        amount_high=50000.0,
        option_type=option_type,
        option_strike=option_strike,
        option_expiry=option_expiry,
    )


def _make_broker(positions: list[str] | None = None) -> MagicMock:
    broker = MagicMock()
    broker.place_order.return_value = OrderResult(
        broker_order_id="order-123",
        status="accepted",
        filled_price=None,
        filled_quantity=None,
        raw_response={},
    )
    if positions is not None:
        broker.get_positions.return_value = [{"symbol": s} for s in positions]
    return broker


def test_execute_stock_trade_dry_run():
    broker = _make_broker()
    trade = _make_trade("AAPL", "buy")
    result = _execute_stock_trade(trade, broker, copy_amount_usd=300.0, dry_run=True)
    broker.place_order.assert_called_once_with(
        symbol="AAPL", side="buy", quantity=0, notional_usd=300.0, dry_run=True
    )
    assert result["status"] == "accepted"


def test_execute_stock_trade_sell_with_position():
    broker = _make_broker(positions=["AAPL", "MSFT"])
    trade = _make_trade("AAPL", "sell")
    result = _execute_stock_trade(trade, broker, copy_amount_usd=300.0, dry_run=False)
    broker.place_order.assert_called_once()
    assert result["status"] == "accepted"


def test_execute_stock_trade_sell_skips_if_no_position():
    broker = _make_broker(positions=["MSFT"])
    trade = _make_trade("AAPL", "sell")
    result = _execute_stock_trade(trade, broker, copy_amount_usd=300.0, dry_run=False)
    broker.place_order.assert_not_called()
    assert result["alpaca_status"] == "skipped_no_position"


def test_should_skip_sell_true_when_not_in_positions():
    positions = [{"symbol": "MSFT"}, {"symbol": "GOOG"}]
    assert _should_skip_sell("AAPL", positions) is True


def test_should_skip_sell_false_when_in_positions():
    positions = [{"symbol": "AAPL"}, {"symbol": "GOOG"}]
    assert _should_skip_sell("AAPL", positions) is False


def test_execute_options_trade_falls_back_to_stock_when_contract_unknown():
    """Options trade with no strike/expiry should fall back to buying the underlying."""
    broker = _make_broker()
    trade = _make_trade("AAPL", "buy", "option", option_type="call")  # no strike or expiry
    result = _execute_options_trade(trade, broker, copy_amount_usd=300.0, dry_run=True)
    # Should have called place_order for the underlying AAPL stock
    broker.place_order.assert_called_once_with(
        symbol="AAPL", side="buy", quantity=0, notional_usd=300.0, dry_run=True
    )
```

- [ ] **Step 2: Run failing tests**

```bash
cd backend && python -m pytest tests/v6/test_copy_trading_service.py -v 2>&1 | tail -20
```
Expected: `ImportError` or `FAILED`

- [ ] **Step 3: Write the service**

```python
# backend/app/services/copy_trading_service.py
"""
Copy trading session lifecycle and trade execution.

Session creation: saves session + seeds existing Quiver trades as pre_existing
  so historical disclosures are never bulk-copied.

Trade execution: wraps broker.place_order() with sell-position checks and
  options fallback logic. All Alpaca calls run in asyncio.to_thread.

Scheduler entry point: process_active_sessions(db) — fetches Quiver once,
  loops all active sessions, commits once after the loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.factory import get_broker_client
from app.models.broker import BrokerCredential
from app.models.copy_trading import CopiedPoliticianTrade, CopyTradingSession
from app.models.user import User
from app.schemas.copy_trading import CreateSessionRequest
from app.services.politician_ranker_service import PoliticianScore, get_best_politician
from app.services.politician_scraper_service import (
    PoliticianTrade,
    fetch_congressional_trades,
    get_politician_trades,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Low-level broker helpers (synchronous — called via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _should_skip_sell(ticker: str, positions: list[dict]) -> bool:
    position_symbols = {p.get("symbol", "").upper() for p in positions}
    return ticker.upper() not in position_symbols


def _execute_stock_trade(
    trade: PoliticianTrade,
    broker,
    copy_amount_usd: float,
    dry_run: bool,
) -> dict:
    """Place a notional stock/ETF order. Returns {order_id, status, alpaca_status}."""
    if trade.trade_type == "sell" and not dry_run:
        positions = broker.get_positions()
        if _should_skip_sell(trade.ticker, positions):
            logger.info("Skipping sell %s — no position", trade.ticker)
            return {"order_id": None, "alpaca_status": "skipped_no_position", "status": "skipped_no_position"}

    result = broker.place_order(
        symbol=trade.ticker,
        side=trade.trade_type,
        quantity=0,
        notional_usd=copy_amount_usd,
        dry_run=dry_run,
    )
    alpaca_status = result.status if result.status else "pending"
    return {
        "order_id": result.broker_order_id,
        "alpaca_status": alpaca_status,
        "status": result.status,
    }


def _execute_options_trade(
    trade: PoliticianTrade,
    broker,
    copy_amount_usd: float,
    dry_run: bool,
) -> dict:
    """Attempt options trade; fall back to underlying stock if contract is unresolvable."""
    if trade.option_strike and trade.option_expiry and trade.option_type:
        try:
            exp = (trade.option_expiry or "").replace("-", "").replace("/", "")
            if len(exp) == 8:
                exp = exp[2:]
            strike_int = int(float(trade.option_strike) * 1000)
            cp = "C" if trade.option_type.lower() == "call" else "P"
            contract_symbol = f"{trade.ticker}{exp}{cp}{strike_int:08d}"
            result = broker.place_order(
                symbol=contract_symbol,
                side=trade.trade_type,
                quantity=1,
                dry_run=dry_run,
            )
            return {
                "order_id": result.broker_order_id,
                "alpaca_status": result.status,
                "status": result.status,
                "notes": f"options contract {contract_symbol}",
            }
        except Exception as exc:
            logger.warning("Options order failed (%s), falling back to underlying %s", exc, trade.ticker)

    logger.info("Falling back to underlying stock %s for options trade", trade.ticker)
    return _execute_stock_trade(trade, broker, copy_amount_usd, dry_run)


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

async def create_session(
    req: CreateSessionRequest,
    db: AsyncSession,
    current_user: User,
) -> CopyTradingSession:
    """
    Create a new active copy-trading session.
    Seeds all existing Quiver trades for the target politician as pre_existing
    so they are never bulk-copied on first poll.
    """
    session = CopyTradingSession(
        user_id=current_user.id,
        status="active",
        dry_run=req.dry_run,
        copy_amount_usd=req.copy_amount_usd,
        target_politician_id=req.target_politician_id,
    )

    # Resolve politician name for display
    if req.target_politician_id:
        try:
            all_trades = await fetch_congressional_trades()
            politician_trades = get_politician_trades(req.target_politician_id, all_trades)
            if politician_trades:
                session.target_politician_name = politician_trades[0].politician_name
        except Exception as exc:
            logger.warning("Could not resolve politician name for %s: %s", req.target_politician_id, exc)

    db.add(session)
    await db.flush()  # get session.id before seeding

    # Seed existing trades so they are never bulk-copied
    await _seed_existing_trades(session, db)

    await db.commit()
    await db.refresh(session)
    logger.info(
        "Created copy-trading session id=%d user=%d politician=%s dry_run=%s",
        session.id, current_user.id, req.target_politician_id or "auto", req.dry_run,
    )
    return session


async def _seed_existing_trades(session: CopyTradingSession, db: AsyncSession) -> None:
    """
    Mark all currently visible Quiver trades for the session's politician as pre_existing.
    This prevents historical disclosures from being bulk-copied when the session first activates.
    """
    try:
        all_trades = await fetch_congressional_trades()
        if session.target_politician_id:
            trades_to_seed = get_politician_trades(session.target_politician_id, all_trades)
        else:
            # auto-rank: seed all visible trades for the current best politician
            best = get_best_politician(all_trades)
            if best is None:
                return
            trades_to_seed = get_politician_trades(best.politician_id, all_trades)

        now = datetime.now(timezone.utc)
        for t in trades_to_seed:
            row = CopiedPoliticianTrade(
                session_id=session.id,
                user_id=session.user_id,
                trade_id=t.trade_id,
                politician_id=t.politician_id,
                politician_name=t.politician_name,
                ticker=t.ticker,
                asset_type=t.asset_type,
                trade_type=t.trade_type,
                trade_date=t.trade_date,
                disclosure_date=t.disclosure_date,
                amount_low=t.amount_low,
                amount_high=t.amount_high,
                alpaca_order_id=None,
                alpaca_status="pre_existing",
                copy_amount_usd=None,
                dry_run=session.dry_run,
                created_at=now,
                notes="seeded on session creation",
            )
            db.add(row)
        logger.info(
            "Seeded %d pre-existing trades for session id=%d", len(trades_to_seed), session.id
        )
    except Exception as exc:
        logger.warning("Seeding failed for session id=%d: %s", session.id, exc)


# ---------------------------------------------------------------------------
# Scheduler: process all active sessions
# ---------------------------------------------------------------------------

async def process_active_sessions(db: AsyncSession) -> None:
    """
    Called by the scheduler every 15 min.
    Fetches Quiver data once, then processes each active session.
    All DB mutations are committed once at the end of the caller (copy_trading_monitor).
    """
    all_trades = await fetch_congressional_trades()

    result = await db.execute(
        select(CopyTradingSession).where(CopyTradingSession.status == "active")
    )
    sessions = result.scalars().all()

    if not sessions:
        logger.info("copy_trading_monitor: no active sessions")
        return

    logger.info("copy_trading_monitor: processing %d active session(s)", len(sessions))

    for session in sessions:
        try:
            await _process_one_session(session, all_trades, db)
        except Exception as exc:
            logger.error("copy_trading_monitor: session id=%d error: %s", session.id, exc)


async def _process_one_session(
    session: CopyTradingSession,
    all_trades: list[PoliticianTrade],
    db: AsyncSession,
) -> None:
    # Load broker credential for this user
    cred_result = await db.execute(
        select(BrokerCredential).where(
            BrokerCredential.user_id == session.user_id,
            BrokerCredential.provider == "alpaca",
            BrokerCredential.is_active == True,
        )
    )
    cred = cred_result.scalars().first()
    if cred is None:
        logger.warning(
            "No active Alpaca credential for user_id=%d (session=%d)",
            session.user_id, session.id,
        )
        return

    broker = get_broker_client(cred)

    # Determine which politician to follow
    if session.target_politician_id:
        politician_trades = get_politician_trades(session.target_politician_id, all_trades)
    else:
        best = get_best_politician(all_trades)
        if best is None:
            logger.warning("No best politician found for session id=%d", session.id)
            return
        politician_trades = get_politician_trades(best.politician_id, all_trades)
        # Update session politician name if auto-rank result changed
        if session.target_politician_name != best.politician_name:
            session.target_politician_name = best.politician_name

    # Get already-copied trade_ids for this user (across all sessions)
    copied_result = await db.execute(
        select(CopiedPoliticianTrade.trade_id).where(
            CopiedPoliticianTrade.user_id == session.user_id
        )
    )
    already_copied: set[str] = {row[0] for row in copied_result}

    new_trades = [t for t in politician_trades if t.trade_id not in already_copied]
    if not new_trades:
        logger.debug("session id=%d: no new trades to copy", session.id)
        return

    logger.info("session id=%d: copying %d new trade(s)", session.id, len(new_trades))

    for trade in new_trades:
        await _copy_one_trade(trade, session, broker, db)


async def _copy_one_trade(
    trade: PoliticianTrade,
    session: CopyTradingSession,
    broker,
    db: AsyncSession,
) -> None:
    logger.info(
        "COPY TRADE: session=%d | %s %s %s | $%.0f–$%.0f | dry_run=%s",
        session.id, trade.politician_name, trade.trade_type.upper(), trade.ticker,
        trade.amount_low, trade.amount_high, session.dry_run,
    )
    try:
        if "option" in trade.asset_type.lower():
            exec_result = await asyncio.to_thread(
                _execute_options_trade, trade, broker, session.copy_amount_usd, session.dry_run
            )
        else:
            exec_result = await asyncio.to_thread(
                _execute_stock_trade, trade, broker, session.copy_amount_usd, session.dry_run
            )
    except Exception as exc:
        logger.error("Trade execution error for %s: %s", trade.ticker, exc)
        exec_result = {"order_id": None, "alpaca_status": f"error: {exc}"}

    record = CopiedPoliticianTrade(
        session_id=session.id,
        user_id=session.user_id,
        trade_id=trade.trade_id,
        politician_id=trade.politician_id,
        politician_name=trade.politician_name,
        ticker=trade.ticker,
        asset_type=trade.asset_type,
        trade_type=trade.trade_type,
        trade_date=trade.trade_date,
        disclosure_date=trade.disclosure_date,
        amount_low=trade.amount_low,
        amount_high=trade.amount_high,
        alpaca_order_id=exec_result.get("order_id"),
        alpaca_status=exec_result.get("alpaca_status", "unknown"),
        copy_amount_usd=session.copy_amount_usd,
        dry_run=session.dry_run,
        notes=exec_result.get("notes", f"source_amount=${trade.amount_low:.0f}-{trade.amount_high:.0f}"),
    )
    db.add(record)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/v6/test_copy_trading_service.py -v 2>&1 | tail -20
```
Expected: all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/copy_trading_service.py backend/tests/v6/test_copy_trading_service.py
git commit -m "feat: copy trading service — session lifecycle + trade execution"
```

---

## Task 7: FastAPI Router

**Files:**
- Create: `backend/app/api/copy_trading.py`

- [ ] **Step 1: Write the router**

```python
# backend/app/api/copy_trading.py
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.copy_trading import CopiedPoliticianTrade, CopyTradingSession
from app.models.user import User
from app.schemas.copy_trading import (
    CopiedTradeOut,
    CopyTradingSessionOut,
    CreateSessionRequest,
    PoliticianRankingOut,
)
from app.services.copy_trading_service import create_session
from app.services.politician_ranker_service import rank_politicians
from app.services.politician_scraper_service import fetch_congressional_trades

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copy-trading", tags=["copy-trading"])


@router.get("/rankings", response_model=list[PoliticianRankingOut])
async def get_rankings(
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[PoliticianRankingOut]:
    """Return platform-wide politician rankings (15-min cached)."""
    all_trades = await fetch_congressional_trades()
    scores = rank_politicians(all_trades, lookback_days=90, min_trades=5, top_n=10)
    return [
        PoliticianRankingOut(
            politician_id=s.politician_id,
            politician_name=s.politician_name,
            total_trades=s.total_trades,
            buy_trades=s.buy_trades,
            win_rate=round(s.win_rate, 1),
            avg_excess_return=round(s.avg_excess_return, 2),
            recent_trade_count=s.recent_trade_count,
            score=round(s.score, 1),
            best_trades=s.best_trades,
        )
        for s in scores
    ]


@router.post("/sessions", response_model=CopyTradingSessionOut, status_code=status.HTTP_201_CREATED)
async def create_copy_session(
    payload: CreateSessionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CopyTradingSessionOut:
    """Create and activate a copy-trading session."""
    session = await create_session(payload, db, current_user)
    return CopyTradingSessionOut.from_orm(session)


@router.get("/sessions", response_model=list[CopyTradingSessionOut])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CopyTradingSessionOut]:
    result = await db.execute(
        select(CopyTradingSession)
        .where(CopyTradingSession.user_id == current_user.id)
        .order_by(CopyTradingSession.activated_at.desc())
        .limit(limit)
    )
    return [CopyTradingSessionOut.from_orm(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=CopyTradingSessionOut)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CopyTradingSessionOut:
    result = await db.execute(
        select(CopyTradingSession).where(
            CopyTradingSession.id == session_id,
            CopyTradingSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return CopyTradingSessionOut.from_orm(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(
        select(CopyTradingSession).where(
            CopyTradingSession.id == session_id,
            CopyTradingSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = "cancelled"
    session.cancelled_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions/{session_id}/trades", response_model=list[CopiedTradeOut])
async def get_session_trades(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CopiedTradeOut]:
    # Verify session ownership
    sess_result = await db.execute(
        select(CopyTradingSession).where(
            CopyTradingSession.id == session_id,
            CopyTradingSession.user_id == current_user.id,
        )
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(CopiedPoliticianTrade)
        .where(CopiedPoliticianTrade.session_id == session_id)
        .order_by(CopiedPoliticianTrade.created_at.desc())
        .limit(limit)
    )
    return [CopiedTradeOut.from_orm(t) for t in result.scalars().all()]


@router.get("/trades", response_model=list[CopiedTradeOut])
async def get_all_trades(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CopiedTradeOut]:
    result = await db.execute(
        select(CopiedPoliticianTrade)
        .where(
            CopiedPoliticianTrade.user_id == current_user.id,
            CopiedPoliticianTrade.alpaca_status != "pre_existing",
        )
        .order_by(CopiedPoliticianTrade.created_at.desc())
        .limit(limit)
    )
    return [CopiedTradeOut.from_orm(t) for t in result.scalars().all()]
```

- [ ] **Step 2: Verify router imports cleanly**

```bash
cd backend && python -c "from app.api.copy_trading import router; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/copy_trading.py
git commit -m "feat: copy trading FastAPI router — 7 endpoints"
```

---

## Task 8: Scheduler Task

**Files:**
- Create: `backend/app/scheduler/tasks/copy_trading_monitor.py`

- [ ] **Step 1: Write the task**

```python
# backend/app/scheduler/tasks/copy_trading_monitor.py
"""
Scheduler task: poll Quiver Quant + copy new congressional trades every 15 minutes.

Fetches Quiver data once per run (shared across all active sessions).
A single AsyncSessionLocal covers the full function body; one db.commit() after processing.
"""
from __future__ import annotations

import asyncio
import gc
import logging

from app.db.session import AsyncSessionLocal
from app.services.copy_trading_service import process_active_sessions

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    logger.info("copy_trading_monitor: starting")
    try:
        async with AsyncSessionLocal() as db:
            await process_active_sessions(db)
            await db.commit()
        logger.info("copy_trading_monitor: complete")
    except Exception as exc:
        logger.exception("copy_trading_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def monitor_copy_trading() -> None:
    """Synchronous APScheduler entry point."""
    asyncio.run(_run_monitor())
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd backend && python -c "from app.scheduler.tasks.copy_trading_monitor import monitor_copy_trading; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/scheduler/tasks/copy_trading_monitor.py
git commit -m "feat: copy trading scheduler task — polls Quiver Quant every 15 min"
```

---

## Task 9: Wire Into main.py and jobs.py

**Files:**
- Modify: `backend/app/scheduler/jobs.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add scheduler job to jobs.py**

In `backend/app/scheduler/jobs.py`, add the import after the trailing bot import:

```python
from app.scheduler.tasks.copy_trading_monitor import monitor_copy_trading
```

Then add this job block at the end of `register_jobs()`, before the closing `logger.info(...)`:

```python
    # ── Copy trading monitor ──────────────────────────────────────────────────
    scheduler.add_job(
        monitor_copy_trading,
        "interval",
        minutes=15,
        id="copy_trading_monitor",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
```

Update the `logger.info(...)` at the bottom of `register_jobs()` to add `copy_trading_monitor=15m` to the format string:

```python
    logger.info(
        "Scheduler jobs registered: buy_zone=%dm theme=%dm alerts=%dm auto_buy=%dm "
        "scan=%dm live_scanner=%dm idea_gen=%dm prune_signals=daily commodity_alerts=%dm "
        "trailing_bot_monitor=5m copy_trading_monitor=15m",
        settings.buy_zone_refresh_minutes,
        settings.theme_score_refresh_minutes,
        settings.alert_eval_minutes,
        settings.auto_buy_eval_minutes,
        settings.watchlist_scan_minutes,
        settings.live_scanner_minutes,
        settings.idea_generator_minutes,
        settings.commodity_alert_minutes,
    )
```

- [ ] **Step 2: Add router to main.py**

In `backend/app/main.py`, add the import after the trailing bot import:

```python
# copy trading
from app.api.copy_trading import router as copy_trading_router
```

Then add the include after `app.include_router(trailing_bot_router, prefix="/api/v1")`:

```python
app.include_router(copy_trading_router, prefix="/api/v1")
```

- [ ] **Step 3: Start the server and verify endpoints are visible**

```bash
cd backend && uvicorn app.main:app --reload 2>&1 | head -30
```
Then in a separate terminal:
```bash
curl -s http://localhost:8000/openapi.json | python -m json.tool | grep "copy-trading"
```
Expected: lines showing `/api/v1/copy-trading/rankings`, `/api/v1/copy-trading/sessions`, etc.

- [ ] **Step 4: Commit**

```bash
git add backend/app/scheduler/jobs.py backend/app/main.py
git commit -m "feat: register copy trading router + scheduler job"
```

---

## Task 10: TypeScript Types and API Lib

**Files:**
- Modify: `frontend/types/index.ts`
- Create: `frontend/lib/copy-trading-api.ts`

- [ ] **Step 1: Add TypeScript interfaces to types/index.ts**

Append to the end of `frontend/types/index.ts`:

```typescript
// ─── Copy Trading ─────────────────────────────────────────────────────────────

export interface PoliticianRankingOut {
  politician_id: string;
  politician_name: string;
  total_trades: number;
  buy_trades: number;
  win_rate: number;
  avg_excess_return: number;
  recent_trade_count: number;
  score: number;
  best_trades: string[];
}

export interface CreateCopySessionRequest {
  copy_amount_usd: number;
  dry_run: boolean;
  target_politician_id: string | null;
}

export interface CopyTradingSessionOut {
  id: number;
  status: string;
  dry_run: boolean;
  copy_amount_usd: number;
  target_politician_id: string | null;
  target_politician_name: string | null;
  activated_at: string;
  cancelled_at: string | null;
}

export interface CopiedTradeOut {
  id: number;
  session_id: number;
  trade_id: string;
  politician_id: string;
  politician_name: string;
  ticker: string;
  asset_type: string;
  trade_type: string;
  trade_date: string | null;
  disclosure_date: string | null;
  amount_low: number | null;
  amount_high: number | null;
  alpaca_order_id: string | null;
  alpaca_status: string;
  copy_amount_usd: number | null;
  dry_run: boolean;
  created_at: string;
  notes: string | null;
}
```

- [ ] **Step 2: Create the API lib**

```typescript
// frontend/lib/copy-trading-api.ts
import type {
  CopiedTradeOut,
  CopyTradingSessionOut,
  CreateCopySessionRequest,
  PoliticianRankingOut,
} from "@/types";
import { apiFetch } from "./api";

export const copyTradingApi = {
  getRankings: (): Promise<PoliticianRankingOut[]> =>
    apiFetch("/api/v1/copy-trading/rankings"),

  createSession: (payload: CreateCopySessionRequest): Promise<CopyTradingSessionOut> =>
    apiFetch("/api/v1/copy-trading/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (): Promise<CopyTradingSessionOut[]> =>
    apiFetch("/api/v1/copy-trading/sessions"),

  getSession: (id: number): Promise<CopyTradingSessionOut> =>
    apiFetch(`/api/v1/copy-trading/sessions/${id}`),

  cancelSession: (id: number): Promise<void> =>
    apiFetch(`/api/v1/copy-trading/sessions/${id}`, { method: "DELETE" }),

  getSessionTrades: (id: number): Promise<CopiedTradeOut[]> =>
    apiFetch(`/api/v1/copy-trading/sessions/${id}/trades`),

  getAllTrades: (): Promise<CopiedTradeOut[]> =>
    apiFetch("/api/v1/copy-trading/trades"),
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i "copy-trading\|error" | head -20
```
Expected: no errors related to copy-trading types

- [ ] **Step 4: Commit**

```bash
git add frontend/types/index.ts frontend/lib/copy-trading-api.ts
git commit -m "feat: copy trading TypeScript types + API lib"
```

---

## Task 11: Frontend Page

**Files:**
- Create: `frontend/app/copy-trading/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// frontend/app/copy-trading/page.tsx
"use client";

/**
 * /copy-trading — Politician Copy Trading
 *
 * Sovereign Terminal design matching /trailing-bot:
 * - Rankings panel: top 10 politicians by score (shared, 15-min refresh)
 * - Activate session form: amount, politician picker, dry-run toggle
 * - Active session card + copied trades table
 */

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  Activity,
  TrendingUp,
  Loader2,
  Shield,
  Play,
  StopCircle,
  DollarSign,
  Users,
  BarChart2,
  CheckCircle2,
  XCircle,
  ChevronRight,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copyTradingApi } from "@/lib/copy-trading-api";
import { formatCurrency, formatDateTime, getErrorMessage, cn } from "@/lib/utils";
import type {
  CopiedTradeOut,
  CopyTradingSessionOut,
  CreateCopySessionRequest,
  PoliticianRankingOut,
} from "@/types";

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: typeof Shield; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
        {title}
      </h3>
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

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

// ─── Trade status badge ────────────────────────────────────────────────────────

function TradeStatusBadge({ alpacaStatus }: { alpacaStatus: string }) {
  const isOk = ["accepted", "filled", "simulated", "dry_run"].some((s) =>
    alpacaStatus.includes(s)
  );
  const isSkip = alpacaStatus.startsWith("skipped") || alpacaStatus === "pre_existing";
  const isErr = alpacaStatus.startsWith("error") || alpacaStatus.startsWith("rejected");

  const cls = isOk
    ? "bg-green-500/15 text-green-400 border-green-500/30"
    : isSkip
    ? "bg-muted/50 text-muted-foreground border-border"
    : isErr
    ? "bg-red-500/15 text-red-400 border-red-500/30"
    : "bg-surface-highest text-muted-foreground border-border";

  return (
    <span className={cn("px-1.5 py-0.5 text-3xs font-bold border font-mono", cls)}>
      {alpacaStatus.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

// ─── Rankings table ────────────────────────────────────────────────────────────

function RankingsTable({
  rankings,
  activeSession,
}: {
  rankings: PoliticianRankingOut[];
  activeSession: CopyTradingSessionOut | undefined;
}) {
  if (rankings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-2xs text-muted-foreground uppercase tracking-wider">
          No rankings available — insufficient disclosure data
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header row */}
      <div className="grid grid-cols-12 gap-1 px-2 py-1 border-b border-border">
        <span className="col-span-1 text-3xs text-muted-foreground uppercase tracking-wider">#</span>
        <span className="col-span-5 text-3xs text-muted-foreground uppercase tracking-wider">Politician</span>
        <span className="col-span-2 text-3xs text-muted-foreground uppercase tracking-wider text-right">Win%</span>
        <span className="col-span-2 text-3xs text-muted-foreground uppercase tracking-wider text-right">vs SPY%</span>
        <span className="col-span-2 text-3xs text-muted-foreground uppercase tracking-wider text-right">Score</span>
      </div>
      {rankings.map((r, i) => {
        const isFollowed =
          activeSession?.target_politician_id === r.politician_id ||
          (activeSession && !activeSession.target_politician_id && i === 0);
        return (
          <div
            key={r.politician_id}
            className={cn(
              "grid grid-cols-12 gap-1 px-2 py-2 border-b border-border/50 hover:bg-surface-high/30 transition-colors",
              isFollowed && "bg-primary/5 border-l-2 border-l-primary"
            )}
          >
            <span className="col-span-1 text-2xs font-black text-primary">{i + 1}</span>
            <div className="col-span-5 min-w-0">
              <p className="text-2xs font-bold text-foreground truncate">{r.politician_name}</p>
              {r.best_trades.length > 0 && (
                <p className="text-3xs text-muted-foreground truncate">{r.best_trades[0]}</p>
              )}
            </div>
            <span className="col-span-2 text-2xs font-mono text-right text-foreground">
              {r.win_rate.toFixed(0)}%
            </span>
            <span
              className={cn(
                "col-span-2 text-2xs font-mono text-right font-bold",
                r.avg_excess_return > 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {r.avg_excess_return > 0 ? "+" : ""}{r.avg_excess_return.toFixed(1)}%
            </span>
            <span className="col-span-2 text-2xs font-mono text-right text-primary font-bold">
              {r.score.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  tradeCount,
  onCancel,
  isCancelling,
}: {
  session: CopyTradingSessionOut;
  tradeCount: number;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}) {
  const followingName = session.target_politician_name || "Auto (best performer)";
  return (
    <div className="bg-surface-mid border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-black text-sm text-foreground">
            {followingName}
          </span>
          <StatusBadge status={session.status} />
          {session.dry_run && (
            <span className="px-2 py-0.5 text-2xs font-bold border bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
              <FlaskConical className="h-2.5 w-2.5" />
              DRY RUN
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xs text-muted-foreground font-mono">
            #{session.id} · {formatDateTime(session.activated_at)}
          </span>
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
                  Cancel
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator className="bg-border/50" />

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">Copy Amount</p>
          <p className="text-sm font-black text-foreground font-mono">
            {formatCurrency(session.copy_amount_usd)}
          </p>
          <p className="text-3xs text-muted-foreground">per trade</p>
        </div>
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">Politician</p>
          <p className="text-xs font-bold text-foreground truncate">
            {session.target_politician_id ? session.target_politician_id : "Auto-ranked"}
          </p>
        </div>
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">Copied</p>
          <p className="text-sm font-black text-primary font-mono">{tradeCount}</p>
          <p className="text-3xs text-muted-foreground">trades</p>
        </div>
      </div>
    </div>
  );
}

// ─── Copied trades table ───────────────────────────────────────────────────────

function CopiedTradesTable({ trades }: { trades: CopiedTradeOut[] }) {
  if (trades.length === 0) {
    return (
      <div className="bg-surface-mid p-6 flex flex-col items-center gap-2 text-center">
        <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
          No trades copied yet
        </p>
        <p className="text-3xs text-muted-foreground">
          The scheduler checks for new disclosures every 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-mid overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-border bg-surface-highest">
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Disclosed</span>
        <span className="col-span-3 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Politician</span>
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Ticker</span>
        <span className="col-span-1 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Type</span>
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Status</span>
      </div>
      {trades.map((t) => (
        <div
          key={t.id}
          className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-border/30 hover:bg-surface-high/20 transition-colors"
        >
          <span className="col-span-2 text-3xs font-mono text-muted-foreground">
            {t.disclosure_date || "—"}
          </span>
          <span className="col-span-3 text-2xs text-foreground truncate">{t.politician_name}</span>
          <span className="col-span-2 text-2xs font-mono font-bold text-foreground">{t.ticker}</span>
          <span
            className={cn(
              "col-span-1 text-2xs font-bold",
              t.trade_type === "buy" ? "text-green-400" : "text-red-400"
            )}
          >
            {t.trade_type.toUpperCase()}
          </span>
          <span className="col-span-2 text-2xs font-mono text-right text-foreground">
            {t.copy_amount_usd ? formatCurrency(t.copy_amount_usd) : "—"}
          </span>
          <div className="col-span-2 flex items-center gap-1 flex-wrap">
            <TradeStatusBadge alpacaStatus={t.alpaca_status} />
            {t.dry_run && (
              <span className="text-3xs text-primary font-bold">DR</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CopyTradingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [copyAmount, setCopyAmount] = useState("300");
  const [selectedPolitician, setSelectedPolitician] = useState<string>("auto");
  const [dryRun, setDryRun] = useState(true);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  // SSR-safe instance ID
  const [instanceId, setInstanceId] = useState<string | null>(null);
  useEffect(() => {
    setInstanceId("CT_UNIT_" + Math.floor(Math.random() * 90 + 10));
  }, []);

  // Queries
  const { data: rankings = [], isLoading: rankingsLoading } = useQuery<PoliticianRankingOut[]>({
    queryKey: ["copy-trading", "rankings"],
    queryFn: copyTradingApi.getRankings,
    enabled: !!user,
    refetchInterval: 15 * 60 * 1000, // 15 min
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<CopyTradingSessionOut[]>({
    queryKey: ["copy-trading", "sessions"],
    queryFn: copyTradingApi.listSessions,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: allTrades = [], isLoading: tradesLoading } = useQuery<CopiedTradeOut[]>({
    queryKey: ["copy-trading", "trades"],
    queryFn: copyTradingApi.getAllTrades,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Mutations
  const { mutate: createSession, isPending: isCreating } = useMutation({
    mutationFn: (payload: CreateCopySessionRequest) => copyTradingApi.createSession(payload),
    onSuccess: () => {
      toast.success("Copy-trading session activated");
      queryClient.invalidateQueries({ queryKey: ["copy-trading"] });
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to activate session"));
    },
  });

  const { mutate: cancelSession, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => copyTradingApi.cancelSession(id),
    onSuccess: () => {
      toast.success("Session cancelled");
      queryClient.invalidateQueries({ queryKey: ["copy-trading"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to cancel session"));
    },
  });

  function resetForm() {
    setCopyAmount("300");
    setSelectedPolitician("auto");
    setDryRun(true);
  }

  const isFormValid = useMemo(() => {
    const amount = parseFloat(copyAmount);
    return !isNaN(amount) && amount > 0;
  }, [copyAmount]);

  function handleActivate() {
    if (!dryRun) {
      setLiveConfirmOpen(true);
      return;
    }
    submitActivate();
  }

  function submitActivate() {
    const payload: CreateCopySessionRequest = {
      copy_amount_usd: parseFloat(copyAmount),
      dry_run: dryRun,
      target_politician_id: selectedPolitician === "auto" ? null : selectedPolitician,
    };
    createSession(payload);
  }

  function confirmLiveActivate() {
    if (!liveConfirmed) {
      toast.error("Check the confirmation box to proceed in live mode");
      return;
    }
    setLiveConfirmOpen(false);
    setLiveConfirmed(false);
    submitActivate();
  }

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "active"),
    [sessions]
  );

  const sessionTradeCount = useMemo(() => {
    if (!activeSession) return 0;
    return allTrades.filter(
      (t) => t.session_id === activeSession.id && t.alpaca_status !== "pre_existing"
    ).length;
  }, [allTrades, activeSession]);

  const engineStatus = activeSession ? "RUNNING" : "STANDBY";

  return (
    <AppShell title="Copy Trading">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Politician Copy Trading
          </h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            Engine Instance:{" "}
            {instanceId ?? (
              <span className="inline-block w-24 h-3 bg-surface-highest animate-pulse rounded-sm align-middle" />
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              activeSession
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-surface-highest text-primary border-primary/20"
            )}
          >
            STATUS: {engineStatus}
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
        {/* ── Left: Rankings + Setup form ─────────────────────────── */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          {/* Rankings */}
          <section className="bg-surface-mid p-4">
            <SectionHeader icon={BarChart2} title="Politician Rankings" />
            <p className="text-3xs text-muted-foreground mb-3 leading-relaxed">
              Ranked by historically favorable performance vs SPY. Past results do not guarantee future returns.
            </p>
            {rankingsLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <RankingsTable rankings={rankings} activeSession={activeSession} />
            )}
          </section>

          {/* Setup form (hidden when active session exists) */}
          {!activeSession && (
            <section className="bg-surface-mid p-4 flex flex-col gap-4">
              <SectionHeader icon={Bot} title="Activate Copy Trading" />

              <div className="bg-destructive/5 border-l-4 border-destructive p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-3xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/70">Disclosure delay:</strong>{" "}
                    STOCK Act allows 45-day filing delay. You may be copying trades already priced in.
                    Start with dry-run mode. Past performance of any politician is not indicative of future results.
                  </p>
                </div>
              </div>

              {/* Copy amount */}
              <div>
                <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Copy Amount (USD per trade)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="300"
                    value={copyAmount}
                    onChange={(e) => setCopyAmount(e.target.value)}
                    className="bg-surface-lowest border-border text-foreground placeholder:text-muted-foreground/60 pl-7 font-mono"
                  />
                </div>
              </div>

              {/* Politician selector */}
              <div>
                <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Politician to Follow
                </Label>
                {rankingsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={selectedPolitician} onValueChange={setSelectedPolitician}>
                    <SelectTrigger className="bg-surface-lowest border-border text-foreground">
                      <SelectValue placeholder="Select politician" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        Auto — Best performer (re-ranked daily)
                      </SelectItem>
                      {rankings.map((r) => (
                        <SelectItem key={r.politician_id} value={r.politician_id}>
                          {r.politician_name} — {r.win_rate.toFixed(0)}% win · +{r.avg_excess_return.toFixed(1)}% vs SPY
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      : "LIVE — real broker orders will execute"}
                  </p>
                </div>
                <Switch
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <Button
                onClick={handleActivate}
                disabled={!isFormValid || isCreating}
                className={cn(
                  "w-full text-xs font-bold uppercase tracking-wider",
                  !dryRun
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-2" />
                    Activate{!dryRun ? " (LIVE)" : ""}
                  </>
                )}
              </Button>
            </section>
          )}
        </div>

        {/* ── Right: Active session + trade history ───────────────── */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          {/* Active session card */}
          {sessionsLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : activeSession ? (
            <section className="bg-surface-mid p-4">
              <SectionHeader icon={Activity} title="Active Session" />
              <SessionCard
                session={activeSession}
                tradeCount={sessionTradeCount}
                onCancel={cancelSession}
                isCancelling={isCancelling}
              />
            </section>
          ) : (
            <section className="bg-surface-mid p-8 flex flex-col items-center gap-3 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                No Active Session
              </p>
              <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
                Activate a session using the form on the left. The scheduler will poll for
                new congressional disclosures every 15 minutes.
              </p>
            </section>
          )}

          {/* Copied trades */}
          <section className="bg-surface-mid p-4">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={TrendingUp} title="Copied Trades" />
              {allTrades.length > 0 && (
                <span className="text-3xs font-bold text-primary">
                  {allTrades.length} total
                </span>
              )}
            </div>
            {tradesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <CopiedTradesTable trades={allTrades} />
            )}
          </section>

          {/* Session history */}
          {sessions.filter((s) => s.status !== "active").length > 0 && (
            <section className="bg-surface-mid p-4">
              <SectionHeader icon={Activity} title="Session History" />
              <div className="flex flex-col gap-2">
                {sessions
                  .filter((s) => s.status !== "active")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 border border-border bg-surface-low"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={s.status} />
                        <span className="text-2xs text-foreground truncate">
                          {s.target_politician_name || "Auto-ranked"}
                        </span>
                      </div>
                      <span className="text-3xs text-muted-foreground font-mono whitespace-nowrap ml-2">
                        #{s.id} · {formatDateTime(s.activated_at)}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Live confirmation dialog */}
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
              Live Mode — Real Orders
            </DialogTitle>
            <DialogDescription className="text-2xs text-muted-foreground leading-relaxed pt-1">
              You are about to activate copy trading in{" "}
              <strong className="text-destructive">LIVE mode</strong>. The scheduler will
              place real market orders through your broker whenever a new congressional
              disclosure appears. STOCK Act filings can be up to 45 days old — you may
              be copying trades that are already fully priced in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="bg-surface-lowest p-3 border border-destructive/20 rounded-sm">
              <p className="text-2xs font-bold uppercase text-foreground mb-2">Order parameters:</p>
              <div className="grid grid-cols-2 gap-y-1.5 text-2xs font-mono">
                <span className="text-muted-foreground">Copy amount</span>
                <span className="text-foreground font-bold">
                  {formatCurrency(parseFloat(copyAmount) || 0)} / trade
                </span>
                <span className="text-muted-foreground">Politician</span>
                <span className="text-foreground font-bold truncate">
                  {selectedPolitician === "auto"
                    ? "Auto-ranked"
                    : rankings.find((r) => r.politician_id === selectedPolitician)
                        ?.politician_name ?? selectedPolitician}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 mt-4">
              <input
                id="live-ct-confirm"
                type="checkbox"
                checked={liveConfirmed}
                onChange={(e) => setLiveConfirmed(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <label
                htmlFor="live-ct-confirm"
                className="text-2xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                I understand this will place real market orders and accept full
                responsibility for any trades executed.
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
              onClick={confirmLiveActivate}
              disabled={!liveConfirmed || isCreating}
              className="text-xs font-bold uppercase"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Activate Live"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify the page compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "copy-trading\|error" | head -20
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/copy-trading/page.tsx
git commit -m "feat: copy trading frontend page — rankings + session form + trade history"
```

---

## Task 12: Sidebar, Middleware, and Final Wiring

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`
- Modify: `frontend/proxy.ts`

- [ ] **Step 1: Add nav link to Sidebar.tsx**

In `frontend/components/layout/Sidebar.tsx`, find the import block and add `Copy` to the lucide-react imports (or use `Users` which is already imported).

Find the Terminal nav group in `NAV_GROUPS`:
```typescript
{ href: "/trailing-bot", label: "Trail Bot", icon: TrendingDown },
```

Add the copy trading link immediately after it:
```typescript
{ href: "/copy-trading", label: "Copy Trade", icon: Users },
```

If `Users` is not already imported, add it to the lucide-react import line.

- [ ] **Step 2: Add /copy-trading to PROTECTED_PREFIXES in proxy.ts**

In `frontend/proxy.ts`, find:
```typescript
  "/trailing-bot",
```

Add after it:
```typescript
  "/copy-trading",
```

- [ ] **Step 3: Verify build compiles**

```bash
cd frontend && npm run build 2>&1 | tail -30
```
Expected: build succeeds with no errors on copy-trading related files

- [ ] **Step 4: Run all backend tests**

```bash
cd backend && python -m pytest tests/v6/ -v 2>&1 | tail -30
```
Expected: all tests `PASSED`

- [ ] **Step 5: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx frontend/proxy.ts
git commit -m "feat: add copy-trading to sidebar nav + middleware protection"
```

---

## Self-Review

**Spec coverage check:**
- [x] Multi-user sessions scoped to `user_id` — CopyTradingSession + all queries filter by user
- [x] Shared rankings — `GET /rankings` uses cached Quiver data, not per-user
- [x] User pins politician or uses auto-rank — `target_politician_id` nullable
- [x] Scheduler-driven (15 min) — `copy_trading_monitor` in jobs.py
- [x] Sessions model with history — CopyTradingSession + status lifecycle
- [x] Startup seeding — `_seed_existing_trades()` called in `create_session()`
- [x] Sell-position check — `_should_skip_sell()` tested and used in `_execute_stock_trade()`
- [x] Options fallback to underlying stock — `_execute_options_trade()` fallback path
- [x] Dry-run default + live confirmation dialog — frontend + service both enforce
- [x] `(user_id, trade_id)` unique constraint — in migration + ORM `__table_args__`
- [x] `gc.collect()` in scheduler finally — copy_trading_monitor.py
- [x] Single `AsyncSessionLocal` outside loop — monitor calls `process_active_sessions(db)` with one session
- [x] `DELETE` returns `Response(status_code=204)` not in decorator — router cancel_session
- [x] All list endpoints bounded `le=200` — all Query params set
- [x] Broker credentials never returned in API responses — only used in service layer
- [x] V3 wording in frontend — "historically favorable performance", "past results do not guarantee"
- [x] `/copy-trading` in PROTECTED_PREFIXES — proxy.ts Task 12
- [x] Sidebar nav link — Sidebar.tsx Task 12

**Placeholder scan:** No TBDs, TODOs, or incomplete steps.

**Type consistency:**
- `PoliticianTrade` defined in `politician_scraper_service.py`, used in `politician_ranker_service.py` and `copy_trading_service.py` ✓
- `PoliticianScore` defined in `politician_ranker_service.py`, used in `copy_trading_service.py` ✓
- `CopyTradingSession` / `CopiedPoliticianTrade` defined in `models/copy_trading.py`, imported in service and router ✓
- `CopyTradingSessionOut.from_orm()` / `CopiedTradeOut.from_orm()` used consistently in router ✓
- `copyTradingApi` methods match API routes exactly ✓
- TypeScript interfaces match Pydantic schemas ✓
