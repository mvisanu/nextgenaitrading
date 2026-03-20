# NextGenStock

**A production-grade, multi-user AI trading platform.**

[![Python](https://img.shields.io/badge/Python-3.12%2B-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

NextGenStock wraps a Python quant engine — HMM regime detection, multi-variant indicator optimisation, a 60/20/20 backtesting engine, and Pine Script v5 generation — in a secure, multi-tenant web application. Individual investors and quant hobbyists get a polished browser UI to run algorithmic strategies against any yfinance symbol, backtest across parameter grids, manage encrypted broker credentials, and export winning strategies directly to TradingView. No command line required.

The platform is spec-driven and greenfield. All source code is being built to this specification; the architecture, API contracts, and database schema are fully defined and ready to implement.

---

## What this demonstrates

This project is a portfolio piece. It is designed to show the following skills to technical evaluators:

- **Async Python backend at scale** — FastAPI with SQLAlchemy 2.x `AsyncSession`, `asyncpg`, and a fully async service layer
- **JWT security without localStorage** — HTTP-only cookie auth with SHA-256 refresh token hashing, silent rotation, and strict SameSite controls
- **Multi-tenant data isolation** — every query scoped to `user_id`; `assert_ownership()` enforced in every service method; no route trusts a user-supplied ID
- **Quantitative strategy engine** — GaussianHMM regime detection (hmmlearn), 8-confirmation signal gating, leveraged backtesting with trailing stops and cooldowns
- **Parameter optimisation** — 12-variant AI Pick grid and 8-variant Buy Low / Sell High grid ranked by `validation_score = validation_return / (1 + max_drawdown)` on a held-out split
- **Pine Script v5 generation** — winning variants serialised to executable TradingView strategy code
- **Fernet credential encryption** — broker API keys encrypted at rest, decrypted in-memory at execution time only, never returned in any API response
- **Production-ready frontend** — Next.js 16 App Router, TanStack Query v5, three charting libraries (Lightweight Charts, Recharts, Plotly.js) each chosen for a specific rendering task
- **Broker abstraction layer** — `AbstractBrokerClient` with Alpaca (alpaca-py) and Robinhood (httpx) implementations behind a factory

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Vercel)                       │
│                                                             │
│  Next.js 16 App Router · TypeScript · Tailwind · shadcn/ui  │
│                                                             │
│  ┌──────────┐  ┌───────────┐  ┌────────────────────────┐   │
│  │  Login / │  │ Dashboard │  │ Strategies / Backtests │   │
│  │ Register │  │ KPIs      │  │ Live Trading / Artifacts│  │
│  └──────────┘  └───────────┘  └────────────────────────┘   │
│                                                             │
│  Lightweight Charts · Recharts · Plotly.js                  │
│  TanStack Query v5 · React Hook Form + Zod                  │
│                                                             │
│  middleware.ts — cookie presence check → /login redirect    │
│  lib/api.ts    — typed fetch + 401 silent-refresh           │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + HTTP-only cookies
                         │ CORS restricted to CORS_ORIGINS
┌────────────────────────▼────────────────────────────────────┐
│                   FastAPI (Render)                          │
│                                                             │
│  auth/          — register, login, refresh, logout, /me     │
│  api/           — profile, broker, backtests, strategies,   │
│                   live, artifacts                           │
│  core/security  — JWT encode/decode, assert_ownership()     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Strategy Engine                        │   │
│  │                                                      │   │
│  │  conservative.py  — HMM 2-state, 2.5x leverage,     │   │
│  │                     7/8 confirmations                │   │
│  │  aggressive.py    — HMM + 5% trailing stop,          │   │
│  │                     4.0x leverage, 5/8 confirmations │   │
│  │  ai_pick_optimizer        — 12-variant MACD/RSI/EMA  │   │
│  │  buy_low_sell_high_optimizer — 8-variant RSI/BB/cycle│   │
│  │  backtesting/engine.py    — 60/20/20 split, cooldown,│   │
│  │                             trailing stop, validation │   │
│  │  artifacts/pine_script_generator.py — Pine Script v5 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  broker/factory.py — routes to Alpaca or Robinhood client   │
│  services/credential_service — Fernet encrypt/decrypt       │
│  db/session.py     — AsyncSession + asyncpg                 │
└────────────────────────┬────────────────────────────────────┘
                         │ asyncpg
┌────────────────────────▼────────────────────────────────────┐
│              PostgreSQL (Supabase)                          │
│                                                             │
│  14 tables — all with user_id FK + ondelete CASCADE         │
│  User · UserProfile · UserSession · BrokerCredential        │
│  StrategyRun · TradeDecision · BrokerOrder                  │
│  PositionSnapshot · CooldownState · TrailingStopState       │
│  VariantBacktestResult · WinningStrategyArtifact            │
│  BacktestTrade                                              │
└─────────────────────────────────────────────────────────────┘
```

### Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js 16 (App Router) | RSC for fast initial load; middleware.ts for edge-runtime cookie checks |
| UI components | shadcn/ui + Radix primitives | Accessible, unstyled base with Tailwind customisation |
| Server state | TanStack Query v5 | Declarative cache invalidation on mutations; no Redux boilerplate |
| Forms | React Hook Form + Zod | Type-safe schemas shared with backend DTO shapes |
| Candlestick charts | Lightweight Charts (TradingView) | Native OHLCV + volume + signal marker support; minimal bundle overhead |
| Metric charts | Recharts | Composable area/bar charts for equity curves, PnL histograms |
| Research charts | Plotly.js | Scatter plots and heatmaps for optimisation analysis |
| Backend framework | FastAPI + Pydantic v2 | Async-first; automatic OpenAPI docs; Pydantic v2 performance |
| ORM | SQLAlchemy 2.x async | Type-safe queries; Alembic migration support |
| Database driver | asyncpg | Non-blocking PostgreSQL driver; required for async SQLAlchemy |
| Auth tokens | python-jose (HS256) | Standard JWT implementation; short-lived access tokens |
| Password hashing | passlib[bcrypt] | Bcrypt with cost factor; industry standard |
| Credential encryption | cryptography (Fernet) | Symmetric authenticated encryption for broker API keys |
| Market data | yfinance + pandas | Wide ticker coverage; 4h resampled from 1h (yfinance limitation) |
| HMM regime detection | hmmlearn (GaussianHMM) | 2-state bull/bear regime fitted on 730 days of log-returns, ATR, volume ratio |
| Technical indicators | ta | Consistent project convention; MACD, RSI, EMA, Bollinger Bands |
| Broker — stocks/ETFs | alpaca-py (Alpaca Markets) | Official SDK; paper and live trading; crypto support |
| Broker — crypto | httpx (Robinhood REST) | Direct API calls against Robinhood crypto endpoint; stub in v1 |
| Deployment | Vercel + Render + Supabase | Zero-ops free tier for all three layers |

---

## Strategy modes

| Mode | Leverage | Min Confirms | Notes |
|---|---|---|---|
| Conservative | 2.5x | 7 / 8 | GaussianHMM regime detection; suitable for lower-risk profiles |
| Aggressive | 4.0x | 5 / 8 | HMM + 5% trailing stop; higher leverage, looser confirmation gate |
| AI Pick | — | — | 12-variant grid across MACD/RSI/EMA parameters; auto-selects winner by `validation_score` |
| Buy Low / Sell High | — | — | 8-variant grid across RSI oversold level, Bollinger window, cycle hold bars |

**AI Pick variant ranking:** `validation_score = validation_return / (1 + max_drawdown)` on the held-out validation split. The winning variant generates a Pine Script v5 artifact.

**Buy Low / Sell High entry/exit:** dip entry when RSI < oversold threshold AND price < Bollinger lower band; cycle exit when RSI > 65 OR price > Bollinger upper band.

**Supported symbols:** any valid yfinance ticker — `AAPL`, `BTC-USD`, `SPY`, `ETH-USD`, etc. The backend validates the symbol via yfinance before running.

**Supported timeframes:** `1d`, `1h`, `4h`, `1wk` (4h is resampled from 1h internally).

---

## Quickstart

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 15+ (local) or a Supabase connection string

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate a Fernet encryption key (run once, paste into .env)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Copy and edit the environment file
cp .env.example .env
# Required: DATABASE_URL, SECRET_KEY, ENCRYPTION_KEY

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --port 8000
```

The API is available at:

| URL | Description |
|---|---|
| `http://localhost:8000` | API base |
| `http://localhost:8000/docs` | Swagger UI (interactive) |
| `http://localhost:8000/redoc` | ReDoc |
| `http://localhost:8000/healthz` | Health check (used by Render) |

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and edit the environment file
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Start the development server
npm run dev                      # http://localhost:3000

# Production preview
npm run build && npm run start

# Lint
npm run lint
```

---

## Configuration

### Backend environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | `postgresql+asyncpg://user:pass@host/db` |
| `SECRET_KEY` | Yes | — | HMAC secret for JWT signing (min 32 chars) |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Access token lifetime in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime in days |
| `ENCRYPTION_KEY` | Yes | — | Fernet key for broker credential encryption |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `COOKIE_SECURE` | No | `false` | Set `true` in production (requires HTTPS) |
| `COOKIE_SAMESITE` | No | `lax` | Cookie SameSite attribute |
| `POOL_SIZE` | No | `5` | SQLAlchemy connection pool size |
| `MAX_OVERFLOW` | No | `10` | SQLAlchemy pool max overflow |
| `ALPACA_BASE_URL` | No | `https://api.alpaca.markets` | Alpaca live trading API URL |
| `ALPACA_PAPER_URL` | No | `https://paper-api.alpaca.markets` | Alpaca paper trading API URL |
| `ROBINHOOD_BASE_URL` | No | `https://trading.robinhood.com` | Robinhood base URL |

### Frontend environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | FastAPI backend URL, e.g. `http://localhost:8000` |

No secrets belong in the frontend. This is the only variable needed.

---

## Security design

**Authentication:** Access tokens (15 min, HS256) and refresh tokens (7 days) are issued as HTTP-only, SameSite=Lax cookies. Tokens are never exposed to JavaScript and never stored in `localStorage`. The refresh token is not stored in the database — only its SHA-256 hex hash is stored in `UserSession.refresh_token_hash`, meaning a database breach does not expose refresh tokens. On refresh, the incoming token is hashed and compared; the old token is revoked immediately after rotation.

**Multi-tenancy:** Every user-owned table carries a `user_id` foreign key with `ondelete=CASCADE`. Every service method queries with `WHERE user_id = current_user.id`. The `assert_ownership(record_user_id, current_user_id)` utility in `core/security.py` raises HTTP 403 on mismatch and is called before every record read or modification.

**Broker credentials:** Both `api_key` and `secret_key` columns store Fernet-encrypted ciphertext. Decryption occurs only inside `broker/factory.py` at execution time, in-memory, and is never logged. API responses return `****(encrypted)` for the `api_key` field.

**Live trading safety:** Live trading defaults to dry-run (`dry_run=True`). Switching to real-money execution requires explicit opt-in via UI toggle plus a confirmation dialog. A persistent risk disclaimer banner is shown on the live trading page regardless of mode.

**CORS:** Restricted to the origins listed in `CORS_ORIGINS`. No wildcard origins in production.

---

## API reference

### Auth

| Method | Path | Auth required | Description |
|---|---|---|---|
| `POST` | `/auth/register` | No | Create account; returns 201 + HTTP-only cookies |
| `POST` | `/auth/login` | No | Authenticate; issues access + refresh cookies |
| `GET` | `/auth/me` | Cookie | Validate token; return current user |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token; issue new access token |
| `POST` | `/auth/logout` | Cookie | Revoke session; clear cookies |

### Profile

| Method | Path | Description |
|---|---|---|
| `GET` | `/profile` | Fetch user profile (display name, timezone, defaults) |
| `PATCH` | `/profile` | Update profile fields |

### Broker credentials

| Method | Path | Description |
|---|---|---|
| `GET` | `/broker/credentials` | List credentials (api_key masked) |
| `POST` | `/broker/credentials` | Add credential (stored encrypted) |
| `PATCH` | `/broker/credentials/{id}` | Update credential |
| `DELETE` | `/broker/credentials/{id}` | Remove credential |
| `POST` | `/broker/credentials/{id}/test` | Test broker connectivity |

### Strategies & backtests

| Method | Path | Description |
|---|---|---|
| `POST` | `/backtests/run` | Run Conservative or Aggressive backtest |
| `GET` | `/backtests` | List backtest runs |
| `GET` | `/backtests/{id}` | Backtest summary + KPIs |
| `GET` | `/backtests/{id}/trades` | Trade-level results |
| `GET` | `/backtests/{id}/leaderboard` | Variant leaderboard (AI Pick / BLSH) |
| `GET` | `/backtests/{id}/chart-data` | Candles, signal markers, equity curve |
| `POST` | `/strategies/ai-pick/run` | Run AI Pick optimiser (202 Accepted; up to 120s) |
| `POST` | `/strategies/buy-low-sell-high/run` | Run BLSH optimiser |
| `GET` | `/strategies/runs` | List all strategy runs |
| `GET` | `/strategies/runs/{id}` | Strategy run detail |
| `GET` | `/strategies/runs/{id}/decisions` | Per-bar trade decisions (for signal markers) |

### Live trading

| Method | Path | Description |
|---|---|---|
| `POST` | `/live/run-signal-check` | Run regime check + confirmation count |
| `POST` | `/live/execute` | Submit order (dry-run or live) |
| `GET` | `/live/orders` | Order history |
| `GET` | `/live/positions` | Open position snapshots |
| `GET` | `/live/status` | Broker connection status |
| `GET` | `/live/chart-data` | OHLCV candles for live price chart |

### Artifacts

| Method | Path | Description |
|---|---|---|
| `GET` | `/artifacts` | List Pine Script artifacts |
| `GET` | `/artifacts/{id}` | Artifact metadata |
| `GET` | `/artifacts/{id}/pine-script` | Pine Script v5 code |

---

## Project structure

```
NextgenAiTrading/
│
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app, CORS, router registration
│   │   ├── core/
│   │   │   ├── config.py                # pydantic-settings — all env vars
│   │   │   └── security.py              # JWT, bcrypt, assert_ownership()
│   │   ├── auth/                        # register, login, refresh, logout, /me
│   │   ├── api/
│   │   │   ├── profile.py
│   │   │   ├── broker.py
│   │   │   ├── backtests.py
│   │   │   ├── strategies.py
│   │   │   ├── live.py
│   │   │   └── artifacts.py
│   │   ├── models/                      # SQLAlchemy ORM models (14 tables)
│   │   ├── schemas/                     # Pydantic v2 request/response DTOs
│   │   ├── db/session.py                # AsyncSession + asyncpg engine
│   │   ├── broker/
│   │   │   ├── base.py                  # AbstractBrokerClient interface
│   │   │   ├── alpaca_client.py         # alpaca-py implementation
│   │   │   ├── robinhood_client.py      # httpx stub (v1)
│   │   │   └── factory.py              # decrypt credentials + return client
│   │   ├── services/
│   │   │   ├── credential_service.py    # Fernet encrypt/decrypt
│   │   │   ├── execution_service.py     # order routing + position snapshots
│   │   │   ├── market_data.py           # yfinance fetch + 4h resampling
│   │   │   └── strategy_run_service.py  # persist runs + decisions
│   │   ├── strategies/
│   │   │   ├── base.py
│   │   │   ├── conservative.py          # HMM + 8 confirmations + 2.5x leverage
│   │   │   └── aggressive.py            # HMM + trailing stop + 4.0x leverage
│   │   ├── optimizers/
│   │   │   ├── base.py
│   │   │   ├── ai_pick_optimizer.py     # 12-variant MACD/RSI/EMA grid
│   │   │   └── buy_low_sell_high_optimizer.py  # 8-variant RSI/BB/cycle grid
│   │   ├── backtesting/engine.py        # 60/20/20 split, cooldown, trailing stop
│   │   └── artifacts/pine_script_generator.py  # Pine Script v5 output
│   ├── alembic/                         # Migration scripts + env.py
│   ├── alembic.ini
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout: fonts, QueryProvider, AuthProvider, Toaster
│   │   ├── (auth)/login/                # Public login page
│   │   ├── (auth)/register/             # Public register page
│   │   ├── dashboard/                   # KPIs, recent runs, equity sparkline
│   │   ├── strategies/                  # 4-tab mode selector + run form + results
│   │   ├── backtests/                   # Leaderboard, run detail, trade table
│   │   ├── live-trading/                # Signal check, order execution, positions
│   │   ├── artifacts/                   # Pine Script viewer, copy, download
│   │   └── profile/                     # User info + broker credential management
│   ├── components/
│   │   ├── ui/                          # shadcn/ui primitives (Radix-backed)
│   │   ├── charts/
│   │   │   ├── PriceChart.tsx           # Lightweight Charts: OHLCV + signal markers
│   │   │   ├── EquityCurve.tsx          # Recharts: equity area + per-trade PnL bars
│   │   │   └── OptimizationScatter.tsx  # Plotly: variant scatter (drawdown vs return)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopNav.tsx
│   │   │   └── AppShell.tsx
│   │   └── strategy/
│   │       ├── StrategyModeSelector.tsx
│   │       ├── StrategyForm.tsx
│   │       └── ResultsPanel.tsx
│   ├── lib/
│   │   ├── api.ts                       # Typed fetch wrappers + 401 interceptor
│   │   └── queryClient.ts               # TanStack Query singleton
│   ├── types/index.ts                   # All TypeScript DTO interfaces
│   ├── middleware.ts                    # Cookie presence check → /login redirect
│   └── package.json
│
├── PRD.md
├── BACKEND.md
├── FRONTEND.md
├── TASKS.md
├── prompt.md
└── CLAUDE.md
```

---

## Development

### Database migrations

```bash
cd backend
source .venv/bin/activate

# After changing an ORM model, generate a migration
alembic revision --autogenerate -m "describe your change"

# Review the generated file in alembic/versions/ before applying
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Check current revision
alembic current
```

Always review autogenerated migrations before applying. Alembic may miss custom index details — add them manually if needed.

### Running tests

```bash
# Frontend unit tests (Jest + Testing Library)
cd frontend
npm test

# Frontend tests with coverage
npm test -- --coverage
```

### Frontend dev server standalone

```bash
cd frontend
npm run dev
# Requires NEXT_PUBLIC_API_BASE_URL set in .env.local
# API calls will fail until the backend is also running
```

### Adding a new dataset / symbol

Symbols are validated at runtime via yfinance. No configuration changes are required — pass any valid ticker to the strategy or backtest endpoints and the backend will validate it before running.

### Linting

```bash
cd frontend && npm run lint
```

---

## Deployment

### Recommended hosting

| Layer | Service | Notes |
|---|---|---|
| Frontend | Vercel (free tier) | Auto-deploys on push to `main`; set `NEXT_PUBLIC_API_BASE_URL` in project settings |
| Backend | Render | Web Service; set all `.env` variables in Render dashboard; uses `/healthz` for health checks |
| Database | Supabase | Free-tier PostgreSQL; copy the connection string as `DATABASE_URL` |

### Vercel (frontend)

1. Import the repository in the Vercel dashboard.
2. Set the root directory to `frontend`.
3. Add environment variable: `NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com`
4. Deploy. Vercel auto-deploys on every push to `main`.

### Render (backend)

1. Create a new **Web Service** pointing to the `backend` directory.
2. Set Build Command: `pip install -r requirements.txt && alembic upgrade head`
3. Set Start Command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Add all backend environment variables from the [Configuration](#configuration) section.
5. Set `COOKIE_SECURE=true` and `CORS_ORIGINS=https://your-vercel-app.vercel.app`.

### Supabase (database)

1. Create a new Supabase project.
2. Copy the connection string from Settings > Database.
3. Replace the password placeholder and set as `DATABASE_URL` in Render.
4. Migrations run automatically at Render startup (`alembic upgrade head` in the build command).

### Generating the Fernet key (one-time, production)

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste the output as `ENCRYPTION_KEY` in Render. Store it securely — losing it makes all stored broker credentials unrecoverable.

---

## Broker support

| Provider | Assets | Status |
|---|---|---|
| Alpaca | Stocks, ETFs, crypto | Full implementation (alpaca-py); paper and live trading |
| Robinhood | Crypto only | Stub in v1 — `ping()` returns `False`; all other methods raise `NotImplementedError`; dry-run orders return a simulated response |

Robinhood's official crypto API requires Ed25519 key signing; full implementation is planned post-MVP.

---

## Roadmap

Post-MVP items from the PRD:

- **Scheduled signal worker** — Render Background Worker running hourly regime checks; notify via Discord/Slack webhook on signal changes
- **WebSocket price streaming** — real-time OHLCV feed via Alpaca streaming API; replace polling-based live chart
- **Robinhood full implementation** — Ed25519 signing for the official Robinhood crypto API
- **Additional brokers** — Interactive Brokers, TD Ameritrade via the existing `AbstractBrokerClient` interface
- **Subscription tiers** — usage quotas per tier; Stripe billing integration

---

## Disclaimer

**This is educational software.** Running live trades with real broker credentials carries significant financial risk. The authors accept no responsibility for trading losses. Always test thoroughly with paper trading before enabling real-money execution. Past backtest performance does not guarantee future results. The risk disclaimer is also displayed persistently in the live trading UI regardless of dry-run state.

---

## License

MIT. See [LICENSE](LICENSE) for details.
# nextgenaitrading
