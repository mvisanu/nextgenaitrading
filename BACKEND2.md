# BACKEND2.md — NextGenStock v2 Backend Handoff

**Version:** 2.0
**Date:** 2026-03-24
**Extends:** BACKEND.md (v1)
**Status:** Implemented

---

## Overview

This document covers all v2 backend additions to NextGenStock. Five features were implemented on top of the existing 14-table, 60-file v1 backend:

| Feature | Description |
|---------|-------------|
| A — Intelligent Buy Zone Estimator | Seven-layer weighted pipeline producing zone ranges, confidence scores, forward return estimates, and human-readable explanations |
| B — Smart Price Alert Engine | Six alert types evaluated on a 5-minute schedule with cooldown and market-hours filtering |
| C — Optional Auto-Buy Execution | Nine-safeguard decision engine, disabled by default, paper mode default, full audit log |
| D — Theme / World Trend Scoring Engine | Ten supported themes, sector mapping + user tag blending, 6-hour refresh |
| E — Idea Pipeline and Conviction Watchlist | CRUD idea cards with thesis, theme tags, linked tickers, conviction slider, auto-ranking |

**Key architectural decisions:**
- All new tables follow the existing `user_id` FK pattern (multi-tenancy non-negotiable)
- `StockThemeScore` has no `user_id` — it is system-wide and shared to reduce computation
- `StockBuyZoneSnapshot.user_id` is nullable — NULL = system-wide; per-user recalculate always writes a user-scoped row
- Auto-buy is `enabled=False` by default; the frontend must present a confirmation dialog before calling PATCH `/api/auto-buy/settings` with `enabled=True`
- APScheduler runs in-process inside the FastAPI lifespan on the Render web dyno
- `feature_payload_json` is persisted for auditability but **never** returned in API responses (FR-A07)
- Language rule enforced throughout: no "guaranteed profit", "safe entry", "certain to go up" — use "historically favorable", "confidence score", "positive outcome rate"

---

## Stack and Dependencies

All v1 dependencies retained. One new addition:

```
apscheduler>=3.10.0   # AsyncIOScheduler for background jobs
```

Add to `backend/requirements.txt` (already done).

---

## New Database Tables (7)

### ERD Summary

```
users (existing)
  ├── stock_buy_zone_snapshots (user_id nullable FK)
  ├── watchlist_ideas (user_id FK)
  │     └── watchlist_idea_tickers (idea_id FK)
  ├── price_alert_rules (user_id FK)
  ├── auto_buy_settings (user_id FK, unique)
  └── auto_buy_decision_logs (user_id FK)

stock_theme_scores (no user_id — system-wide)
```

### Table Descriptions

| Table | Purpose |
|-------|---------|
| `stock_buy_zone_snapshots` | Persisted buy zone calculation results per ticker (and optionally per user) |
| `stock_theme_scores` | System-wide theme alignment scores per ticker; updated every 6 hours |
| `watchlist_ideas` | User-owned investment thesis cards with conviction scores and theme tags |
| `watchlist_idea_tickers` | Tickers linked to an idea (many-to-one); includes `near_earnings` flag |
| `price_alert_rules` | Per-user, per-ticker alert configurations with cooldown and market-hours filtering |
| `auto_buy_settings` | Per-user auto-buy configuration (one row per user; unique constraint on `user_id`) |
| `auto_buy_decision_logs` | Immutable audit trail of every auto-buy evaluation with full safeguard breakdown |

### Key Column Notes

- `watchlist_idea_tickers.near_earnings` — manual boolean flag (OQ-02 resolution; live earnings calendar deferred to v3)
- `auto_buy_settings.enabled` — `False` by default; must be explicitly toggled
- `auto_buy_settings.paper_mode` — `True` by default; real execution requires explicit opt-in
- `auto_buy_settings` has `UniqueConstraint("user_id")` — exactly one row per user
- `stock_buy_zone_snapshots.feature_payload_json` — stores raw OHLCV inputs for auditability, never returned in API responses

### Migration

Single migration file chains from the v1 head:

```
backend/alembic/versions/a1b2c3d4e5f6_v2_features.py
  down_revision: 8fc51a5529bd (v1 initial schema)
```

Run:
```bash
cd backend
alembic upgrade head    # applies v2 migration on top of v1
alembic downgrade -1    # drops all 7 v2 tables (reversible)
```

---

## New ORM Models

