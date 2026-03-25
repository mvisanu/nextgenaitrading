# NextGenStock

**A production-grade, multi-user AI trading platform built across three feature generations.**

[![Python](https://img.shields.io/badge/Python-3.12%2B-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14%2B-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

NextGenStock is a full-stack algorithmic trading platform that takes a user from strategy backtesting all the way to a live automated watchlist scanner — without a single command-line step. The quant engine combines GaussianHMM regime detection, 8-confirmation signal gating, a multi-variant parameter optimiser, and a 10-condition ALL-PASS buy signal gate into a coherent async Python backend. The frontend surfaces every layer through a polished Next.js interface with three purpose-selected charting libraries and a real-time scheduler driving ideas and alerts in the background.

---

## What this demonstrates

This is a portfolio project. The points below are the ones technical evaluators typically look for.

- **Async Python at scale** — FastAPI with SQLAlchemy 2.x `AsyncSession`, `asyncpg`, and a fully async service layer across 110+ backend files
- **JWT security without localStorage** — HTTP-only cookie auth, SHA-256 refresh token hashing, silent rotation, strict SameSite=Lax controls; tokens are never exposed to JavaScript
- **Multi-tenant data isolation** — every query scoped to `user_id`; `assert_ownership()` enforced in every service method; no route trusts a user-supplied ID
- **Quantitative strategy engine** — GaussianHMM regime detection (hmmlearn), 8-indicator confirmation gating, leveraged backtesting with trailing stops and cooldowns, 60/20/20 train/validate/test split
- **Parameter optimisation** — 12-variant AI Pick grid and 8-variant Buy Low/Sell High grid, each ranked by `validation_score = validation_return / (1 + max_drawdown)` on a held-out split
- **10-condition buy signal gate (V3)** — ALL 10 conditions must pass simultaneously: price in zone, RSI in range, above 50d/200d MA, volume declining on pullback, near support, trend regime bullish, confidence threshold met, buy zone valid, no recent cooldown
- **Automated idea engine (V3)** — three independent background scanners (news RSS, theme, technical universe) merge and score candidates every 60 minutes using a 6-component scoring formula: idea score, moat score, financial quality, entry priority, analog win rate, confidence
- **Fernet credential encryption** — broker API keys encrypted at rest, decrypted in-memory at execution time only, never returned in any API response
- **APScheduler background jobs** — buy zone refresh (every 4h), alert evaluation (every 5min), auto-buy engine (every 5min), live watchlist scanner (every 5min), idea generator (every 60min)
- **Pine Script v5 generation** — winning optimiser variants serialised to executable TradingView strategy code

---

## Screenshots

Screenshots coming soon. The platform includes the following main views:

- Dashboard — KPI cards, recent strategy runs, equity sparkline, shared watchlist panel
- Strategies — 4-tab mode selector (Conservative / Aggressive / AI Pick / Buy Low Sell High) with results panel, equity curve, and trade table
- Backtests — run leaderboard, per-variant scatter plot (Plotly), trade-level detail
- Live Trading — signal check with per-indicator breakdown, BUY/SELL/HOLD banner, candlestick chart with markers, dollar-amount order entry
- Opportunities — watchlist table with buy zone, estimated entry, confidence, 90d win rate, STRONG BUY badge, and expandable EstimatedEntryPanel
- Ideas — auto-generated idea cards with megatrend tags, moat score, financial quality, news catalyst, and one-click Add to Watchlist
- Alerts — per-ticker alert configuration
- Auto-Buy — dry-run and live auto-buy settings, decision log

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Browser (Vercel)                            │
│                                                                  │
│  Next.js 14+ App Router · TypeScript · Tailwind CSS · shadcn/ui  │
│                                                                  │
│  Pages: dashboard, strategies, backtests, live-trading,          │
│         opportunities, ideas, alerts, auto-buy, artifacts,       │
│         profile, faq (Thai/English i18n), learn                  │
│                                                                  │
│  Lightweight Charts (candlestick) · Recharts (equity/KPIs)       │
│  Plotly.js (optimisation scatter) · TanStack Query v5            │
│                                                                  │
│  middleware.ts — cookie presence check → /login redirect         │
│  lib/api.ts    — typed fetch wrappers + 401 silent-refresh       │
│  lib/watchlist.ts — shared watchlist hook (localStorage sync)    │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTPS + HTTP-only cookies
                          │ CORS restricted to CORS_ORIGINS
┌─────────────────────────▼────────────────────────────────────────┐
│                   FastAPI (Render)                               │
│                                                                  │
│  auth/     — register, login, refresh, logout, /me               │
│  api/      — profile, broker, backtests, strategies, live,       │
│              artifacts, buy_zone, alerts, ideas, auto_buy,       │
│              opportunities, watchlist, scanner                   │
│  core/     — JWT, Fernet, assert_ownership()                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Strategy Engine                                        │     │
│  │  conservative.py  — HMM 2-state, 2.5x leverage, 7/8    │     │
│  │  aggressive.py    — HMM + 5% trailing stop, 4.0x, 5/8  │     │
│  │  ai_pick_optimizer      — 12-variant MACD/RSI/EMA grid  │     │
│  │  buy_low_sell_high_opt  — 8-variant RSI/BB/cycle grid   │     │
│  │  backtesting/engine.py  — 60/20/20, cooldown, trailing  │     │
│  │  pine_script_generator  — Pine Script v5 output         │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  V2/V3 Services                                         │     │
│  │  buy_zone_service       — ATR + analog zone calc        │     │
│  │  analog_scoring_service — 90d win rate, historical      │     │
│  │  theme_scoring_service  — megatrend tag weights         │     │
│  │  alert_engine_service   — BUY_NOW + price alerts        │     │
│  │  auto_buy_engine        — auto-execute on signal        │     │
│  │  live_scanner_service   — 10-condition gate per ticker  │     │
│  │  news_scanner_service   — RSS feed + keyword extraction │     │
│  │  idea_generator_service — 3-source merge + scoring      │     │
│  │  moat_scoring_service   — competitive moat heuristic    │     │
│  │  financial_quality_svc  — yfinance revenue/margin data  │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  scheduler/ — APScheduler: buy zone (4h), alerts (5min),        │
│               auto-buy (5min), live scanner (5min),              │
│               idea generator (60min, market hours only)          │
│                                                                  │
│  broker/ — AbstractBrokerClient → AlpacaClient / RobinhoodStub  │
└─────────────────────────┬────────────────────────────────────────┘
                          │ asyncpg
┌─────────────────────────▼────────────────────────────────────────┐
│              PostgreSQL 16 (Supabase / Docker)                   │
│                                                                  │
│  24 tables across 3 schema generations                           │
│  V1 (14): User, UserSession, BrokerCredential, StrategyRun,      │
│           TradeDecision, BrokerOrder, PositionSnapshot,          │
│           CooldownState, TrailingStopState,                      │
│           VariantBacktestResult, WinningStrategyArtifact,        │
│           BacktestTrade, UserProfile                             │
│  V2 (7):  StockBuyZoneSnapshot, StockThemeScore,                 │
│           WatchlistIdea, WatchlistIdeaTicker,                    │
│           PriceAlertRule, AutoBuySettings, AutoBuyDecisionLog    │
│  V3 (3):  UserWatchlist, BuyNowSignal, GeneratedIdea             │
└──────────────────────────────────────────────────────────────────┘
```

### Request flow

1. `middleware.ts` checks for JWT in the HTTP-only cookie; redirects to `/login` if absent
2. All API calls go to FastAPI; `Depends(get_current_user)` validates the access token on every protected route
3. Every DB query is scoped `WHERE user_id = current_user.id` — user-supplied IDs are never trusted
4. Broker credentials are decrypted in-memory at execution time only via Fernet; never returned in responses
5. Background scheduler jobs fire independently of user sessions; each job opens its own async DB session

---

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend framework | Next.js 14+ (App Router) | RSC for fast initial load; `middleware.ts` for edge-runtime cookie checks |
| UI components | shadcn/ui + Radix primitives | Accessible, unstyled base with Tailwind customisation |
| Server state | TanStack Query v5 | Declarative cache invalidation on mutations; no Redux boilerplate |
| Candlestick charts | Lightweight Charts (TradingView) | Native OHLCV + volume + signal marker support; minimal bundle |
| Metric charts | Recharts | Composable area/bar charts for equity curves and KPI sparklines |
| Research charts | Plotly.js | Scatter plots for optimisation variant analysis |
| Backend framework | FastAPI + Pydantic v2 | Async-first; automatic OpenAPI docs; Pydantic v2 performance |
| ORM | SQLAlchemy 2.x async | Type-safe queries; Alembic migration support |
| Database driver | asyncpg | Non-blocking PostgreSQL; required for async SQLAlchemy |
| Auth tokens | python-jose (HS256) | Standard JWT; short-lived access tokens |
| Password hashing | passlib[bcrypt] | Bcrypt with cost factor |
| Credential encryption | cryptography (Fernet) | Symmetric authenticated encryption for broker API keys |
| Market data | yfinance + pandas | Wide ticker coverage; 4h resampled from 1h |
| HMM regime detection | hmmlearn (GaussianHMM) | 2-state bull/bear regime fitted on 730 days of log-returns, ATR, volume ratio |
| Technical indicators | ta | MACD, RSI, EMA, Bollinger Bands |
| Scheduler | APScheduler 3.x | Cron-style background jobs without a separate worker process |
| News scanning | feedparser | Free RSS feeds; no paid API dependency |
| Broker — stocks/ETFs | alpaca-py | Official Alpaca SDK; paper and live trading |
| Broker — crypto stub | httpx | Robinhood REST stub; `ping()` only in V1 |
| Deployment | Vercel + Render + Supabase | Zero-ops free tier for all three layers |

---

## Features by generation

### V1 — Core platform

| Feature | Description |
|---|---|
| JWT auth | Register, login, refresh token rotation, logout. HTTP-only cookies, SHA-256 refresh hash stored (not raw token) |
| Multi-tenant isolation | Every table has `user_id FK ondelete=CASCADE`; every service method calls `assert_ownership()` |
| Conservative strategy | GaussianHMM 2-state regime, 8 confirmation indicators, 2.5x leverage, 7/8 threshold |
| Aggressive strategy | Same as conservative + 5% trailing stop, 4.0x leverage, 5/8 threshold |
| AI Pick optimiser | 12-variant MACD/RSI/EMA grid; winner selected by `validation_score = validation_return / (1 + max_drawdown)` |
| Buy Low/Sell High optimiser | 8-variant RSI/Bollinger/cycle grid; dip entry + cycle exit logic |
| Backtesting engine | 60/20/20 train/validate/test split, cooldown, trailing stop simulation |
| Pine Script v5 generation | Winning variant serialised to executable TradingView strategy code |
| Live trading | Signal check with per-indicator breakdown, BUY/SELL/HOLD banner, notional USD order entry, dry-run default |
| Broker abstraction | `AbstractBrokerClient` → `AlpacaClient` (full) / `RobinhoodClient` (stub) |
| Fernet encryption | Broker API keys encrypted at rest; never returned in responses |

### V2 — Intelligence layer

| Feature | Description |
|---|---|
| Buy zone analysis | ATR-based zone calculation + analog scoring (90d win rate from similar historical setups) |
| Theme scoring | Megatrend tags (AI, Robotics, Longevity, Energy, Defense, Space, Semiconductors) scored per ticker |
| Price alerts | Configurable alert rules per ticker with `entered_buy_zone`, `price_above`, `price_below` types |
| Auto-buy engine | Automated execution when alert conditions met; notional size limits, dry-run mode, decision logging |
| Investment ideas | User-authored idea cards with conviction score, tickers, notes |
| APScheduler jobs | Buy zone refresh every 4h, alert evaluation every 5min, auto-buy evaluation every 5min |

### V3 — Live scanner and auto-idea engine

| Feature | Description |
|---|---|
| Watchlist scanner | Per-user ticker watchlist on Opportunities page; each ticker evaluated every 5min against 10 conditions |
| 10-condition ALL-PASS gate | Price in zone, above 50d/200d MA, RSI 30–55, volume declining on pullback, near weekly support, trend regime bullish, confidence ≥ threshold, buy zone valid, cooldown clear |
| BuyNowSignal audit trail | Every scanner evaluation (pass or fail) persisted to `buy_now_signals` table with all 10 condition booleans |
| STRONG BUY notifications | In-app + email dispatched the moment all 10 conditions pass; 4-hour cooldown prevents duplicates |
| Estimated entry panel | Per-ticker buy zone range, ideal entry price (ATR midpoint refined by analog scoring), worst drawdown, invalidation level |
| Auto-generated idea feed | Three parallel background scanners: news RSS, theme scanner, technical universe — merged, deduplicated, scored every 60min |
| News RSS scanner | Fetches 5 free RSS feeds, extracts tickers/sector keywords, matches megatrend themes, scores by mention frequency |
| Theme scanner | Loads theme-tagged tickers from `stock_theme_scores`, applies 4 quality filters, computes moat and financial quality scores |
| Technical universe scanner | ~50-ticker universe; checks 4 conditions (above 50d/200d MA, RSI 35–55, volume declining); surface tickers where 3+ pass |
| 6-component idea scoring | `idea_score` combines: theme fit, moat score, financial quality, entry priority (near 52w low / at weekly support), analog win rate, confidence |
| Competitive moat scoring | `HIGH_MOAT_TICKERS` map + yfinance market cap / competitor heuristic fallback |
| Financial quality scoring | yfinance `revenueGrowth`, `grossMargins`, `earningsGrowth`, `operatingMargins` |
| Add to Watchlist (one-click) | Creates `UserWatchlist` entry + `PriceAlertRule` in one backend call; marks idea as `added_to_watchlist=True` |
| Manual scan trigger | `POST /api/scanner/run-now` and `POST /api/ideas/generated/run-now` for on-demand execution |
| Scan universe themes | AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine (~50 tickers) |

---

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for local Postgres) — or a Supabase connection string

### 1. Start the database

```bash
# From the repo root
docker compose up -d
```

This starts PostgreSQL 16 on port 5432 with user `nextgen`, password `nextgen`, database `nextgenstock`.

### 2. Configure and start the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Generate a Fernet encryption key (run once; paste into .env)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Copy the example env file and fill in the required values
cp .env.example .env
# At minimum: DATABASE_URL, SECRET_KEY, ENCRYPTION_KEY

# Run all database migrations (V1 + V2 + V3 tables)
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
| `http://localhost:8000/healthz` | Health check |

### 3. Configure and start the frontend

```bash
cd frontend

# Install dependencies
npm install

# Create and configure the environment file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local

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
| `ENCRYPTION_KEY` | Yes | — | Fernet key for broker credential encryption |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `COOKIE_SECURE` | No | `false` | Set `true` in production (requires HTTPS) |
| `COOKIE_SAMESITE` | No | `lax` | Cookie SameSite attribute |
| `ALPACA_BASE_URL` | No | `https://api.alpaca.markets` | Alpaca live trading API URL |
| `ALPACA_PAPER_URL` | No | `https://paper-api.alpaca.markets` | Alpaca paper trading API URL |

### Frontend environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | FastAPI backend URL, e.g. `http://localhost:8000` |

No secrets belong in the frontend environment.

---

## Database schema

24 tables across three Alembic migrations. All user-owned tables carry `user_id FK ondelete=CASCADE`.

### V1 — 14 tables

| Table | Purpose |
|---|---|
| `users` | Account credentials + email |
| `user_profiles` | Display name, timezone, strategy defaults |
| `user_sessions` | SHA-256 hashed refresh tokens; revoked on rotation |
| `broker_credentials` | Fernet-encrypted api_key + secret_key per broker |
| `strategy_runs` | One row per backtest/optimiser execution |
| `trade_decisions` | Per-bar BUY/SELL/HOLD decisions with indicator values |
| `broker_orders` | Order records with broker order IDs |
| `position_snapshots` | Point-in-time open position records |
| `cooldown_states` | Per-user cooldown tracking between trades |
| `trailing_stop_states` | Active trailing stop levels |
| `variant_backtest_results` | One row per optimiser variant |
| `winning_strategy_artifacts` | Winning variant metadata + Pine Script blob |
| `backtest_trades` | Trade-level P&L for equity curve reconstruction |

### V2 — 7 tables

| Table | Purpose |
|---|---|
| `stock_buy_zone_snapshots` | ATR-based buy zone per ticker (system-wide, refreshed every 4h) |
| `stock_theme_scores` | Megatrend tag weights per ticker (system-wide) |
| `watchlist_ideas` | User-authored investment ideas with conviction score |
| `watchlist_idea_tickers` | Ticker children of a `WatchlistIdea` |
| `price_alert_rules` | Per-user, per-ticker alert configuration |
| `auto_buy_settings` | One row per user; notional limits, cooldown settings |
| `auto_buy_decision_logs` | Audit trail of every auto-buy evaluation |

### V3 — 3 tables

| Table | Purpose |
|---|---|
| `user_watchlist` | Lightweight user → ticker association for the Opportunities scanner |
| `buy_now_signals` | Full 10-condition audit trail for every scanner evaluation (pass and fail) |
| `generated_ideas` | Auto-generated idea cards from news/theme/technical sources; expire after 24h |

---

## API highlights

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account; returns 201 + HTTP-only cookies |
| `POST` | `/auth/login` | Authenticate; issues access + refresh cookies |
| `GET` | `/auth/me` | Validate token; return current user |
| `POST` | `/auth/refresh` | Rotate refresh token; issue new access token |
| `POST` | `/auth/logout` | Revoke session; clear cookies |

### Strategies and backtests

| Method | Path | Description |
|---|---|---|
| `POST` | `/backtests/run` | Run Conservative or Aggressive backtest |
| `GET` | `/backtests/{id}` | Backtest summary + KPIs |
| `GET` | `/backtests/{id}/trades` | Trade-level results |
| `GET` | `/backtests/{id}/chart-data` | Candles, signal markers, equity curve |
| `POST` | `/strategies/ai-pick/run` | Run AI Pick optimiser (202 Accepted; up to 120s) |
| `POST` | `/strategies/buy-low-sell-high/run` | Run BLSH optimiser |

### Live trading

| Method | Path | Description |
|---|---|---|
| `POST` | `/live/run-signal-check` | Run regime check + 8-indicator breakdown |
| `POST` | `/live/execute` | Submit order (dry-run or live; notional USD) |
| `GET` | `/live/orders` | Order history |
| `GET` | `/live/positions` | Open position snapshots |

### V2 — Intelligence layer

| Method | Path | Description |
|---|---|---|
| `GET` | `/buy-zone/{ticker}` | Current buy zone snapshot for a ticker |
| `GET` | `/opportunities` | Tickers with active buy zone data |
| `GET/POST/DELETE` | `/alerts` | Price alert rule CRUD |
| `GET/POST` | `/auto-buy` | Auto-buy settings + decision log |
| `GET/POST` | `/ideas` | User-authored idea cards |

### V3 — Scanner and generated ideas

| Method | Path | Description |
|---|---|---|
| `GET/POST/DELETE` | `/api/watchlist` / `/api/watchlist/{ticker}` | Personal watchlist CRUD |
| `GET` | `/opportunities/watchlist` | Watchlist rows with signal status + buy zone |
| `GET` | `/api/scanner/status` | Scanner health, market hours active, next scan time |
| `POST` | `/api/scanner/run-now` | On-demand watchlist scan |
| `GET` | `/api/ideas/generated` | Auto-generated idea feed (filter by source, theme) |
| `GET` | `/api/ideas/generated/last-scan` | Last scan timestamp + ideas generated count |
| `POST` | `/api/ideas/generated/run-now` | On-demand idea generation (bypasses market hours) |
| `POST` | `/api/ideas/generated/{id}/add-to-watchlist` | One-click watchlist + alert creation from idea card |

---

## Project structure

```
NextgenAiTrading/
├── backend/
│   ├── app/
│   │   ├── main.py                       # FastAPI app, CORS, router registration
│   │   ├── core/
│   │   │   ├── config.py                 # pydantic-settings: all env vars
│   │   │   └── security.py              # JWT, bcrypt, assert_ownership()
│   │   ├── auth/                         # register, login, refresh, logout, /me
│   │   ├── api/                          # 14 router modules (V1 + V2 + V3)
│   │   ├── models/                       # SQLAlchemy ORM models (24 tables)
│   │   ├── schemas/                      # Pydantic v2 request/response DTOs
│   │   ├── db/session.py                 # AsyncSession + asyncpg engine
│   │   ├── broker/
│   │   │   ├── base.py                   # AbstractBrokerClient interface
│   │   │   ├── alpaca_client.py          # Full alpaca-py implementation
│   │   │   ├── robinhood_client.py       # httpx stub
│   │   │   └── factory.py               # Decrypt credentials + return client
│   │   ├── services/                     # 15+ service modules (V1/V2/V3)
│   │   ├── strategies/
│   │   │   ├── base.py                   # SignalResult dataclass + confirmation_details
│   │   │   ├── conservative.py           # HMM + 8 confirmations + 2.5x leverage
│   │   │   └── aggressive.py             # HMM + trailing stop + 4.0x leverage
│   │   ├── optimizers/
│   │   │   ├── ai_pick_optimizer.py      # 12-variant MACD/RSI/EMA grid
│   │   │   └── buy_low_sell_high_optimizer.py  # 8-variant RSI/BB/cycle grid
│   │   ├── backtesting/engine.py         # 60/20/20 split, cooldown, trailing stop
│   │   ├── artifacts/
│   │   │   └── pine_script_generator.py  # Pine Script v5 output
│   │   ├── scheduler/                    # APScheduler jobs (V2 + V3)
│   │   │   └── tasks/                    # run_live_scanner, run_news_scanner, run_idea_generator
│   │   └── utils/market_hours.py         # ET market hours check for scheduler gates
│   ├── alembic/                          # Migration scripts: V1 + V2 + V3
│   ├── tests/                            # 167 unit tests (V2 + V3 services)
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/login, (auth)/register
│   │   ├── dashboard/                    # KPIs, recent runs, equity sparkline, watchlist
│   │   ├── strategies/                   # 4-tab mode selector + run form + ResultsPanel
│   │   ├── backtests/                    # Run list + [id] detail with equity curve + trade table
│   │   ├── live-trading/                 # Signal check, BUY/SELL/HOLD banner, order entry
│   │   ├── opportunities/                # V3 WatchlistTable + EstimatedEntryPanel
│   │   ├── ideas/                        # V3 IdeaFeed + theme/source filter chips
│   │   ├── alerts/                       # AlertConfigForm
│   │   ├── auto-buy/                     # Auto-buy settings + dry-run panel + decision log
│   │   ├── artifacts/                    # Pine Script viewer + [id] detail
│   │   ├── profile/                      # User info + broker credential management
│   │   ├── faq/                          # Thai/English language toggle (i18n)
│   │   └── learn/
│   ├── components/
│   │   ├── ui/                           # shadcn/ui primitives (Radix-backed)
│   │   ├── charts/                       # PriceChart, EquityCurve, OptimizationScatter
│   │   ├── layout/                       # Sidebar, TopNav, AppShell
│   │   ├── strategy/                     # StrategyModeSelector, StrategyForm, ResultsPanel
│   │   ├── buy-zone/                     # BuyZoneCard, BuyZoneAnalysisPanel, ThemeScoreBadge
│   │   ├── alerts/                       # AlertConfigForm
│   │   ├── ideas/                        # IdeaForm, IdeaList, GeneratedIdeaCard, IdeaFeed
│   │   └── opportunities/                # WatchlistTable, BuyNowBadge, EstimatedEntryPanel
│   ├── lib/
│   │   ├── api.ts                        # Typed fetch wrappers + 401 interceptor (V1/V2/V3)
│   │   └── watchlist.ts                  # Shared useWatchlist hook (localStorage + cross-tab sync)
│   ├── types/index.ts                    # All TypeScript DTO interfaces
│   └── middleware.ts                     # Cookie presence check → /login redirect
│
├── tests/
│   └── e2e/                              # Playwright E2E tests
│       ├── specs/                        # V1, V2, V3 test specs
│       └── playwright.config.ts          # workers: 1 (sequential; requires live backend)
│
├── docker-compose.yml                    # PostgreSQL 16 on port 5432
├── PRD.md, PRD2.md, PRD3.md             # V1/V2/V3 product requirements
├── BACKEND.md, BACKEND2.md, BACKEND3.md  # Backend handoff docs
├── FRONTEND.md, FRONTEND2.md, FRONTEND3.md  # Frontend handoff docs
└── CLAUDE.md                             # Project guidance for AI-assisted development
```

---

## Testing

### Backend unit tests (167 passing)

Unit tests cover V2 and V3 service logic. They do not require a running database.

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

### E2E tests (Playwright)

E2E tests require both the backend and frontend running.

```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev

# Terminal 3 — run tests
cd tests
npm install                          # First time only
npx playwright test --config=e2e/playwright.config.ts
```

Test coverage by generation:

| Suite | Cases | Status |
|---|---|---|
| V1 E2E (auth, strategies, backtests, live, artifacts) | 263 cases × 3 browsers | 421/789 passing (53.4%) |
| V2 E2E (opportunities, ideas, alerts, auto-buy) | 159 cases | Written; run against live stack |
| V3 E2E (watchlist, scanner, generated ideas) | 34 cases | Written in `v3-opportunities.spec.ts` + `v3-ideas.spec.ts` |

---

## Security design

**Authentication:** Access tokens (15 min, HS256) and refresh tokens (7 days) are issued as HTTP-only, SameSite=Lax cookies. Tokens are never exposed to JavaScript and never stored in `localStorage`. The refresh token is not stored raw — only its SHA-256 hex hash is persisted in `UserSession.refresh_token_hash`. On refresh, the incoming token is hashed and compared; the old token is revoked immediately after rotation.

**Multi-tenancy:** Every user-owned table carries `user_id FK ondelete=CASCADE`. Every service method queries with `WHERE user_id = current_user.id`. `assert_ownership(record_user_id, current_user_id)` in `core/security.py` raises HTTP 403 on mismatch and is called before every record read or modification.

**Broker credentials:** `api_key` and `secret_key` columns store Fernet-encrypted ciphertext. Decryption occurs only inside `broker/factory.py` at execution time, in-memory, and is never logged. API responses return `****(encrypted)` for the key field.

**Live trading safety:** Defaults to `dry_run=True`. Real-money execution requires explicit UI toggle plus a confirmation dialog. A persistent risk disclaimer banner is shown on the live trading page regardless of mode.

**Scanner language constraints:** V3 scanner output never uses "guaranteed", "safe", or "certain to go up". All wording uses "historically favorable", "high-probability entry zone", and "confidence score".

---

## Deployment

### Recommended hosting

| Layer | Service | Notes |
|---|---|---|
| Frontend | Vercel (free tier) | Auto-deploys on push to `main` |
| Backend | Render (free tier) | Web Service with `/healthz` health check |
| Database | Supabase (free tier) | Managed PostgreSQL; connection string as `DATABASE_URL` |

### Vercel (frontend)

1. Import the repository; set root directory to `frontend`
2. Add environment variable: `NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com`
3. Deploy. Auto-deploys on every push to `main`

### Render (backend)

1. Create a Web Service pointing to the `backend` directory
2. Build command: `pip install -r requirements.txt && alembic upgrade head`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. Add all environment variables from the [Configuration](#configuration) section
5. Set `COOKIE_SECURE=true` and `CORS_ORIGINS=https://your-vercel-app.vercel.app`

### Supabase (database)

1. Create a Supabase project
2. Copy the connection string from Settings > Database
3. Set as `DATABASE_URL` in Render; migrations run automatically at startup

### Generating secrets (one-time)

```bash
# Fernet key for ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# SECRET_KEY (any random 32+ character string)
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Strategy modes

| Mode | Leverage | Min Confirms | Notes |
|---|---|---|---|
| Conservative | 2.5x | 7 / 8 | GaussianHMM regime detection; 8 indicator confirmations |
| Aggressive | 4.0x | 5 / 8 | HMM + 5% trailing stop; looser confirmation gate |
| AI Pick | — | — | 12-variant MACD/RSI/EMA grid; auto-selects winner by `validation_score` |
| Buy Low / Sell High | — | — | 8-variant RSI/Bollinger/cycle grid; dip entry, cycle exit |

Supported symbols: any valid yfinance ticker (`AAPL`, `BTC-USD`, `SPY`, `ETH-USD`, etc.).

Supported timeframes: `1d`, `1h`, `4h` (resampled from 1h internally), `1wk`.

---

## Known deviations from spec

| Area | Deviation | Reason |
|---|---|---|
| Refresh token storage | SHA-256 hash instead of bcrypt | Speed; bcrypt is too slow for token comparison |
| AI Pick run | Returns 202 Accepted (async; up to 120s) | Long-running optimiser cannot return synchronously |
| `GET /live/positions` | Returns DB snapshot, not live broker poll | Avoids broker rate limiting on every page load |
| Robinhood client | Stub — all methods raise `NotImplementedError` except `ping()` | Official API requires Ed25519 signing; planned post-MVP |
| 4h timeframe | Resampled from 1h OHLCV internally | yfinance does not provide native 4h bars |

---

## Roadmap

- **WebSocket price streaming** — real-time OHLCV via Alpaca streaming API; replace polling-based live chart
- **Robinhood full implementation** — Ed25519 signing for the official Robinhood crypto API
- **LLM-generated thesis copy** — natural-language idea summaries via an LLM provider
- **Live earnings calendar** — near_earnings flag driven by live API rather than manual flag
- **Subscription tiers** — usage quotas per tier; Stripe billing integration

---

## Disclaimer

**This is educational software.** Running live trades with real broker credentials carries significant financial risk. The authors accept no responsibility for trading losses. Always test thoroughly with paper trading before enabling real-money execution. Past backtest performance does not guarantee future results. A persistent risk disclaimer is displayed in the live trading UI regardless of dry-run state.

---

## License

MIT. See [LICENSE](LICENSE) for details.
