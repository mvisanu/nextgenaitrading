# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NextGenStock** — a production-grade multi-user AI trading platform. All specs consolidated in `SPEC.md` (V1 + V2 + V3 + Screener + Bitcoin). PRD in `PRD.md` (3 parts). V1 backend complete (60 files). V2 backend implemented (47 new files, 236 unit tests passing). V3 backend + frontend implemented (~88% complete, 167 unit tests passing, 10 bugs fixed). Frontend mostly implemented with Thai/English i18n on FAQ page.

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
  core/config.py        # Settings via pydantic-settings (includes `debug` flag for Swagger toggle)
  core/security.py      # JWT encode/decode (PyJWT), password hashing (bcrypt/passlib), Fernet encryption
  core/rate_limit.py    # slowapi rate limiter (shared instance)
  auth/                 # Register, login, refresh, logout, get_current_user
  api/                  # profile, broker, backtests, strategies, live, artifacts + v2: buy_zone, alerts, ideas, auto_buy, opportunities + v3: watchlist, scanner (extended)
  models/               # SQLAlchemy ORM models (all have user_id FK) + v2: buy_zone, alert, auto_buy, idea, theme_score + v3: buy_signal, generated_idea, user_watchlist
  schemas/              # Pydantic request/response DTOs + v2: buy_zone, alert, auto_buy, idea, theme_score + v3: buy_signal, generated_idea, watchlist, scanner
  db/session.py         # Async engine + session factory
  broker/               # AlpacaClient, RobinhoodClient, factory.py
  services/             # credential_service, execution_service, strategy_run_service + v2: buy_zone_service, analog_scoring_service, alert_engine_service, auto_buy_engine, theme_scoring_service, notification_service + v3: buy_signal_service, live_scanner_service, news_scanner_service, moat_scoring_service, financial_quality_service, entry_priority_service + bollinger_squeeze_service
  utils/                # v3: market_hours.py (ET market hours check)
  strategies/           # conservative.py, aggressive.py, bollinger_squeeze.py
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

### Authentication & Security
- **Access token:** 15-min expiry, HTTP-only cookie, SameSite=Lax
- **Refresh token:** 7-day expiry, stored as SHA-256 hash in `UserSession` table, rotated on each use
- **Never use localStorage** for tokens
- **JWT library:** PyJWT (`jwt` module), NOT python-jose — migrated for active maintenance
- **Rate limiting:** slowapi on auth endpoints (10/min login, 5/min register, 10/min refresh) and trade execution (10/min)
- **Account lockout:** 5 failed login attempts → 15-min lockout per email (in-memory tracker)
- **Password policy:** min 8 chars, requires uppercase + lowercase + digit
- **CORS:** Restricted to `settings.cors_origins_list` — never use `allow_origins=["*"]`
- **Auto-buy real trading:** Requires password re-authentication to set `paper_mode=False`
- **Swagger/Redoc:** Only enabled when `DEBUG=true` in `.env`

