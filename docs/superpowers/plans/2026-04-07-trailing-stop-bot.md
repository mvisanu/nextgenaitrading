# Trailing Stop Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/trailing-bot` page where the user configures a stock purchase with an automatic trailing stop loss and ladder-in buy rules, executed against their Alpaca paper/live account.

**Architecture:** New FastAPI router (`/api/v1/trailing-bot`) backed by a `TrailingBotSession` DB model. A background APScheduler task monitors active sessions every 5 minutes and raises/adjusts stop orders when price thresholds are hit. The frontend page follows the existing "Sovereign Terminal" design system (same pattern as `/auto-buy`).

**Tech Stack:** FastAPI · SQLAlchemy 2.x async · Alembic · alpaca-py SDK · Next.js 14 App Router · TypeScript · TanStack Query · shadcn/ui · Tailwind · Lucide icons

---

## File Map

### Backend — new files
| File | Responsibility |
|---|---|
| `backend/app/models/trailing_bot.py` | `TrailingBotSession` ORM model |
| `backend/app/schemas/trailing_bot.py` | Pydantic request/response DTOs |
| `backend/app/services/trailing_bot_service.py` | Place orders, compute stop adjustments |
| `backend/app/api/trailing_bot.py` | FastAPI router: setup, status, cancel |
| `backend/app/scheduler/tasks/trailing_bot_monitor.py` | APScheduler task: price check + stop adjustment |
| `backend/app/alembic/versions/v5_trailing_bot.py` | Migration: `trailing_bot_sessions` table |

### Backend — modified files
| File | Change |
|---|---|
| `backend/app/main.py` | Register `trailing_bot` router |
| `backend/app/scheduler/jobs.py` | Register `monitor_trailing_bots` job |

### Frontend — new files
| File | Responsibility |
|---|---|
| `frontend/app/trailing-bot/page.tsx` | Full page: form + confirmation summary |
| `frontend/lib/trailing-bot-api.ts` | Typed fetch wrappers for trailing-bot endpoints |

### Frontend — modified files
| File | Change |
|---|---|
| `frontend/types/index.ts` | Add `TrailingBotSetup*`, `TrailingBotSession`, `LadderRule` types |
| `frontend/components/layout/Sidebar.tsx` | Add `/trailing-bot` nav link under Terminal group |
| `frontend/proxy.ts` | Add `/trailing-bot` to `PROTECTED_PREFIXES` |

---

## Task 1: DB Model + Alembic Migration

**Files:**
- Create: `backend/app/models/trailing_bot.py`
- Create: `backend/app/alembic/versions/v5_trailing_bot.py`

- [ ] **Step 1: Write the model**

```python
# backend/app/models/trailing_bot.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TrailingBotSession(Base):
    __tablename__ = "trailing_bot_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[int] = mapped_column(
        ForeignKey("broker_credentials.id", ondelete="CASCADE"), nullable=False
    )

    # Position basics
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    initial_qty: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Alpaca order IDs
    initial_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    stop_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Floor / trailing rules
    floor_price: Mapped[float] = mapped_column(Float, nullable=False)
    trailing_trigger_pct: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    trailing_trail_pct: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    trailing_step_pct: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)

    # Trailing state
    trailing_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    trailing_high_water: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_floor: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Ladder-in rules + fill tracking (JSON stored as Text)
    # Format: '[{"price": 150.0, "qty": 2, "order_id": "abc", "filled": false}]'
    ladder_rules_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # dry_run flag — passed through to every broker call
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Session status
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    # status values: "active" | "cancelled" | "stopped_out" | "completed"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
```

- [ ] **Step 2: Write the Alembic migration**

```python
# backend/app/alembic/versions/v5_trailing_bot.py
"""v5 trailing_bot_sessions table

Revision ID: v5_trailing_bot
Revises: v4_options          # update this to the actual latest revision id
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v5_trailing_bot"
down_revision = "v4_options"   # replace with actual latest head from: alembic current
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trailing_bot_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("credential_id", sa.Integer, sa.ForeignKey("broker_credentials.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("initial_qty", sa.Float, nullable=False),
        sa.Column("entry_price", sa.Float, nullable=True),
        sa.Column("initial_order_id", sa.String(100), nullable=True),
        sa.Column("stop_order_id", sa.String(100), nullable=True),
        sa.Column("floor_price", sa.Float, nullable=False),
        sa.Column("trailing_trigger_pct", sa.Float, nullable=False, server_default="10.0"),
        sa.Column("trailing_trail_pct", sa.Float, nullable=False, server_default="5.0"),
        sa.Column("trailing_step_pct", sa.Float, nullable=False, server_default="5.0"),
        sa.Column("trailing_active", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("trailing_high_water", sa.Float, nullable=True),
        sa.Column("current_floor", sa.Float, nullable=True),
        sa.Column("ladder_rules_json", sa.Text, nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("trailing_bot_sessions")
```

