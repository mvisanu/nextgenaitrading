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
cd backend && source .venv/bin/activate
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
  api/                                    # v1: profile,broker,backtests,strategies,live,artifacts,morning_brief
                                          # v2: buy_zone,alerts,ideas,auto_buy,opportunities
                                          # v3: watchlist,scanner,generated_ideas
                                          # v4: options
                                          # commodity: gold, commodity_alert_prefs
  models/, schemas/                       # ORM + Pydantic DTOs
  services/
    alpaca_data.py                        # Alpaca StockHistoricalDataClient; primary source for stocks/ETFs
    alpaca_stream.py                      # AlpacaStreamManager singleton; WebSocket→SSE fan-out; max 20 symbols; bounded queues
    market_data.py                        # routes load_ohlcv(): Alpaca→yfinance fallback; yfinance-only for commodities/forex/crypto
    yfinance_cache.py                     # 30-min TTL cache; use get_ticker_info(t) — never yf.Ticker(t).info directly
  strategies/                             # conservative, aggressive, bollinger_squeeze
  optimizers/                             # ai_pick, buy_low_sell_high
  scheduler/tasks/                        # APScheduler: buy-zone, alerts, auto-buy, live-scanner, idea-gen, commodity-alerts
  db/session.py                           # async engine (lazy init, pool_recycle=3600)
  broker/                                 # AlpacaClient, RobinhoodClient (stub), factory
  options/                                # broker/, greeks.py, iv.py, scanner.py, signals.py, risk.py, calendar.py, executor.py
  backtesting/engine.py
  alembic/                                # v1+v2+v3+v4 migrations

frontend/
  app/                                    # App Router pages (dashboard, strategies, backtests, live-trading,
                                          #   artifacts, profile, faq, learn, opportunities, ideas, alerts,
                                          #   auto-buy, portfolio, multi-chart, stock/[symbol],
                                          #   gold/, options/, commodities-guide/, morning-brief/)
  components/ui/, charts/, layout/, strategy/, buy-zone/, alerts/, ideas/, opportunities/, options/
  components/dashboard/MorningBriefTable.tsx  # watchlist TA table (EMA200/RSI/MACD/Bias/Signal)
  lib/api.ts                              # typed fetch wrappers, Bearer token auth
  lib/auth.ts, lib/supabase.ts            # Supabase session helpers
  lib/watchlist.ts                        # shared useWatchlist hook (localStorage)
  lib/market-stream.ts                    # useMarketStream hook — fetch-based SSE, exponential backoff, QuoteData type
  lib/options-api.ts                      # typed wrappers for all 10 options endpoints
  app/auth/callback/                      # magic link code exchange
  middleware.ts                           # route protection (Supabase SSR); protected prefixes include /portfolio,/options,/gold,/multi-chart,/stock,/morning-brief
```

### Request Flow
1. Middleware checks Supabase SSR session → redirect to `/login` if absent
2. API calls send `Authorization: Bearer <supabase_access_token>`
3. FastAPI `get_current_user` decodes Supabase JWT (HS256 / `SUPABASE_JWT_SECRET`), auto-provisions user by email
4. All DB queries scoped `WHERE user_id = current_user.id`
5. Broker credentials decrypted in-memory at execution time only; never returned in responses

### Auth Notes
- **Supabase magic link** — passwordless; `signInWithOtp({ email })` → `/auth/callback`
- **Dev login** — `POST /test/token` (debug only) → `dev_token` cookie (`httponly=True`, `secure=settings.cookie_secure`); enable with `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`
- **JWT lib:** PyJWT (not python-jose); `audience="authenticated"` always verified
- **Cross-origin (Vercel↔Render)** — `auth_session=1` marker cookie set on frontend domain

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

**V4 (3):** OptionsPosition, OptionsExecution, IVHistory

**Commodity (1):** `CommodityAlertPrefs` (unique per user; stores alert_email, alert_phone, symbols JSON, min_confidence, cooldown_minutes, last_alerted_at)

## Environment Variables

**Backend `.env`:**
```
DATABASE_URL=postgresql+asyncpg://nextgen:nextgen@localhost:5432/nextgenstock
SECRET_KEY=<generated>
JWT_ALGORITHM=HS256
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=http://localhost:3000,https://nextgenaitrading.vercel.app
FRONTEND_BASE_URL=http://localhost:3000   # set to https://nextgenaitrading.vercel.app on Render
DEBUG=true
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
ALPACA_API_KEY=your-alpaca-api-key
ALPACA_SECRET_KEY=your-alpaca-secret-key
# ALPACA_FEED=iex     # iex = free/delayed (default), sip = paid/real-time
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# SMTP (email alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=NextGenAi Trading <your-gmail@gmail.com>

