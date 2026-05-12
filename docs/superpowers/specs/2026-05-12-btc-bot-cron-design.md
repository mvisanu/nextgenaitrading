# BTC Trailing-Stop Bot — Scheduled Cron + Web History Design

**Date:** 2026-05-12
**Status:** Approved (brainstorm)
**Feature:** BTC trailing-stop bot — convert standalone CLI scripts into a scheduled, DB-backed, multi-tenant web feature
**Related:** `btc-bot/BTC_BOT.md`, `btc-bot/btc_trailing_bot.py`, `btc-bot/btc_execute_now.py`, `btc-bot/btc_close_now.py`, `btc-bot/btc_status.py`

---

## Overview

The standalone `btc-bot/` scripts implement a BTC/USD trailing-stop strategy with 3-level DCA ladder re-entry. Today they run as long-lived CLI processes against Alpaca paper trading — there is no DB state, no scheduler, and no UI visibility. The user wants the strategy to run on the platform's APScheduler so it is visible on `/crons`, and to surface full session + action history on a dedicated `/btc-bot` page.

This spec converts the strategy into:

1. A pure-logic decision service (testable without Alpaca or DB)
2. A 15-min APScheduler task that drives the decision service across all users with active sessions
3. Two new database tables for sessions and an audit log of state changes
4. A small read-mostly REST surface
5. A `/btc-bot` dashboard page that displays the active/cooldown session and the full action history

The standalone scripts in `btc-bot/` stay untouched and continue to work independently.

---

## Confirmed Requirements (from brainstorm Q&A)

| Decision | Choice |
|---|---|
| Cron scope | **Full lifecycle** — initial buy, monitor, ladder, FLOOR, cooldown re-entry |
| After FLOOR stop-out | **4-hour cooldown then auto re-enter** (default; env-tunable) |
| Bootstrap when no session + no position | **Auto-buy** using `BTC_BOT_INITIAL_USD` env var (default $10,000) |
| Existing Alpaca position with no DB session | **Adopt** as fresh session (avg_entry → blended_entry, qty → total_qty) |
| Cadence | **15 minutes** |
| Credentials | Multi-tenant: `BrokerCredential` first, env-var (`VISANU_ALPACA_*` / `ALPACA_*`) fallback for the bootstrap user |
| Implementation pattern | **Approach B — service-layer split** (pure decision fn + thin orchestrator + small Alpaca wrapper) |
| History | New `/btc-bot` page (not crammed into `/crons`); `/crons` shows only the scheduler entry |

---

## Architecture

### Approach

Service-layer split mirroring `services/commodity_signal_service.py` and `options/signals.py`:

- **`services/btc_bot_service.py`** — pure decision function `evaluate_tick(session, current_price, …) -> TickAction`. No I/O.
- **`broker/btc_bot_client.py`** — thin `alpaca-py` wrapper exposing only the 4 calls the orchestrator needs.
- **`scheduler/tasks/btc_bot_monitor.py`** — orchestrator: load state, fetch price, call decider, execute action, persist.

Multi-tenant from day one (matches `trailing_bot`, `wheel_bot`, `copy_trading`). Single-user today is a configuration concern (only one user has an active session), not a schema concern.

### Backend files

```
backend/app/
  models/btc_bot_session.py             # BtcBotSession ORM
  models/btc_bot_action.py              # BtcBotAction ORM (audit log)
  schemas/btc_bot.py                    # Pydantic DTOs
  services/btc_bot_service.py           # Pure decision: evaluate_tick(...)
  broker/btc_bot_client.py              # alpaca-py wrapper
  api/btc_bot.py                        # FastAPI router @ /api/v1/btc-bot
  scheduler/tasks/btc_bot_monitor.py    # APScheduler task: every 15 min
  alembic/versions/v9_btc_bot.py        # Migration for 2 new tables
```

### Frontend files

```
frontend/
  app/btc-bot/page.tsx                  # session card + cooldown panel + action history
  lib/btc-bot-api.ts                    # typed fetch wrappers
```

### Scheduler wiring

One new entry added to `JOB_TEMPLATES` in `backend/app/scheduler/jobs.py`:

```python
"btc_bot_monitor": {
    "func": monitor_btc_bots,
    "trigger": "interval",
    "minutes": settings.btc_bot_monitor_minutes,  # default 15
    "description": "Tick the BTC trailing-stop bot — FLOOR / trailing / ladder / cooldown re-entry",
},
```