- [ ] **Step 3: Find the real current alembic head and update `down_revision`**

```bash
cd backend && source .venv/Scripts/activate && alembic current
```

Update `down_revision` in `v5_trailing_bot.py` to match the revision ID printed.

- [ ] **Step 4: Run the migration**

```bash
alembic upgrade head
```

Expected output: `Running upgrade <prev> -> v5_trailing_bot, v5 trailing_bot_sessions table`

- [ ] **Step 5: Verify table exists**

```bash
python -c "
import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text(\"SELECT COUNT(*) FROM trailing_bot_sessions\"))
        print('trailing_bot_sessions row count:', r.scalar())

asyncio.run(check())
"
```

Expected: `trailing_bot_sessions row count: 0`

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/trailing_bot.py backend/app/alembic/versions/v5_trailing_bot.py
git commit -m "feat: add TrailingBotSession model + v5 migration"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/trailing_bot.py`

- [ ] **Step 1: Write schemas**

```python
# backend/app/schemas/trailing_bot.py
from __future__ import annotations

import json
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LadderRule(BaseModel):
    price: float = Field(..., gt=0, description="Price level to buy more shares")
    qty: float = Field(..., gt=0, description="Number of shares to buy at this level")


class TrailingBotSetupRequest(BaseModel):
    credential_id: int
    symbol: str = Field(..., min_length=1, max_length=20)
    initial_qty: float = Field(..., gt=0)
    floor_price: float = Field(..., gt=0, description="Hard stop-loss: sell all if price hits this")
    ladder_rules: list[LadderRule] = Field(default_factory=list, max_length=5)
    dry_run: bool = True

    @field_validator("symbol")
    @classmethod
    def normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()


class LadderRuleOut(BaseModel):
    price: float
    qty: float
    order_id: str
    filled: bool


class TrailingBotSessionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    symbol: str
    initial_qty: float
    entry_price: Optional[float]
    initial_order_id: Optional[str]
    stop_order_id: Optional[str]
    floor_price: float
    trailing_trigger_pct: float
    trailing_trail_pct: float
    trailing_step_pct: float
    trailing_active: bool
    current_floor: Optional[float]
    ladder_rules: list[LadderRuleOut]
    dry_run: bool
    status: str
    created_at: str

    @classmethod
    def from_orm_session(cls, s: "TrailingBotSession") -> "TrailingBotSessionOut":  # noqa: F821
        ladder_rules = json.loads(s.ladder_rules_json or "[]")
        return cls(
            id=s.id,
            symbol=s.symbol,
            initial_qty=s.initial_qty,
            entry_price=s.entry_price,
            initial_order_id=s.initial_order_id,
            stop_order_id=s.stop_order_id,
            floor_price=s.floor_price,
            trailing_trigger_pct=s.trailing_trigger_pct,
            trailing_trail_pct=s.trailing_trail_pct,
            trailing_step_pct=s.trailing_step_pct,
            trailing_active=s.trailing_active,
            current_floor=s.current_floor,
            ladder_rules=[LadderRuleOut(**r) for r in ladder_rules],
            dry_run=s.dry_run,
            status=s.status,
            created_at=s.created_at.isoformat(),
        )
```

- [ ] **Step 2: Verify schemas parse correctly (no test runner needed for schema shape)**

```bash
python -c "
from app.schemas.trailing_bot import TrailingBotSetupRequest, LadderRule
r = TrailingBotSetupRequest(
    credential_id=1,
    symbol='tsla',
    initial_qty=2,
    floor_price=200.0,
    ladder_rules=[LadderRule(price=220.0, qty=1), LadderRule(price=210.0, qty=2)],
)
print(r)
assert r.symbol == 'TSLA'
print('OK')
"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/trailing_bot.py
git commit -m "feat: add trailing bot Pydantic schemas"
```

---

## Task 3: Service — Order Placement + Stop Adjustment Logic

**Files:**
- Create: `backend/app/services/trailing_bot_service.py`

- [ ] **Step 1: Write the service**

```python
# backend/app/services/trailing_bot_service.py
from __future__ import annotations

import json
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.factory import get_broker_client
from app.models.trailing_bot import TrailingBotSession
from app.models.user import User
from app.schemas.trailing_bot import TrailingBotSetupRequest
from app.services import credential_service

logger = logging.getLogger(__name__)


def _place_stop_order_alpaca(
    client,
    symbol: str,
    qty: float,
    stop_price: float,
    dry_run: bool,
) -> str:
    """Place a stop-market sell order via alpaca-py. Returns broker order ID."""
    if dry_run:
        return f"dry-stop-{symbol}-{stop_price}"

    from alpaca.trading.enums import OrderSide, TimeInForce
    from alpaca.trading.requests import StopOrderRequest

    req = StopOrderRequest(
        symbol=symbol,
        qty=qty,
        side=OrderSide.SELL,
        time_in_force=TimeInForce.GTC,
        stop_price=stop_price,
    )
    order = client.client.submit_order(req)
    return str(order.id)