# Twilio (SMS alerts)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1XXXXXXXXXX

COMMODITY_ALERT_MINUTES=15

# Options engine
RISK_FREE_RATE=0.05
OPTIONS_EARNINGS_BLOCK_DAYS=5
OPTIONS_MIN_IV_RANK=30
OPTIONS_MAX_SINGLE_TRADE_LOSS=500
OPTIONS_MIN_POP=0.60
OPTIONS_SCANNER_SYMBOLS=AAPL,TSLA,NVDA,SPY,QQQ,AMZN,MSFT,META,GOOGL,AMD
OPTIONS_ACTIVE_BROKER=alpaca
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Render Memory Constraints (512 MB Starter Plan)

- **DB pool:** `pool_size=2`, `max_overflow=3` (5 max connections). Never raise these.
- **uvicorn:** `--workers 1 --limit-concurrency 20 --backlog 64`. Single worker (APScheduler singleton).
- **yfinance:** Hard cap at 750 rows after download. Weekly/monthly intervals limited to `"1825d"` (5 years).
- **Scheduler intervals:** buy-zones=120min, theme-scores=720min, alerts=10min, auto-buy=10min, watchlist=30min, live-scanner=15min, idea-gen=120min, commodity-alerts=30min.
- **Scheduler gc:** Every scheduler task must have `gc.collect()` in its `finally` block.
- **`chart-data` endpoint:** Never add `db: Depends(get_db)` unless actually used — dashboard fires 15+ concurrent polls per symbol.

## Critical Constraints

- **Multi-tenancy:** Every service method scopes queries to `user_id`. Use `assert_ownership(record, current_user)`.
- **Live trading defaults to dry-run.** Require explicit opt-in + confirmation dialog.
- **Broker keys never returned in API responses.**
- **`SPEC.md` is authoritative** for all feature specs.
- **V3 scanner alerts fire only when ALL 10 conditions pass.** Condition 9 (`not_near_earnings`) calls `get_days_to_earnings()` from `options/calendar.py` (60-min LRU cache) — blocks within `OPTIONS_EARNINGS_BLOCK_DAYS` (default 5).
- **V3 wording:** Use "historically favorable", "high-probability entry zone", "confidence score" — never "guaranteed", "safe", "certain to go up".
- **CORS never `["*"]`.** Use `settings.cors_origins_list`. Both `http://localhost:3000` and `https://nextgenaitrading.vercel.app` must be included.
- **List endpoints must have bounded `limit`:** `Query(default=50, ge=1, le=200)`.
- **Credential errors:** Return generic message; log real error server-side.
- **`yf.Ticker(t).info` must use `get_ticker_info(t)` from `services/yfinance_cache.py`.** Never call directly.
- **`AsyncSessionLocal()` must never open inside a loop body.** Open one session outside the loop, mutate ORM objects in-place, commit once.
- **Frontend watchlist prices must use the batch endpoint** `GET /live/watchlist-prices?symbols=...` — not `Promise.allSettled(list.map(...))`.
- **`dangerouslySetInnerHTML` requires DOMPurify sanitization.**
- **DELETE endpoints:** Return `Response(status_code=204)` — don't put `status_code=204` in decorator (FastAPI 0.115+).
- **Intraday chart times:** `df_to_candles()` outputs Unix int timestamps for intraday; ISO strings for daily+.
- **Router prefix:** Never double-prefix routes.
- **Market data routing:** Always use `load_ohlcv()` or `load_ohlcv_for_strategy()` — never `load_ohlcv_alpaca()` directly. Commodities (`=F`), forex (`=X`), crypto (`-USD`) always go to yfinance.
- **Commodity symbol normalisation:** Always call `market_data.normalize_symbol()` before any `load_ohlcv*` call. Never pass raw commodity/index symbols to yfinance directly.
- **Specific futures contracts:** Pattern `^[A-Z]{2,3}[FGHJKMNQUVXZ]\d{2}$` → exchange suffix: COMEX metals → `.CMX`; NYMEX energy → `.NYM`.
- **`PriceChart` has 3 effects — do not merge them:** Effect 1 (`[theme, height]`) creates chart; Effect 2 (`[data, signals, bollingerData, maOverlays, theme]`) updates series; Effect 3 (`[drawings]`) attaches drawing primitives. `fitContent()` fires only on first load per symbol.
- **`AppShell` requires `title` prop** — always pass `title="..."`.
- **Valid surface tokens (Tailwind):** `surface-lowest` · `surface-low` · `surface-mid` · `surface` · `surface-high` · `surface-highest` · `surface-bright`. Never use `surface-1`, `surface-2`, etc.
- **Placeholder visibility:** Symbol inputs use `placeholder:text-primary/40`. General inputs use `placeholder:text-muted-foreground/60` minimum. Never `/30` or lower.
- **`useMemo` with derived arrays:** Declare array construction inside the `useMemo` callback, not outside.
- **SSR hydration for time/random values:** Initialize `useState` as `null`; set real value only in `useEffect`.
- **Alembic on Render:** Dockerfile CMD runs `alembic upgrade head && uvicorn ...` — migrations auto-apply on every deploy.
- **Alembic / PgBouncer:** Use `statement_cache_size=0` in alembic `env.py` engine to avoid `DuplicatePreparedStatementError`.
- **`py_vollib_vectorized` on Render:** Wrap import in `except Exception` (not just `ImportError`) — numba crashes on read-only fs; falls back to analytic B-S.
- **JWT security:** Always verify `audience="authenticated"`; never skip on missing secret. Both primary and fallback decode paths must include `verify_aud=True`.
- **`GET /api/v1/stream/status`** requires `get_current_user` auth.
- **Deprecated APIs:** Use `datetime.now(timezone.utc)` (not `utcnow()`); use `asyncio.get_running_loop()` (not `get_event_loop()`).

