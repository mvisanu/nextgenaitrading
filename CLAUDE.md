# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NextGenStock** — a production-grade multi-user AI trading platform. V1 spec: `prompt.md`. V2 feature spec: `prompt-feature.md` / `PRD2.md`. V3 feature spec: `prompt-watchlist-scanner.md` / `PRD3.md`. V1 backend complete (60 files). V2 backend implemented (47 new files, 236 unit tests passing). V3 backend + frontend implemented (~88% complete, 167 unit tests passing, 10 bugs fixed). Frontend mostly implemented with Thai/English i18n on FAQ page.

**Stack:**
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **Backend:** FastAPI, SQLAlchemy 2.x async, Alembic, Pydantic v2
- **Database:** PostgreSQL (asyncpg driver)
- **Deployment:** Vercel (frontend), Render (backend), Supabase (DB)

## Development Commands

### Database (Docker)
```bash
# From repo root — start Postgres on host port 5432
docker compose up -d
```

### Backend
```bash
cd backend
# Windows PowerShell: .venv\Scripts\Activate.ps1
# bash/Unix: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head               # Run after docker compose up
uvicorn app.main:app --reload      # Dev server on :8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                          # Dev server on :3000
npm run build && npm run start       # Production preview
npm run lint
```

## Architecture

### Directory Layout
```
backend/app/
  main.py               # FastAPI app + CORS + router registration
  core/config.py        # Settings via pydantic-settings
  core/security.py      # JWT encode/decode, password hashing
  auth/                 # Register, login, refresh, logout, get_current_user
  api/                  # profile, broker, backtests, strategies, live, artifacts + v2: buy_zone, alerts, ideas, auto_buy, opportunities + v3: watchlist, scanner (extended)
  models/               # SQLAlchemy ORM models (all have user_id FK) + v2: buy_zone, alert, auto_buy, idea, theme_score + v3: buy_signal, generated_idea, user_watchlist
  schemas/              # Pydantic request/response DTOs + v2: buy_zone, alert, auto_buy, idea, theme_score + v3: buy_signal, generated_idea, watchlist, scanner
  db/session.py         # Async engine + session factory
  broker/               # AlpacaClient, RobinhoodClient, factory.py
  services/             # credential_service, execution_service, strategy_run_service + v2: buy_zone_service, analog_scoring_service, alert_engine_service, auto_buy_engine, theme_scoring_service, notification_service + v3: buy_signal_service, live_scanner_service, news_scanner_service, moat_scoring_service, financial_quality_service, entry_priority_service
  utils/                # v3: market_hours.py (ET market hours check)
  strategies/           # conservative.py, aggressive.py
  optimizers/           # ai_pick_optimizer.py, buy_low_sell_high_optimizer.py
  backtesting/engine.py
  artifacts/pine_script_generator.py
  scheduler/            # v2: APScheduler jobs (buy zone refresh, alert eval, auto-buy) + v3: live scanner (5min), idea generator (60min)
    tasks/              # v3: run_live_scanner.py, run_news_scanner.py, run_idea_generator.py
  alembic/              # Migration scripts (v1 + v2 + v3)

frontend/
  app/                  # Next.js App Router pages
    (auth)/login, (auth)/register
    dashboard, strategies, backtests, live-trading, artifacts, strategy-samples, profile, faq, learn
    opportunities, ideas, alerts, auto-buy   # v2 feature pages
  components/
    ui/                 # shadcn/ui primitives
    charts/             # PriceChart (Lightweight Charts), EquityCurve (Recharts), OptimizationScatter (Plotly)
    layout/             # sidebar, nav, shell
    strategy/           # StrategyModeSelector, StrategyForm, ResultsPanel
    buy-zone/           # BuyZoneCard, BuyZoneAnalysisPanel, HistoricalOutcomePanel, ThemeScoreBadge
    alerts/             # AlertConfigForm
    ideas/              # IdeaForm, IdeaList + v3: GeneratedIdeaCard, IdeaFeed, AddToWatchlistButton
    opportunities/      # v3: WatchlistTable, BuyNowBadge, EstimatedEntryPanel
  lib/api.ts            # Typed fetch wrappers for all backend endpoints (v1 + v2 + v3)
  lib/watchlist.ts      # Shared watchlist hook (useWatchlist) — syncs dashboard + opportunities via localStorage
  middleware.ts         # Route protection via cookie validation
```

