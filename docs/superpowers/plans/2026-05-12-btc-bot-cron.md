# BTC Trailing-Stop Bot — Scheduled Cron + Web History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the standalone `btc-bot/` CLI scripts (BTC/USD trailing-stop strategy with 3-level DCA ladder) into a multi-tenant, DB-backed, APScheduler-driven web feature visible on `/crons` with full history on `/btc-bot`.

**Architecture:** Service-layer split — a pure decision function `evaluate_tick(...) -> TickAction` with no I/O, driven by a thin orchestrator that loads state, calls Alpaca through a small wrapper, and persists the result. Two new tables (`btc_bot_sessions` + sparse `btc_bot_actions` audit log) scoped by `user_id`. One new entry in `JOB_TEMPLATES` so `/crons` picks it up automatically.

**Tech Stack:** FastAPI · SQLAlchemy 2 async · Alembic · Pydantic v2 · APScheduler · `alpaca-py` (already in requirements) · Next.js 14 App Router · TypeScript · shadcn/ui · TanStack Query

**Related design:** `docs/superpowers/specs/2026-05-12-btc-bot-cron-design.md`

---

## Credentials

Already in `backend/.env` (from prior CLI usage):

```env
VISANU_ALPACA_API_KEY=...
VISANU_ALPACA_SECRET_KEY=...
```

New env vars introduced by this plan (defaults in code, override in `.env` if desired):

```env
BTC_BOT_INITIAL_USD=10000
BTC_BOT_COOLDOWN_MINUTES=240
BTC_BOT_MONITOR_MINUTES=15
BTC_BOT_BOOTSTRAP_USER_EMAIL=mvisanu@gmail.com
```

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `backend/app/models/btc_bot.py` | `BtcBotSession` + `BtcBotAction` ORM |
| Create | `backend/app/schemas/btc_bot.py` | Pydantic DTOs |
| Create | `backend/app/services/btc_bot_service.py` | Pure decision function |
| Create | `backend/app/broker/btc_bot_client.py` | Thin `alpaca-py` wrapper |
| Create | `backend/app/api/btc_bot.py` | FastAPI router @ `/api/v1/btc-bot` |
| Create | `backend/app/scheduler/tasks/btc_bot_monitor.py` | APScheduler orchestrator |
| Create | `backend/alembic/versions/v9_btc_bot.py` | DB migration |
| Create | `backend/tests/v9/__init__.py` | Empty |
| Create | `backend/tests/v9/conftest.py` | Test fixtures |
| Create | `backend/tests/v9/test_btc_bot_service.py` | Pure decision tests |
| Create | `backend/tests/v9/test_btc_bot_monitor.py` | Orchestrator integration |
| Create | `backend/tests/v9/test_btc_bot_api.py` | API endpoint tests |
| Create | `frontend/lib/btc-bot-api.ts` | Typed fetch wrappers |
| Create | `frontend/app/btc-bot/page.tsx` | Dashboard page |
| Modify | `backend/app/models/__init__.py` | Import new models |
| Modify | `backend/app/core/config.py` | 4 new Settings fields |
| Modify | `backend/app/scheduler/jobs.py` | `JOB_TEMPLATES` + `register_jobs` |
| Modify | `backend/app/main.py` | Mount `btc_bot` router |
| Modify | `frontend/components/layout/Sidebar.tsx` | Add `/btc-bot` link |
| Modify | `CLAUDE.md` | V9 entry + Test Suite line + section |

---

## Task 1: Config Additions

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add new fields to `Settings` class**

Open `backend/app/core/config.py`. Find a logical grouping near the existing bot-related settings (search for `wheel_alpaca_api_key`). Add this block after the last commodity/wheel setting and before any closing classes:

```python
    # ── BTC Trailing-Stop Bot (V9) ────────────────────────────────────────────
    btc_bot_initial_usd: float = Field(
        default=10000.0,
        description="Default initial buy size (USD) for a new btc-bot session.",
    )
    btc_bot_cooldown_minutes: int = Field(
        default=240,
        description="Minutes to wait after FLOOR stop-out before auto re-entering.",
    )
    btc_bot_monitor_minutes: int = Field(
        default=15,
        description="APScheduler interval for btc_bot_monitor (minutes).",
    )
    btc_bot_bootstrap_user_email: str = Field(
        default="",
        description=(
            "Only the user whose email matches this value receives the env-var Alpaca "
            "credential fallback. All other users must save their own BrokerCredential."
        ),
    )
    visanu_alpaca_api_key: str = Field(
        default="",
        description="Personal Alpaca paper API key for the bootstrap user (env-var fallback).",
    )
    visanu_alpaca_secret_key: str = Field(
        default="",
        description="Personal Alpaca paper secret key for the bootstrap user (env-var fallback).",
    )
```

- [ ] **Step 2: Verify import works**

Run: `cd backend && python -c "from app.core.config import settings; print(settings.btc_bot_monitor_minutes, settings.btc_bot_cooldown_minutes)"`
Expected: `15 240`

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/config.py
git commit -m "config: add btc-bot settings (V9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/v9_btc_bot.py`

- [ ] **Step 1: Write the migration file**

Create `backend/alembic/versions/v9_btc_bot.py` with this exact content:

```python
"""v9 btc_bot_sessions + btc_bot_actions tables

Revision ID: v9_btc_bot
Revises: v8_user_pins
Create Date: 2026-05-12
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v9_btc_bot"
down_revision = "v8_user_pins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "btc_bot_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "credential_id",
            sa.Integer(),
            sa.ForeignKey("broker_credentials.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("original_entry_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("blended_entry_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("total_qty", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("initial_buy_usd", sa.Numeric(18, 2), nullable=False, server_default="10000"),
        sa.Column("current_floor", sa.Numeric(18, 2), nullable=True),
        sa.Column("trailing_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("trailing_high", sa.Numeric(18, 2), nullable=True),
        sa.Column("ladder_next", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("realized_pnl", sa.Numeric(18, 2), nullable=True),
        sa.Column("last_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_btc_bot_sessions_user_id",
        "btc_bot_sessions",
        ["user_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_btc_bot_sessions_user_status",
        "btc_bot_sessions",
        ["user_id", "status"],
        if_not_exists=True,
    )
    # Partial unique: a user can never have two simultaneously-live sessions.
    op.create_index(
        "uq_btc_bot_sessions_user_active",
        "btc_bot_sessions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('active','cooldown')"),
        if_not_exists=True,
    )

    op.create_table(
        "btc_bot_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("btc_bot_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("btc_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("qty_delta", sa.Numeric(20, 8), nullable=True),
        sa.Column("usd_delta", sa.Numeric(18, 2), nullable=True),
        sa.Column("floor_before", sa.Numeric(18, 2), nullable=True),
        sa.Column("floor_after", sa.Numeric(18, 2), nullable=True),
        sa.Column("alpaca_order_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_btc_bot_actions_session_id",
        "btc_bot_actions",
        ["session_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_btc_bot_actions_user_created",
        "btc_bot_actions",
        ["user_id", "created_at"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_btc_bot_actions_user_created", table_name="btc_bot_actions", if_exists=True)
    op.drop_index("ix_btc_bot_actions_session_id", table_name="btc_bot_actions", if_exists=True)
    op.drop_table("btc_bot_actions")
    op.drop_index("uq_btc_bot_sessions_user_active", table_name="btc_bot_sessions", if_exists=True)
    op.drop_index("ix_btc_bot_sessions_user_status", table_name="btc_bot_sessions", if_exists=True)
    op.drop_index("ix_btc_bot_sessions_user_id", table_name="btc_bot_sessions", if_exists=True)
    op.drop_table("btc_bot_sessions")
```

- [ ] **Step 2: Run the migration locally**

Make sure docker postgres is up (`docker compose up -d`), then:

Run: `cd backend && alembic upgrade head`
Expected: `INFO  [alembic.runtime.migration] Running upgrade v8_user_pins -> v9_btc_bot, v9 btc_bot_sessions + btc_bot_actions tables`

- [ ] **Step 3: Verify the schema with psql**

Run: `docker exec -it $(docker ps -qf "ancestor=postgres:15") psql -U nextgen -d nextgenstock -c "\d btc_bot_sessions"`
Expected: table exists with all columns + the three indexes (`ix_btc_bot_sessions_user_id`, `ix_btc_bot_sessions_user_status`, `uq_btc_bot_sessions_user_active`).

Then: `docker exec -it $(docker ps -qf "ancestor=postgres:15") psql -U nextgen -d nextgenstock -c "\d btc_bot_actions"`
Expected: table exists with `ix_btc_bot_actions_session_id` and `ix_btc_bot_actions_user_created`.

- [ ] **Step 4: Verify downgrade works (then re-upgrade)**

Run: `cd backend && alembic downgrade v8_user_pins && alembic upgrade head`
Expected: both tables dropped, then recreated, no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/v9_btc_bot.py
git commit -m "db: v9 btc_bot_sessions + btc_bot_actions migration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ORM Models

**Files:**
- Create: `backend/app/models/btc_bot.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/v9/__init__.py`, `backend/tests/v9/test_btc_bot_model.py`

- [ ] **Step 1: Create the test directory and empty `__init__.py`**

Run: `mkdir -p backend/tests/v9 && touch backend/tests/v9/__init__.py`

- [ ] **Step 2: Write the failing model test**

Create `backend/tests/v9/test_btc_bot_model.py`:

```python
from decimal import Decimal

from app.models.btc_bot import BtcBotAction, BtcBotSession


def test_btc_bot_session_defaults():
    """BtcBotSession must initialise with the documented defaults."""
    session = BtcBotSession(user_id=1)
    assert session.status == "active"
    assert session.total_qty == Decimal("0") or session.total_qty == 0
    assert session.initial_buy_usd in (Decimal("10000"), 10000, 10000.0)
    assert session.trailing_active is False
    assert session.ladder_next == 0


def test_btc_bot_session_has_required_fields():
    """All columns the decision engine touches must be settable."""
    session = BtcBotSession(
        user_id=1,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("92000.00"),
        total_qty=Decimal("0.10000000"),
        current_floor=Decimal("82800.00"),
        trailing_active=True,
        trailing_high=Decimal("100000.00"),
        ladder_next=1,
    )
    assert session.original_entry_price == Decimal("94000.00")
    assert session.trailing_active is True
    assert session.ladder_next == 1


def test_btc_bot_action_required_fields():
    """BtcBotAction needs session_id + user_id + action + created_at default."""
    action = BtcBotAction(
        session_id=1,
        user_id=1,
        action="initial_buy",
        btc_price=Decimal("94000.00"),
        qty_delta=Decimal("0.10000000"),
        usd_delta=Decimal("10000.00"),
        alpaca_order_id="abc-123",
    )
    assert action.action == "initial_buy"
    assert action.btc_price == Decimal("94000.00")
    assert action.qty_delta == Decimal("0.10000000")
```

- [ ] **Step 3: Run the test — expect ImportError**

Run: `cd backend && pytest tests/v9/test_btc_bot_model.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.btc_bot'`.

- [ ] **Step 4: Create the model file**

Create `backend/app/models/btc_bot.py`:

```python
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BtcBotSession(Base):
    __tablename__ = "btc_bot_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("broker_credentials.id", ondelete="SET NULL"), nullable=True
    )

    # active | cooldown | ended | error
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    original_entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    blended_entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    total_qty: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=Decimal("0"), nullable=False)
    initial_buy_usd: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), default=Decimal("10000"), nullable=False
    )
    current_floor: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    trailing_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trailing_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    ladder_next: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cooldown_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    realized_pnl: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    last_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class BtcBotAction(Base):
    __tablename__ = "btc_bot_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("btc_bot_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)

    btc_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    qty_delta: Mapped[Optional[Decimal]] = mapped_column(Numeric(20, 8), nullable=True)
    usd_delta: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    floor_before: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    floor_after: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    alpaca_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

- [ ] **Step 5: Wire into `models/__init__.py`**

Open `backend/app/models/__init__.py`. Add the import alongside existing models (the file already imports `WheelBotSession`, etc.):

```python
from app.models.btc_bot import BtcBotAction, BtcBotSession  # noqa: F401
```

- [ ] **Step 6: Run the model test — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_model.py -v`
Expected: `3 passed`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/btc_bot.py backend/app/models/__init__.py backend/tests/v9/
git commit -m "models: BtcBotSession + BtcBotAction ORM (V9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/btc_bot.py`
- Test: `backend/tests/v9/test_btc_bot_schemas.py`

- [ ] **Step 1: Write the failing schema test**

Create `backend/tests/v9/test_btc_bot_schemas.py`:

```python
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.btc_bot import (
    BtcBotActionResponse,
    BtcBotSessionCreateRequest,
    BtcBotSessionResponse,
)


def test_session_create_request_defaults():
    """initial_buy_usd is optional and defaults to None (service picks env default)."""
    req = BtcBotSessionCreateRequest()
    assert req.initial_buy_usd is None


def test_session_create_request_rejects_zero():
    """Initial buy USD must be positive when supplied."""
    with pytest.raises(ValidationError):
        BtcBotSessionCreateRequest(initial_buy_usd=0)


def test_session_response_round_trip():
    """BtcBotSessionResponse parses Decimal + datetime correctly."""
    resp = BtcBotSessionResponse(
        id=1,
        user_id=42,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("92000.00"),
        total_qty=Decimal("0.10000000"),
        initial_buy_usd=Decimal("10000.00"),
        current_floor=Decimal("82800.00"),
        trailing_active=False,
        trailing_high=None,
        ladder_next=0,
        cooldown_until=None,
        realized_pnl=None,
        last_action_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=None,
        ended_at=None,
    )
    assert resp.status == "active"
    assert resp.current_floor == Decimal("82800.00")


def test_action_response_round_trip():
    resp = BtcBotActionResponse(
        id=1,
        session_id=1,
        user_id=42,
        action="initial_buy",
        btc_price=Decimal("94000.00"),
        qty_delta=Decimal("0.10000000"),
        usd_delta=Decimal("10000.00"),
        floor_before=None,
        floor_after=Decimal("84600.00"),
        alpaca_order_id="abc",
        notes=None,
        created_at=datetime.now(timezone.utc),
    )
    assert resp.action == "initial_buy"
    assert resp.qty_delta == Decimal("0.10000000")
```

- [ ] **Step 2: Run — expect ImportError**

Run: `cd backend && pytest tests/v9/test_btc_bot_schemas.py -v`
Expected: FAIL — `app.schemas.btc_bot` does not exist.

- [ ] **Step 3: Create the schemas**

Create `backend/app/schemas/btc_bot.py`:

```python
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class BtcBotSessionCreateRequest(BaseModel):
    initial_buy_usd: Optional[Decimal] = Field(
        default=None,
        gt=0,
        description="Override default initial buy size. Falls back to BTC_BOT_INITIAL_USD env when omitted.",
    )


class BtcBotSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    status: str
    original_entry_price: Optional[Decimal]
    blended_entry_price: Optional[Decimal]
    total_qty: Decimal
    initial_buy_usd: Decimal
    current_floor: Optional[Decimal]
    trailing_active: bool
    trailing_high: Optional[Decimal]
    ladder_next: int
    cooldown_until: Optional[datetime]
    realized_pnl: Optional[Decimal]
    last_action_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    ended_at: Optional[datetime]


class BtcBotActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    user_id: int
    action: str
    btc_price: Optional[Decimal]
    qty_delta: Optional[Decimal]
    usd_delta: Optional[Decimal]
    floor_before: Optional[Decimal]
    floor_after: Optional[Decimal]
    alpaca_order_id: Optional[str]
    notes: Optional[str]
    created_at: datetime


class BtcBotSessionDetailResponse(BaseModel):
    """Session row with its full action history."""

    session: BtcBotSessionResponse
    actions: list[BtcBotActionResponse]
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_schemas.py -v`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/btc_bot.py backend/tests/v9/test_btc_bot_schemas.py
git commit -m "schemas: btc-bot Pydantic DTOs (V9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Decision Service — Skeleton + Terminal Branches

**Files:**
- Create: `backend/app/services/btc_bot_service.py`
- Test: `backend/tests/v9/test_btc_bot_service.py`

- [ ] **Step 1: Write the first failing test**

Create `backend/tests/v9/test_btc_bot_service.py` with the initial cases (terminal + cooldown):

```python
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.services.btc_bot_service import (
    AdoptPosition,
    AdvanceTrailing,
    ExitCooldown,
    Idle,
    InitialBuy,
    LadderBuy,
    SessionState,
    StopOut,
    evaluate_tick,
)


def _now() -> datetime:
    return datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)


def _state(**kwargs) -> SessionState:
    """Build a SessionState with sensible defaults; override per-test."""
    defaults = dict(
        status="active",
        original_entry=Decimal("94000.00"),
        blended_entry=Decimal("94000.00"),
        total_qty=Decimal("0.10000000"),
        current_floor=Decimal("84600.00"),
        trailing_active=False,
        trailing_high=None,
        ladder_next=0,
        cooldown_until=None,
    )
    defaults.update(kwargs)
    return SessionState(**defaults)


def test_ended_session_is_idle():
    state = _state(status="ended", original_entry=None, blended_entry=None,
                   total_qty=Decimal("0"), current_floor=None)
    action = evaluate_tick(
        state, Decimal("95000"), Decimal("0"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, Idle)


def test_cooldown_not_expired_is_idle():
    state = _state(
        status="cooldown",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
        cooldown_until=_now() + timedelta(hours=2),
    )
    action = evaluate_tick(
        state, Decimal("95000"), Decimal("0"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, Idle)
    assert "cooldown" in action.reason.lower()


def test_cooldown_expired_returns_exit():
    state = _state(
        status="cooldown",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
        cooldown_until=_now() - timedelta(minutes=1),
    )
    action = evaluate_tick(
        state, Decimal("95000"), Decimal("0"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, ExitCooldown)
```

- [ ] **Step 2: Run — expect ImportError**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: FAIL — `app.services.btc_bot_service` does not exist.

- [ ] **Step 3: Create the service skeleton with terminal branches only**

Create `backend/app/services/btc_bot_service.py`:

```python
"""
BTC trailing-stop bot — pure decision service (V9).

This module is the testable heart of the bot. It has ZERO I/O — no Alpaca calls,
no DB writes — and is driven by the orchestrator in
`scheduler/tasks/btc_bot_monitor.py`.

The single public entry point is `evaluate_tick(...) -> TickAction`. The orchestrator
hands it a snapshot of session state + the latest market data, and gets back
exactly one action describing what should happen this tick.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal, Union

# ── Strategy constants ───────────────────────────────────────────────────────
# Drops measured against the *original* entry price (not blended), per BTC_BOT.md.
LADDER_DROPS: tuple[Decimal, Decimal, Decimal] = (
    Decimal("0.20"),
    Decimal("0.30"),
    Decimal("0.40"),
)
LADDER_USD: tuple[Decimal, Decimal, Decimal] = (
    Decimal("10000"),
    Decimal("15000"),
    Decimal("20000"),
)
TRAILING_ACTIVATION_GAIN = Decimal("0.10")  # +10%
TRAILING_STEP = Decimal("0.05")              # +5% steps
TRAILING_FLOOR_MULT = Decimal("0.95")        # 5% below current price
FLOOR_MULT = Decimal("0.90")                 # 10% below blended entry


# ── TickAction dataclasses ──────────────────────────────────────────────────

@dataclass(frozen=True)
class Idle:
    reason: str


@dataclass(frozen=True)
class InitialBuy:
    usd_amount: Decimal


@dataclass(frozen=True)
class LadderBuy:
    level: int  # 1, 2, or 3
    usd_amount: Decimal


@dataclass(frozen=True)
class AdvanceTrailing:
    new_floor: Decimal
    new_trailing_high: Decimal
    activated_now: bool


@dataclass(frozen=True)
class StopOut:
    reason: str


@dataclass(frozen=True)
class ExitCooldown:
    pass


@dataclass(frozen=True)
class AdoptPosition:
    avg_entry: Decimal
    qty: Decimal


TickAction = Union[
    Idle, InitialBuy, LadderBuy, AdvanceTrailing, StopOut, ExitCooldown, AdoptPosition
]


# ── SessionState input ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class SessionState:
    status: Literal["active", "cooldown", "ended", "no_session"]
    original_entry: Decimal | None
    blended_entry: Decimal | None
    total_qty: Decimal
    current_floor: Decimal | None
    trailing_active: bool
    trailing_high: Decimal | None
    ladder_next: int  # 0..3
    cooldown_until: datetime | None


# ── Decision function (filled out incrementally in later tasks) ─────────────

def evaluate_tick(
    session: SessionState,
    current_price: Decimal,
    alpaca_position_qty: Decimal,
    alpaca_avg_entry: Decimal | None,
    initial_buy_usd: Decimal,
    now_utc: datetime,
) -> TickAction:
    """Pure decision. See module docstring for behaviour."""
    # 1. Terminal — session ended (no work)
    if session.status == "ended":
        return Idle("session ended")

    # 2. Cooldown — idle until cooldown_until, then ExitCooldown
    if session.status == "cooldown":
        if session.cooldown_until is None or now_utc < session.cooldown_until:
            remaining = "?"
            if session.cooldown_until is not None:
                delta = session.cooldown_until - now_utc
                remaining = f"{int(delta.total_seconds() // 60)}m"
            return Idle(f"cooldown — {remaining} left")
        return ExitCooldown()

    # Remaining branches added in subsequent tasks.
    return Idle("not implemented yet")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/btc_bot_service.py backend/tests/v9/test_btc_bot_service.py
git commit -m "services(btc-bot): pure decision service skeleton + terminal branches

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Decision Service — `no_session` Branch (Initial Buy + Adopt)

**Files:**
- Modify: `backend/app/services/btc_bot_service.py`
- Modify: `backend/tests/v9/test_btc_bot_service.py`

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_service.py`:

```python
def test_no_session_flat_account_returns_initial_buy():
    state = _state(
        status="no_session",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
    )
    action = evaluate_tick(
        state,
        current_price=Decimal("95000"),
        alpaca_position_qty=Decimal("0"),
        alpaca_avg_entry=None,
        initial_buy_usd=Decimal("10000"),
        now_utc=_now(),
    )
    assert isinstance(action, InitialBuy)
    assert action.usd_amount == Decimal("10000")


def test_no_session_with_open_position_returns_adopt():
    state = _state(
        status="no_session",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
    )
    action = evaluate_tick(
        state,
        current_price=Decimal("95000"),
        alpaca_position_qty=Decimal("0.10000000"),
        alpaca_avg_entry=Decimal("94000"),
        initial_buy_usd=Decimal("10000"),
        now_utc=_now(),
    )
    assert isinstance(action, AdoptPosition)
    assert action.avg_entry == Decimal("94000")
    assert action.qty == Decimal("0.10000000")
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: 2 new tests FAIL — current code returns `Idle("not implemented yet")` for `no_session`.

- [ ] **Step 3: Implement the `no_session` branch**

In `backend/app/services/btc_bot_service.py`, replace the trailing `return Idle("not implemented yet")` with:

```python
    # 3. No session in DB
    if session.status == "no_session":
        if alpaca_position_qty > 0 and alpaca_avg_entry is not None:
            return AdoptPosition(avg_entry=alpaca_avg_entry, qty=alpaca_position_qty)
        return InitialBuy(usd_amount=initial_buy_usd)

    # 4. status == "active" — main monitoring branch (filled in next tasks).
    return Idle("not implemented yet")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/btc_bot_service.py backend/tests/v9/test_btc_bot_service.py
git commit -m "services(btc-bot): no_session branch — initial buy + adopt position

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Decision Service — FLOOR Check