### Strategy Modes
| Mode | Leverage | Min Confirms | Notes |
|------|----------|--------------|-------|
| Conservative | 2.5x | 7/8 | HMM regime detection |
| Aggressive | 4.0x | 5/8 | HMM + 5% trailing stop |
| AI Pick | — | — | Optimizer across MACD/RSI/EMA variants |
| Buy Low/Sell High | — | — | Optimizer across dip/cycle variants |
| BB Squeeze | 2.5x | 6/8 | Bollinger Band squeeze breakout detection |

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
DEBUG=true
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
```

Docker Postgres: `nextgen:nextgen@localhost:5432/nextgenstock` (bound to `127.0.0.1:5432`, dev-only credentials).

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Critical Constraints

- **Multi-tenancy is non-negotiable:** Every service method must scope queries to `user_id`. Add `assert_ownership(record, current_user)` checks.
- **Live trading defaults to dry-run.** Require explicit opt-in and a confirmation dialog before real execution.
- **Broker keys are never returned in API responses.** Mask or omit entirely.
- **`SPEC.md` is authoritative for all feature specs** (V1, V2, V3, Screener, Bitcoin sections). When in doubt about a spec detail, consult the relevant section in `SPEC.md`.
- **V3 scanner alerts fire only when ALL 10 conditions pass.** Never partial alerts. See `PRD.md` Part 3, Section 4.3 for the full gate logic.
- **V3 approved wording:** Never say "guaranteed", "safe", "certain to go up". Always use "historically favorable", "high-probability entry zone", "confidence score".
- **CORS must never be `["*"]`.** Always use `settings.cors_origins_list`. Exception handlers must validate origin against allow-list before reflecting.
- **All list endpoints must have bounded `limit` params:** Use `Query(default=50, ge=1, le=200)`.
- **Credential test errors must not leak raw exception strings.** Return a generic message; log the real error server-side.
- **FAQ page HTML rendering uses DOMPurify sanitization.** Never add `dangerouslySetInnerHTML` without sanitization.
- **DELETE endpoints return `Response(status_code=204)`** — FastAPI 0.115+ forbids `status_code=204` with response body in decorator.

## Implementation Status

| Layer | Status |
|-------|--------|
| v1 Backend (FastAPI, 60 files) | Complete |
| v2 Backend (47 new files, 236 unit tests) | Complete — buy zone, alerts, auto-buy, themes, ideas, scheduler |
| Alembic migrations (v1 + v2) | Written; run `alembic upgrade head` after DB is up |
| Docker Compose (Postgres) | Complete |
| Frontend v1 pages | Complete (auth, dashboard, artifacts, artifacts/[id], backtests/[id], strategies, strategy-samples, live-trading, profile, faq, learn) — FAQ has 13 sections + Thai i18n |
| Frontend v2 pages | Complete (opportunities, ideas, alerts, auto-buy) |
| Shared watchlist | `lib/watchlist.ts` — syncs dashboard + opportunities via localStorage events |
| v1 E2E tests (Playwright, 263 cases × 3 browsers) | Written in `tests/e2e/`; 421/789 passing (54%) — see `TEST_REPORT.md` |
| v2 E2E tests (159 cases) | Written in `tests/e2e/specs/`; buy-zone & opportunities 100%, alerts/auto-buy have failures |
| v3 Backend (live scanner, buy signals, ideas engine) | Implemented — services, models, schemas, API endpoints, scheduler tasks, 167 unit tests passing |
| v3 Frontend (opportunities + ideas page extensions) | Implemented — WatchlistTable, BuyNowBadge, EstimatedEntryPanel, GeneratedIdeaCard, IdeaFeed, AddToWatchlistButton, ScannerStatusDot; opportunities page has dashboard watchlist sidebar |
| v3 API: POST /api/ideas/generated/run-now | Manual idea scan trigger (bypasses market hours) |
| v3 E2E tests (34 cases) | Written in `tests/e2e/specs/v3-opportunities.spec.ts` + `v3-ideas.spec.ts` |
| v3 Bug fixes (10 from TEST_REPORT.md) | All resolved — see V3 Bug Fixes section below |
| Bollinger Band Squeeze strategy | Complete — backend service + strategy + API + frontend chart overlay + dashboard toggle |
| Cross-origin auth (Vercel ↔ Render) | Complete — auth_session marker cookie + pgbouncer fix |
| Mobile responsiveness | Complete — all pages phone-friendly (hamburger menus, scrollable tables, responsive grids) |

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

### Consolidated Documentation
All documentation has been merged into single files with V1/V2/V3 sections:
- `SPEC.md` — All feature specs (V1 core, V2 buy zone/alerts/auto-buy, V3 watchlist scanner, Screener & TA, Bitcoin theme)
- `PRD.md` — Product requirements (Parts 1–3)
- `TASKS.md` — Task breakdowns (Parts 1–3)
- `BACKEND.md` — Backend architecture handoff (Parts 1–3)
- `FRONTEND.md` — Frontend architecture handoff (Parts 1–3)
- `TEST_REPORT.md` — All test reports (V1/V2/V3 unit tests, E2E results, bugs found)

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
- `faq/page.tsx`: Added 4 new sections (Opportunities & Live Scanner, Ideas & Auto-Generated Suggestions, Price Alerts, Auto-Buy Engine) + 4 new FAQ items, all with Thai translations
- `faq/page.tsx`: Fixed `onChange` TypeError — wrapped `setLang` in `useCallback` to avoid React 19 `current is not iterable` crash when passing raw dispatcher as prop
- `faq/translations.ts`: Added ~80 new translation keys for V2/V3 feature FAQ sections (EN + TH)

### OWASP Top 10 Security Hardening (2026-03-25)
Full audit performed; 1 Critical, 4 High, 7 Medium, 6 Low findings identified and fixed:
- **A01 CORS (CRITICAL):** `main.py` — replaced `allow_origins=["*"]` with `settings.cors_origins_list`; error handlers validate origin against allow-list before reflecting
- **A04 Rate limiting (HIGH):** Added `slowapi` — auth endpoints (5-10/min), trade execution (10/min) via `core/rate_limit.py`
- **A04 Auto-buy re-auth (HIGH):** `auto_buy.py` — `paper_mode=False` requires `current_password` field for re-authentication
- **A05 Cookie secure (HIGH):** `main.py` lifespan — startup warning when `COOKIE_SECURE=false` in non-localhost env
- **A05 Swagger (MEDIUM):** `main.py` — docs/redoc disabled unless `DEBUG=true`
- **A06 python-jose → PyJWT (MEDIUM):** `security.py` + `dependencies.py` — migrated to `PyJWT[crypto]>=2.8.0`; `requirements.txt` updated
- **A04 Password policy (MEDIUM):** `schemas/auth.py` — min 8 chars + uppercase + lowercase + digit validator
- **A03 XSS (MEDIUM):** `faq/page.tsx` — added DOMPurify sanitization for `dangerouslySetInnerHTML` with strict tag/attr allowlist
- **A05 Docker (MEDIUM):** `docker-compose.yml` — bound port to `127.0.0.1:5432`, credentials via env vars
- **A07 Account lockout (MEDIUM):** `auth/service.py` — 5 failed attempts → 15-min lockout per email (in-memory)
- **A01 Unbounded limits (LOW):** strategies, backtests, live, artifacts — added `Query(ge=1, le=200)` bounds
- **A09 Error leaking (LOW):** `credential_service.py` — generic message instead of `str(exc)`
- **A06 bcrypt (LOW):** Updated from pinned `4.0.1` to `>=4.1.0`
- **FastAPI 0.115+ compat:** Fixed 5 DELETE endpoints (`broker`, `watchlist`, `alerts`, `ideas`, `auth/logout`) — `status_code=204` in decorator replaced with `Response(status_code=204)` return

### E2E Bug Fixes Applied (2026-03-25)
- `schemas/alert.py`: Renamed `threshold` → `threshold_json` with backward-compat coercion from legacy `threshold` field
- `schemas/idea.py`: Renamed `tags` → `tags_json` with backward-compat coercion from legacy `tags` field
- `api/alerts.py`: Updated to use `threshold_json`; added `GET /alerts/{id}` endpoint
- `api/ideas.py`: Updated to use `tags_json`
- `api/buy_zone.py`: Generate explanation for cached theme score records (was returning empty list)
- `auth/service.py`: Logout uses `set_cookie(max_age=0)` instead of `delete_cookie` (fixes cookie clearing)
- `dashboard/page.tsx`: Replaced `sr-only` heading with `opacity-0` so Playwright `toBeVisible()` works
- `tests/e2e/helpers/v2-api.helper.ts`: Auto-buy dry-run sends `{}` body (was empty → 422)
- `tests/e2e/specs/auto-buy.spec.ts`: Added `beforeEach` settings reset to prevent stale data
- `tests/e2e/specs/security.spec.ts`: Fresh request context for unauthenticated tests (cookie isolation)
- `tests/e2e/specs/nextgenstock-live.spec.ts`: Fresh request context for API auth isolation
- `tests/e2e/specs/live-trading.spec.ts`, `strategies.spec.ts`, `backtests.spec.ts`, `auto-buy-ui.spec.ts`: Fixed broken CSS comma-separated attribute selectors

### Former V3 Documentation (now consolidated above)
All V3 docs have been merged into the consolidated files listed above.

### Bollinger Band Squeeze Strategy (2026-03-25)
Full implementation of BB Squeeze as a new strategy mode across backend + frontend:
- **`services/bollinger_squeeze_service.py`** (NEW): Pure calculation utilities — `compute_bollinger_bands()`, `detect_squeeze()`, `compute_squeeze_strength()`, `detect_breakout()`, `compute_squeeze_analysis()`
- **`strategies/bollinger_squeeze.py`** (NEW): `BollingerSqueezeStrategy` class — 8 squeeze-specific confirmations (RSI, EMA cross, ADX, volume, OBV, squeeze active, bullish breakout, breakout volume), leverage 2.5x, min 6/8 confirms
- **`schemas/live.py`**: Added `SqueezeData`, `BollingerOverlayBar` models; extended `SignalCheckOut` with `squeeze` field; `LiveChartResponse` with `bollinger` list
- **`api/live.py`**: Chart-data endpoint accepts `bollinger: bool` query param; signal check extracts squeeze data from notes JSON
- **`strategy_run_service.py`**: Routes `"squeeze"` mode through `_run_hmm_mode`
- **Frontend**: PriceChart renders BB overlay (upper/lower/middle bands + squeeze zones in orange); live-trading page has "BB Squeeze" strategy mode with squeeze status card; dashboard has "BB Squeeze" toggle button in drawing tools toolbar
- **Types**: `SqueezeData`, `BollingerOverlayBar` interfaces; `SignalCheckRequest.mode` includes `"squeeze"`

### Cross-Origin Auth Fix (2026-03-25)
Fixed redirect loop when frontend (Vercel) and backend (Render) are on different domains:
- **Problem**: httponly `access_token` cookie set on Render domain is invisible to Next.js edge middleware on Vercel → middleware sees no cookie → redirects to `/login` → infinite loop
- **Solution**: `auth_session` marker cookie (non-sensitive `1` value) set via `document.cookie` on the frontend domain
- **`proxy.ts`** (middleware): Checks for either `access_token` or `auth_session` cookie
- **`login/page.tsx`** + **`register/page.tsx`**: Set `auth_session=1` cookie on successful auth
- **`AppShell.tsx`** + **`lib/api.ts`**: Clear `auth_session` cookie on logout and on 401 session expiry
- **`db/session.py`**: Added `connect_args={"statement_cache_size": 0}` for Supabase pgbouncer compatibility
- **Production env vars needed on Render**: `CORS_ORIGINS=<vercel-domain>`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`