Plus the matching `scheduler.add_job(...)` block in `register_jobs()`. No `/crons` UI changes — the existing generic table picks it up automatically.

---

## Database Schema

### Table 1: `btc_bot_sessions`

One row per session lifecycle (`active` → `cooldown` → `ended`).

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK autoincrement | matches codebase convention (`wheel_bot_sessions`, `copy_trading_sessions`) |
| `user_id` | Integer FK → `users.id` ON DELETE CASCADE | every query scoped here |
| `status` | String(20) | values: `active`, `cooldown`, `ended`, `error` (no Postgres-native enum — easier to extend later) |
| `original_entry_price` | Numeric(18,2) | frozen at first buy; ladder triggers reference this |
| `blended_entry_price` | Numeric(18,2) | recomputed after each ladder fill |
| `total_qty` | Numeric(20,8) | BTC qty held |
| `initial_buy_usd` | Numeric(18,2) | default from `BTC_BOT_INITIAL_USD`; stored per session |
| `current_floor` | Numeric(18,2) | up-only |
| `trailing_active` | Bool | false until +10% gain crossed |
| `trailing_high` | Numeric(18,2) nullable | last price the trailing floor stepped from |
| `ladder_next` | Int (0–3) | next ladder index to fire |
| `cooldown_until` | DateTime UTC nullable | populated on stop-out |
| `realized_pnl` | Numeric(18,2) nullable | populated on stop-out |
| `last_action_at` | DateTime UTC | freshness signal for `/btc-bot` |
| `created_at` / `updated_at` / `ended_at` | DateTime UTC | |

**Indexes:**
- `(user_id, status)` — cron iteration.
- Partial unique index on `(user_id)` filtered `WHERE status IN ('active','cooldown')` — guarantees a user can never hold two live sessions simultaneously.

### Table 2: `btc_bot_actions`

Sparse audit log: one row per **state change**. Idle ticks write nothing.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK autoincrement | |
| `session_id` | Integer FK → `btc_bot_sessions.id` ON DELETE CASCADE | |
| `user_id` | Integer FK → `users.id` ON DELETE CASCADE | denormalised for fast user-scoped queries |
| `action` | String(30) | values: `initial_buy`, `ladder_l1`, `ladder_l2`, `ladder_l3`, `trailing_activate`, `trailing_advance`, `stop_out`, `cooldown_start`, `cooldown_exit`, `adopted_position`, `manual_close`, `error` |
| `btc_price` | Numeric(18,2) | observed price when action fired |
| `qty_delta` | Numeric(20,8) nullable | `+qty` on buys, `-qty` on sells, null otherwise |
| `usd_delta` | Numeric(18,2) nullable | dollar amount on buys/sells |
| `floor_before` / `floor_after` | Numeric(18,2) nullable | non-null only when the floor changed |
| `alpaca_order_id` | String nullable | populated when the action involved an order |
| `notes` | Text nullable | free-form explanation |
| `created_at` | DateTime UTC | |

**Indexes:**
- `(user_id, created_at DESC)` — history table on `/btc-bot`.
- `(session_id, created_at)` — session-detail drill-in.

**Status/action types:** Stored as plain `String` columns (not Postgres Enums), matching the `wheel_bot_sessions.stage` pattern. Avoids enum-alter migration pain when adding new action types later.

**Migration:** new alembic revision based on the current head; filename `v9_btc_bot.py` (next number after the v8 PIN migration).

---

## Decision Function Contract

File: `backend/app/services/btc_bot_service.py`. Zero I/O.

### Types

```python
@dataclass(frozen=True)
class Idle:           reason: str
@dataclass(frozen=True)
class InitialBuy:     usd_amount: Decimal
@dataclass(frozen=True)
class LadderBuy:      level: Literal[1, 2, 3]; usd_amount: Decimal
@dataclass(frozen=True)
class AdvanceTrailing:
    new_floor: Decimal
    new_trailing_high: Decimal
    activated_now: bool   # True iff +10% threshold just crossed
@dataclass(frozen=True)
class StopOut:        reason: str
@dataclass(frozen=True)
class ExitCooldown:   pass
@dataclass(frozen=True)
class AdoptPosition:  avg_entry: Decimal; qty: Decimal

TickAction = Idle | InitialBuy | LadderBuy | AdvanceTrailing | StopOut | ExitCooldown | AdoptPosition
```