**Files:**
- Modify: `backend/app/services/btc_bot_service.py`
- Modify: `backend/tests/v9/test_btc_bot_service.py`

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_service.py`:

```python
def test_active_floor_breach_returns_stop_out():
    state = _state(current_floor=Decimal("85000"))
    action = evaluate_tick(
        state, Decimal("84999.99"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, StopOut)


def test_active_floor_equal_returns_stop_out():
    """Boundary: price == floor must also trigger StopOut (≤ semantics)."""
    state = _state(current_floor=Decimal("85000"))
    action = evaluate_tick(
        state, Decimal("85000.00"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, StopOut)


def test_active_floor_above_price_no_stop_out():
    state = _state(current_floor=Decimal("85000"))
    action = evaluate_tick(
        state, Decimal("85000.01"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, StopOut)
```

- [ ] **Step 2: Run — expect FAIL on stop-out tests**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: 2 FAIL (the stop-out cases), 1 PASS (the no-stop-out case still returns the placeholder Idle which passes the assertion).

- [ ] **Step 3: Add the FLOOR check at the top of the active branch**

In `btc_bot_service.py`, replace:

```python
    # 4. status == "active" — main monitoring branch (filled in next tasks).
    return Idle("not implemented yet")
```

with:

```python
    # 4. status == "active" — main monitoring branch
    if session.current_floor is None or session.blended_entry is None or session.original_entry is None:
        # Defensive: orchestrator should never hand us this; treat as Idle.
        return Idle("active session missing required state")

    # 4a. FLOOR check first — safety override (wins over ladder, trailing, everything).
    if current_price <= session.current_floor:
        gain = (current_price / session.blended_entry - Decimal("1")) * Decimal("100")
        return StopOut(
            reason=f"FLOOR @ ${current_price:.2f} ({gain:+.2f}% from blended ${session.blended_entry:.2f})"
        )

    # Remaining checks (ladder, trailing) added in subsequent tasks.
    return Idle("active — no rule fired yet")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/btc_bot_service.py backend/tests/v9/test_btc_bot_service.py
git commit -m "services(btc-bot): FLOOR check — safety override on active branch

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Decision Service — Ladder Logic

**Files:**
- Modify: `backend/app/services/btc_bot_service.py`
- Modify: `backend/tests/v9/test_btc_bot_service.py`

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_service.py`:

```python
def test_ladder_l1_fires_at_minus_20pct_from_original():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("90000"),
        ladder_next=0,
    )
    # -20% of 100000 = 80000
    action = evaluate_tick(
        state, Decimal("80000"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, LadderBuy)
    assert action.level == 1
    assert action.usd_amount == Decimal("10000")


def test_ladder_l2_fires_after_l1_at_minus_30pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("90000"),
        current_floor=Decimal("65000"),  # below price so FLOOR doesn't fire
        ladder_next=1,
    )
    action = evaluate_tick(
        state, Decimal("70000"), Decimal("0.20"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, LadderBuy)
    assert action.level == 2
    assert action.usd_amount == Decimal("15000")


def test_ladder_l3_fires_after_l2_at_minus_40pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("80000"),
        current_floor=Decimal("55000"),
        ladder_next=2,
    )
    action = evaluate_tick(
        state, Decimal("60000"), Decimal("0.30"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, LadderBuy)
    assert action.level == 3
    assert action.usd_amount == Decimal("20000")


def test_already_fired_ladder_does_not_refire():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("90000"),
        current_floor=Decimal("80000"),
        ladder_next=1,  # L1 already fired
    )
    # Price is at -20% but L1 already counted — don't re-fire L1.
    action = evaluate_tick(
        state, Decimal("80500"), Decimal("0.20"), None, Decimal("10000"), _now()
    )
    # Not a LadderBuy(level=1). Either Idle or trailing — but never LadderBuy(level=1).
    if isinstance(action, LadderBuy):
        assert action.level != 1


def test_all_ladders_fired_no_more_fire():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("75000"),
        current_floor=Decimal("50000"),
        ladder_next=3,
    )
    action = evaluate_tick(
        state, Decimal("55000"), Decimal("0.50"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, LadderBuy)


def test_floor_wins_over_ladder_when_both_triggered_same_tick():
    """If FLOOR is breached AND a ladder trigger is hit, StopOut wins."""
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("85000"),  # 15% below entry
        ladder_next=0,
    )
    # Price 70000 is below floor 85000 AND below ladder-L1 trigger 80000
    action = evaluate_tick(
        state, Decimal("70000"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, StopOut)
```

- [ ] **Step 2: Run — expect FAILs**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: ladder tests FAIL (they get `Idle("active — no rule fired yet")` instead of `LadderBuy`). The floor-wins test PASSes (FLOOR check is already first).

- [ ] **Step 3: Add the ladder branch**

In `btc_bot_service.py`, replace `return Idle("active — no rule fired yet")` with:

```python
    # 4b. Ladder check — triggers compare to ORIGINAL entry, never blended.
    if session.ladder_next < 3:
        drop = LADDER_DROPS[session.ladder_next]
        trigger = session.original_entry * (Decimal("1") - drop)
        if current_price <= trigger:
            level = session.ladder_next + 1
            return LadderBuy(level=level, usd_amount=LADDER_USD[session.ladder_next])

    # Trailing checks added in next task.
    return Idle("active — no rule fired yet")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: `14 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/btc_bot_service.py backend/tests/v9/test_btc_bot_service.py
git commit -m "services(btc-bot): ladder rule — 3-level DCA on original-entry drops

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Decision Service — Trailing Floor Logic

**Files:**
- Modify: `backend/app/services/btc_bot_service.py`
- Modify: `backend/tests/v9/test_btc_bot_service.py`

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_service.py`:

```python
def test_trailing_activates_at_plus_10pct_gain():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("90000"),
        trailing_active=False,
    )
    # +10% gain = 110000 -> new floor = 110000 * 0.95 = 104500
    action = evaluate_tick(
        state, Decimal("110000"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, AdvanceTrailing)
    assert action.activated_now is True
    assert action.new_floor == Decimal("104500.00")
    assert action.new_trailing_high == Decimal("110000")


def test_trailing_does_not_activate_below_10pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("90000"),
        trailing_active=False,
    )
    action = evaluate_tick(
        state, Decimal("109999"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, AdvanceTrailing)


def test_trailing_step_advances_every_5pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("104500"),
        trailing_active=True,
        trailing_high=Decimal("110000"),
    )
    # +5% from trailing_high 110000 = 115500 -> new_floor = 115500 * 0.95 = 109725
    action = evaluate_tick(
        state, Decimal("115500"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, AdvanceTrailing)
    assert action.activated_now is False
    assert action.new_floor == Decimal("109725.00")
    assert action.new_trailing_high == Decimal("115500")


def test_trailing_step_does_not_fire_below_5pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("104500"),
        trailing_active=True,
        trailing_high=Decimal("110000"),
    )
    # Only +4% — too small
    action = evaluate_tick(
        state, Decimal("114400"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, AdvanceTrailing)


def test_trailing_floor_is_up_only():
    """If proposed new_floor <= current_floor, do not advance."""
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("120000"),   # very high prior floor
        trailing_active=True,
        trailing_high=Decimal("125000"),
    )
    # Price up +5% from trailing_high to 131250 -> proposed new floor = 124687.50
    # But current_floor = 120000 < 124687.50 — actually this WOULD raise.
    # Construct a case where it would NOT raise:
    state2 = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("130000"),   # floor already > would-be new_floor
        trailing_active=True,
        trailing_high=Decimal("125000"),
    )
    action = evaluate_tick(
        state2, Decimal("131250"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, AdvanceTrailing)
```

- [ ] **Step 2: Run — expect FAILs on trailing tests**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: trailing tests FAIL (currently return `Idle`).

- [ ] **Step 3: Add the trailing branch**

In `btc_bot_service.py`, replace the trailing `return Idle("active — no rule fired yet")` with:

```python
    # 4c. Trailing floor — activation + step advances. Up-only.
    if not session.trailing_active:
        gain = current_price / session.blended_entry - Decimal("1")
        if gain >= TRAILING_ACTIVATION_GAIN:
            proposed = (current_price * TRAILING_FLOOR_MULT).quantize(Decimal("0.01"))
            if proposed > session.current_floor:
                return AdvanceTrailing(
                    new_floor=proposed,
                    new_trailing_high=current_price,
                    activated_now=True,
                )
    else:
        # trailing_active == True
        if (
            session.trailing_high is not None
            and current_price > session.trailing_high
        ):
            step = current_price / session.trailing_high - Decimal("1")
            if step >= TRAILING_STEP:
                proposed = (current_price * TRAILING_FLOOR_MULT).quantize(Decimal("0.01"))
                if proposed > session.current_floor:
                    return AdvanceTrailing(
                        new_floor=proposed,
                        new_trailing_high=current_price,
                        activated_now=False,
                    )

    # 4d. Nothing fired — pure idle with diagnostic reason.
    gain_pct = (current_price / session.blended_entry - Decimal("1")) * Decimal("100")
    return Idle(
        f"price=${current_price:.2f} gain={gain_pct:+.2f}% floor=${session.current_floor:.2f}"
    )
```

Also delete the now-unreachable `return Idle("active — no rule fired yet")` line at the bottom of the function (it's replaced by 4d above).

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: `19 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/btc_bot_service.py backend/tests/v9/test_btc_bot_service.py
git commit -m "services(btc-bot): trailing floor — activation + 5%-step advance (up-only)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Decision Service — Idle Default + Helper Functions

**Files:**
- Modify: `backend/app/services/btc_bot_service.py`
- Modify: `backend/tests/v9/test_btc_bot_service.py`

The Idle default is already in place from Task 9. This task adds two helper functions used by the orchestrator and a test asserting they exist.

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_service.py`:

```python
def test_compute_blended_entry():
    """Helper used by orchestrator when a ladder buy fills."""
    from app.services.btc_bot_service import compute_blended_entry

    new_blended = compute_blended_entry(
        prior_qty=Decimal("0.10"),
        prior_blended=Decimal("100000"),
        fill_qty=Decimal("0.15"),
        fill_price=Decimal("80000"),
    )
    # (0.10 * 100000 + 0.15 * 80000) / 0.25 = 22000 / 0.25 = 88000
    assert new_blended == Decimal("88000.00")


def test_compute_new_floor_up_only():
    """Helper returns max(existing_floor, proposed_floor)."""
    from app.services.btc_bot_service import compute_new_floor_up_only

    assert compute_new_floor_up_only(Decimal("90000"), Decimal("95000")) == Decimal("95000")
    assert compute_new_floor_up_only(Decimal("95000"), Decimal("90000")) == Decimal("95000")
    # None existing floor → take proposed
    assert compute_new_floor_up_only(None, Decimal("85000")) == Decimal("85000")
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: 2 FAILs — helpers don't exist.

- [ ] **Step 3: Add the helpers**

Append to `backend/app/services/btc_bot_service.py`:

```python
# ── Helpers for orchestrator (also pure) ────────────────────────────────────

def compute_blended_entry(
    prior_qty: Decimal,
    prior_blended: Decimal,
    fill_qty: Decimal,
    fill_price: Decimal,
) -> Decimal:
    """Weighted-average entry after a buy fills. Rounds to 2dp."""
    total_cost = prior_qty * prior_blended + fill_qty * fill_price
    total_qty = prior_qty + fill_qty
    if total_qty == 0:
        return Decimal("0.00")
    return (total_cost / total_qty).quantize(Decimal("0.01"))


def compute_new_floor_up_only(
    existing: Decimal | None,
    proposed: Decimal,
) -> Decimal:
    """Floor is up-only. Returns max of existing (if any) and proposed."""
    if existing is None:
        return proposed
    return max(existing, proposed)
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_service.py -v`
Expected: `21 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/btc_bot_service.py backend/tests/v9/test_btc_bot_service.py
git commit -m "services(btc-bot): blended-entry + up-only floor helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Alpaca Wrapper Client

**Files:**
- Create: `backend/app/broker/btc_bot_client.py`
- Test: `backend/tests/v9/test_btc_bot_client.py`

This wrapper exposes only the 4 calls the orchestrator needs. Tests use a stub of `alpaca-py` because we don't want to hit Alpaca during unit tests.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/v9/test_btc_bot_client.py`:

```python
"""Test the BtcBotClient wrapper surface.

We test only the wrapper's shape (method signatures, that it accepts api/secret keys,
returns dicts/None correctly) — actual Alpaca calls are mocked.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.broker.btc_bot_client import BtcBotClient


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_get_btc_ask_returns_decimal(mock_data_cls, mock_trading_cls):
    mock_data = MagicMock()
    mock_quote = MagicMock()
    mock_quote.ask_price = 95000.5
    mock_data.get_crypto_latest_quote.return_value = {"BTC/USD": mock_quote}
    mock_data_cls.return_value = mock_data

    client = BtcBotClient(api_key="k", secret_key="s")
    price = client.get_btc_ask()

    assert isinstance(price, Decimal)
    assert price == Decimal("95000.5")


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_get_btc_position_returns_none_when_flat(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_trading.get_all_positions.return_value = []
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    pos = client.get_btc_position()

    assert pos is None


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_get_btc_position_returns_qty_and_avg(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_pos = MagicMock()
    mock_pos.symbol = "BTCUSD"  # Alpaca crypto positions use this form
    mock_pos.qty = "0.10000000"
    mock_pos.avg_entry_price = "94000.00"
    mock_trading.get_all_positions.return_value = [mock_pos]
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    pos = client.get_btc_position()

    assert pos is not None
    assert pos["qty"] == Decimal("0.10000000")
    assert pos["avg_entry_price"] == Decimal("94000.00")


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_market_buy_returns_fill_summary(mock_data_cls, mock_trading_cls):
    """market_buy submits an order, polls until filled, returns qty + price + order_id."""
    mock_trading = MagicMock()
    mock_data = MagicMock()
    # Quote for the order qty calc
    mock_quote = MagicMock()
    mock_quote.ask_price = 95000.0
    mock_data.get_crypto_latest_quote.return_value = {"BTC/USD": mock_quote}
    mock_data_cls.return_value = mock_data

    # submit_order returns an order with an id
    mock_order = MagicMock()
    mock_order.id = "order-123"
    mock_trading.submit_order.return_value = mock_order

    # First poll = filled
    mock_filled = MagicMock()
    mock_filled.status.value = "filled"
    mock_filled.filled_qty = "0.10526316"
    mock_filled.filled_avg_price = "95000.00"
    mock_trading.get_order_by_id.return_value = mock_filled
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    fill = client.market_buy(usd_amount=Decimal("10000"))

    assert fill["filled_qty"] == Decimal("0.10526316")
    assert fill["filled_price"] == Decimal("95000.00")
    assert fill["order_id"] == "order-123"


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_market_sell_all_returns_fill_summary(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_order = MagicMock()
    mock_order.id = "sell-456"
    mock_trading.submit_order.return_value = mock_order

    mock_filled = MagicMock()
    mock_filled.status.value = "filled"
    mock_filled.filled_qty = "0.10000000"
    mock_filled.filled_avg_price = "94000.00"
    mock_trading.get_order_by_id.return_value = mock_filled
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    fill = client.market_sell_all(qty=Decimal("0.10000000"))

    assert fill["filled_qty"] == Decimal("0.10000000")
    assert fill["filled_price"] == Decimal("94000.00")
    assert fill["order_id"] == "sell-456"
```

- [ ] **Step 2: Run — expect ImportError**

Run: `cd backend && pytest tests/v9/test_btc_bot_client.py -v`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create the wrapper**

Create `backend/app/broker/btc_bot_client.py`:

```python
"""
Thin alpaca-py wrapper for the BTC trailing-stop bot.

Exposes only the 4 calls the orchestrator needs:
  - get_btc_ask()          → latest ask price (Decimal)
  - get_btc_position()     → dict | None  (qty, avg_entry_price, symbol)
  - market_buy(usd)        → dict (filled_qty, filled_price, order_id)
  - market_sell_all(qty)   → dict (filled_qty, filled_price, order_id)

Polls submitted orders up to ~60 s and raises TimeoutError if Alpaca never fills.
All numeric values are Decimal — callers should never see Python floats.
"""
from __future__ import annotations

import logging
import time
import uuid
from decimal import ROUND_DOWN, Decimal
from typing import Optional

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoLatestQuoteRequest
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import MarketOrderRequest

logger = logging.getLogger(__name__)

SYMBOL = "BTC/USD"
# Alpaca returns crypto positions with symbol stripped of slash (e.g. "BTCUSD").
_POSITION_SYMBOL = SYMBOL.replace("/", "").upper()


class BtcBotClient:
    """Minimal Alpaca wrapper used by the btc_bot_monitor scheduler task."""

    def __init__(self, api_key: str, secret_key: str, paper: bool = True) -> None:
        if not api_key or not secret_key:
            raise ValueError("BtcBotClient requires api_key + secret_key")
        self._trading = TradingClient(api_key, secret_key, paper=paper)
        self._data = CryptoHistoricalDataClient(api_key, secret_key)

    # ── Reads ─────────────────────────────────────────────────────────────

    def get_btc_ask(self) -> Decimal:
        req = CryptoLatestQuoteRequest(symbol_or_symbols=SYMBOL)
        quote = self._data.get_crypto_latest_quote(req)
        ask = quote[SYMBOL].ask_price
        return Decimal(str(ask))

    def get_btc_position(self) -> Optional[dict]:
        for p in self._trading.get_all_positions():
            if p.symbol.replace("/", "").upper() == _POSITION_SYMBOL:
                return {
                    "qty": Decimal(str(p.qty)),
                    "avg_entry_price": Decimal(str(p.avg_entry_price)),
                    "symbol": p.symbol,
                }
        return None

    # ── Writes ────────────────────────────────────────────────────────────

    def market_buy(self, usd_amount: Decimal, max_poll_seconds: int = 60) -> dict:
        """Place a notional-equivalent BTC market buy. Polls until filled."""
        ask = self.get_btc_ask()
        qty = (usd_amount / ask).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
        if qty <= 0:
            raise ValueError(f"computed qty {qty} <= 0 for usd={usd_amount} ask={ask}")
        req = MarketOrderRequest(
            symbol=SYMBOL,
            qty=float(qty),
            side=OrderSide.BUY,
            time_in_force=TimeInForce.GTC,
        )
        order = self._trading.submit_order(req)
        order_id = str(order.id)
        return self._poll_fill(order_id, max_poll_seconds, fallback_qty=qty, fallback_price=ask)

    def market_sell_all(self, qty: Decimal, max_poll_seconds: int = 60) -> dict:
        """Market-sell the entire BTC position. Polls until filled."""
        if qty <= 0:
            raise ValueError(f"market_sell_all called with qty={qty}")
        req = MarketOrderRequest(
            symbol=SYMBOL,
            qty=float(qty.quantize(Decimal("0.00000001"))),
            side=OrderSide.SELL,
            time_in_force=TimeInForce.GTC,
        )
        order = self._trading.submit_order(req)
        order_id = str(order.id)
        return self._poll_fill(order_id, max_poll_seconds, fallback_qty=qty, fallback_price=None)

    # ── Internal ──────────────────────────────────────────────────────────

    def _poll_fill(
        self,
        order_id: str,
        max_poll_seconds: int,
        fallback_qty: Decimal,
        fallback_price: Optional[Decimal],
    ) -> dict:
        for _ in range(max_poll_seconds):
            o = self._trading.get_order_by_id(uuid.UUID(order_id))
            status_value = o.status.value if hasattr(o.status, "value") else str(o.status)
            if status_value in ("filled", "partially_filled"):
                filled_qty = Decimal(str(o.filled_qty or fallback_qty))
                price_src = o.filled_avg_price or fallback_price
                if price_src is None:
                    raise RuntimeError(f"Order {order_id} filled but no price reported")
                return {
                    "filled_qty": filled_qty,
                    "filled_price": Decimal(str(price_src)),
                    "order_id": order_id,
                }
            if status_value in ("canceled", "rejected", "expired"):
                raise RuntimeError(f"Order {order_id} ended in status={status_value}")
            time.sleep(1)
        raise TimeoutError(f"Order {order_id} did not fill within {max_poll_seconds}s")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_client.py -v`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/broker/btc_bot_client.py backend/tests/v9/test_btc_bot_client.py
git commit -m "broker(btc-bot): thin alpaca-py wrapper (4 calls)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Scheduler — Credential Resolution Helper

**Files:**
- Create: `backend/tests/v9/conftest.py` (shared fixtures)
- Modify: `backend/app/scheduler/tasks/btc_bot_monitor.py` (placeholder created in Step 1)
- Test: `backend/tests/v9/test_btc_bot_monitor.py`

- [ ] **Step 1: Create the conftest and write the failing test**

Create `backend/tests/v9/conftest.py`:

```python
"""Shared fixtures for v9 btc-bot tests."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models.btc_bot import BtcBotSession
from app.models.user import User


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def user_bootstrap(monkeypatch) -> User:
    """User whose email matches BTC_BOT_BOOTSTRAP_USER_EMAIL — gets env-var fallback."""
    monkeypatch.setenv("BTC_BOT_BOOTSTRAP_USER_EMAIL", "bootstrap@example.com")
    monkeypatch.setenv("VISANU_ALPACA_API_KEY", "test-key")
    monkeypatch.setenv("VISANU_ALPACA_SECRET_KEY", "test-secret")
    u = User(id=1, email="bootstrap@example.com")
    return u


@pytest.fixture
def user_other(monkeypatch) -> User:
    """User whose email does NOT match the bootstrap user."""
    monkeypatch.setenv("BTC_BOT_BOOTSTRAP_USER_EMAIL", "bootstrap@example.com")
    u = User(id=2, email="other@example.com")
    return u


@pytest.fixture
def active_session() -> BtcBotSession:
    return BtcBotSession(
        id=10,
        user_id=1,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("94000.00"),
        total_qty=Decimal("0.10000000"),
        initial_buy_usd=Decimal("10000.00"),
        current_floor=Decimal("84600.00"),
        trailing_active=False,
        trailing_high=None,
        ladder_next=0,
    )
```

Create `backend/tests/v9/test_btc_bot_monitor.py`:

```python
"""Orchestrator + credential-resolver unit tests.

Avoid hitting Alpaca by patching BtcBotClient. Use the conftest fixtures for
deterministic user + session inputs.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.scheduler.tasks.btc_bot_monitor import _resolve_creds_for_user


def test_resolve_creds_returns_env_for_bootstrap_user(user_bootstrap):
    """User matching BTC_BOT_BOOTSTRAP_USER_EMAIL gets env-var creds."""
    creds = _resolve_creds_for_user(user_bootstrap, broker_cred=None)
    assert creds is not None
    api, secret = creds
    assert api == "test-key"
    assert secret == "test-secret"


def test_resolve_creds_returns_none_for_other_user_without_broker_cred(user_other):
    """Non-bootstrap user without saved credentials → no creds available."""
    creds = _resolve_creds_for_user(user_other, broker_cred=None)
    assert creds is None


def test_resolve_creds_prefers_broker_cred_over_env(user_bootstrap):
    """If user has a BrokerCredential, prefer it even if env vars are set."""
    mock_cred = MagicMock()
    with patch("app.scheduler.tasks.btc_bot_monitor.decrypt_value") as mock_dec:
        mock_dec.side_effect = ["personal-key", "personal-secret"]
        creds = _resolve_creds_for_user(user_bootstrap, broker_cred=mock_cred)
    assert creds == ("personal-key", "personal-secret")
```

- [ ] **Step 2: Run — expect ImportError**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: FAIL — `app.scheduler.tasks.btc_bot_monitor` does not exist.

- [ ] **Step 3: Create the scheduler module skeleton with the helper**

Create `backend/app/scheduler/tasks/btc_bot_monitor.py`:

```python
"""
APScheduler task: BTC trailing-stop bot monitor (V9).

Fires every BTC_BOT_MONITOR_MINUTES (default 15). Iterates active + cooldown
sessions across all users, executes one TickAction per session per fire.

This module is the only place I/O happens for the bot:
  - DB reads/writes go through AsyncSessionLocal
  - Alpaca calls go through BtcBotClient
  - Pure decisions delegated to services.btc_bot_service.evaluate_tick

One AsyncSessionLocal is opened OUTSIDE the per-user loop (CLAUDE.md rule);
gc.collect() in the finally block (Render memory rule).
"""
from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings
from app.core.security import decrypt_value
from app.models.broker import BrokerCredential
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Credential resolution ──────────────────────────────────────────────────

def _resolve_creds_for_user(
    user: User,
    broker_cred: Optional[BrokerCredential],
) -> Optional[tuple[str, str]]:
    """
    Return (api_key, secret_key) for the user, or None if no usable credential.

    Precedence:
      1. user's BrokerCredential row (if non-None)
      2. env vars VISANU_ALPACA_* / ALPACA_* — only for the bootstrap user
    """
    if broker_cred is not None:
        api = decrypt_value(broker_cred.api_key)
        secret = decrypt_value(broker_cred.encrypted_secret_key)
        return (api, secret)

    if (
        settings.btc_bot_bootstrap_user_email
        and user.email
        and user.email.lower() == settings.btc_bot_bootstrap_user_email.lower()
    ):
        api = settings.visanu_alpaca_api_key
        secret = settings.visanu_alpaca_secret_key
        if api and secret:
            return (api, secret)

    return None
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/v9/conftest.py backend/tests/v9/test_btc_bot_monitor.py backend/app/scheduler/tasks/btc_bot_monitor.py
git commit -m "scheduler(btc-bot): credential resolver skeleton

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Scheduler — `_tick_one_user` Skeleton (Load + Decide)

**Files:**
- Modify: `backend/app/scheduler/tasks/btc_bot_monitor.py`
- Modify: `backend/tests/v9/test_btc_bot_monitor.py`

- [ ] **Step 1: Append the failing test**

Append to `backend/tests/v9/test_btc_bot_monitor.py`:

```python
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from app.scheduler.tasks.btc_bot_monitor import _build_session_state
from app.services.btc_bot_service import SessionState


def test_build_session_state_from_active_session(active_session):
    state = _build_session_state(active_session)
    assert isinstance(state, SessionState)
    assert state.status == "active"
    assert state.original_entry == Decimal("94000.00")
    assert state.ladder_next == 0


def test_build_session_state_from_none_returns_no_session():
    state = _build_session_state(None)
    assert state.status == "no_session"
    assert state.total_qty == Decimal("0")
    assert state.original_entry is None
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: 2 new FAILs — `_build_session_state` doesn't exist.

- [ ] **Step 3: Add the helper**

Append to `backend/app/scheduler/tasks/btc_bot_monitor.py`:

```python
from decimal import Decimal
from typing import Optional

from app.models.btc_bot import BtcBotSession
from app.services.btc_bot_service import SessionState


def _build_session_state(session: Optional[BtcBotSession]) -> SessionState:
    """Project a DB row (or None) into the immutable SessionState the decision fn needs."""
    if session is None:
        return SessionState(
            status="no_session",
            original_entry=None,
            blended_entry=None,
            total_qty=Decimal("0"),
            current_floor=None,
            trailing_active=False,
            trailing_high=None,
            ladder_next=0,
            cooldown_until=None,
        )
    return SessionState(
        status=session.status,  # type: ignore[arg-type]
        original_entry=session.original_entry_price,
        blended_entry=session.blended_entry_price,
        total_qty=session.total_qty or Decimal("0"),
        current_floor=session.current_floor,
        trailing_active=session.trailing_active,
        trailing_high=session.trailing_high,
        ladder_next=session.ladder_next,
        cooldown_until=session.cooldown_until,
    )
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduler/tasks/btc_bot_monitor.py backend/tests/v9/test_btc_bot_monitor.py
git commit -m "scheduler(btc-bot): _build_session_state — DB row → SessionState

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Scheduler — Action Recording Helpers

**Files:**
- Modify: `backend/app/scheduler/tasks/btc_bot_monitor.py`
- Modify: `backend/tests/v9/test_btc_bot_monitor.py`

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_monitor.py`:

```python
from app.scheduler.tasks.btc_bot_monitor import _record_action, _record_error
from app.models.btc_bot import BtcBotAction


def test_record_action_creates_row_with_required_fields():
    db = MagicMock()
    db.add = MagicMock()
    _record_action(
        db,
        session_id=10,
        user_id=1,
        action="initial_buy",
        btc_price=Decimal("94000"),
        qty_delta=Decimal("0.10"),
        usd_delta=Decimal("10000"),
        alpaca_order_id="abc",
        notes=None,
    )
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert isinstance(row, BtcBotAction)
    assert row.action == "initial_buy"
    assert row.qty_delta == Decimal("0.10")
    assert row.alpaca_order_id == "abc"


def test_record_error_writes_error_row(active_session):
    db = MagicMock()
    db.add = MagicMock()
    _record_error(db, active_session, reason="Alpaca quote failed")
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.action == "error"
    assert "Alpaca" in row.notes
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: 2 FAILs — helpers don't exist.

- [ ] **Step 3: Add the recorders**

Append to `backend/app/scheduler/tasks/btc_bot_monitor.py`:

```python
from app.models.btc_bot import BtcBotAction


def _record_action(
    db,
    *,
    session_id: int,
    user_id: int,
    action: str,
    btc_price: Optional[Decimal] = None,
    qty_delta: Optional[Decimal] = None,
    usd_delta: Optional[Decimal] = None,
    floor_before: Optional[Decimal] = None,
    floor_after: Optional[Decimal] = None,
    alpaca_order_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> None:
    """Insert one row into btc_bot_actions. Caller commits later."""
    row = BtcBotAction(
        session_id=session_id,
        user_id=user_id,
        action=action,
        btc_price=btc_price,
        qty_delta=qty_delta,
        usd_delta=usd_delta,
        floor_before=floor_before,
        floor_after=floor_after,
        alpaca_order_id=alpaca_order_id,
        notes=notes,
    )
    db.add(row)


def _record_error(db, session: Optional[BtcBotSession], reason: str) -> None:
    """Write an `error` action row. If we have no session yet, skip (nothing to attach to)."""
    if session is None:
        logger.error("btc_bot: error before session existed: %s", reason)
        return
    _record_action(
        db,
        session_id=session.id,
        user_id=session.user_id,
        action="error",
        notes=reason[:5000],
    )
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduler/tasks/btc_bot_monitor.py backend/tests/v9/test_btc_bot_monitor.py
git commit -m "scheduler(btc-bot): _record_action + _record_error helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Scheduler — `_apply_action` Dispatch

This is the meatiest task — the function that converts a `TickAction` into DB mutations + Alpaca calls.

**Files:**
- Modify: `backend/app/scheduler/tasks/btc_bot_monitor.py`
- Modify: `backend/tests/v9/test_btc_bot_monitor.py`

- [ ] **Step 1: Append the failing tests for `_apply_action` (one test per branch)**

Append to `backend/tests/v9/test_btc_bot_monitor.py`:

```python
from datetime import timedelta
from app.scheduler.tasks.btc_bot_monitor import _apply_action
from app.services.btc_bot_service import (
    AdoptPosition,
    AdvanceTrailing,
    ExitCooldown,
    Idle,
    InitialBuy,
    LadderBuy,
    StopOut,
)


def test_apply_idle_does_nothing(active_session):
    db = MagicMock()
    client = MagicMock()
    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=Idle("nothing"), price=Decimal("95000"), now_utc=None,
    )
    assert new_session is active_session
    db.add.assert_not_called()
    client.market_buy.assert_not_called()
    client.market_sell_all.assert_not_called()


def test_apply_initial_buy_creates_session_and_records_action(user_bootstrap):
    db = MagicMock()
    db.add = MagicMock()
    client = MagicMock()
    client.market_buy.return_value = {
        "filled_qty": Decimal("0.10526316"),
        "filled_price": Decimal("95000.00"),
        "order_id": "buy-1",
    }
    from datetime import datetime, timezone
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=None, user_id=user_bootstrap.id,
        action=InitialBuy(usd_amount=Decimal("10000")),
        price=Decimal("95000"), now_utc=now,
    )

    client.market_buy.assert_called_once_with(usd_amount=Decimal("10000"))
    assert new_session is not None
    assert new_session.user_id == user_bootstrap.id
    assert new_session.status == "active"
    assert new_session.total_qty == Decimal("0.10526316")
    assert new_session.original_entry_price == Decimal("95000.00")
    assert new_session.blended_entry_price == Decimal("95000.00")
    assert new_session.current_floor == Decimal("85500.00")  # 95000 * 0.90
    assert new_session.ladder_next == 0
    # Both the session row and the action row should be added
    assert db.add.call_count == 2


def test_apply_adopt_position_creates_session(user_bootstrap):
    db = MagicMock()
    client = MagicMock()
    from datetime import datetime, timezone
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=None, user_id=user_bootstrap.id,
        action=AdoptPosition(avg_entry=Decimal("94000"), qty=Decimal("0.10")),
        price=Decimal("95000"), now_utc=now,
    )

    assert new_session is not None
    assert new_session.original_entry_price == Decimal("94000")
    assert new_session.blended_entry_price == Decimal("94000")
    assert new_session.total_qty == Decimal("0.10")
    assert new_session.current_floor == Decimal("84600.00")  # 94000 * 0.90
    # No order placed for adopt
    client.market_buy.assert_not_called()
    # One action row inserted (adopted_position)
    assert db.add.call_count == 2  # session + action


def test_apply_ladder_buy_updates_blended_and_floor(active_session):
    """LadderBuy(L1, 10000) at price=$80000 with prior session having qty=0.10@94000."""
    db = MagicMock()
    client = MagicMock()
    client.market_buy.return_value = {
        "filled_qty": Decimal("0.125"),  # 10000 / 80000
        "filled_price": Decimal("80000.00"),
        "order_id": "ladder-1",
    }
    from datetime import datetime, timezone
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=LadderBuy(level=1, usd_amount=Decimal("10000")),
        price=Decimal("80000"), now_utc=now,
    )

    client.market_buy.assert_called_once_with(usd_amount=Decimal("10000"))
    # New total_qty = 0.10 + 0.125 = 0.225
    assert new_session.total_qty == Decimal("0.22500000")
    # New blended_entry = (0.10 * 94000 + 0.125 * 80000) / 0.225 = 19400 / 0.225 = 86222.22
    assert new_session.blended_entry_price == Decimal("86222.22")
    # New proposed floor = 86222.22 * 0.90 = 77600.00 — but existing floor was 84600.
    # Up-only → floor stays at 84600.
    assert new_session.current_floor == Decimal("84600.00")
    # ladder_next advanced
    assert new_session.ladder_next == 1


def test_apply_advance_trailing_updates_floor_in_place(active_session):
    db = MagicMock()
    client = MagicMock()
    from datetime import datetime, timezone
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)
    action = AdvanceTrailing(
        new_floor=Decimal("104500.00"),
        new_trailing_high=Decimal("110000.00"),
        activated_now=True,
    )

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=action, price=Decimal("110000"), now_utc=now,
    )

    assert new_session.current_floor == Decimal("104500.00")
    assert new_session.trailing_high == Decimal("110000.00")
    assert new_session.trailing_active is True
    # No Alpaca call for trailing
    client.market_buy.assert_not_called()
    client.market_sell_all.assert_not_called()


def test_apply_stop_out_sells_all_and_enters_cooldown(active_session):
    db = MagicMock()
    client = MagicMock()
    client.market_sell_all.return_value = {
        "filled_qty": Decimal("0.10000000"),
        "filled_price": Decimal("83000.00"),
        "order_id": "sell-1",
    }
    from datetime import datetime, timezone
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=StopOut(reason="FLOOR hit"),
        price=Decimal("83000"), now_utc=now,
    )

    client.market_sell_all.assert_called_once_with(qty=Decimal("0.10000000"))
    assert new_session.status == "cooldown"
    assert new_session.cooldown_until is not None
    assert new_session.cooldown_until > now
    # Realized PnL = (83000 - 94000) * 0.10 = -1100
    assert new_session.realized_pnl == Decimal("-1100.00")
    assert new_session.total_qty == Decimal("0")


def test_apply_exit_cooldown_ends_session(active_session):
    db = MagicMock()
    client = MagicMock()
    active_session.status = "cooldown"
    active_session.cooldown_until = None  # already expired logically
    from datetime import datetime, timezone
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=ExitCooldown(),
        price=Decimal("95000"), now_utc=now,
    )

    assert new_session.status == "ended"
    assert new_session.ended_at == now
```

- [ ] **Step 2: Run — expect FAILs**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: 7 new FAILs — `_apply_action` doesn't exist.

- [ ] **Step 3: Add `_apply_action`**

Append to `backend/app/scheduler/tasks/btc_bot_monitor.py`:

```python
from datetime import datetime, timedelta
from typing import Optional

from app.services.btc_bot_service import (
    AdoptPosition,
    AdvanceTrailing,
    ExitCooldown,
    FLOOR_MULT,
    Idle,
    InitialBuy,
    LadderBuy,
    StopOut,
    TickAction,
    compute_blended_entry,
    compute_new_floor_up_only,
)


def _apply_action(
    db,
    client,
    *,
    session: Optional[BtcBotSession],
    user_id: int,
    action: TickAction,
    price: Decimal,
    now_utc: datetime,
) -> Optional[BtcBotSession]:
    """
    Execute one TickAction. Returns the (possibly newly-created) session.

    Pure side-effect dispatch — no decision logic lives here, only I/O.
    """
    if isinstance(action, Idle):
        return session

    # ── InitialBuy: open a new session with the fill ─────────────────────
    if isinstance(action, InitialBuy):
        fill = client.market_buy(usd_amount=action.usd_amount)
        new_session = BtcBotSession(
            user_id=user_id,
            status="active",
            original_entry_price=fill["filled_price"],
            blended_entry_price=fill["filled_price"],
            total_qty=fill["filled_qty"],
            initial_buy_usd=action.usd_amount,
            current_floor=(fill["filled_price"] * FLOOR_MULT).quantize(Decimal("0.01")),
            trailing_active=False,
            trailing_high=None,
            ladder_next=0,
            last_action_at=now_utc,
        )
        db.add(new_session)
        # Flush so we have an id before recording the action.
        try:
            db.flush()
        except Exception:
            # In MagicMock tests db.flush is a noop and session.id stays unset.
            pass
        _record_action(
            db,
            session_id=new_session.id or 0,
            user_id=user_id,
            action="initial_buy",
            btc_price=fill["filled_price"],
            qty_delta=fill["filled_qty"],
            usd_delta=action.usd_amount,
            floor_after=new_session.current_floor,
            alpaca_order_id=fill["order_id"],
        )
        return new_session

    # ── AdoptPosition: open a session from existing Alpaca position ──────
    if isinstance(action, AdoptPosition):
        new_session = BtcBotSession(
            user_id=user_id,
            status="active",
            original_entry_price=action.avg_entry,
            blended_entry_price=action.avg_entry,
            total_qty=action.qty,
            initial_buy_usd=settings.btc_bot_initial_usd,
            current_floor=(action.avg_entry * FLOOR_MULT).quantize(Decimal("0.01")),
            trailing_active=False,
            trailing_high=None,
            ladder_next=0,
            last_action_at=now_utc,
        )
        db.add(new_session)
        try:
            db.flush()
        except Exception:
            pass
        _record_action(
            db,
            session_id=new_session.id or 0,
            user_id=user_id,
            action="adopted_position",
            btc_price=price,
            qty_delta=action.qty,
            floor_after=new_session.current_floor,
            notes=f"Adopted Alpaca position: avg_entry=${action.avg_entry} qty={action.qty}",
        )
        return new_session

    # ── For all remaining actions we need an existing session ────────────
    assert session is not None, f"_apply_action({action.__class__.__name__}) requires existing session"

    # ── LadderBuy: place buy, recompute blended + floor (up-only) ───────
    if isinstance(action, LadderBuy):
        floor_before = session.current_floor
        fill = client.market_buy(usd_amount=action.usd_amount)
        new_blended = compute_blended_entry(
            prior_qty=session.total_qty,
            prior_blended=session.blended_entry_price,
            fill_qty=fill["filled_qty"],
            fill_price=fill["filled_price"],
        )
        new_total_qty = (session.total_qty + fill["filled_qty"]).quantize(Decimal("0.00000001"))
        proposed_floor = (new_blended * FLOOR_MULT).quantize(Decimal("0.01"))
        new_floor = compute_new_floor_up_only(session.current_floor, proposed_floor)

        session.blended_entry_price = new_blended
        session.total_qty = new_total_qty
        session.current_floor = new_floor
        session.ladder_next = action.level
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action=f"ladder_l{action.level}",
            btc_price=fill["filled_price"],
            qty_delta=fill["filled_qty"],
            usd_delta=action.usd_amount,
            floor_before=floor_before,
            floor_after=new_floor,
            alpaca_order_id=fill["order_id"],
        )
        return session

    # ── AdvanceTrailing: pure DB mutation, no Alpaca call ───────────────
    if isinstance(action, AdvanceTrailing):
        floor_before = session.current_floor
        session.current_floor = action.new_floor
        session.trailing_high = action.new_trailing_high
        session.trailing_active = True
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="trailing_activate" if action.activated_now else "trailing_advance",
            btc_price=price,
            floor_before=floor_before,
            floor_after=action.new_floor,
        )
        return session

    # ── StopOut: market-sell everything, enter cooldown ─────────────────
    if isinstance(action, StopOut):
        floor_before = session.current_floor
        qty_to_sell = session.total_qty
        fill = client.market_sell_all(qty=qty_to_sell)
        proceeds = fill["filled_qty"] * fill["filled_price"]
        cost_basis = qty_to_sell * session.blended_entry_price
        realized = (proceeds - cost_basis).quantize(Decimal("0.01"))

        session.status = "cooldown"
        session.cooldown_until = now_utc + timedelta(minutes=settings.btc_bot_cooldown_minutes)
        session.realized_pnl = realized
        session.total_qty = Decimal("0")
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="stop_out",
            btc_price=fill["filled_price"],
            qty_delta=-qty_to_sell,
            usd_delta=proceeds,
            floor_before=floor_before,
            alpaca_order_id=fill["order_id"],
            notes=action.reason,
        )
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="cooldown_start",
            notes=f"cooldown until {session.cooldown_until.isoformat()}",
        )
        return session

    # ── ExitCooldown: end the session; next tick will fire InitialBuy ───
    if isinstance(action, ExitCooldown):
        session.status = "ended"
        session.ended_at = now_utc
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="cooldown_exit",
            notes="Cooldown expired; session ended. Next tick will fire InitialBuy.",
        )
        return session

    raise RuntimeError(f"Unknown TickAction type: {type(action).__name__}")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_monitor.py -v`
Expected: `14 passed`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduler/tasks/btc_bot_monitor.py backend/tests/v9/test_btc_bot_monitor.py
git commit -m "scheduler(btc-bot): _apply_action — dispatch every TickAction branch

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Scheduler — Top-level `monitor_btc_bots` + Per-User Tick

**Files:**
- Modify: `backend/app/scheduler/tasks/btc_bot_monitor.py`

This wires together everything: load active+cooldown sessions, load potential users for bootstrap, iterate, call `_apply_action`, commit once.

- [ ] **Step 1: Append the top-level orchestrator at the bottom of `btc_bot_monitor.py`**

```python
import asyncio
import gc
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.btc_bot_client import BtcBotClient
from app.db.session import AsyncSessionLocal
from app.services.btc_bot_service import evaluate_tick


async def _load_users_to_tick(db: AsyncSession) -> list[User]:
    """
    Users who should be ticked this round:
      - every user with an active or cooldown btc_bot_sessions row
      - PLUS the bootstrap user (if configured) so they get auto-buy on empty DB
    """
    result = await db.execute(
        select(User).join(
            BtcBotSession, BtcBotSession.user_id == User.id
        ).where(
            BtcBotSession.status.in_(("active", "cooldown"))
        ).distinct()
    )
    users = list(result.scalars().all())
    user_ids_present = {u.id for u in users}

    if settings.btc_bot_bootstrap_user_email:
        bootstrap_result = await db.execute(
            select(User).where(
                User.email == settings.btc_bot_bootstrap_user_email
            )
        )
        bootstrap = bootstrap_result.scalars().first()
        if bootstrap and bootstrap.id not in user_ids_present:
            users.append(bootstrap)

    return users


async def _load_active_session(db: AsyncSession, user_id: int) -> Optional[BtcBotSession]:
    """Return the user's active or cooldown session (at most one due to partial unique)."""
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.user_id == user_id,
            BtcBotSession.status.in_(("active", "cooldown")),
        ).limit(1)
    )
    return result.scalars().first()


async def _load_broker_cred(db: AsyncSession, session: Optional[BtcBotSession]) -> Optional[BrokerCredential]:
    if session is None or session.credential_id is None:
        return None
    result = await db.execute(
        select(BrokerCredential).where(BrokerCredential.id == session.credential_id)
    )
    return result.scalars().first()


async def _tick_one_user(db: AsyncSession, user: User, now_utc: datetime) -> None:
    """Single-user tick. Must NEVER raise — log + record_error on failure."""
    session = await _load_active_session(db, user.id)
    broker_cred = await _load_broker_cred(db, session)

    creds = _resolve_creds_for_user(user, broker_cred)
    if creds is None:
        logger.info("btc_bot: user %d has no usable credentials — skipping", user.id)
        return
    api_key, secret_key = creds

    try:
        client = BtcBotClient(api_key=api_key, secret_key=secret_key, paper=True)
        price = client.get_btc_ask()
        position = client.get_btc_position()
    except Exception as exc:
        logger.exception("btc_bot: read failure for user %d: %s", user.id, exc)
        _record_error(db, session, f"Alpaca read failure: {exc}")
        return

    state = _build_session_state(session)
    alpaca_qty = position["qty"] if position else Decimal("0")
    alpaca_avg = position["avg_entry_price"] if position else None
    initial_usd = (
        session.initial_buy_usd if session
        else Decimal(str(settings.btc_bot_initial_usd))
    )

    action = evaluate_tick(
        state,
        current_price=price,
        alpaca_position_qty=alpaca_qty,
        alpaca_avg_entry=alpaca_avg,
        initial_buy_usd=initial_usd,
        now_utc=now_utc,
    )
    logger.info("btc_bot: user=%d action=%s price=%s", user.id, type(action).__name__, price)

    try:
        _apply_action(
            db, client,
            session=session,
            user_id=user.id,
            action=action,
            price=price,
            now_utc=now_utc,
        )
    except Exception as exc:
        logger.exception("btc_bot: apply failure for user %d action=%s: %s", user.id, type(action).__name__, exc)
        _record_error(db, session, f"Apply {type(action).__name__} failed: {exc}")


async def _run_monitor() -> None:
    now_utc = datetime.now(timezone.utc)
    logger.info("btc_bot_monitor: starting at %s", now_utc.isoformat())
    try:
        async with AsyncSessionLocal() as db:
            users = await _load_users_to_tick(db)
            if not users:
                logger.info("btc_bot_monitor: no users to tick")
                return
            logger.info("btc_bot_monitor: ticking %d user(s)", len(users))
            for user in users:
                try:
                    await _tick_one_user(db, user, now_utc)
                except Exception as exc:
                    logger.exception("btc_bot: unhandled error in tick for user %d: %s", user.id, exc)
            await db.commit()
    except Exception as exc:
        logger.exception("btc_bot_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def monitor_btc_bots() -> None:
    """Synchronous APScheduler entry point."""
    asyncio.run(_run_monitor())
```

- [ ] **Step 2: Smoke-import to catch syntax errors**

Run: `cd backend && python -c "from app.scheduler.tasks.btc_bot_monitor import monitor_btc_bots; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Run the full v9 test suite — expect all PASS**

Run: `cd backend && pytest tests/v9/ -v`
Expected: All tests pass (~21 service + 14 monitor + 5 client + 4 schema + 3 model = ~47 tests).

- [ ] **Step 4: Commit**

```bash
git add backend/app/scheduler/tasks/btc_bot_monitor.py
git commit -m "scheduler(btc-bot): top-level monitor + per-user tick

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Register the Cron in `JOB_TEMPLATES` + `register_jobs`

**Files:**
- Modify: `backend/app/scheduler/jobs.py`

- [ ] **Step 1: Add the import at the top of `jobs.py`**

In `backend/app/scheduler/jobs.py`, add after the other task imports:

```python
from app.scheduler.tasks.btc_bot_monitor import monitor_btc_bots
```

- [ ] **Step 2: Add the `JOB_TEMPLATES` entry**

In the same file, inside `JOB_TEMPLATES`, add this entry at the end of the dict (before the closing `}`):

```python
    "btc_bot_monitor": {
        "func": monitor_btc_bots,
        "trigger": "interval",
        "minutes": settings.btc_bot_monitor_minutes,
        "description": "Tick the BTC trailing-stop bot — FLOOR / trailing / ladder / cooldown re-entry",
    },
```

- [ ] **Step 3: Add the `scheduler.add_job` call**

In `register_jobs()`, after the `run_commodity_alerts` block, add:

```python
    # ── BTC trailing-stop bot ─────────────────────────────────────────────────
    scheduler.add_job(
        monitor_btc_bots,
        "interval",
        minutes=settings.btc_bot_monitor_minutes,
        id="btc_bot_monitor",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
```

- [ ] **Step 4: Update the log line at the bottom of `register_jobs()`**

Find the existing `logger.info(...)` summary in `register_jobs()`. Append `btc_bot_monitor=%dm` to the format string and `settings.btc_bot_monitor_minutes` to the arg list. Example:

```python
    logger.info(
        "Scheduler jobs registered: buy_zone=%dm theme=%dm alerts=%dm auto_buy=%dm "
        "scan=%dm live_scanner=%dm idea_gen=%dm prune_signals=daily commodity_alerts=%dm "
        "trailing_bot_monitor=5m wheel_bot_monitor=15m "
        "wheel_bot_daily_summary=cron(21:05 UTC) btc_bot_monitor=%dm",
        settings.buy_zone_refresh_minutes,
        settings.theme_score_refresh_minutes,
        settings.alert_eval_minutes,
        settings.auto_buy_eval_minutes,
        settings.watchlist_scan_minutes,
        settings.live_scanner_minutes,
        settings.idea_generator_minutes,
        settings.commodity_alert_minutes,
        settings.btc_bot_monitor_minutes,
    )
```

- [ ] **Step 5: Smoke-import `register_jobs`**

Run: `cd backend && python -c "from app.scheduler.jobs import register_jobs, JOB_TEMPLATES; print('btc_bot_monitor' in JOB_TEMPLATES)"`
Expected: `True`

- [ ] **Step 6: Commit**

```bash
git add backend/app/scheduler/jobs.py
git commit -m "scheduler: register btc_bot_monitor in JOB_TEMPLATES + register_jobs (V9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: API Router — Read Endpoints

**Files:**
- Create: `backend/app/api/btc_bot.py`
- Test: `backend/tests/v9/test_btc_bot_api.py`

This codebase tests API handlers directly as async functions (mocking `db` + `user`) rather than going through a `TestClient`. Match that pattern.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/v9/test_btc_bot_api.py`:

```python
"""Direct-call tests for the btc-bot route handlers.

Avoid TestClient + DB fixtures (this codebase doesn't expose those) — call the
async handler functions directly with mocked AsyncSession + User.
"""
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.btc_bot import BtcBotAction, BtcBotSession


def _mock_db_with_first(returned_obj):
    """Build a MagicMock AsyncSession whose db.execute(...).scalars().first() returns `returned_obj`."""
    db = MagicMock()
    db.execute = AsyncMock()
    scalars = MagicMock()
    scalars.first = MagicMock(return_value=returned_obj)
    scalars.all = MagicMock(return_value=[returned_obj] if returned_obj else [])
    db.execute.return_value.scalars.return_value = scalars
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.asyncio
async def test_get_current_session_returns_none_when_no_active():
    from app.api.btc_bot import get_current_session

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    result = await get_current_session(db=db, user=user)
    assert result is None


@pytest.mark.asyncio
async def test_get_current_session_returns_row_when_active():
    from app.api.btc_bot import get_current_session

    session = BtcBotSession(
        id=10,
        user_id=1,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("94000.00"),
        total_qty=Decimal("0.10000000"),
        initial_buy_usd=Decimal("10000.00"),
        current_floor=Decimal("84600.00"),
    )
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)
    result = await get_current_session(db=db, user=user)
    assert result is session


@pytest.mark.asyncio
async def test_get_session_detail_404_when_missing():
    from fastapi import HTTPException

    from app.api.btc_bot import get_session_detail

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    with pytest.raises(HTTPException) as exc:
        await get_session_detail(session_id=999, db=db, user=user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_actions_filters_by_action():
    """Confirms the handler runs without exception when ?action= is passed."""
    from app.api.btc_bot import list_actions

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    result = await list_actions(action="initial_buy", limit=10, offset=0, db=db, user=user)
    # _mock_db_with_first returned None; scalars().all() returns [] when first is None
    assert isinstance(result, list)
```

- [ ] **Step 2: Run — expect failures**

Run: `cd backend && pytest tests/v9/test_btc_bot_api.py -v`
Expected: 404s on every test (router not registered).

- [ ] **Step 3: Create the router with read endpoints**

Create `backend/app/api/btc_bot.py`:

```python
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.btc_bot import BtcBotAction, BtcBotSession
from app.models.user import User
from app.schemas.btc_bot import (
    BtcBotActionResponse,
    BtcBotSessionDetailResponse,
    BtcBotSessionResponse,
)

router = APIRouter(prefix="/api/v1/btc-bot", tags=["btc-bot"])


# ── Read endpoints ────────────────────────────────────────────────────────


@router.get("/session", response_model=Optional[BtcBotSessionResponse])
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return the user's currently active or cooldown session (or null)."""
    result = await db.execute(
        select(BtcBotSession)
        .where(
            BtcBotSession.user_id == user.id,
            BtcBotSession.status.in_(("active", "cooldown")),
        )
        .limit(1)
    )
    session = result.scalars().first()
    return session


@router.get("/sessions", response_model=list[BtcBotSessionResponse])
async def list_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List the user's session history, newest first."""
    result = await db.execute(
        select(BtcBotSession)
        .where(BtcBotSession.user_id == user.id)
        .order_by(BtcBotSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


@router.get("/sessions/{session_id}", response_model=BtcBotSessionDetailResponse)
async def get_session_detail(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """One session + its full action history."""
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.id == session_id,
            BtcBotSession.user_id == user.id,
        )
    )
    session = result.scalars().first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

    actions_result = await db.execute(
        select(BtcBotAction)
        .where(BtcBotAction.session_id == session_id)
        .order_by(BtcBotAction.created_at.desc())
    )
    actions = list(actions_result.scalars().all())
    return {"session": session, "actions": actions}


@router.get("/actions", response_model=list[BtcBotActionResponse])
async def list_actions(
    action: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cross-session action history (paginated). Optional ?action=<type> filter."""
    stmt = select(BtcBotAction).where(BtcBotAction.user_id == user.id)
    if action is not None:
        stmt = stmt.where(BtcBotAction.action == action)
    stmt = stmt.order_by(BtcBotAction.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())
```

- [ ] **Step 4: Mount the router in `main.py`**

Open `backend/app/main.py`. Find where other routers are included (search for `wheel_bot.router`). Add:

```python
from app.api import btc_bot as btc_bot_router
...
app.include_router(btc_bot_router.router)
```

(Place this next to the existing `wheel_bot` include for consistency.)

- [ ] **Step 5: Run the API tests — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_api.py -v`
Expected: `4 passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/btc_bot.py backend/app/main.py backend/tests/v9/test_btc_bot_api.py
git commit -m "api(btc-bot): read endpoints (session, sessions, actions, detail)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: API Router — Mutation Endpoints

**Files:**
- Modify: `backend/app/api/btc_bot.py`
- Modify: `backend/tests/v9/test_btc_bot_api.py`

- [ ] **Step 1: Append the failing tests**

Append to `backend/tests/v9/test_btc_bot_api.py`:

```python
@pytest.mark.asyncio
async def test_create_session_409_when_active_exists():
    from fastapi import HTTPException

    from app.api.btc_bot import create_session
    from app.schemas.btc_bot import BtcBotSessionCreateRequest

    existing = BtcBotSession(id=1, user_id=1, status="active")
    db = _mock_db_with_first(existing)
    user = MagicMock(id=1)

    with pytest.raises(HTTPException) as exc:
        await create_session(body=BtcBotSessionCreateRequest(), db=db, user=user)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_create_session_creates_when_no_active():
    from app.api.btc_bot import create_session
    from app.schemas.btc_bot import BtcBotSessionCreateRequest

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    result = await create_session(
        body=BtcBotSessionCreateRequest(initial_buy_usd=Decimal("5000")),
        db=db, user=user,
    )
    # db.add called once for the new session
    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert isinstance(added, BtcBotSession)
    assert added.user_id == 1
    assert added.status == "active"
    assert added.initial_buy_usd == Decimal("5000")


@pytest.mark.asyncio
async def test_close_session_409_when_not_active():
    from fastapi import HTTPException

    from app.api.btc_bot import close_session

    session = BtcBotSession(id=10, user_id=1, status="cooldown")
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    with pytest.raises(HTTPException) as exc:
        await close_session(session_id=10, db=db, user=user)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_close_session_with_no_position_sets_ended():
    """Close handler on a 0-qty active session: skip Alpaca call, just mark ended."""
    from app.api.btc_bot import close_session

    session = BtcBotSession(
        id=10,
        user_id=1,
        status="active",
        total_qty=Decimal("0"),
        blended_entry_price=Decimal("94000"),
    )
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    result = await close_session(session_id=10, db=db, user=user)
    assert result.status == "ended"
    assert result.ended_at is not None


@pytest.mark.asyncio
async def test_cancel_cooldown_ends_session():
    from app.api.btc_bot import cancel_cooldown

    session = BtcBotSession(id=10, user_id=1, status="cooldown")
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    result = await cancel_cooldown(session_id=10, db=db, user=user)
    assert result.status == "ended"
    assert result.cooldown_until is None


@pytest.mark.asyncio
async def test_cancel_cooldown_409_when_not_cooldown():
    from fastapi import HTTPException

    from app.api.btc_bot import cancel_cooldown

    session = BtcBotSession(id=10, user_id=1, status="active")
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    with pytest.raises(HTTPException) as exc:
        await cancel_cooldown(session_id=10, db=db, user=user)
    assert exc.value.status_code == 409
```

- [ ] **Step 2: Run — expect FAILs**

Run: `cd backend && pytest tests/v9/test_btc_bot_api.py -v`
Expected: 4 new FAILs.

- [ ] **Step 3: Append the mutation endpoints + helper to `api/btc_bot.py`**

Append to `backend/app/api/btc_bot.py`:

```python
from datetime import datetime, timezone
from decimal import Decimal

from app.broker.btc_bot_client import BtcBotClient
from app.core.config import settings
from app.core.security import decrypt_value
from app.models.broker import BrokerCredential
from app.schemas.btc_bot import BtcBotSessionCreateRequest


async def _build_client_for_session(session: BtcBotSession, db: AsyncSession) -> BtcBotClient:
    """Resolve creds + build BtcBotClient for an existing session row."""
    cred: Optional[BrokerCredential] = None
    if session.credential_id is not None:
        result = await db.execute(
            select(BrokerCredential).where(BrokerCredential.id == session.credential_id)
        )
        cred = result.scalars().first()

    if cred:
        api = decrypt_value(cred.api_key)
        secret = decrypt_value(cred.encrypted_secret_key)
    else:
        api = settings.visanu_alpaca_api_key
        secret = settings.visanu_alpaca_secret_key

    if not api or not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Alpaca credentials available for this session",
        )
    return BtcBotClient(api_key=api, secret_key=secret, paper=True)


@router.post("/sessions", response_model=BtcBotSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: BtcBotSessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Manually open a new session. Cron normally handles this on its own — this
    endpoint exists for testing + recovery.

    Returns 409 if an active or cooldown session already exists.
    """
    existing = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.user_id == user.id,
            BtcBotSession.status.in_(("active", "cooldown")),
        )
    )
    if existing.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active or cooldown session already exists",
        )

    initial = body.initial_buy_usd or Decimal(str(settings.btc_bot_initial_usd))
    session = BtcBotSession(
        user_id=user.id,
        status="active",
        initial_buy_usd=initial,
        total_qty=Decimal("0"),
        last_action_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/close", response_model=BtcBotSessionResponse)
async def close_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Manual close: market-sell all + status=ended (no cooldown).
    Only valid when session.status == 'active'.
    """
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.id == session_id,
            BtcBotSession.user_id == user.id,
        )
    )
    session = result.scalars().first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"cannot close session in status={session.status}",
        )

    proceeds = Decimal("0")
    fill_price = None
    order_id: Optional[str] = None
    if session.total_qty and session.total_qty > 0:
        client = await _build_client_for_session(session, db)
        fill = client.market_sell_all(qty=session.total_qty)
        proceeds = fill["filled_qty"] * fill["filled_price"]
        fill_price = fill["filled_price"]
        order_id = fill["order_id"]
        if session.blended_entry_price:
            cost_basis = session.total_qty * session.blended_entry_price
            session.realized_pnl = (proceeds - cost_basis).quantize(Decimal("0.01"))

    now = datetime.now(timezone.utc)
    session.status = "ended"
    session.ended_at = now
    session.total_qty = Decimal("0")
    session.last_action_at = now

    db.add(
        BtcBotAction(
            session_id=session.id,
            user_id=user.id,
            action="manual_close",
            btc_price=fill_price,
            qty_delta=-session.total_qty if session.total_qty else None,
            usd_delta=proceeds if proceeds > 0 else None,
            alpaca_order_id=order_id,
            notes="Manually closed via API",
        )
    )
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/cancel-cooldown", response_model=BtcBotSessionResponse)
async def cancel_cooldown(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel a session that is in cooldown. Soft-end (preserves audit history)."""
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.id == session_id,
            BtcBotSession.user_id == user.id,
        )
    )
    session = result.scalars().first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    if session.status != "cooldown":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"cannot cancel-cooldown on status={session.status}",
        )

    now = datetime.now(timezone.utc)
    session.status = "ended"
    session.ended_at = now
    session.cooldown_until = None
    session.last_action_at = now
    db.add(
        BtcBotAction(
            session_id=session.id,
            user_id=user.id,
            action="manual_close",
            notes="Cooldown cancelled via API",
        )
    )
    await db.commit()
    await db.refresh(session)
    return session
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd backend && pytest tests/v9/test_btc_bot_api.py -v`
Expected: `10 passed`.

- [ ] **Step 5: Full v9 suite passes**

Run: `cd backend && pytest tests/v9/ -v`
Expected: All v9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/btc_bot.py backend/tests/v9/test_btc_bot_api.py
git commit -m "api(btc-bot): mutation endpoints (create, close, cancel-cooldown)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: Frontend — Typed API Client

**Files:**
- Create: `frontend/lib/btc-bot-api.ts`

- [ ] **Step 1: Create the client**

Create `frontend/lib/btc-bot-api.ts`:

```typescript
/**
 * Typed fetch wrappers for /api/v1/btc-bot/*.
 *
 * Uses the shared apiFetch helper which attaches Bearer tokens and handles 401 redirects.
 */
import { apiFetch } from "@/lib/api";

export type BtcBotSession = {
  id: number;
  user_id: number;
  status: "active" | "cooldown" | "ended" | "error";
  original_entry_price: string | null;
  blended_entry_price: string | null;
  total_qty: string;
  initial_buy_usd: string;
  current_floor: string | null;
  trailing_active: boolean;
  trailing_high: string | null;
  ladder_next: number;
  cooldown_until: string | null;
  realized_pnl: string | null;
  last_action_at: string | null;
  created_at: string;
  updated_at: string | null;
  ended_at: string | null;
};

export type BtcBotAction = {
  id: number;
  session_id: number;
  user_id: number;
  action: string;
  btc_price: string | null;
  qty_delta: string | null;
  usd_delta: string | null;
  floor_before: string | null;
  floor_after: string | null;
  alpaca_order_id: string | null;
  notes: string | null;
  created_at: string;
};

export type BtcBotSessionDetail = {
  session: BtcBotSession;
  actions: BtcBotAction[];
};

export const btcBotApi = {
  getCurrentSession(): Promise<BtcBotSession | null> {
    return apiFetch<BtcBotSession | null>("/api/v1/btc-bot/session");
  },

  listSessions(limit = 50, offset = 0): Promise<BtcBotSession[]> {
    return apiFetch<BtcBotSession[]>(
      `/api/v1/btc-bot/sessions?limit=${limit}&offset=${offset}`
    );
  },

  getSessionDetail(id: number): Promise<BtcBotSessionDetail> {
    return apiFetch<BtcBotSessionDetail>(`/api/v1/btc-bot/sessions/${id}`);
  },

  listActions(opts: { action?: string; limit?: number; offset?: number } = {}): Promise<BtcBotAction[]> {
    const params = new URLSearchParams();
    if (opts.action) params.set("action", opts.action);
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    return apiFetch<BtcBotAction[]>(`/api/v1/btc-bot/actions?${params}`);
  },

  createSession(initialBuyUsd?: number): Promise<BtcBotSession> {
    return apiFetch<BtcBotSession>("/api/v1/btc-bot/sessions", {
      method: "POST",
      body: JSON.stringify(initialBuyUsd != null ? { initial_buy_usd: initialBuyUsd } : {}),
    });
  },

  closeSession(id: number): Promise<BtcBotSession> {
    return apiFetch<BtcBotSession>(`/api/v1/btc-bot/sessions/${id}/close`, {
      method: "POST",
    });
  },

  cancelCooldown(id: number): Promise<BtcBotSession> {
    return apiFetch<BtcBotSession>(`/api/v1/btc-bot/sessions/${id}/cancel-cooldown`, {
      method: "POST",
    });
  },
};
```

- [ ] **Step 2: TypeScript build check**

Run: `cd frontend && npx tsc --noEmit lib/btc-bot-api.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/btc-bot-api.ts
git commit -m "frontend(btc-bot): typed API client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: Frontend — `/btc-bot` Page

**Files:**
- Create: `frontend/app/btc-bot/page.tsx`

- [ ] **Step 1: Create the page**

Create `frontend/app/btc-bot/page.tsx`:

```tsx
"use client";

/**
 * /btc-bot — BTC Trailing-Stop Bot dashboard
 *
 * Three sections:
 *  1. Active session card (entry, blended, floor, qty, P&L)  — or
 *     Cooldown card (re-entry countdown + cancel button)
 *  2. Action history (paginated, filterable)
 *  3. Footer linking to /crons for scheduler management
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Bitcoin,
  Clock,
  Loader2,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { btcBotApi } from "@/lib/btc-bot-api";
import type { BtcBotAction, BtcBotSession } from "@/lib/btc-bot-api";

function formatDecimal(v: string | null, decimals = 2): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateTime(iso: string | null): string {
  if (iso == null) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatCountdown(iso: string | null): string {
  if (iso == null) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

// ─── Active session card ──────────────────────────────────────────────────────

function ActiveSessionCard({ session, onClose }: { session: BtcBotSession; onClose: () => void }) {
  return (
    <section className="bg-surface-mid border border-border p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
            Active Session #{session.id}
          </h3>
        </div>
        <span className="text-3xs text-muted-foreground font-mono">
          Started {formatDateTime(session.created_at)}
        </span>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <Stat label="Original entry" value={`$${formatDecimal(session.original_entry_price)}`} />
        <Stat label="Blended entry" value={`$${formatDecimal(session.blended_entry_price)}`} />
        <Stat label="Total qty" value={`${formatDecimal(session.total_qty, 8)} BTC`} />
        <Stat
          label="Current floor"
          value={`$${formatDecimal(session.current_floor)}`}
          tone="warning"
        />
        <Stat
          label="Trailing"
          value={session.trailing_active ? "ON" : "OFF"}
          tone={session.trailing_active ? "positive" : "neutral"}
        />
        <Stat label="Ladders fired" value={`${session.ladder_next} / 3`} />
      </div>

      <Button variant="outline" size="sm" onClick={onClose} className="text-2xs uppercase tracking-wider">
        <XCircle className="h-3.5 w-3.5 mr-1.5" />
        Force close
      </Button>
    </section>
  );
}

function CooldownCard({ session, onCancel }: { session: BtcBotSession; onCancel: () => void }) {
  return (
    <section className="bg-surface-mid border border-yellow-500/30 p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-yellow-400" />
          <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Cooldown #{session.id}
          </h3>
        </div>
        <span className="text-3xs text-muted-foreground font-mono">
          Re-entry in {formatCountdown(session.cooldown_until)}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat label="Realized PnL" value={`$${formatDecimal(session.realized_pnl)}`} tone={
          session.realized_pnl && Number(session.realized_pnl) >= 0 ? "positive" : "warning"
        } />
        <Stat label="Cooldown ends" value={formatDateTime(session.cooldown_until)} />
      </div>

      <Button variant="outline" size="sm" onClick={onCancel} className="text-2xs uppercase tracking-wider">
        <XCircle className="h-3.5 w-3.5 mr-1.5" />
        Cancel cooldown
      </Button>
    </section>
  );
}

function NoSessionCard() {
  return (
    <section className="bg-surface-mid border border-border p-8 text-center">
      <Bitcoin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
        No Active Session
      </p>
      <p className="text-3xs text-muted-foreground mt-2 max-w-md mx-auto">
        The cron will auto-open a new session on its next tick if credentials are configured.
        Manage cadence at <Link href="/crons" className="text-primary underline">/crons</Link>.
      </p>
    </section>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const colorClass =
    tone === "positive" ? "text-green-400" :
    tone === "warning"  ? "text-yellow-400" :
                          "text-foreground";
  return (
    <div>
      <p className="text-3xs uppercase tracking-wider text-muted-foreground/70 font-bold mb-0.5">
        {label}
      </p>
      <p className={`text-sm font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}

// ─── Action history table ───────────────────────────────────────────────────

const ACTION_COLOURS: Record<string, string> = {
  initial_buy:        "text-green-400",
  ladder_l1:          "text-green-400",
  ladder_l2:          "text-green-400",
  ladder_l3:          "text-green-400",
  trailing_activate:  "text-blue-400",
  trailing_advance:   "text-blue-400",
  stop_out:           "text-red-400",
  cooldown_start:     "text-yellow-400",
  cooldown_exit:      "text-yellow-400",
  adopted_position:   "text-purple-400",
  manual_close:       "text-orange-400",
  error:              "text-red-500",
};

function ActionHistory({ actions, loading }: { actions: BtcBotAction[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }
  if (actions.length === 0) {
    return (
      <p className="text-3xs text-muted-foreground py-8 text-center">No actions recorded yet.</p>
    );
  }
  return (
    <div className="text-xs">
      <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/30 bg-surface-lowest text-3xs font-bold uppercase tracking-widest text-muted-foreground/70">
        <div className="col-span-3">Time</div>
        <div className="col-span-1">#</div>
        <div className="col-span-3">Action</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">Qty Δ</div>
        <div className="col-span-1 text-right">Order</div>
      </div>
      {actions.map((a) => (
        <div key={a.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/20 hover:bg-surface-high/30">
          <div className="col-span-3 font-mono text-3xs text-muted-foreground">{formatDateTime(a.created_at)}</div>
          <div className="col-span-1 font-mono text-3xs text-muted-foreground">#{a.session_id}</div>
          <div className={`col-span-3 text-2xs font-bold ${ACTION_COLOURS[a.action] ?? "text-foreground"}`}>
            {a.action.replaceAll("_", " ")}
          </div>
          <div className="col-span-2 text-right font-mono">{a.btc_price ? `$${formatDecimal(a.btc_price)}` : "—"}</div>
          <div className="col-span-2 text-right font-mono">{a.qty_delta ?? "—"}</div>
          <div className="col-span-1 text-right font-mono text-3xs text-muted-foreground truncate">
            {a.alpaca_order_id?.slice(0, 8) ?? "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BtcBotPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);

  const { data: session, isPending: sessionPending, refetch } = useQuery({
    queryKey: ["btc-bot", "session"],
    queryFn: () => btcBotApi.getCurrentSession(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: actions = [], isPending: actionsPending } = useQuery({
    queryKey: ["btc-bot", "actions", actionFilter],
    queryFn: () => btcBotApi.listActions({ action: actionFilter, limit: 100 }),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["btc-bot"] });
  }

  const closeMut = useMutation({
    mutationFn: (id: number) => btcBotApi.closeSession(id),
    onSuccess: () => { toast.success("Session closed"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelCooldownMut = useMutation({
    mutationFn: (id: number) => btcBotApi.cancelCooldown(id),
    onSuccess: () => { toast.success("Cooldown cancelled"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell title="BTC Bot">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">BTC Trailing-Stop Bot</h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            FLOOR · Trailing · 3-Level Ladder
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 px-3 text-2xs font-bold uppercase">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {sessionPending ? (
        <Skeleton className="h-48 w-full mb-6" />
      ) : session === null || session === undefined ? (
        <div className="mb-6"><NoSessionCard /></div>
      ) : session.status === "active" ? (
        <div className="mb-6">
          <ActiveSessionCard session={session} onClose={() => closeMut.mutate(session.id)} />
        </div>
      ) : session.status === "cooldown" ? (
        <div className="mb-6">
          <CooldownCard session={session} onCancel={() => cancelCooldownMut.mutate(session.id)} />
        </div>
      ) : (
        <div className="mb-6 p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
          Session #{session.id} is in <strong>{session.status}</strong> state.
        </div>
      )}

      <section className="bg-surface-mid border border-border">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">Action History</h3>
          </div>
          <select
            value={actionFilter ?? ""}
            onChange={(e) => setActionFilter(e.target.value || undefined)}
            className="text-3xs bg-surface-lowest border border-border px-2 py-1"
          >
            <option value="">All actions</option>
            <option value="initial_buy">initial_buy</option>
            <option value="ladder_l1">ladder_l1</option>
            <option value="ladder_l2">ladder_l2</option>
            <option value="ladder_l3">ladder_l3</option>
            <option value="trailing_activate">trailing_activate</option>
            <option value="trailing_advance">trailing_advance</option>
            <option value="stop_out">stop_out</option>
            <option value="cooldown_start">cooldown_start</option>
            <option value="cooldown_exit">cooldown_exit</option>
            <option value="manual_close">manual_close</option>
            <option value="error">error</option>
          </select>
        </header>
        <ActionHistory actions={actions} loading={actionsPending} />
      </section>

      <p className="mt-4 text-3xs text-muted-foreground/50 uppercase tracking-wider">
        Cron: <code className="text-primary">btc_bot_monitor</code> · Manage cadence at{" "}
        <Link href="/crons" className="text-primary underline">/crons</Link>
      </p>
    </AppShell>
  );
}
```

- [ ] **Step 2: TypeScript build check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors related to `btc-bot/page.tsx` or `btc-bot-api.ts`.

- [ ] **Step 3: Smoke test in dev**

Run: `cd frontend && npm run dev` in one terminal, and in another start the backend (`cd backend && uvicorn app.main:app --reload`). Open `http://localhost:3000/btc-bot` — should render the empty-state card (no active session) without console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/btc-bot/page.tsx
git commit -m "frontend(btc-bot): /btc-bot page — session card + history

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Sidebar Entry

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Locate the existing wheel-bot / trailing-bot entries**

Open `frontend/components/layout/Sidebar.tsx`. Search for the string `wheel-bot` or `trailing-bot` to find the existing nav-link block.

- [ ] **Step 2: Add the new entry next to the wheel-bot link**

Add an entry mirroring the wheel-bot one (same icon style, label "BTC Bot"). Concrete example (your exact code will differ slightly depending on the sidebar's link-array shape):

```tsx
{ href: "/btc-bot", label: "BTC Bot", icon: Bitcoin },
```

If the file uses individual `<Link>` elements instead of an array, add:

```tsx
<NavLink href="/btc-bot" icon={Bitcoin} label="BTC Bot" />
```

Import `Bitcoin` from `lucide-react` at the top of the file if not already present.

- [ ] **Step 3: Verify the link appears**

With `npm run dev` running, open the app, log in, and confirm "BTC Bot" appears in the sidebar between "Wheel Bot" and "Crons" (or wherever fits visually).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "frontend(btc-bot): sidebar link

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Database Tables block — add V9 entry**

In the **Database Tables** section, after the V8 entry, add:

```markdown
**V9 (2):** `BtcBotSession` (`btc_bot_sessions`; partial-unique on `user_id` while `status IN ('active','cooldown')`), `BtcBotAction` (`btc_bot_actions`; sparse audit log of every state change)
```

- [ ] **Step 2: Update the Directory Layout block**

In the `backend/app/` directory listing, find the `api/` line and append `,btc_bot` to the v4+commodity comment line — or add a new line for v9. Then add `btc_bot.py` to `services/`, `broker/`, `scheduler/tasks/`, and `models/`. Update the `frontend/app/` line to include `btc-bot/` between the existing bot pages.

- [ ] **Step 3: Update the Render Memory Constraints scheduler intervals line**

Find the line beginning `**Scheduler intervals:**` and append:

```
btc-bot=15min
```

- [ ] **Step 4: Update the Test Suite block**

Append to the `pytest tests/v9/` line in the Test Suite section. If absent, add:

```bash
cd backend && pytest tests/v9/   # BTC bot (V9)
```

- [ ] **Step 5: Add a new "BTC Trailing-Stop Bot — Web Feature (V9)" section**

After the "PIN Auth (V8)" section, insert:

```markdown
## BTC Trailing-Stop Bot — Web Feature (V9)

Frontend page at `/btc-bot`. Converts the standalone `btc-bot/` CLI scripts into a multi-tenant scheduled feature managed from `/crons`.

**API routes** (`/api/v1/btc-bot/`): `GET /session` · `GET /sessions` · `GET /sessions/{id}` · `GET /actions` · `POST /sessions` · `POST /sessions/{id}/close` · `POST /sessions/{id}/cancel-cooldown`

**Strategy (from `btc-bot/BTC_BOT.md`):**
- FLOOR: blended_entry × 0.90 (up-only)
- Trailing activates at +10% gain; floor = current × 0.95; advances every +5% step
- 3-level ladder against original_entry: L1 (-20%, $10k), L2 (-30%, $15k), L3 (-40%, $20k)
- After stop-out: 4h cooldown, then auto re-enter with default initial buy

**Credential resolution:** Prefers `BrokerCredential` row; falls back to `VISANU_ALPACA_*` env vars only for the user whose email matches `BTC_BOT_BOOTSTRAP_USER_EMAIL`.

**Scheduler:** `btc_bot_monitor` every 15 min. Iterates active+cooldown sessions across all users + the bootstrap user. Single `AsyncSessionLocal` outside the loop, one commit at the end, `gc.collect()` in `finally`.

**Decision is pure:** `services.btc_bot_service.evaluate_tick(...) -> TickAction` has zero I/O — fully testable. Orchestrator in `scheduler/tasks/btc_bot_monitor.py` dispatches actions through `BtcBotClient` (thin alpaca-py wrapper).
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md updates for btc-bot V9

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: Full-Stack Smoke Test (Manual)

**Files:** none (verification only)

This is a manual verification step. Do not write code.

- [ ] **Step 1: Start backend with migration applied**

Run: `cd backend && alembic upgrade head && uvicorn app.main:app --reload`
Expected: backend starts on `:8000`; no migration errors; logs include `btc_bot_monitor=15m` in the scheduler-registered line.

- [ ] **Step 2: Start frontend**

Run: `cd frontend && npm run dev`
Expected: frontend on `:3000`.

- [ ] **Step 3: Verify `/crons` shows `btc_bot_monitor`**

Visit `http://localhost:3000/crons`, log in. Confirm a row labelled `Btc Bot Monitor` with interval `interval[0:15:00]`. Confirm pause/resume/run-now/edit-cadence buttons render.

- [ ] **Step 4: Trigger an immediate tick**

Click "Run Now" on the `btc_bot_monitor` row. In the backend logs you should see something like:

```
btc_bot_monitor: starting at 2026-05-12T...
btc_bot_monitor: ticking 1 user(s)
btc_bot: user=1 action=InitialBuy price=...
```

This proves the cron path works end-to-end, including a real Alpaca paper buy (since env vars are configured).

- [ ] **Step 5: Verify the session appears on `/btc-bot`**

Visit `http://localhost:3000/btc-bot`. Confirm:
- Active session card shows the new session with original/blended entry, qty, floor
- Action History shows one row: `initial_buy` with the fill price

- [ ] **Step 6: Verify a manual close works**

Click "Force close" on the active card. Confirm:
- Toast says "Session closed"
- The card switches to "No Active Session"
- History gains a `manual_close` row

- [ ] **Step 7: Smoke test — close out via Alpaca paper to clean up**

Run: `cd btc-bot && python btc_close_now.py`
Expected: any residual paper-BTC position is closed.

- [ ] **Step 8: Final commit (housekeeping if any)**

If anything was tweaked during smoke-testing, commit it. Otherwise nothing to do here.

---

## Self-Review Checklist (for the agent writing/executing this plan)

Run through this list once after the last commit, before marking the plan complete:

- [ ] All tasks 1–24 marked done
- [ ] `cd backend && pytest tests/v9/ -v` → all green
- [ ] `cd backend && alembic upgrade head && alembic downgrade v8_user_pins && alembic upgrade head` → no errors
- [ ] `cd frontend && npm run build` → no TypeScript errors
- [ ] `/crons` page lists `btc_bot_monitor` after backend restart (proves `register_jobs()` includes it)
- [ ] `/btc-bot` page renders without console errors when no session exists
- [ ] CLAUDE.md V9 section, Test Suite line, scheduler-intervals line, directory layout all updated
- [ ] Sidebar contains the "BTC Bot" link
- [ ] No `print()` / `console.log()` left in committed code (use loggers)
- [ ] No secrets committed (`VISANU_ALPACA_*` values stay in `.env`, never in code)

Plan complete.