### Request Flow
1. Frontend middleware checks JWT in HTTP-only cookie → redirects if missing
2. API calls go to FastAPI; `Depends(get_current_user)` validates access token on every protected route
3. All DB queries are scoped `WHERE user_id = current_user.id` — never trust user-supplied IDs
4. Broker credentials are decrypted in-memory at execution time only (Fernet); never returned in responses

### Authentication
- **Access token:** 15-min expiry, HTTP-only cookie, SameSite=Lax
- **Refresh token:** 7-day expiry, stored as bcrypt hash in `UserSession` table, rotated on each use
- **Never use localStorage** for tokens

### Strategy Modes
| Mode | Leverage | Min Confirms | Notes |
|------|----------|--------------|-------|
| Conservative | 2.5x | 7/8 | HMM regime detection |
| Aggressive | 4.0x | 5/8 | HMM + 5% trailing stop |
| AI Pick | — | — | Optimizer across MACD/RSI/EMA variants |
| Buy Low/Sell High | — | — | Optimizer across dip/cycle variants |

Optimizers backtest multiple variants, rank by risk-adjusted score, save winner + generate Pine Script v5.

### Charting Libraries (do not swap)
- **Lightweight Charts (TradingView):** Candlestick price/volume + signal markers
- **Recharts:** Equity curves, PnL histograms, KPI sparklines, leaderboard bars
- **Plotly.js:** Optimization scatter plots, regime heatmaps (AI Pick/BLSH only)

### Database Tables
**V1 (14 tables):** `User`, `UserProfile`, `UserSession`, `BrokerCredential`, `StrategyRun`, `TradeDecision`, `BrokerOrder`, `PositionSnapshot`, `CooldownState`, `TrailingStopState`, `VariantBacktestResult`, `WinningStrategyArtifact`, `BacktestTrade`

**V2 (7 new tables):** `StockBuyZoneSnapshot`, `StockThemeScore` (system-wide, no user_id), `WatchlistIdea`, `WatchlistIdeaTicker`, `PriceAlertRule`, `AutoBuySettings` (unique per user), `AutoBuyDecisionLog`

**V3 (3 new tables — implemented):** `UserWatchlist` (user_id + ticker, direct watchlist), `BuyNowSignal` (10-condition audit trail per evaluation), `GeneratedIdea` (auto-generated idea cards with megatrend/moat/financial quality scores, `reason_summary`/`news_headline` use `Text` columns)

## Environment Variables

**Backend (`.env`)** — file exists with local dev values:
```
DATABASE_URL=postgresql+asyncpg://nextgen:nextgen@localhost:5432/nextgenstock
SECRET_KEY=<generated>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
```

Docker Postgres: `nextgen:nextgen@localhost:5432/nextgenstock` (host port 5432).

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Critical Constraints

- **Multi-tenancy is non-negotiable:** Every service method must scope queries to `user_id`. Add `assert_ownership(record, current_user)` checks.
- **Live trading defaults to dry-run.** Require explicit opt-in and a confirmation dialog before real execution.
- **Broker keys are never returned in API responses.** Mask or omit entirely.
- **`prompt.md` is authoritative for v1.** `prompt-feature.md` is authoritative for v2 features (buy zone, alerts, auto-buy, themes, ideas). `prompt-watchlist-scanner.md` is authoritative for v3 features (live scanner, buy signals, auto-generated ideas, news scanner). When in doubt about a spec detail, consult the relevant prompt file.
- **V3 scanner alerts fire only when ALL 10 conditions pass.** Never partial alerts. See `PRD3.md` Section 4.3 for the full gate logic.
- **V3 approved wording:** Never say "guaranteed", "safe", "certain to go up". Always use "historically favorable", "high-probability entry zone", "confidence score".

