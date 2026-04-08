# Politician Copy-Trading — Web Feature Design

**Date:** 2026-04-07  
**Status:** Approved  
**Feature:** V6 — Politician Copy-Trading (multi-user web integration)

---

## Overview

Integrate the existing standalone `politician-copy-trading/` bot into the NextGenAiTrading web platform as a multi-user, scheduler-driven feature. Each logged-in user can activate a copy-trading session that automatically mirrors congressional trade disclosures (sourced from Quiver Quantitative) on their connected Alpaca account.

The standalone CLI bot in `politician-copy-trading/` remains untouched and continues to work independently.

---

## Architecture

### Approach

Layered service architecture following the trailing-bot (V5) pattern:

- Existing standalone bot stays as-is for CLI use
- New FastAPI integration uses the project's standard stack: SQLAlchemy async, Pydantic v2, Supabase auth, existing `BrokerCredential` table for Alpaca keys
- Quiver Quant API is polled once per scheduler run (not per user), shared across all active sessions
- APScheduler task runs every 15 min as a singleton

### Backend Files

```
backend/app/
  models/copy_trading.py                      # CopyTradingSession + CopiedPoliticianTrade ORM
  schemas/copy_trading.py                     # Pydantic DTOs (request/response)
  services/
    politician_scraper_service.py             # async wrapper: fetch + cache Quiver Quant data
    politician_ranker_service.py              # async wrapper: rank politicians by score
    copy_trading_service.py                   # session CRUD + trade execution via BrokerCredential
  api/copy_trading.py                         # FastAPI router mounted at /api/v1/copy-trading
  scheduler/tasks/copy_trading_monitor.py     # APScheduler task: every 15 min
  alembic/versions/v6_copy_trading.py         # migration for 2 new tables
```

### Frontend Files

```
frontend/
  app/copy-trading/page.tsx                   # page: rankings + session management + trade history
  lib/copy-trading-api.ts                     # typed fetch wrappers for all API routes
```

---

## Data Model

### Table: `copy_trading_sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | multi-tenancy scope |
| status | varchar | `active` \| `paused` \| `cancelled` |
| dry_run | boolean | default True |
| copy_amount_usd | float | per-trade USD amount, default 300 |
| target_politician_id | text nullable | BioGuideID; null = auto-rank |
| target_politician_name | text nullable | denormalized for display |
| activated_at | timestamptz | set on creation |
| cancelled_at | timestamptz nullable | set on DELETE |

### Table: `copied_politician_trades`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| session_id | UUID FK → copy_trading_sessions | |
| user_id | UUID FK → users | for direct scoped queries |
| trade_id | text | Quiver dedup key: `{bioguide}_{ticker}_{date}_{type}` |
| politician_id | text | BioGuideID |
| politician_name | text | |
| ticker | text | |
| asset_type | text | `stock` \| `etf` \| `option` |
| trade_type | text | `buy` \| `sell` |
| trade_date | date | |
| disclosure_date | date | |
| amount_low | float | politician's reported range low |
| amount_high | float | politician's reported range high |
| alpaca_order_id | text nullable | |
| alpaca_status | text | `pending` \| `filled` \| `dry_run` \| `skipped_no_position` \| `rejected_insufficient_funds` \| `no_credentials` \| `error` |
| copy_amount_usd | float | USD actually used |
| dry_run | boolean | |
| created_at | timestamptz | |
| notes | text | e.g. source amount range |

**Unique constraint:** `(user_id, trade_id)` — each user copies each disclosure at most once across all sessions.

---

## API Routes

Base path: `/api/v1/copy-trading/`  
Auth: all routes require `get_current_user` (Supabase JWT).

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/rankings` | Platform-wide politician rankings (15-min cache) | list of PoliticianScore |
| POST | `/sessions` | Create + activate a session | 201 CopyTradingSession |
| GET | `/sessions` | List user's sessions, newest first, max 100 | list |
| GET | `/sessions/{id}` | Single session detail | CopyTradingSession |
| DELETE | `/sessions/{id}` | Cancel session → status=cancelled | 204 |
| GET | `/sessions/{id}/trades` | Copied trades for a session | paginated list |
| GET | `/trades` | All copied trades across all user's sessions | paginated list |

**`POST /sessions` body:**
```json
{
  "copy_amount_usd": 300,
  "dry_run": true,
  "target_politician_id": "J000309"   // optional; null = auto-rank
}
```

List endpoints: `limit` bounded `Query(default=50, ge=1, le=200)`.  
DELETE returns `Response(status_code=204)` (not in decorator).  
All queries scoped `WHERE user_id = current_user.id`.

---

## Scheduler Task

**Job:** `copy_trading_monitor`  
**Interval:** every 15 minutes  
**Runner:** APScheduler singleton (same process as uvicorn)

### Algorithm

```
1. Fetch Quiver Quant data once — cache for the run (5-min TTL in service)
2. Load all sessions WHERE status = 'active'
3. For each session:
   a. Look up user's BrokerCredential (broker='alpaca'); skip if missing → log warning
   b. Determine target politician:
      - if target_politician_id set → filter Quiver trades to that BioGuideID
      - else → run ranking → pick top scorer
   c. Get politician's recent trades (last RANK_LOOKBACK_DAYS days)
   d. For each trade:
      - Skip if (user_id, trade_id) already in copied_politician_trades
      - Execute via Alpaca (decrypt credential in-memory):
          * stock/ETF → market order, notional = copy_amount_usd
          * option → try contract symbol; fall back to underlying stock
          * sell → skip if no position
      - Insert CopiedPoliticianTrade row with result