| File | Classes |
|------|---------|
| `backend/app/models/buy_zone.py` | `StockBuyZoneSnapshot` |
| `backend/app/models/theme_score.py` | `StockThemeScore` |
| `backend/app/models/idea.py` | `WatchlistIdea`, `WatchlistIdeaTicker` |
| `backend/app/models/alert.py` | `PriceAlertRule` |
| `backend/app/models/auto_buy.py` | `AutoBuySettings`, `AutoBuyDecisionLog` |

All models follow the existing SQLAlchemy 2.x `Mapped[]` / `mapped_column()` pattern. All are registered in `models/__init__.py` and `db/base.py` for Alembic discovery.

---

## New Pydantic Schemas

| File | Schemas |
|------|---------|
| `backend/app/schemas/buy_zone.py` | `BuyZoneOut` |
| `backend/app/schemas/theme_score.py` | `ThemeScoreOut` |
| `backend/app/schemas/idea.py` | `IdeaCreate`, `IdeaUpdate`, `IdeaOut`, `TickerIn`, `TickerOut` |
| `backend/app/schemas/alert.py` | `AlertCreate`, `AlertUpdate`, `AlertOut` |
| `backend/app/schemas/auto_buy.py` | `AutoBuySettingsOut`, `AutoBuySettingsUpdate`, `AutoBuyDecisionLogOut`, `DryRunRequest`, `OpportunityOut` |

**Note:** `BuyZoneOut` excludes `feature_payload_json` — raw inputs are stored in the DB only and never surfaced in any API response.

---

## New Services

### `buy_zone_service.py`

Orchestrates the seven-layer buy zone scoring pipeline.

**Layers and weights:**

| Layer | Weight | Function |
|-------|--------|----------|
| Trend quality | 0.20 | `_score_trend_quality` — EMA-50 vs EMA-200 relationship |
| Pullback quality | 0.20 | `_score_pullback_quality` — depth from 20-day high |
| Support proximity | 0.20 | `_score_support_proximity` — distance from EMA-200 |
| Volatility normalisation | 0.10 | `_score_volatility_normalization` — ATR ratio vs baseline |
| Historical analog win rate | 0.20 | Delegated to `analog_scoring_service` |
| Drawdown penalty | 0.05 | Penalises setups with high historical MAE |
| Theme alignment bonus | 0.05 | Reads from `StockThemeScore` table |

**Key functions:**
- `calculate_buy_zone(ticker, db, user_id)` — full pipeline, persists snapshot
- `get_or_calculate_buy_zone(ticker, db, user_id, max_age_minutes)` — returns cached if fresh, else recalculates

### `analog_scoring_service.py`

Pure functions for historical pattern matching. Zero DB calls.

- `find_analog_matches(df, top_n)` — finds top_n historical windows by Euclidean distance in 4-factor feature space (RSI, ATR ratio, trend slope, pullback depth)
- `score_analogs(matches)` — aggregates forward returns into win rate score and explanation string
- Minimum 5 analog matches required; below that, confidence is capped at 0.40

### `theme_scoring_service.py`

Blends sector mapping, curated ticker-to-theme overrides, and user-assigned idea tags.

- `compute_theme_score(ticker, user_id, db)` — computes and persists/updates `StockThemeScore`
- `TICKER_THEME_OVERRIDES` — hardcoded for ~30 well-known tickers; extensible
- `SECTOR_TO_THEMES` — maps yfinance sector strings to theme lists

### `alert_engine_service.py`

Stateless evaluation of all enabled `PriceAlertRule` records.

- `evaluate_rule(rule, db)` — evaluates one rule, dispatches notification if triggered
- `evaluate_all_alerts(db)` — batch evaluation, returns summary dict
- Cooldown logic via `_is_in_cooldown(rule)`
- Market-hours filtering via `_is_market_hours()` (NYSE 09:30–16:00 ET)

### `notification_service.py`

Abstract notification channel pattern.

- `NotificationChannel` — abstract base
- `InAppNotification` — writes structured log entry (v2 implementation)
- `EmailNotification` — stub; active if `NOTIFICATION_EMAIL_ENABLED=true`
- `WebhookNotification` — stub; active if `NOTIFICATION_WEBHOOK_ENABLED=true` and `NOTIFICATION_WEBHOOK_URL` set
- `dispatch_notification(user_id, subject, body, metadata)` — routes through all active channels

### `auto_buy_engine.py`

Nine-safeguard decision engine.

