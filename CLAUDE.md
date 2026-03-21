# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NextGenStock** — a production-grade multi-user AI trading platform. The full specification lives in `prompt.md`. The backend is fully implemented (60 files). The frontend scaffolding exists but pages/components are not yet implemented.

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
  api/                  # profile, broker, backtests, strategies, live, artifacts
  models/               # SQLAlchemy ORM models (all have user_id FK)
  schemas/              # Pydantic request/response DTOs
  db/session.py         # Async engine + session factory
  broker/               # AlpacaClient, RobinhoodClient, factory.py
  services/             # credential_service, execution_service, strategy_run_service
  strategies/           # conservative.py, aggressive.py
  optimizers/           # ai_pick_optimizer.py, buy_low_sell_high_optimizer.py
  backtesting/engine.py
  artifacts/pine_script_generator.py
  alembic/              # Migration scripts

frontend/
  app/                  # Next.js App Router pages
    (auth)/login, (auth)/register
    dashboard, strategies, backtests, live-trading, artifacts, strategy-samples, profile
  components/
    ui/                 # shadcn/ui primitives
    charts/             # PriceChart (Lightweight Charts), EquityCurve (Recharts), OptimizationScatter (Plotly)
    layout/             # sidebar, nav, shell
    strategy/           # StrategyModeSelector, StrategyForm, ResultsPanel
  lib/api.ts            # Typed fetch wrappers for all backend endpoints
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
14 tables, all with `user_id` FK:
`User`, `UserProfile`, `UserSession`, `BrokerCredential`, `StrategyRun`, `TradeDecision`, `BrokerOrder`, `PositionSnapshot`, `CooldownState`, `TrailingStopState`, `VariantBacktestResult`, `WinningStrategyArtifact`, `BacktestTrade`

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
- **`prompt.md` is authoritative.** When in doubt about a spec detail (API shape, DB schema, strategy parameters), consult it.

## Implementation Status

| Layer | Status |
|-------|--------|
| Backend (FastAPI, 60 files) | Complete |
| Alembic migrations | Written; run `alembic upgrade head` after DB is up |
| Docker Compose (Postgres) | Complete |
| Frontend (Next.js pages/components) | Partially implemented (auth, artifacts, strategies, strategy-samples pages done) |
| E2E tests (Playwright, 159 cases) | Written in `tests/e2e/` |

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