4. Single db.commit() after all sessions processed
5. gc.collect() in finally block
```

**Notes:**
- `AsyncSessionLocal()` opened once outside the session loop
- ORM objects mutated in-place; single commit at end (per CLAUDE.md constraint)
- Quiver Quant fetch failures return stale cache; scheduler does not crash

---

## Politician Ranking

Scoring formula (matches standalone bot):

```python
import math
recency_bonus = math.log1p(recent_count) * 3.0
score = (win_rate * 1.5) + (avg_excess_return * 5.0) + recency_bonus
```

- `win_rate`: % of buy trades where ExcessReturn > 0 (vs SPY)
- `avg_excess_return`: average % outperformance vs SPY (highest weight ×5)
- `recency_bonus`: log-scaled to prevent volume traders dominating

Rankings endpoint caches results for 15 min (in-process, no Redis).  
Only politicians with ≥ 5 qualifying trades in the lookback window appear.

---

## Frontend Page (`/copy-trading`)

Route protected by middleware (add `/copy-trading` to protected prefixes).

### Sections

1. **Rankings panel** — table: rank, politician name, buy win%, avg excess return vs SPY, recent trades, score. Highlights the currently-followed politician. Polling interval matches rankings cache (15 min). Note: "historically favorable" wording, never "guaranteed" (V3 wording rules apply).

2. **Activate session card** — shown when user has no active session:
   - Copy amount (USD, default $300)
   - Politician: dropdown from rankings + "Auto (best performer)" option
   - Dry-run toggle (default ON)
   - Confirmation dialog required when dry-run is OFF
   - Submit → `POST /sessions`

3. **Active session card** — shown when user has an active session:
   - Status badge, politician being followed, copy amount, dry-run indicator
   - Trade count since activation
   - Cancel button → `DELETE /sessions/{id}` → confirmation dialog

4. **Copied trades table** — paginated (50/page), columns: date disclosed, politician, ticker, buy/sell, asset type, copy amount, Alpaca order status, dry-run badge. Uses `GET /trades`.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No broker credential for user | Trade skipped, `alpaca_status="no_credentials"`, session stays active |
| Quiver Quant fetch fails | Return stale cache; log error; scheduler continues |
| Alpaca order rejected (insufficient funds) | Record `rejected_insufficient_funds`; session stays active |
| Options contract unresolvable | Fall back to buying underlying stock; note in `notes` field |
| Sell with no existing position | Record `skipped_no_position`; session stays active |
| Alpaca exception | Record `error: {message}`; log server-side; return generic message to client |

---

## Constraints (from CLAUDE.md)

- Broker credentials decrypted in-memory at execution time only; never returned in API responses
- Dry-run default: `True` — live mode requires explicit toggle + confirmation dialog
- `AsyncSessionLocal()` never opened inside a loop body
- `gc.collect()` in scheduler task `finally` block
- All list endpoints bounded: `Query(default=50, ge=1, le=200)`
- DELETE endpoints return `Response(status_code=204)`
- CORS never `["*"]`
- V3 wording: "historically favorable", "confidence score" — never "guaranteed", "safe", "certain"
- `assert_ownership(record, current_user)` on all session/trade lookups

---

## Migration

Alembic revision: `v6_copy_trading`  
Creates: `copy_trading_sessions`, `copied_politician_trades`  
Adds unique constraint: `uq_user_trade` on `(user_id, trade_id)` in `copied_politician_trades`

---

## Sidebar Navigation

Add `/copy-trading` link to the sidebar nav under a "Copy Trading" label.  
Add `/copy-trading` to `middleware.ts` protected prefixes.

---

## Out of Scope

- Real-time WebSocket updates (polling via TanStack Query is sufficient)
- Per-user Quiver Quant API keys (free tier, shared)
- Mobile push notifications for copied trades
- Backtesting politician picks (separate feature)
