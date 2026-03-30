# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NextGenStock** — production-grade multi-user AI trading platform. Specs in `SPEC.md`, PRD in `PRD.md`, tasks in `TASKS.md`, architecture in `BACKEND.md`/`FRONTEND.md`.

**Stack:** Next.js 14+ (App Router) · TypeScript · Tailwind · shadcn/ui · TanStack Query · FastAPI · SQLAlchemy 2.x async · Alembic · Pydantic v2 · PostgreSQL (asyncpg) · Supabase Auth
**Deployment:** Vercel (frontend) · Render (backend) · Supabase (DB)
**Notifications:** SMTP email (smtplib) + Twilio SMS for commodity buy-signal alerts

## Development Commands

```bash
# Docker Postgres (port 5432)
docker compose up -d

# Backend
cd backend && source .venv/bin/activate   # or .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload             # :8000

# Frontend
cd frontend && npm install
npm run dev                               # :3000
npm run build && npm run start

# E2E tests (requires both servers running)
cd tests && npm install
npx playwright test --config=e2e/playwright.config.ts
```

## Architecture

### Directory Layout
```
backend/app/
  main.py, core/, auth/                   # app entry, config, Supabase JWT auth
  api/                                    # v1: profile,broker,backtests,strategies,live,artifacts
                                          # v2: buy_zone,alerts,ideas,auto_buy,opportunities
                                          # v3: watchlist,scanner,generated_ideas
                                          # commodity: gold, commodity_alert_prefs
  models/, schemas/                       # ORM + Pydantic DTOs (v1+v2+v3+commodity)
  services/                               # business logic (see BACKEND.md)
  strategies/                             # conservative, aggressive, bollinger_squeeze
  optimizers/                             # ai_pick, buy_low_sell_high
  scheduler/tasks/                        # APScheduler: buy-zone, alerts, auto-buy, live-scanner, idea-gen, commodity-alerts
  db/session.py                           # async engine (lazy init, pool_recycle=3600)
  broker/                                 # AlpacaClient, RobinhoodClient (stub), factory
  backtesting/engine.py
  artifacts/pine_script_generator.py
  alembic/                                # v1+v2+v3 migrations

frontend/
  app/                                    # App Router pages (dashboard,strategies,backtests,live-trading,
                                          #   artifacts,profile,faq,learn,opportunities,ideas,alerts,
                                          #   auto-buy,portfolio,multi-chart,stock/[symbol],
                                          #   gold/,gold/signals/,gold/performance/,gold/risk/)
  components/ui/, charts/, layout/, strategy/, buy-zone/, alerts/, ideas/, opportunities/
  lib/api.ts                              # typed fetch wrappers, Bearer token auth
  lib/auth.ts, lib/supabase.ts            # Supabase session helpers
  lib/watchlist.ts                        # shared useWatchlist hook (localStorage)
  app/auth/callback/                      # magic link code exchange
  middleware.ts                           # route protection (Supabase SSR)
```

### Request Flow
1. Middleware checks Supabase SSR session → redirect to `/login` if absent
2. API calls send `Authorization: Bearer <supabase_access_token>`
3. FastAPI `get_current_user` decodes Supabase JWT (HS256 / `SUPABASE_JWT_SECRET`), auto-provisions user by email
4. All DB queries scoped `WHERE user_id = current_user.id`
5. Broker credentials decrypted in-memory at execution time only; never returned in responses

### Auth Notes
- **Supabase magic link** — passwordless; `signInWithOtp({ email })` → `/auth/callback`
- **Dev login** — `POST /test/token` (debug only) → `dev_token` cookie; enable with `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`
- **Cross-origin (Vercel↔Render)** — `auth_session=1` marker cookie set on frontend domain
- JWT lib: **PyJWT**, not python-jose