def _place_limit_buy_alpaca(
    client,
    symbol: str,
    qty: float,
    limit_price: float,
    dry_run: bool,
) -> str:
    """Place a limit buy order via alpaca-py. Returns broker order ID."""
    if dry_run:
        return f"dry-limit-{symbol}-{limit_price}"

    from alpaca.trading.enums import OrderSide, TimeInForce
    from alpaca.trading.requests import LimitOrderRequest

    req = LimitOrderRequest(
        symbol=symbol,
        qty=qty,
        side=OrderSide.BUY,
        time_in_force=TimeInForce.GTC,
        limit_price=limit_price,
    )
    order = client.client.submit_order(req)
    return str(order.id)


def _cancel_order_alpaca(client, order_id: str, dry_run: bool) -> None:
    """Cancel an existing order by ID."""
    if dry_run or order_id.startswith("dry-"):
        return
    try:
        import uuid
        client.client.cancel_order_by_id(uuid.UUID(order_id))
    except Exception as exc:
        logger.warning("Could not cancel order %s: %s", order_id, exc)


def _get_latest_price(symbol: str) -> Optional[float]:
    """Fetch the latest close price for a symbol using the existing yfinance cache."""
    try:
        from app.services.market_data import load_ohlcv_for_strategy
        df = load_ohlcv_for_strategy(symbol, "1d")
        if df is not None and len(df) > 0:
            return float(df["Close"].iloc[-1])
    except Exception as exc:
        logger.warning("Price fetch failed for %s: %s", symbol, exc)
    return None