## Alpaca Real-Time Streaming

SSE endpoint: `GET /api/v1/stream/quotes?symbols=AAPL,MSFT` — JWT auth required. Events: `status`, `snapshot`, `quote`.  
Stream starts in `lifespan()` only when `ALPACA_API_KEY`+`ALPACA_SECRET_KEY` present.  
Max 20 symbols; per-client queue bounded to 50; stale quotes evicted after 90s.  
On 406 (IEX connection limit): applies 60s backoff immediately, then falls back to 30s yfinance polling; dashboard shows orange badge.  
Frontend: `useMarketStream()` in `lib/market-stream.ts` — fetch-based SSE (not `EventSource`) to allow `Authorization` header; exponential backoff 1s→30s; `symbols` key wrapped in `useMemo` to prevent reconnect storms.

## Options Trading Engine

Routes at `/api/v4/options/`: `GET /expirations` · `GET /chain` · `POST /scan` · `GET /signals` · `GET /positions` · `POST /execute` · `GET /risk` · `GET /greeks/portfolio` · `GET /iv/{symbol}` · `GET /executions`

**Strategy selection matrix:**
| Trend | IV Rank | Strategy |
|---|---|---|
| bullish | >50 | cash_secured_put |
| bearish | >50 | covered_call |
| neutral | >50 | iron_condor |
| bullish | <30 | bull_call_debit |
| bearish | <30 | bear_put_debit |
| neutral | <30 | long_straddle |

Debit strategies: action=`buy` + `limit_debit`. Credit strategies: action=`sell` + `limit_credit`.  
`underlying_trend` derived from EMA-20/EMA-50 cross via yfinance (not hardcoded).  
Greeks via `py_vollib_vectorized`; analytic B-S fallback. IV rank from `iv_history` DB table.  
`get_days_to_earnings()` from `options/calendar.py` has 60-min in-process LRU cache.

## Commodity Alert System

Signal engine (`services/commodity_signal_service.py`): 4-condition gate — EMA-8 > EMA-21 | price > EMA-50 | RSI-14 < 70 | volume ≥ 1.05× 20-day avg.  
RSI uses Wilder's EWM (`ewm(com=period-1, adjust=False)`).  
Scheduler: every `COMMODITY_ALERT_MINUTES` (default 15). Single `AsyncSessionLocal` for full function body; one `db.commit()` after loop.  
API: `GET /commodity-alerts/prefs` + `PATCH /commodity-alerts/prefs`.

## Branding
- **App name:** "NextGen Trading" · **Tagline:** "Play Smart" (sidebar only) · **Auth pages:** "Work Hard, Play Hard"
- **Sidebar:** expanded `w-[190px]`, collapsed `w-12`. No email shown — only "AI Trader" label.

## BTC Trailing Stop Bot

Standalone script: `btc_trailing_bot.py` (repo root). Executes against Alpaca paper trading via `alpaca-py`.