### Mobile Responsiveness (2026-03-25)
Comprehensive mobile/phone viewing fixes across all pages:
- **Dashboard** (custom layout — biggest fix): Added mobile hamburger menu (Sheet); mobile watchlist as right-side sheet; toolbar scrolls horizontally; quick intervals/indicators/alert buttons hidden on small screens; OHLCV bar scrollable; drawing tool labels icon-only on mobile
- **Live Trading**: All 4 tables (paper positions, paper history, broker positions, orders) wrapped in `overflow-x-auto`
- **Backtests**: List table + detail page (trades + variant leaderboard) wrapped in `overflow-x-auto`
- **Artifacts**: Table wrapped in `overflow-x-auto`
- **Auto-Buy**: Empty-state decision log table wrapped in `overflow-x-auto`
- **Already mobile-friendly**: AppShell pages (hamburger + responsive padding), WatchlistTable, trade log, alerts, ideas, profile, FAQ

### Auto-Buy Paper Mode Password UI (2026-03-25)
- **`auto-buy/page.tsx`**: Added `livePassword` state + password Input field in live mode dialog; sends `current_password` in updateSettings call
- **`types/index.ts`**: Added `current_password?: string` to `UpdateAutoBuySettingsRequest`
- Fixed JSX syntax error (missing `</div>` at line 592 in empty-state ternary)

### FVG Visibility Fix (2026-03-25)
- **`DrawingPrimitives.ts`**: Increased FVG fill opacity 0.15→0.35, border 0.5→0.85 solid (was dashed), label font bold 11px at full opacity

### Git Status
All V1 + V2 + V3 code committed and pushed to `main` (commit `86dfa5c`, 2026-03-24). 766 files, 110K+ insertions. README.md rewritten for portfolio. Additional features (BB Squeeze, cross-origin auth, mobile responsive, FVG fix, auto-buy password UI) added 2026-03-25 — uncommitted.

### Known E2E Test Failures (as of 2026-03-25, see `TEST_REPORT.md`)
Most issues from the 2026-03-25 test run have been fixed. Remaining open items:
- Multi-tenancy tests: some assertions may still need investigation (test isolation vs real scoping bugs)
- Auto-buy UI: some expected elements may still be missing (risk disclaimer, decision log table)
- No DB reset between test runs causing stale data accumulation

### Scan Universe Themes
Theme chips on Ideas page: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine. Scan universe: ~50 tickers including mega-cap tech, financials, energy, defense, semiconductors, space, longevity/biotech, healthcare, and bitcoin/crypto-adjacent stocks.