## Implementation Status

| Layer | Status |
|-------|--------|
| v1 Backend (FastAPI, 60 files) | Complete |
| v2 Backend (47 new files, 236 unit tests) | Complete — buy zone, alerts, auto-buy, themes, ideas, scheduler |
| Alembic migrations (v1 + v2) | Written; run `alembic upgrade head` after DB is up |
| Docker Compose (Postgres) | Complete |
| Frontend v1 pages | Complete (auth, dashboard, artifacts, artifacts/[id], backtests/[id], strategies, strategy-samples, live-trading, profile, faq, learn) |
| Frontend v2 pages | Complete (opportunities, ideas, alerts, auto-buy) |
| Shared watchlist | `lib/watchlist.ts` — syncs dashboard + opportunities via localStorage events |
| v1 E2E tests (Playwright, 263 cases × 3 browsers) | Written in `tests/e2e/`; 421/789 passing (54%) — see `user_tests2.md` |
| v2 E2E tests (159 cases) | Written in `tests/e2e/specs/`; buy-zone & opportunities 100%, alerts/auto-buy have failures |
| v3 Backend (live scanner, buy signals, ideas engine) | Implemented — services, models, schemas, API endpoints, scheduler tasks, 167 unit tests passing |
| v3 Frontend (opportunities + ideas page extensions) | Implemented — WatchlistTable, BuyNowBadge, EstimatedEntryPanel, GeneratedIdeaCard, IdeaFeed, AddToWatchlistButton, ScannerStatusDot; opportunities page has dashboard watchlist sidebar |
| v3 API: POST /api/ideas/generated/run-now | Manual idea scan trigger (bypasses market hours) |
| v3 E2E tests (34 cases) | Written in `tests/e2e/specs/v3-opportunities.spec.ts` + `v3-ideas.spec.ts` |
| v3 Bug fixes (10 from test_report3.md) | All resolved — see V3 Bug Fixes section below |

### Running E2E Tests
```bash
cd tests
npm install                           # First time only
npx playwright test --config=e2e/playwright.config.ts
```
Tests require both backend (`uvicorn`) and frontend (`npm run dev`) running.

### Known Spec Deviations (see BACKEND.md for full list)
- Refresh token stored as SHA-256 (not bcrypt) — speed, not security compromise
- `POST /strategies/ai-pick/run` returns 202 Accepted (long-running)
- `GET /live/positions` returns DB snapshot, not live broker poll
- Robinhood client is a stub — all methods raise `NotImplementedError` except `ping()`
- 4h timeframe is resampled from 1h (yfinance limitation)