### SessionState input

```python
@dataclass(frozen=True)
class SessionState:
    status: Literal["active", "cooldown", "ended", "no_session"]
    original_entry: Decimal | None
    blended_entry: Decimal | None
    total_qty: Decimal
    current_floor: Decimal | None
    trailing_active: bool
    trailing_high: Decimal | None
    ladder_next: int                   # 0..3
    cooldown_until: datetime | None    # tz-aware UTC
```

### Signature

```python
def evaluate_tick(
    session: SessionState,
    current_price: Decimal,
    alpaca_position_qty: Decimal,
    alpaca_avg_entry: Decimal | None,
    initial_buy_usd: Decimal,
    now_utc: datetime,
) -> TickAction: ...
```

### Precedence (checked in this exact order; first match returns)

1. `status == "ended"` → `Idle("session ended")`
2. `status == "cooldown"`:
   - `now_utc < cooldown_until` → `Idle("cooldown — {N}m left")`
   - else → `ExitCooldown()`
3. `status == "no_session"`:
   - `alpaca_position_qty > 0` → `AdoptPosition(avg_entry, qty)`
   - else → `InitialBuy(initial_buy_usd)`
4. `status == "active"`:
   1. **FLOOR check first** — `current_price <= current_floor` → `StopOut(reason)` (always wins; safety override)
   2. **Ladder check before trailing** — `ladder_next < 3` and `current_price <= original_entry * (1 - LADDER_DROPS[ladder_next])` → `LadderBuy(level, LADDER_USD[level])`. Triggers compare to `original_entry`, never `blended_entry`.
   3. **Trailing activation** — `not trailing_active` and `(current_price / blended_entry - 1) >= 0.10` and `current_price * 0.95 > current_floor` → `AdvanceTrailing(new_floor=current_price*0.95, new_trailing_high=current_price, activated_now=True)`
   4. **Trailing step** — `trailing_active` and `current_price > trailing_high` and `(current_price / trailing_high - 1) >= 0.05` and `current_price * 0.95 > current_floor` → `AdvanceTrailing(...)`
   5. Otherwise → `Idle("price=$X, gain=Y%, floor=$Z")`

### Constants

```python
LADDER_DROPS = [Decimal("0.20"), Decimal("0.30"), Decimal("0.40")]      # -20%, -30%, -40%
LADDER_USD   = [Decimal("10000"), Decimal("15000"), Decimal("20000")]    # L1, L2, L3 buy sizes
TRAILING_ACTIVATION_GAIN = Decimal("0.10")                               # +10%
TRAILING_STEP            = Decimal("0.05")                               # +5%
TRAILING_FLOOR_MULT      = Decimal("0.95")                               # 5% below current
FLOOR_MULT               = Decimal("0.90")                               # 10% below blended
```

These constants are not session-configurable in v1 — they live in the service module and any change requires a code release. (Future spec may move them onto the session row for backtest mode.)

### Invariants

- **Floor is up-only.** `evaluate_tick` never returns `AdvanceTrailing` with `new_floor <= session.current_floor`.
- **Each ladder fires at most once.** Function returns `LadderBuy(level=N+1)` only when `ladder_next == N`.
- **Stop-out ranks above ladder.** Same-tick FLOOR + ladder collision returns `StopOut`. We don't add to a position that's already breaching its floor.
- **Ladder triggers use `original_entry`, not blended.** Prevents the chase-itself-lower failure mode called out in `BTC_BOT.md:47`.

---

## Orchestrator Flow

File: `backend/app/scheduler/tasks/btc_bot_monitor.py`.

```python
async def monitor_btc_bots() -> None:
    async with AsyncSessionLocal() as db:
        try:
            users = await _resolve_users_with_btc_bot_enabled(db)
            for user in users:
                try:
                    await _tick_one_user(db, user)
                except Exception as e:
                    log.exception("btc_bot tick failed for user %s", user.id)
                    await _record_error_action(db, user, str(e))
            await db.commit()
        finally:
            gc.collect()
```

### Per-user tick (7 steps)