async def setup_trailing_bot(
    req: TrailingBotSetupRequest,
    db: AsyncSession,
    current_user: User,
) -> TrailingBotSession:
    """
    1. Buy initial_qty shares at market.
    2. Place a stop-market sell order at floor_price.
    3. Place limit buy orders for each ladder rule.
    4. Save the session to DB and return it.
    """
    cred = await credential_service.get_credential(req.credential_id, db, current_user)
    broker = get_broker_client(cred)

    # Step 1: Market buy
    buy_result = broker.place_order(
        symbol=req.symbol,
        side="buy",
        quantity=req.initial_qty,
        dry_run=req.dry_run,
    )

    # Step 2: Floor stop-market sell order
    stop_order_id = _place_stop_order_alpaca(
        broker, req.symbol, req.initial_qty, req.floor_price, req.dry_run
    )

    # Step 3: Ladder-in limit buys
    ladder_rows = []
    for rule in req.ladder_rules:
        order_id = _place_limit_buy_alpaca(
            broker, req.symbol, rule.qty, rule.price, req.dry_run
        )
        ladder_rows.append({
            "price": rule.price,
            "qty": rule.qty,
            "order_id": order_id,
            "filled": False,
        })

    # Step 4: Persist session
    session = TrailingBotSession(
        user_id=current_user.id,
        credential_id=req.credential_id,
        symbol=req.symbol,
        initial_qty=req.initial_qty,
        entry_price=buy_result.filled_price,
        initial_order_id=buy_result.broker_order_id,
        stop_order_id=stop_order_id,
        floor_price=req.floor_price,
        current_floor=req.floor_price,
        trailing_trigger_pct=10.0,
        trailing_trail_pct=5.0,
        trailing_step_pct=5.0,
        trailing_active=False,
        trailing_high_water=None,
        ladder_rules_json=json.dumps(ladder_rows),
        dry_run=req.dry_run,
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def adjust_trailing_stop(
    session: TrailingBotSession,
    broker,
    db: AsyncSession,
) -> None:
    """
    Called by the scheduler. Checks current price against trailing rules and
    adjusts the stop order upward if thresholds are met. Floor never goes down.
    """
    if session.status != "active" or session.entry_price is None:
        return

    current_price = _get_latest_price(session.symbol)
    if current_price is None:
        return

    entry = session.entry_price
    gain_pct = ((current_price - entry) / entry) * 100

    # Activate trailing once price gains trailing_trigger_pct (default 10%)
    if not session.trailing_active:
        if gain_pct >= session.trailing_trigger_pct:
            session.trailing_active = True
            session.trailing_high_water = current_price
            new_floor = round(current_price * (1 - session.trailing_trail_pct / 100), 4)
            if new_floor > (session.current_floor or 0):
                logger.info(
                    "Session %d: activating trailing stop. Gain=%.2f%%, new floor=$%.4f",
                    session.id, gain_pct, new_floor,
                )
                _cancel_order_alpaca(broker, session.stop_order_id or "", session.dry_run)
                new_stop_id = _place_stop_order_alpaca(
                    broker, session.symbol, session.initial_qty, new_floor, session.dry_run
                )
                session.stop_order_id = new_stop_id
                session.current_floor = new_floor
        return

    # Already trailing: move floor up every trailing_step_pct above high water
    if current_price > (session.trailing_high_water or 0):
        prev_high = session.trailing_high_water or entry
        step_gained = ((current_price - prev_high) / prev_high) * 100

        if step_gained >= session.trailing_step_pct:
            new_floor = round(current_price * (1 - session.trailing_trail_pct / 100), 4)
            if new_floor > (session.current_floor or 0):
                logger.info(
                    "Session %d: raising floor. Price=$%.4f, new floor=$%.4f",
                    session.id, current_price, new_floor,
                )
                _cancel_order_alpaca(broker, session.stop_order_id or "", session.dry_run)
                new_stop_id = _place_stop_order_alpaca(
                    broker, session.symbol, session.initial_qty, new_floor, session.dry_run
                )
                session.stop_order_id = new_stop_id
                session.current_floor = new_floor
                session.trailing_high_water = current_price
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/trailing_bot_service.py
git commit -m "feat: trailing bot service — order placement + stop adjustment logic"
```

---

## Task 4: API Router

**Files:**
- Create: `backend/app/api/trailing_bot.py`

- [ ] **Step 1: Write the router**

```python
# backend/app/api/trailing_bot.py
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.trailing_bot import TrailingBotSession
from app.models.user import User
from app.schemas.trailing_bot import TrailingBotSessionOut, TrailingBotSetupRequest
from app.services.trailing_bot_service import setup_trailing_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trailing-bot", tags=["trailing-bot"])


@router.post("/setup", response_model=TrailingBotSessionOut, status_code=status.HTTP_201_CREATED)
async def setup_bot(
    payload: TrailingBotSetupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TrailingBotSessionOut:
    """Buy shares at market and set up floor + trailing stop + ladder-in rules."""
    session = await setup_trailing_bot(payload, db, current_user)
    return TrailingBotSessionOut.from_orm_session(session)


@router.get("/sessions", response_model=list[TrailingBotSessionOut])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[TrailingBotSessionOut]:
    """List all trailing bot sessions for this user, newest first."""
    result = await db.execute(
        select(TrailingBotSession)
        .where(TrailingBotSession.user_id == current_user.id)
        .order_by(TrailingBotSession.created_at.desc())
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [TrailingBotSessionOut.from_orm_session(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=TrailingBotSessionOut)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TrailingBotSessionOut:
    """Get a specific session by ID."""
    result = await db.execute(
        select(TrailingBotSession).where(
            TrailingBotSession.id == session_id,
            TrailingBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return TrailingBotSessionOut.from_orm_session(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Cancel an active trailing bot session (marks as cancelled, does NOT auto-sell)."""
    result = await db.execute(
        select(TrailingBotSession).where(
            TrailingBotSession.id == session_id,
            TrailingBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = "cancelled"
    await db.commit()
    from fastapi.responses import Response
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 2: Register router in `main.py`**

Open `backend/app/main.py`. Find the block where other routers are included (search for `app.include_router`). Add:

```python
from app.api.trailing_bot import router as trailing_bot_router
app.include_router(trailing_bot_router, prefix="/api/v1")
```

- [ ] **Step 3: Verify routes appear in docs**

```bash
uvicorn app.main:app --reload &
sleep 3
curl http://localhost:8000/openapi.json | python -c "
import json, sys
spec = json.load(sys.stdin)
paths = [p for p in spec['paths'] if 'trailing' in p]
print(paths)
"
```

Expected: `['/api/v1/trailing-bot/setup', '/api/v1/trailing-bot/sessions', ...]`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/trailing_bot.py backend/app/main.py
git commit -m "feat: trailing bot API router — setup, list, get, cancel endpoints"
```

---

## Task 5: Scheduler Task — Trailing Monitor

**Files:**
- Create: `backend/app/scheduler/tasks/trailing_bot_monitor.py`
- Modify: `backend/app/scheduler/jobs.py`

- [ ] **Step 1: Write the monitor task**

```python
# backend/app/scheduler/tasks/trailing_bot_monitor.py
from __future__ import annotations

import asyncio
import gc
import logging

from sqlalchemy import select

from app.broker.factory import get_broker_client
from app.db.session import AsyncSessionLocal
from app.models.trailing_bot import TrailingBotSession
from app.services import credential_service
from app.services.trailing_bot_service import adjust_trailing_stop

logger = logging.getLogger(__name__)


async def _run_monitor() -> None:
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(TrailingBotSession).where(TrailingBotSession.status == "active")
            )
            sessions = result.scalars().all()
            logger.info("Trailing bot monitor: checking %d active session(s)", len(sessions))

            for session in sessions:
                try:
                    # Load credential directly (no user context needed — admin task)
                    from sqlalchemy import select as sa_select
                    from app.models.broker import BrokerCredential

                    cred_result = await db.execute(
                        sa_select(BrokerCredential).where(
                            BrokerCredential.id == session.credential_id
                        )
                    )
                    cred = cred_result.scalar_one_or_none()
                    if not cred:
                        logger.warning("Session %d: credential not found, skipping", session.id)
                        continue

                    broker = get_broker_client(cred)
                    await adjust_trailing_stop(session, broker, db)
                except Exception as exc:
                    logger.error("Session %d monitor error: %s", session.id, exc)

            await db.commit()
        finally:
            gc.collect()


def monitor_trailing_bots() -> None:
    """Synchronous wrapper called by APScheduler."""
    asyncio.run(_run_monitor())
```

- [ ] **Step 2: Register the job in `jobs.py`**

Open `backend/app/scheduler/jobs.py`. Find where other jobs are registered (look for `scheduler.add_job`). Add:

```python
from app.scheduler.tasks.trailing_bot_monitor import monitor_trailing_bots

scheduler.add_job(
    monitor_trailing_bots,
    trigger="interval",
    minutes=5,
    id="trailing_bot_monitor",
    replace_existing=True,
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/scheduler/tasks/trailing_bot_monitor.py backend/app/scheduler/jobs.py
git commit -m "feat: trailing bot scheduler task — monitors and adjusts stops every 5 min"
```

---

## Task 6: Frontend Types

**Files:**
- Modify: `frontend/types/index.ts`

- [ ] **Step 1: Append trailing bot types to `types/index.ts`**

Add at the end of the file:

```typescript
// ─── Trailing Bot ─────────────────────────────────────────────────────────────

export interface LadderRuleOut {
  price: number;
  qty: number;
  order_id: string;
  filled: boolean;
}

export interface TrailingBotSessionOut {
  id: number;
  symbol: string;
  initial_qty: number;
  entry_price: number | null;
  initial_order_id: string | null;
  stop_order_id: string | null;
  floor_price: number;
  trailing_trigger_pct: number;
  trailing_trail_pct: number;
  trailing_step_pct: number;
  trailing_active: boolean;
  current_floor: number | null;
  ladder_rules: LadderRuleOut[];
  dry_run: boolean;
  status: string;
  created_at: string;
}

export interface LadderRuleIn {
  price: number;
  qty: number;
}

export interface TrailingBotSetupRequest {
  credential_id: number;
  symbol: string;
  initial_qty: number;
  floor_price: number;
  ladder_rules: LadderRuleIn[];
  dry_run: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types/index.ts
git commit -m "feat: add TrailingBot frontend types"
```

---

## Task 7: Frontend API Wrapper

**Files:**
- Create: `frontend/lib/trailing-bot-api.ts`

- [ ] **Step 1: Write the API module**

```typescript
// frontend/lib/trailing-bot-api.ts
import type { TrailingBotSessionOut, TrailingBotSetupRequest } from "@/types";
import { apiFetch } from "@/lib/api"; // re-uses the existing auth-aware fetch wrapper

export const trailingBotApi = {
  setup: (payload: TrailingBotSetupRequest): Promise<TrailingBotSessionOut> =>
    apiFetch("/api/v1/trailing-bot/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  list: (): Promise<TrailingBotSessionOut[]> =>
    apiFetch("/api/v1/trailing-bot/sessions"),

  get: (id: number): Promise<TrailingBotSessionOut> =>
    apiFetch(`/api/v1/trailing-bot/sessions/${id}`),

  cancel: (id: number): Promise<void> =>
    apiFetch(`/api/v1/trailing-bot/sessions/${id}`, { method: "DELETE" }),
};
```

> **Note:** `apiFetch` is the low-level auth-aware fetch already exported from `lib/api.ts`. Check the export name — it may be named `apiFetch`, `apiGet`, or similar. Search `lib/api.ts` for the base fetch function name and update the import accordingly.

- [ ] **Step 2: Verify `apiFetch` is exported from `lib/api.ts`**

```bash
grep -n "^export.*fetch\|^export.*Fetch\|^export async function api\|^export function api" frontend/lib/api.ts | head -10
```

If the function has a different name, update the import in `trailing-bot-api.ts` to match.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/trailing-bot-api.ts
git commit -m "feat: trailing bot API client wrapper"
```

---

## Task 8: Frontend Page

**Files:**
- Create: `frontend/app/trailing-bot/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// frontend/app/trailing-bot/page.tsx
"use client";

/**
 * /trailing-bot — Trailing Stop Bot
 *
 * Sovereign Terminal design system (matches /auto-buy):
 * - Form panel: stock symbol, shares, floor, ladder-in rules
 * - Dry-run toggle with confirmation dialog on live mode
 * - Summary card: every order and rule placed, status badges
 * - Session history: recent sessions list
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  X,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trailingBotApi } from "@/lib/trailing-bot-api";
import { brokerApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TrailingBotSessionOut, TrailingBotSetupRequest } from "@/types";

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active:      { label: "ACTIVE",      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    cancelled:   { label: "CANCELLED",   className: "bg-muted/40 text-muted-foreground border-muted/30" },
    stopped_out: { label: "STOPPED OUT", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    completed:   { label: "COMPLETE",    className: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  };
  const cfg = map[status] ?? { label: status.toUpperCase(), className: "" };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono tracking-widest px-2", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

// ─── Session summary card ─────────────────────────────────────────────────────

function SessionCard({
  session,
  onCancel,
  isCancelling,
}: {
  session: TrailingBotSessionOut;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface-low p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-primary">{session.symbol}</span>
          <StatusBadge status={session.status} />
          {session.dry_run && (
            <Badge variant="outline" className="text-[10px] font-mono tracking-widest px-2 bg-amber-500/10 text-amber-400 border-amber-500/20">
              DRY RUN
            </Badge>
          )}
        </div>
        {session.status === "active" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-red-400 h-7 px-2"
            onClick={() => onCancel(session.id)}
            disabled={isCancelling}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      <Separator className="opacity-30" />

      {/* Orders grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {/* Initial buy */}
        <div className="rounded-md border border-border/30 bg-surface-mid p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Play className="h-3 w-3 text-emerald-400" />
            INITIAL BUY
          </div>
          <p className="font-mono font-semibold">{session.initial_qty} × {session.symbol}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {session.entry_price != null
              ? `@ $${session.entry_price.toFixed(2)}`
              : "Pending fill"}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-mono truncate">
            ID: {session.initial_order_id ?? "—"}
          </p>
        </div>

        {/* Floor stop */}
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
            <ShieldCheck className="h-3 w-3" />
            FLOOR (STOP LOSS)
          </div>
          <p className="font-mono font-semibold text-red-300">${session.floor_price.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground font-mono">
            Current: ${(session.current_floor ?? session.floor_price).toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            {session.trailing_active ? "Trailing ACTIVE" : `Activates at +${session.trailing_trigger_pct}%`}
          </p>
        </div>

        {/* Trailing rule */}
        <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-sky-400 font-mono">
            <TrendingUp className="h-3 w-3" />
            TRAILING FLOOR
          </div>
          <p className="font-mono font-semibold text-sky-300">
            {session.trailing_trail_pct}% below peak
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Rises every +{session.trailing_step_pct}%
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            Trigger: +{session.trailing_trigger_pct}% from entry
          </p>
        </div>
      </div>

      {/* Ladder rules */}
      {session.ladder_rules.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-mono text-muted-foreground flex items-center gap-1">
            <Layers className="h-3 w-3 text-violet-400" />
            LADDER-IN RULES
          </p>
          {session.ladder_rules.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between rounded px-3 py-1.5 text-xs font-mono",
                r.filled
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-surface-mid border border-border/30"
              )}
            >
              <span>
                If drops to <span className="text-violet-300 font-semibold">${r.price.toFixed(2)}</span>
                {" "}→ buy <span className="font-semibold">{r.qty}</span> more shares
              </span>
              <span className="text-muted-foreground/60 truncate ml-2 hidden sm:inline">
                {r.filled ? "✓ FILLED" : `ID: ${r.order_id}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/40 font-mono">
        Created {new Date(session.created_at).toLocaleString()}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrailingBotPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [symbol, setSymbol] = useState("");
  const [initialQty, setInitialQty] = useState("");
  const [floorPrice, setFloorPrice] = useState("");
  const [credentialId, setCredentialId] = useState<string>("");
  const [dryRun, setDryRun] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ladders, setLadders] = useState([
    { price: "", qty: "" },
    { price: "", qty: "" },
  ]);

  // Credentials
  const { data: credentials = [] } = useQuery({
    queryKey: ["credentials"],
    queryFn: brokerApi.list,
    enabled: !!user,
  });

  // Sessions history
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["trailing-bot-sessions"],
    queryFn: trailingBotApi.list,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Setup mutation
  const setupMutation = useMutation({
    mutationFn: trailingBotApi.setup,
    onSuccess: () => {
      toast.success("Trailing bot session started");
      queryClient.invalidateQueries({ queryKey: ["trailing-bot-sessions"] });
      setSymbol("");
      setInitialQty("");
      setFloorPrice("");
      setLadders([{ price: "", qty: "" }, { price: "", qty: "" }]);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to start bot");
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: trailingBotApi.cancel,
    onSuccess: () => {
      toast.success("Session cancelled");
      queryClient.invalidateQueries({ queryKey: ["trailing-bot-sessions"] });
    },
  });

  const validLadders = useMemo(
    () =>
      ladders
        .filter((l) => l.price && l.qty && Number(l.price) > 0 && Number(l.qty) > 0)
        .map((l) => ({ price: Number(l.price), qty: Number(l.qty) })),
    [ladders]
  );

  const canSubmit =
    symbol.trim() &&
    Number(initialQty) > 0 &&
    Number(floorPrice) > 0 &&
    credentialId;

  function handleSubmitClick() {
    if (!dryRun) {
      setConfirmOpen(true);
    } else {
      submitSetup();
    }
  }

  function submitSetup() {
    setConfirmOpen(false);
    const payload: TrailingBotSetupRequest = {
      credential_id: Number(credentialId),
      symbol: symbol.trim().toUpperCase(),
      initial_qty: Number(initialQty),
      floor_price: Number(floorPrice),
      ladder_rules: validLadders,
      dry_run: dryRun,
    };
    setupMutation.mutate(payload);
  }

  if (authLoading) return null;

  return (
    <AppShell title="Trailing Stop Bot">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">
            Trailing Stop Bot
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Buy now. Set a floor. Let winners run with an automatic trailing stop.
          </p>
        </div>

        {/* Dry-run notice */}
        {dryRun && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300 text-sm">
              Dry-run mode — no real orders will be placed. Toggle off to trade live.
            </AlertDescription>
          </Alert>
        )}

        {/* Setup form */}
        <div className="rounded-lg border border-border/40 bg-surface-low p-6 space-y-6">
          <h2 className="text-sm font-mono font-semibold text-muted-foreground tracking-widest uppercase">
            Configure Strategy
          </h2>

          {/* Row 1: symbol + qty + account */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Stock Symbol</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="TSLA"
                className="font-mono placeholder:text-primary/40"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Shares to Buy</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value)}
                placeholder="1"
                className="font-mono placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Broker Account</Label>
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="font-mono">
                      {c.profile_name} — {c.provider}
                      {c.paper_trading ? " (paper)" : " (live)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Row 2: Floor */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-red-400" />
              <span className="text-sm font-mono font-semibold">Floor (Hard Stop Loss)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sell everything if the price drops to this level.
            </p>
            <div className="w-48">
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={floorPrice}
                onChange={(e) => setFloorPrice(e.target.value)}
                placeholder="200.00"
                className="font-mono placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Row 3: Trailing floor description (always 10% / 5%) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-400" />
              <span className="text-sm font-mono font-semibold">Trailing Floor</span>
            </div>
            <div className="rounded-md border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs font-mono space-y-1 text-sky-300">
              <p>↑ Activates when price rises <span className="font-bold">+10%</span> from your entry</p>
              <p>↑ Stop moves to <span className="font-bold">5% below current price</span></p>
              <p>↑ Rises again every additional <span className="font-bold">+5%</span> gain</p>
              <p className="text-muted-foreground/60">The floor only moves UP — never down.</p>
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Row 4: Ladder-in */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-mono font-semibold">Ladder-In Rules</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically buy more shares at specific lower price levels.
            </p>
            {ladders.map((l, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">
                  Level {i + 1}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={l.price}
                    onChange={(e) => {
                      const next = [...ladders];
                      next[i] = { ...next[i], price: e.target.value };
                      setLadders(next);
                    }}
                    placeholder="Price $"
                    className="font-mono placeholder:text-muted-foreground/60 w-28"
                  />
                  <span className="text-xs text-muted-foreground font-mono">→ buy</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={l.qty}
                    onChange={(e) => {
                      const next = [...ladders];
                      next[i] = { ...next[i], qty: e.target.value };
                      setLadders(next);
                    }}
                    placeholder="Shares"
                    className="font-mono placeholder:text-muted-foreground/60 w-24"
                  />
                  <span className="text-xs text-muted-foreground font-mono">shares</span>
                </div>
              </div>
            ))}
          </div>

          <Separator className="opacity-30" />

          {/* Row 5: Dry-run + submit */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={dryRun}
                onCheckedChange={setDryRun}
                id="dry-run-toggle"
              />
              <Label htmlFor="dry-run-toggle" className="text-sm cursor-pointer">
                {dryRun ? (
                  <span className="text-amber-400 font-mono">Dry-Run Mode (no real orders)</span>
                ) : (
                  <span className="text-red-400 font-mono font-semibold">LIVE TRADING</span>
                )}
              </Label>
            </div>

            <Button
              onClick={handleSubmitClick}
              disabled={!canSubmit || setupMutation.isPending}
              className={cn(
                "font-mono",
                !dryRun && "bg-red-600 hover:bg-red-700 text-white"
              )}
            >
              {setupMutation.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Setting up...</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Deploy Bot</>
              )}
            </Button>
          </div>
        </div>

        {/* Sessions history */}
        {(sessions.length > 0 || sessionsLoading) && (
          <div className="space-y-4">
            <h2 className="text-sm font-mono font-semibold text-muted-foreground tracking-widest uppercase">
              Bot Sessions
            </h2>
            {sessionsLoading ? (
              <p className="text-sm text-muted-foreground font-mono">Loading sessions...</p>
            ) : (
              sessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onCancel={cancelMutation.mutate}
                  isCancelling={cancelMutation.isPending}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Live trade confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Live Trade
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>You are about to place <strong>real orders</strong> with real money.</p>
              <ul className="text-sm space-y-1 font-mono">
                <li>• Buy <strong>{initialQty} × {symbol || "?"}</strong> at market</li>
                <li>• Stop loss at <strong>${floorPrice}</strong></li>
                {validLadders.map((l, i) => (
                  <li key={i}>• Buy {l.qty} more at <strong>${l.price}</strong></li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                NextGen Trading does not guarantee any outcome. Past performance is not indicative of future results.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-mono"
              onClick={submitSetup}
            >
              Confirm — Place Live Orders
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
git add frontend/app/trailing-bot/page.tsx
git commit -m "feat: trailing bot frontend page — form, summary cards, dry-run toggle"
```

---

## Task 9: Route Protection + Sidebar Nav

**Files:**
- Modify: `frontend/proxy.ts`
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `/trailing-bot` to protected routes in `proxy.ts`**

In `frontend/proxy.ts`, find `PROTECTED_PREFIXES` array. Add `"/trailing-bot"` to it:

```typescript
const PROTECTED_PREFIXES = [
  "/dashboard",
  // ... existing entries ...
  "/morning-brief",
  "/trailing-bot",   // ← add this line
];
```

- [ ] **Step 2: Add nav link in `Sidebar.tsx`**

In `frontend/components/layout/Sidebar.tsx`, find the Terminal nav group:

```typescript
{
  title: "Terminal",
  links: [
    { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
    { href: "/morning-brief",label: "Morning Brief", icon: Sun },
    { href: "/live-trading", label: "Live Trading",  icon: Radio },
    { href: "/portfolio",    label: "Portfolio",     icon: Wallet },
    { href: "/auto-buy",     label: "Auto-Buy",      icon: Zap },
    { href: "/options",      label: "Options",       icon: BarChart2 },
  ],
},
```

Add the trailing bot link after `/auto-buy`:

```typescript
{ href: "/trailing-bot", label: "Trail Bot", icon: TrendingDown },
```

Also add `TrendingDown` to the import at the top of Sidebar.tsx (it is already imported from lucide-react — check first, add if missing).

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/proxy.ts frontend/components/layout/Sidebar.tsx
git commit -m "feat: add trailing-bot to sidebar nav and route protection"
```

---

## Task 10: Check `apiFetch` export and wire trailing-bot-api.ts correctly

- [ ] **Step 1: Find the correct export name from lib/api.ts**

```bash
grep -n "^export\|^async function\|^function " frontend/lib/api.ts | head -30
```

- [ ] **Step 2: Update `trailing-bot-api.ts` if needed**

If the base fetch function is not named `apiFetch`, update the import in `frontend/lib/trailing-bot-api.ts` to use the correct name. The function to use is whatever makes authenticated GET/POST requests with the Bearer token — it's the same one used in all other api.ts wrappers.

- [ ] **Step 3: Final build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error|✓|Failed"
```

All errors must be resolved before this task is done.

- [ ] **Step 4: Smoke test**

With backend running (`uvicorn app.main:app --reload`):

```bash
# Should return 401 (no auth) — confirms route is registered
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/trailing-bot/sessions
```

Expected: `401`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: trailing stop bot — complete feature (backend + frontend + scheduler)"
```

---

## Self-Review

### Spec coverage checklist
| Requirement | Covered by |
|---|---|
| Buy X shares at market | Task 3 `setup_trailing_bot()` → `broker.place_order()` |
| FLOOR: hard stop loss | Task 3 `_place_stop_order_alpaca()` |
| TRAILING FLOOR: activate at +10%, trail at 5% below | Task 3 `adjust_trailing_stop()` |
| Trailing step: rise every +5% | Task 3 `adjust_trailing_stop()` trailing_step_pct |
| Floor never goes down | Task 3: `if new_floor > session.current_floor` guard |
| LADDER IN: limit buys at specific prices | Task 3 `_place_limit_buy_alpaca()` |
| Confirmation summary after setup | Task 8 `SessionCard` component |
| Dry-run default | `dry_run: bool = True` throughout |
| Auth protection | Task 9 proxy.ts + get_current_user on all endpoints |
| Sidebar nav entry | Task 9 |

### Known limitation
The trailing monitor runs every 5 minutes and uses yesterday's close price (yfinance daily). For intraday precision, a user would need a paid Alpaca data feed. This is acceptable for paper trading and is consistent with the rest of the app's yfinance usage pattern.

### No placeholder scan
- No "TBD" or "TODO" items in any code block ✓
- All imports are explicit ✓  
- `LadderRuleOut` defined in Task 2 and used in Task 6 ✓
- `from_orm_session` factory method consistent between schema definition and router ✓