**Synchronous safeguards** (run in `run_safeguards`):
1. `price_inside_buy_zone`
2. `confidence_above_threshold`
3. `drawdown_within_limit`
4. `liquidity_filter` (price >= $1)
5. `spread_filter` (v2: always passes; v3: real bid-ask check)
6. `not_near_earnings`
7. `position_size_limit`

**Async safeguards** (added in `run_full_safeguards`):
8. `no_duplicate_order` (24-hour lookback on `BrokerOrder`)
9. `daily_risk_budget` (today's total vs 3x `max_trade_amount`)

**Key functions:**
- `evaluate_auto_buy(ticker, user, db, dry_run, credential_id)` — full pipeline, always persists `AutoBuyDecisionLog`
- `evaluate_all_auto_buy(db)` — batch evaluation for all enabled users

**Decision states:** `candidate`, `ready_to_alert`, `ready_to_buy`, `blocked_by_risk`, `order_submitted`, `order_filled`, `order_rejected`, `cancelled`

---

## New API Routers

All new routers are mounted under `/api` prefix in `main.py`. All require `Depends(get_current_user)`.

### `GET /api/stocks/{ticker}/buy-zone`

Returns the latest buy zone snapshot. Auto-recalculates if older than 60 minutes.

**Response:** `BuyZoneOut` (excludes `feature_payload_json`)

**Errors:**
- `422` — ticker not found in yfinance or insufficient data

---

### `POST /api/stocks/{ticker}/recalculate-buy-zone`

Force full pipeline recalculation. Always writes a user-scoped snapshot row.

**Response:** `BuyZoneOut`

---

### `GET /api/stocks/{ticker}/theme-score`

Returns current theme score. Auto-computes on first request if no record exists.

**Response:** `ThemeScoreOut`

---

### `POST /api/stocks/{ticker}/theme-score/recompute`

Force recompute theme score.

**Response:** `ThemeScoreOut`

---

### `GET /api/alerts`

List all alert rules for the current user.

**Response:** `list[AlertOut]`

---

### `POST /api/alerts`

Create a new alert rule.

**Request body:** `AlertCreate`
```json
{
  "ticker": "NVDA",
  "alert_type": "entered_buy_zone",
  "threshold": {},
  "cooldown_minutes": 60,
  "market_hours_only": true
}
```

**Valid alert_type values:** `entered_buy_zone`, `near_buy_zone`, `below_invalidation`, `confidence_improved`, `theme_score_increased`, `macro_deterioration`

**Response:** `AlertOut` (201 Created)

---

### `PATCH /api/alerts/{id}`

Partial update. Only provided fields are changed.

**Request body:** `AlertUpdate` (all fields optional)

**Errors:**
- `403` — rule belongs to another user
- `404` — rule not found

---

### `DELETE /api/alerts/{id}`

Permanently delete an alert rule. Returns 204 No Content.

---

### `GET /api/ideas`

List all ideas sorted by composite rank score descending.

**Rank formula:**
```
rank_score = (theme_score_total × 0.35) + (entry_quality_score × 0.35)
           + (conviction_score/10 × 0.20) + (alert_readiness_bonus × 0.10)
```

**Response:** `list[IdeaOut]` (includes computed `rank_score`)

---

### `POST /api/ideas`

Create a new idea with optional linked tickers.

**Request body:** `IdeaCreate`
```json
{
  "title": "AI Infrastructure Cycle",
  "thesis": "Data center buildout will drive sustained demand...",
  "conviction_score": 8,
  "watch_only": false,
  "tradable": true,
  "tags": ["ai", "semiconductors"],
  "tickers": [
    {"ticker": "NVDA", "is_primary": true},
    {"ticker": "AMD", "is_primary": false}
  ]
}
```

**Tags must be from SUPPORTED_THEMES:** `ai`, `renewable_energy`, `power_infrastructure`, `data_centers`, `space_economy`, `aerospace`, `defense`, `robotics`, `semiconductors`, `cybersecurity`

---

### `PATCH /api/ideas/{id}`

Partial update. When `tickers` is provided, replaces all linked tickers.

---

### `DELETE /api/ideas/{id}`

Delete idea and all linked tickers (cascade). Returns 204.

---

### `GET /api/auto-buy/settings`

Return current user's auto-buy settings. Creates defaults if none exist.

**Response:** `AutoBuySettingsOut`

---

### `PATCH /api/auto-buy/settings`

Update settings. **Frontend must present confirmation dialog before sending `enabled=true`.**

**Request body:** `AutoBuySettingsUpdate` (all fields optional)

---

### `GET /api/auto-buy/decision-log`

Paginated decision log. Query params: `page` (default 1), `page_size` (default 50, max 200).

**Response:** `list[AutoBuyDecisionLogOut]`

Each entry includes `reason_codes`: list of `{check, result}` dicts where `result` is `"PASSED"` or `"FAILED: <reason>"`.

---

### `POST /api/auto-buy/dry-run/{ticker}`

Simulate the full nine-safeguard pipeline without executing any order.

**Request body:** `DryRunRequest` (optional `credential_id`)

**Response:** `AutoBuyDecisionLogOut`

---

### `GET /api/opportunities`

Ranked opportunity list across all user's watchlist tickers.

**Query params:**
- `theme` — filter by theme tag
- `min_confidence` — filter by minimum confidence score
- `alert_active` — filter by alert presence
- `limit` — max results (default 100, max 100)

**Response:** `list[OpportunityOut]`

---

## Background Scheduler

APScheduler `AsyncIOScheduler` runs in-process, started in the FastAPI lifespan.

| Job | Interval | Function |
|-----|----------|----------|
| `refresh_buy_zones` | 60 min | Refresh all buy zone snapshots older than 60 min |
| `refresh_theme_scores` | 360 min | Refresh all theme scores |
| `evaluate_alerts` | 5 min | Evaluate all enabled alert rules |
| `evaluate_auto_buy` | 5 min | Evaluate auto-buy for all enabled users |

All jobs use `coalesce=True, max_instances=1` to prevent pile-up.

**Disable scheduler for testing:**
```bash
SCHEDULER_ENABLE=false uvicorn app.main:app --reload
```

---

## Environment Variables (New in v2)

Add to `backend/.env`:

```env
# Scheduler
SCHEDULER_ENABLE=true
BUY_ZONE_REFRESH_MINUTES=60
THEME_SCORE_REFRESH_MINUTES=360
ALERT_EVAL_MINUTES=5
AUTO_BUY_EVAL_MINUTES=5

# Notifications (v2: in-app only; email/webhook are stubs)
NOTIFICATION_EMAIL_ENABLED=false
NOTIFICATION_WEBHOOK_ENABLED=false
NOTIFICATION_WEBHOOK_URL=
```

---

## New Files Summary

```
backend/app/
  models/
    buy_zone.py              StockBuyZoneSnapshot ORM model
    theme_score.py           StockThemeScore ORM model
    idea.py                  WatchlistIdea + WatchlistIdeaTicker ORM models
    alert.py                 PriceAlertRule ORM model
    auto_buy.py              AutoBuySettings + AutoBuyDecisionLog ORM models
  schemas/
    buy_zone.py              BuyZoneOut
    theme_score.py           ThemeScoreOut
    idea.py                  IdeaCreate, IdeaUpdate, IdeaOut, TickerIn, TickerOut
    alert.py                 AlertCreate, AlertUpdate, AlertOut
    auto_buy.py              AutoBuySettingsOut, AutoBuySettingsUpdate, AutoBuyDecisionLogOut,
                             DryRunRequest, OpportunityOut
  api/
    buy_zone.py              /api/stocks/{ticker}/buy-zone + theme-score
    alerts.py                /api/alerts CRUD
    ideas.py                 /api/ideas CRUD
    auto_buy.py              /api/auto-buy settings + log + dry-run
    opportunities.py         /api/opportunities
  services/
    buy_zone_service.py      Seven-layer scoring pipeline
    analog_scoring_service.py  Historical pattern matching (pure functions)
    theme_scoring_service.py   Theme alignment scoring
    alert_engine_service.py    Alert evaluation and dispatch
    notification_service.py    Notification channel abstraction
    auto_buy_engine.py         Nine-safeguard decision engine
  scheduler/
    __init__.py
    jobs.py                  APScheduler job registry
    tasks/
      __init__.py
      refresh_buy_zones.py
      refresh_theme_scores.py
      evaluate_alerts.py
      evaluate_auto_buy.py
backend/alembic/versions/
  a1b2c3d4e5f6_v2_features.py  All 7 new tables, chains from v1 head
backend/tests/v2/
  test_analog_scoring.py     RSI/ATR/feature/analog matching tests
  test_buy_zone_service.py   Layer scoring function tests
  test_alert_engine.py       Alert type trigger condition tests
  test_auto_buy_engine.py    Safeguard unit tests
```

**Modified files:**
- `backend/requirements.txt` — added `apscheduler>=3.10.0`
- `backend/app/core/config.py` — added scheduler and notification settings
- `backend/app/models/__init__.py` — registered 5 new model files
- `backend/app/db/base.py` — imported new model modules for Alembic
- `backend/app/main.py` — wired scheduler into lifespan, registered 5 new routers

---

## Setup and Migration

```bash
# 1. Install new dependency
cd backend
pip install apscheduler>=3.10.0

# Or reinstall all:
pip install -r requirements.txt

# 2. Add new env vars to backend/.env (see above section)

# 3. Apply migration (requires Docker Postgres running)
docker compose up -d
alembic upgrade head

# 4. Start backend
uvicorn app.main:app --reload
```

---

## Testing

```bash
cd backend
# Run v2 unit tests only
python -m pytest tests/v2/ -v

# Run with coverage
python -m pytest tests/v2/ --cov=app/services --cov-report=term-missing
```

Test files are in `backend/tests/v2/`. Each test file covers one service module.
Tests mock all external dependencies (yfinance, broker clients, DB sessions).

---

## Known Constraints and Deviations

| Item | Detail |
|------|--------|
| Spread filter (safeguard #5) | Always passes in v2. Real bid-ask spread check requires live quote API — deferred to v3 |
| Earnings calendar | `near_earnings` is a manual boolean flag on `WatchlistIdeaTicker`. Live earnings calendar (Polygon.io) is deferred to v3 |
| Email/Webhook notifications | Classes are wired and importable but stub only. Set env vars to activate when SMTP/webhook is configured |
| Theme score history | No history table for theme scores; `macro_deterioration` and `theme_score_increased` alerts use a `prev_theme_score` value stored in `threshold_json` at rule creation time. Full delta tracking deferred to v3 |
| Analog scoring performance | Uses in-memory rolling computation on 5-year daily OHLCV. For large tickers, buy zone calculation may take 3–8 seconds (within p95 target of 8s per PRD2) |
| APScheduler on Render | Runs in-process on the web dyno. On dyno restart, scheduler restarts automatically. A separate Background Worker is deferred to v3 if in-process proves unstable |
| `feature_payload_json` | Stores raw OHLCV indicators for auditability. Never returned in any API response (FR-A07) |

---

## Open Questions for Frontend

1. **Auto-buy confirmation dialog** — The PATCH `/api/auto-buy/settings` endpoint with `enabled=true` must be preceded by a user confirmation dialog: *"Enabling auto-buy may result in real orders being placed. Confirm you understand the risks."* The backend does not block the request — the frontend owns this gate.

2. **Buy zone staleness indicator** — `BuyZoneOut.created_at` is provided. The frontend should display a staleness badge (e.g., "Updated 45 min ago") and offer a manual recalculate button that calls `POST /recalculate-buy-zone`.

3. **Near-earnings flag UX** — `WatchlistIdeaTicker.near_earnings` is set manually by the user in the ideas UI. Consider a toggle or date picker in the ticker form. The auto-buy engine reads this flag per-ticker.

4. **Opportunity page rank sorting** — The `rank_score` field in `OpportunityOut` is the composite score used for default sorting. Frontend can implement client-side secondary sorts (by confidence, by theme, by distance to zone) without additional API calls.

5. **Alert threshold for `near_buy_zone`** — The `threshold_json` for `near_buy_zone` expects `{"proximity_pct": 2.0}`. The alerts UI should show a numeric input for this value when the user selects the `near_buy_zone` type.

6. **Decision log badge colors** — Suggested badge color mapping:
   - `order_filled` — green
   - `ready_to_buy` / `ready_to_alert` — amber
   - `blocked_by_risk` / `order_rejected` — red
   - `candidate` / `cancelled` — gray
   - `order_submitted` — blue

---

## Language Rules (Enforced)

The following phrases are banned in all API responses, UI text, and code comments:

| Banned | Required replacement |
|--------|---------------------|
| "guaranteed profit" | "historically favorable outcome" |
| "no chance of loss" | "lower-risk area based on past data" |
| "safe entry" | "high-probability entry zone" |
| "certain to go up" | "positive outcome rate of X%" |
| "buy now" (as command) | "entered buy zone" |

A `# LANGUAGE RULE` comment is present in `buy_zone_service.py` and `auto_buy_engine.py` to remind future contributors.