**Rules implemented:**
- **FLOOR** — hard stop: sell all if price drops 10% below fill price
- **TRAILING FLOOR** — activates after +10% gain; stop = current price × 0.95; advances every +5% milestone; never moves down
- **LADDER IN** — 3-level DCA re-entry after stop-out; larger buys at deeper discounts:
  | Level | Drop | Trigger | Buy | New Stop |
  |---|---|---|---|---|
  | L1 | −20% | entry × 0.80 | $1,000 | fill × 0.90 |
  | L2 | −30% | entry × 0.70 | $1,500 | fill × 0.90 |
  | L3 | −40% | entry × 0.60 | $2,000 | fill × 0.90 |
  Each level fires once per session. Floor never moves down after ladder fill.

**Config (env vars):**
```
ALPACA_API_KEY=...       # required
ALPACA_SECRET_KEY=...    # required
BTC_USD=1000             # dollar amount to buy initially (default: $1000)
POLL_INTERVAL_SEC=30     # price check interval in seconds
```

**Run:**
```bash
cd backend && source .venv/Scripts/activate   # Windows
python ../btc_trailing_bot.py
```

**Notes:**
- BTC quantity calculated at fill time: `qty = BTC_USD / ask_price` (8 decimal precision via `Decimal`)
- Ladder state tracked in-memory via `ladder_next` index (0–3)
- Monitoring loop runs until position is closed or Ctrl+C; position stays open on Alpaca if interrupted
- Does NOT persist state across restarts

## BTC Trailing Stop — Scheduled Agent

Remote agent (`trig_01FizcNHd7jy9JDyXDBPLfnE`) runs hourly 24/7 on Anthropic cloud.  
Manage: https://claude.ai/code/scheduled/trig_01FizcNHd7jy9JDyXDBPLfnE

**Each run:**
1. Gets live BTC/USD price from Alpaca
2. Checks open position + active stop-limit order
3. If price crossed a +5% trailing milestone → cancels old stop, places new stop-limit at price × 0.95
4. If no position (stopped out) → checks next ladder level and buys if triggered
5. Tracks ladder state by counting buy orders since `2026-04-07T22:02Z` (stateless — no local files)

**Active position (as of 2026-04-07):**
- Entry: $70,145.06 | Qty: 0.014225 BTC | Stop-limit: $63,130.55
- Ladder triggers: L1=$56,116 / L2=$49,102 / L3=$42,087

## Trailing Stop Bot — Web Feature (V5)

Frontend page at `/trailing-bot`. Full backend + scheduler integration.

**API routes** (`/api/v1/trailing-bot/`):
- `POST /setup` — buy at market + place stop + place ladder limit buys → creates `TrailingBotSession` (201)
- `GET /sessions` — list user's sessions (newest first, max 100)
- `GET /sessions/{id}` — single session detail
- `DELETE /sessions/{id}` — cancel session (status → "cancelled", 204)

**DB table:** `trailing_bot_sessions` (V5 Alembic migration)

**Scheduler:** `trailing_bot_monitor` task runs every 5 min — checks all active sessions, adjusts stop order upward when trailing thresholds are met, commits changes. Floor never moves down.

**Rules (hardcoded defaults):**
- `trailing_trigger_pct=10.0` — trailing activates after +10% gain
- `trailing_trail_pct=5.0` — stop set at 5% below current price when trailing
- `trailing_step_pct=5.0` — floor raised again every additional +5%

**Dry-run default:** `True` — live mode requires explicit toggle + confirmation dialog.

**Key files:**
- `backend/app/models/trailing_bot.py` — `TrailingBotSession` ORM model
- `backend/app/schemas/trailing_bot.py` — Pydantic DTOs
- `backend/app/services/trailing_bot_service.py` — `setup_trailing_bot()`, `adjust_trailing_stop()`
- `backend/app/api/trailing_bot.py` — FastAPI router
- `backend/app/scheduler/tasks/trailing_bot_monitor.py` — APScheduler task
- `frontend/app/trailing-bot/page.tsx` — Sovereign Terminal design, form + session cards
- `frontend/lib/trailing-bot-api.ts` — typed API wrappers

## Implementation Status
All V1–V4 backend and frontend features complete as of 2026-04-05. `btc_trailing_bot.py` + scheduled agent added 2026-04-07. Trailing bot web feature (V5) added 2026-04-07. Run `alembic upgrade head` after pulling.

## Known Spec Deviations
- Auth: Supabase magic links (not password-based JWT)
- `POST /strategies/ai-pick/run` → 202 Accepted (async)
- `GET /live/positions` → DB snapshot (not live broker poll)
- Robinhood client is a stub (`NotImplementedError` except `ping()`)
- 4h timeframe resampled from 1h (yfinance limitation)