### Bug Fixes Applied
- `db/session.py`: Added `pool_recycle=3600` and `pool_timeout=30` to prevent connection pool exhaustion
- `register/page.tsx`: Redirects to `/dashboard` after registration (not `/login`); added inline error alert for duplicate emails
- `tests/package.json`: All npm scripts now use `--config=e2e/playwright.config.ts` to enforce `workers: 1`
- `artifacts.spec.ts`: ART-07 test authenticates before testing 404 response
- `auth/dependencies.py`: Replaced dev bypass with real JWT cookie validation (was returning hardcoded dev user)
- `middleware.ts`: Replaced passthrough with real cookie-based route protection (redirect to /login, auth→dashboard)
- `api/live.py` + `schemas/live.py`: Added `SignalCheckOut` model — `/run-signal-check` now returns `regime`/`signal`/`strategy_run_id` matching frontend types
- `live-trading/page.tsx`: Fixed `toUpperCase` crash; added `committedSymbol` to prevent keystroke API spam; added strategy mode dropdown; added per-indicator signal check breakdown (8 indicators with pass/fail); added auth guard
- `dashboard/page.tsx`: Added KPI cards (`data-testid="kpi-card"`), recent runs section, real user email; migrated watchlist to shared `useWatchlist` hook
- `TopNav.tsx`: Page title uses `<h1 data-testid="page-title">`
- `AppShell.tsx`: Shows real user email from `useAuth()` instead of hardcoded
- Added `frontend/app/artifacts/[id]/page.tsx` — artifact detail with Pine Script display and copy button
- Added `frontend/app/backtests/[id]/page.tsx` — backtest detail with equity curve, trade table, leaderboard
- `api/backtests.py` + `schemas/backtest.py`: Returns `StrategyRunOut` with `confirmation_count`, timeframe validation
- `.env.local`: Fixed API port from 8001 to 8000
- `profile/page.tsx`: Added auth guard (redirect to /login when session expired)
- `strategies/conservative.py` + `aggressive.py`: Added `compute_confirmation_details()` for per-indicator breakdown
- `strategies/base.py`: Added `confirmation_details` field to `SignalResult` dataclass
- `opportunities/page.tsx`: Added watchlist sidebar panel with add/edit/remove, star toggle per row
- `lib/watchlist.ts`: Extracted shared watchlist hook from dashboard (localStorage + cross-component sync)
- `market_data.py`: Fixed weekly/monthly period — `1wk` fetches 3650d, `1mo` fetches `max` (was 730d causing 0 trades)
- `live-trading/page.tsx`: Added Signal Decision Banner (BUY/SELL/HOLD) + chart signal markers after signal check
- `faq/page.tsx`: Added Thai/English language toggle with full translations (`faq/translations.ts`)
- `ResultsPanel.tsx`: Fixed `run.mode_name` crash — handles flat API response when `summary.run` is undefined
- `backtests/page.tsx`: Properly wraps flat API response into `BacktestSummary` shape with computed metrics
- `live-trading/page.tsx`: Changed order input from quantity to dollar amount (USD); sends `notional_usd` to backend
- `execution_service.py`: Handles `notional_usd` → quantity conversion using latest market price; fixed `df["Close"]` casing
- `execution_service.py`: Added `IntegrityError` catch on DB commit for dangling `strategy_run_id`
- `strategy_run_service.py`: Removed redundant `validate_symbol()` that caused 422 on signal check
- `auto_buy_engine.py`: Fixed dead-code `position_size_limit` safeguard (notional was self-referential)
- `alert_engine_service.py`: Removed orphaned `_check_theme_score_changed`; fixed theme alert defaults (was always delta=0)

### V2 Documentation
- `PRD2.md` — Structured PRD for v2 features
- `TASKS2.md` — 47 dependency-ordered tasks
- `BACKEND2.md` — V2 backend handoff (endpoints, models, services)
- `tests2_output.md` — V2 test report (236/236 passing)
- `user_tests2.md` — Full E2E test report (2026-03-25): 421/789 v1 passing (54%), v2 buy-zone/opportunities 100%, alerts/auto-buy failing