### Strategy Modes
| Mode | Leverage | Min Confirms | Notes |
|------|----------|--------------|-------|
| Conservative | 2.5x | 7/8 | HMM regime detection |
| Aggressive | 4.0x | 5/8 | HMM + 5% trailing stop |
| AI Pick | — | — | Optimizer: MACD/RSI/EMA variants |
| Buy Low/Sell High | — | — | Optimizer: dip/cycle variants |
| BB Squeeze | 2.5x | 6/8 | Bollinger Band squeeze breakout |

### Charting Libraries (do not swap)
- **Lightweight Charts:** candlestick + signal markers + BB overlay
- **Recharts:** equity curves, PnL histograms, KPI sparklines
- **Plotly.js:** optimization scatter, regime heatmaps (AI Pick/BLSH only)

### Database Tables
**V1 (14):** User, UserProfile, UserSession, BrokerCredential, StrategyRun, TradeDecision, BrokerOrder, PositionSnapshot, CooldownState, TrailingStopState, VariantBacktestResult, WinningStrategyArtifact, BacktestTrade

**V2 (7):** StockBuyZoneSnapshot, StockThemeScore, WatchlistIdea, WatchlistIdeaTicker, PriceAlertRule, AutoBuySettings (includes execution_timeframe, start/end_date, target_buy/sell_price), AutoBuyDecisionLog

**V3 (3):** UserWatchlist, BuyNowSignal (10-condition audit), GeneratedIdea (megatrend/moat/financial scores; reason_summary/news_headline use `Text`)

**Commodity (1):** `CommodityAlertPrefs` (unique per user; stores alert_email, alert_phone, symbols JSON, min_confidence, cooldown_minutes, last_alerted_at)

## Environment Variables

**Backend `.env`:**
```
DATABASE_URL=postgresql+asyncpg://nextgen:nextgen@localhost:5432/nextgenstock
SECRET_KEY=<generated>
JWT_ALGORITHM=HS256
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=http://localhost:3000
DEBUG=true
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Environment Variables (additions)

**Backend `.env` — Commodity Alert Notifications:**
```
# SMTP (email alerts — Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password      # Gmail App Password (not account password)
SMTP_FROM=NextGenAi Trading <your-gmail@gmail.com>

# Twilio (SMS alerts)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX

# Commodity alert check interval (default 15 min)
COMMODITY_ALERT_MINUTES=15
```

## Critical Constraints

- **Multi-tenancy:** Every service method scopes queries to `user_id`. Use `assert_ownership(record, current_user)`.
- **Live trading defaults to dry-run.** Require explicit opt-in + confirmation dialog.
- **Broker keys never returned in API responses.**
- **`SPEC.md` is authoritative** for all feature specs (V1/V2/V3/Screener/Bitcoin).
- **V3 scanner alerts fire only when ALL 10 conditions pass.** No partial alerts. See `PRD.md` Part 3 §4.3.
- **V3 wording:** Use "historically favorable", "high-probability entry zone", "confidence score" — never "guaranteed", "safe", "certain to go up".
- **CORS never `["*"]`.** Use `settings.cors_origins_list`; error handlers validate origin before reflecting.
- **List endpoints must have bounded `limit`:** `Query(default=50, ge=1, le=200)`.
- **Credential errors:** Return generic message; log real error server-side.
- **`dangerouslySetInnerHTML` requires DOMPurify sanitization.**
- **DELETE endpoints:** Return `Response(status_code=204)` — don't put `status_code=204` in decorator (FastAPI 0.115+).
- **Intraday chart times:** `df_to_candles()` outputs Unix int timestamps for intraday intervals; ISO strings for daily+.
- **Router prefix:** Never double-prefix routes. `app.include_router()` must not add `/api` if router already has it.

## Implementation Status

| Layer | Status |
|-------|--------|
| v1 Backend (60 files) | Complete |
| v2 Backend (47 files, 236 unit tests) | Complete |
| v3 Backend (services, models, schemas, scheduler, 167 unit tests) | Complete |
| Alembic migrations (v1+v2+v3) | Written — run `alembic upgrade head` |
| Frontend (all pages v1/v2/v3 + portfolio/multi-chart/stock/[symbol]/gold/*) | Complete |
| Sovereign Terminal design (Deep Titanium dark theme, emerald #44DFA3) | Complete |
| Commodity Alert Notifications (email + SMS, real signal engine, scheduler) | Complete — 2026-03-30 |
| Supabase Auth (magic link, Bearer token, auto-provisioning, dev login) | Complete |
| BB Squeeze strategy (backend + frontend chart overlay) | Complete |
| Commodity signal engine (gold API + 4 sub-pages + sidebar sub-menu) | Complete |
| Mobile responsiveness (all pages) | Complete |
| E2E tests (v1: 263, v2: 159, v3: 34, supabase-auth: 90) | Written; auth system fixed 2026-03-27 |

## Known Spec Deviations
- Auth: Supabase magic links (not password-based JWT)
- `POST /strategies/ai-pick/run` → 202 Accepted (async)
- `GET /live/positions` → DB snapshot (not live broker poll)
- Robinhood client is a stub (`NotImplementedError` except `ping()`)
- 4h timeframe resampled from 1h (yfinance limitation)

## Commodity Alert Notification System (2026-03-30)
Real buy-signal alerts for commodities (gold, silver, oil, crypto, forex) via email and SMS:

**Signal Engine (`services/commodity_signal_service.py`):**
- Uses yfinance to fetch live daily OHLCV — real market data, not mock
- 4-condition gate: EMA-8 > EMA-21 | price > EMA-50 | RSI-14 < 70 | volume ≥ 1.05× 20-day avg
- Symbol map: XAUUSD→GC=F, XAGUSD→SI=F, USOIL→CL=F, BTCUSD→BTC-USD, EURUSD→EURUSD=X, etc.
- Returns `SignalResult` dataclass with all indicator values, gate results, confidence 0-100, human-readable reason

**Notification (`services/notification_service.py`):**
- `send_email()` — SMTP/TLS via stdlib smtplib. Needs SMTP_HOST/USER/PASS/PORT.
- `send_sms()` — Twilio REST. Needs TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER.
- Both log a warning (not error) if env vars missing — app starts cleanly without them.

**Scheduler (`scheduler/tasks/run_commodity_alerts.py`):** Every 15 min (COMMODITY_ALERT_MINUTES).
- Deduplicates yfinance calls across users; enforces per-user cooldown + confidence threshold.
- Updates `last_alerted_at` on first matching symbol per user per run.

**DB:** `commodity_alert_prefs` table — UNIQUE on user_id. Migration: `e4f5a6b1c2d3`.
**API:** `GET /commodity-alerts/prefs` + `PATCH /commodity-alerts/prefs` (auto-creates defaults).
**Frontend:** `NotificationPrefsPanel` component in `/gold` overview page right sidebar.
**Dependency:** `twilio>=9.0.0` added to requirements.txt.
**Activate:** `alembic upgrade head` + `pip install twilio` + add SMTP_*/TWILIO_* to `.env`.
**Email confirmed working** — test email successfully delivered to mvisanu@gmail.com on 2026-03-30 (Gmail SMTP with App Password).

## Dashboard Chart Data
- Chart fetches real OHLCV from yfinance via `GET /live/chart-data?symbol=&interval=`
- Refreshes every 30 seconds; supports stocks, crypto (BTC-USD), forex (EURUSD=X), ETFs
- MACD, RSI, MA computed client-side from real candles
- **Not** tick-by-tick streaming — polling at ~15-30 second granularity
- KPI cards and watchlist come from local DB / localStorage (not live feeds)

## Ideas Page — Scan Universe Themes
Theme chips: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine (~50 tickers total including mega-cap tech, financials, energy, defense, semis, space, biotech, bitcoin/crypto-adjacent).