1. **LOAD** — `SELECT * FROM btc_bot_sessions WHERE user_id=? AND status IN ('active','cooldown') LIMIT 1`. If none, synthesise `SessionState(status="no_session", …)`.
2. **CREDS** — `client = BtcBotClient.for_user(user)`. Prefers user's `BrokerCredential`; falls back to env vars only when `user.email == settings.btc_bot_bootstrap_user_email`.
3. **OBSERVE** — `price = client.get_btc_ask()`; `position = client.get_btc_position()` (None if flat).
4. **DECIDE** — `action = evaluate_tick(state, price, position.qty if position else 0, …)`.
5. **EXECUTE** — switch on `action`:
   - `Idle` → no-op
   - `InitialBuy(usd)` → `client.market_buy(usd)`; INSERT new session row with `original_entry = blended_entry = fill_price`, `total_qty = filled_qty`, `current_floor = fill_price * 0.90`, `trailing_active = False`, `ladder_next = 0`, `status = 'active'`
   - `AdoptPosition(avg, qty)` → INSERT session row using Alpaca's avg/qty as `original_entry = blended_entry`, `total_qty = qty`, `current_floor = avg * 0.90`
   - `LadderBuy(L, usd)` → `client.market_buy(usd)`; recompute `blended_entry = ((total_qty * blended_entry) + (filled_qty * fill_price)) / (total_qty + filled_qty)`; `total_qty += filled_qty`; `ladder_next = L`; `current_floor = max(current_floor, blended_entry * 0.90)`
   - `AdvanceTrailing` → mutate session in place: `current_floor = new_floor`, `trailing_high = new_trailing_high`, `trailing_active = True`. No order.
   - `StopOut(reason)` → `client.market_sell_all(total_qty)`; `realized_pnl = (filled_price * total_qty) - (blended_entry * total_qty)`; `status = 'cooldown'`; `cooldown_until = now + cooldown_minutes`; `total_qty = 0`
   - `ExitCooldown` → set `status = 'ended'`, `ended_at = now`. Next tick's `no_session` branch will fire the new `InitialBuy`.
6. **AUDIT** — INSERT a `btc_bot_actions` row for every non-Idle outcome (with `alpaca_order_id`, `qty_delta`, `usd_delta`, `floor_before/after` populated as relevant).
7. **PERSIST** — `session.last_action_at = now`, `updated_at = now`. One `db.commit()` after the for-loop.

### Cooldown → re-entry handoff

`ExitCooldown` only marks the session `ended`; it does **not** also place the new buy. The next tick's `no_session` branch handles that. Rationale: keeps each tick to exactly one Alpaca-side action — a failure in the re-entry buy never leaves a half-`ended` session behind. At 15-min cadence, re-entry fires ≤15 min after cooldown expires.

### AdoptPosition behaviour

Inserts a session row but **does not place a stop order** (Alpaca crypto stop orders are not used; FLOOR is enforced in software). Floor begins at `avg_entry * 0.90`. An adopted position already underwater >10% will therefore get sold on the next tick — by design — and the `adopted_position` action row makes the cause traceable.

---

## Failure Handling

| Failure | Response |
|---|---|
| Alpaca quote API down (read failure) | Catch, log, write `action='error'` row, return from `_tick_one_user`. Session row unchanged. Next tick retries. |
| Buy/sell order rejected (`APIError`) | Catch, write `action='error'` with `notes=str(e)`, leave session unchanged. Next tick retries. No partial state writes. |
| Decision function raises (defensive — should not happen) | Catch, set `session.status='error'` so cron stops touching it until manual intervention. Surfaced on `/btc-bot` as a red banner. |
| Order partial fill | Use `filled_qty` / `filled_avg_price` from Alpaca's order object — never the requested qty. |

All three error paths route through one helper `_record_error_action(db, user, reason)`. **No exception bubbles out of `_tick_one_user`** — one user's failure must not abort the other users' ticks in the same APScheduler invocation.

---

## Concurrency & Render Memory

- `scheduler.add_job(..., max_instances=1, coalesce=True)` — single global lock, overlapping ticks coalesce.
- Per-tick **single** `AsyncSessionLocal()` opened **outside** the user for-loop (CLAUDE.md async-session rule). One commit at the end.
- `gc.collect()` in the `finally` block (CLAUDE.md Render memory rule).
- DB pool stays at `pool_size=2, max_overflow=3`.
- Alpaca call budget per tick: 2 reads (quote + position) + ≤1 write (order) per active user. Comfortably under rate limits at N ≤ 30 users.