### V3 Bug Fixes Applied
- `api/watchlist.py`: Returns 409 on duplicate ticker (was 200, making frontend error path dead code)
- `schemas/generated_idea.py`: `LastScanOut` field renamed `idea_count` → `ideas_generated` + added `next_scan_at` to match frontend types
- `schemas/generated_idea.py`: `AddToWatchlistResponse` shape changed to `watchlist_entry_created`/`alert_rule_created`/`idea_id` matching frontend `AddToWatchlistResult`
- `api/scanner.py`: `GET /api/scanner/status` now returns `market_hours_active`, `next_scan_at`, `tickers_in_queue` matching `ScannerStatus` TypeScript type
- `models/generated_idea.py`: `reason_summary` and `news_headline` changed from `String(500)` to `Text` (prevents truncation of merged summaries)
- `WatchlistTable.tsx`: Removed non-functional theme filter chips (OpportunityRow has no `theme_tags`)
- `types/index.ts`: Fixed `RunNowResult` type — `strong_buy_tickers: string[]` + `error_tickers: string[]` matching backend
- `frontend/.eslintrc.json`: Created with `next/core-web-vitals` (lint was broken with no config)
- `api/generated_ideas.py`: Added `POST /api/ideas/generated/run-now` endpoint for on-demand idea scanning
- `IdeaFeed.tsx`: Refresh/Try Now calls `generatedIdeasApi.runNow()` (was calling `scannerApi.runNow()` which is the watchlist scanner, not idea generator)
- `opportunities/page.tsx`: Restored dashboard watchlist sidebar (useWatchlist hook) alongside V3 WatchlistTable
- `IdeaFeed.tsx` + `IdeaList.tsx`: Added "How it works" onboarding guides in empty states
- `scanner.py` `run-now`: Response returns `tickers_scanned`/`strong_buy_signals` matching frontend `RunNowResult` type
- `OpportunityRow` type: Rewritten to match `WatchlistOpportunityOut` schema (field name alignment: `signal_strength`, `distance_to_zone_pct`, `last_signal_at`)
- `opportunitiesApi.list`: Calls V3 `GET /opportunities/watchlist` (was V2 `GET /opportunities`)
- `WatchlistTable.tsx`: Added `buildConditionDetails()` and `toSignalStatus()` helpers; fixed all field references
- `BuyNowBadge.tsx`: Condition key labels match `BuyNowSignal` model keys
- `dashboard/page.tsx`: Reads `?ticker=` query param via `useSearchParams()` for "View Chart" links from ideas
- `auto-buy/page.tsx`: Fixed `allowed_account_ids_json.includes()` crash when null; fixed `reason_codes` object handling (both dry-run panel and decision log table)
- `api.ts`: Added `{}` body to `dryRun` POST (backend requires JSON body for `DryRunRequest`)
- `IdeaFeed.tsx`: "Theme" tab filters by `theme_tags` presence (not `source=theme`); added Bitcoin, Healthcare, Medicine chips
- `megatrend_filter_service.py`: Added bitcoin (MSTR, COIN, MARA, RIOT, IBIT), healthcare (UNH, JNJ, PFE, ABBV, TMO, ABT), medicine tags
- `v3_idea_generator_service.py`: Added healthcare + bitcoin/crypto tickers to `SCAN_UNIVERSE`
- `main.py` + `api.ts`: Fixed v2/v3 router registration — removed `prefix="/api"` from `app.include_router()` calls (was doubling prefix); stripped `/api` from frontend API client paths to match

### V3 Documentation
- `prompt-watchlist-scanner.md` — Raw feature spec for watchlist scanner, buy alerts, auto-idea engine
- `PRD3.md` — Structured PRD for v3 features (live scanner, buy signals, news scanner, idea generator, megatrend/moat/financial quality filters)
- `TASKS3.md` — 49 dependency-ordered tasks across 19 parallel work waves
- `BACKEND3.md` — V3 backend handoff (endpoints, models, services, scheduler jobs)
- `FRONTEND3.md` — V3 frontend handoff (new components, types, API functions, page modifications)
- `test_report3.md` — V3 comprehensive test report (167 tests, 10 bugs found and fixed)

### Known E2E Test Failures (as of 2026-03-25, see `user_tests2.md`)
**P0 — Blocking:**
- Middleware/auth test isolation: shared browser context leaks cookies between tests (spec bug, not app bug)
- Multi-tenancy tests: inverted assertions (`expect([403,404]).toContain(200)` always fails)
- Security tests: same inverted assertion pattern

**P1 — Important:**
- Auto-buy dry-run: tests send no request body → 422 (fix: send `{}`)
- Auto-buy UI: missing expected elements (risk disclaimer, switch, decision log)
- Alerts PATCH: field name mismatch (`threshold` vs `threshold_json`)

**P2 — Test Infrastructure:**
- CSS selector syntax errors in some specs
- `sr-only` headings fail `toBeVisible()` assertions
- No DB reset between test runs causing stale data accumulation

### Scan Universe Themes
Theme chips on Ideas page: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine. Scan universe: ~50 tickers including mega-cap tech, financials, energy, defense, semiconductors, space, longevity/biotech, healthcare, and bitcoin/crypto-adjacent stocks.