---

## Configuration

New `pydantic-settings` fields in `backend/app/core/config.py`:

```
BTC_BOT_INITIAL_USD=10000              # default initial buy
BTC_BOT_COOLDOWN_MINUTES=240           # 4h
BTC_BOT_MONITOR_MINUTES=15             # cron cadence
BTC_BOT_BOOTSTRAP_USER_EMAIL=mvisanu@gmail.com   # user receiving env-var credential fallback
VISANU_ALPACA_API_KEY=...              # existing
VISANU_ALPACA_SECRET_KEY=...           # existing
```

Only the user whose email matches `BTC_BOT_BOOTSTRAP_USER_EMAIL` is allowed to fall back to env-var Alpaca credentials. All other users must save their own `BrokerCredential` row before the cron will tick them. This preserves the current single-user reality while leaving the schema multi-tenant.

---

## API Surface

All routes under `/api/v1/btc-bot/`. All scoped `WHERE user_id = current_user.id`. List endpoints use `Query(default=50, ge=1, le=200)` per CLAUDE.md.

| Method | Path | Purpose |
|---|---|---|
| GET | `/session` | Current active or most-recent session (1 row or null) |
| GET | `/sessions` | Paginated session history |
| GET | `/sessions/{id}` | One session + its action list |
| GET | `/actions` | Cross-session action history (paginated, filterable by `action` query param) |
| POST | `/sessions` | Manual start (body: `{ initial_buy_usd?: number }`). 409 if active session exists. |
| POST | `/sessions/{id}/close` | Manual close (`status='active'` only): market-sell + `status='ended'` (no cooldown). Writes `action='manual_close'`. |
| POST | `/sessions/{id}/cancel-cooldown` | Cancel a cooldown row before re-entry fires. Soft-cancel: sets `status='ended'`, clears `cooldown_until`, writes `action='manual_close'`. Audit history preserved. |

**Never returned:** Alpaca API keys, `BrokerCredential` content, raw `VISANU_*` env values.

**Mid-session immutability:** no endpoint mutates floor/ladder/blended-entry mid-session. To change parameters, close and start a new session.

---

## Frontend — `/btc-bot` page

Single column, matches the visual language of `/trailing-bot` and `/wheel-bot`. `AppShell title="BTC Bot"`. Sidebar entry added next to those two pages.

### Sections

1. **Active session card** (when `status='active'`):
   - Original entry, blended entry, total qty + USD value
   - Current price (from `useMarketStream("BTC/USD")`) and gain %
   - Current floor (with up-only indicator)
   - Trailing state — OFF + next activation price, or ON + last advance
   - Ladders fired (0/3, 1/3, …) + next ladder trigger price
   - Buttons: `Force close`, `Edit cooldown` (future — disabled in v1)

2. **Cooldown panel** (alternates with active card when `status='cooldown'`):
   - Re-entry countdown
   - Last stop-out price + realized PnL
   - Button: `Cancel cooldown` (POSTs to `/sessions/{id}/cancel-cooldown` — soft-ends the session; cron treats next tick as no_session)

3. **Action history table** (always visible):
   - Columns: Time, Session ID (short), Action, Price, Qty Δ, USD Δ, Floor Δ, Order ID
   - Paginated (50/page, `useInfiniteQuery`)
   - Toolbar chips filter by action type

4. **Footer** — *"Cron: `btc_bot_monitor` — manage cadence at /crons"* with deep link.

### Data hooks

- `useQuery(['btc-bot','session'], refetchInterval: 30_000)` — active/cooldown session
- `useInfiniteQuery(['btc-bot','actions',filter])` — history
- `useMarketStream(['BTC/USD'])` — live price via existing SSE endpoint

---

## Testing Strategy

New test directory `backend/tests/v9/`. Add `pytest tests/v9/` to the Test Suite block in `CLAUDE.md`.

### `tests/v9/test_btc_bot_service.py` — pure decision function

One test per branch in the precedence list:

- `ended` → Idle
- `cooldown` not expired → Idle
- `cooldown` expired → ExitCooldown
- `no_session` + flat → InitialBuy
- `no_session` + position → AdoptPosition
- `active` + price ≤ floor → StopOut (even when ladder trigger also hit — verify precedence)
- `active` + ladder L1 trigger hit → LadderBuy(1)
- `active` + ladder L2 trigger hit after L1 fired → LadderBuy(2)
- `active` + already-fired ladder does not re-fire
- `active` + +10% gain → AdvanceTrailing(activated_now=True)
- `active` + trailing on + +5% step → AdvanceTrailing(activated_now=False)
- `active` + trailing on + new_floor would move down → Idle (floor up-only)

No mocks. Hand-built `SessionState` fixtures.

### `tests/v9/test_btc_bot_monitor.py` — orchestrator

Fake `BtcBotClient` stub returns canned price + position. One test per `TickAction` branch verifies:
- correct session-row mutation
- correct `btc_bot_actions` row inserted
- no exception escapes `_tick_one_user`

### `tests/v9/test_btc_bot_api.py` — endpoints

- All endpoints reject unauthenticated requests (401)
- `GET /session` scoped to current user only (different user's row not visible)
- `POST /sessions` returns 409 when active session exists
- `POST /sessions/{id}/close` writes `manual_close` action and sets `status='ended'` (only valid when `status='active'`; 409 otherwise)
- `POST /sessions/{id}/cancel-cooldown` writes `manual_close` action and sets `status='ended'` (only valid when `status='cooldown'`; 409 otherwise)
- No endpoint leaks `BrokerCredential` content

---

## Out of Scope (v1)

- Multi-symbol support (ETH, SOL, etc.) — BTC/USD only
- Per-session configurable ladder amounts, drop thresholds, trailing percentages — constants are global in v1
- Backtest mode against historical OHLCV
- Stop order placement on Alpaca side (FLOOR is software-enforced)
- Notifications (email/SMS) on stop-out — surfaced on `/btc-bot` only
- Editing a session's cooldown duration after stop-out — fixed at session creation

---

## Migration & Rollout

1. Alembic revision `btc_bot_v9` adds both tables + indexes.
2. Deploy backend with cron initially **paused** (override `JOB_TEMPLATES` to add `paused: True` on first deploy — manually resume from `/crons` after smoke-test).
3. Smoke-test on Alpaca paper by manually triggering one tick via `POST /api/v1/crons/jobs/btc_bot_monitor/run-now`.
4. Verify `btc_bot_actions` rows appear with expected sequence (InitialBuy → Idle → AdvanceTrailing → …).
5. Resume the cron from `/crons` UI.

Render Starter constraint: this adds one row to the scheduler and at most 3 Alpaca API calls per 15 min. Negligible memory/CPU impact.

---

## Files Changed Summary

**New files (10):**

- `backend/app/models/btc_bot_session.py`
- `backend/app/models/btc_bot_action.py`
- `backend/app/schemas/btc_bot.py`
- `backend/app/services/btc_bot_service.py`
- `backend/app/broker/btc_bot_client.py`
- `backend/app/api/btc_bot.py`
- `backend/app/scheduler/tasks/btc_bot_monitor.py`
- `backend/app/alembic/versions/btc_bot_v9.py`
- `frontend/app/btc-bot/page.tsx`
- `frontend/lib/btc-bot-api.ts`

**Modified files (4):**

- `backend/app/scheduler/jobs.py` — `JOB_TEMPLATES` + `register_jobs()`
- `backend/app/core/config.py` — new env-var fields
- `backend/app/main.py` — register `btc_bot` router
- `CLAUDE.md` — add Database Tables V9 entry + Test Suite line + "BTC Bot — Web Feature (V9)" section

**New test directory:**

- `backend/tests/v9/` — service, monitor, API tests

---

## Open Questions / Future Work

- **Stop order placement on Alpaca side.** Software FLOOR works but leaves a window between ticks (≤15 min) where a wick can take price well below the floor before we sell. Future enhancement: place a GTC stop order at the FLOOR each tick and cancel/replace on floor advance. Not v1.
- **Notifications.** Email on stop-out would re-use the existing SMTP service from commodity alerts. Easy follow-up.
- **Multi-symbol.** Generalising to ETH/SOL is mostly a schema change (add `symbol` column with default `'BTC/USD'`) + service-layer parametrisation. Defer until requested.
