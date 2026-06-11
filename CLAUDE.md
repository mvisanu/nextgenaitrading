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

# Backend unit tests
cd backend && pytest tests/v2/ tests/v3/ tests/v4/ tests/v5/
cd backend && pytest tests/v6/   # Congress copy bot — standalone only
cd backend && pytest tests/v7/   # Wheel bot (V7)

# E2E tests (requires both servers running)
cd tests && npm install
npx playwright test --config=e2e/playwright.config.ts
```

## Architecture

### Directory Layout
```
backend/app/
  main.py, core/, auth/                   # app entry, config, Supabase JWT auth
  api/                                    # v1: profile,broker,backtests,strategies,live,artifacts,morning_brief,copy_trading,wheel_bot,trailing_bot,btc_bot
                                          # v2: buy_zone,alerts,ideas,auto_buy,opportunities
                                          # v3: watchlist,scanner,generated_ideas
                                          # v4: options
                                          # commodity: gold, commodity_alert_prefs
  models/, schemas/                       # ORM + Pydantic DTOs (incl. btc_bot)
  services/
    alpaca_data.py                        # Alpaca StockHistoricalDataClient; primary source for stocks/ETFs
    alpaca_stream.py                      # AlpacaStreamManager singleton; WebSocket→SSE fan-out; max 20 symbols; bounded queues
    market_data.py                        # routes load_ohlcv(): Alpaca→yfinance fallback; yfinance-only for commodities/forex/crypto
    yfinance_cache.py                     # 30-min TTL cache; use get_ticker_info(t) — never yf.Ticker(t).info directly
    btc_bot_service.py                    # pure evaluate_tick(...) -> TickAction; zero I/O — fully unit-testable
  strategies/                             # conservative, aggressive, bollinger_squeeze
  optimizers/                             # ai_pick, buy_low_sell_high
  scheduler/tasks/                        # APScheduler: buy-zone, alerts, auto-buy, live-scanner, idea-gen, commodity-alerts, trailing-bot, copy-trading, wheel-bot, btc-bot
  db/session.py                           # async engine (lazy init, pool_recycle=3600)
  broker/                                 # AlpacaClient, RobinhoodClient (stub), factory, WheelAlpacaClient (wheel bot; WHEEL_ALPACA_* env vars), BtcBotClient (thin alpaca-py wrapper)
  options/                                # broker/, greeks.py, iv.py, scanner.py, signals.py, risk.py, calendar.py, executor.py
  backtesting/engine.py
  alembic/                                # v1+v2+v3+v4+v5+v6+v7+v8 migrations

frontend/
  app/                                    # App Router pages (dashboard, strategies, backtests, live-trading,
                                          #   artifacts, profile, faq, learn, opportunities, ideas, alerts,
                                          #   auto-buy, portfolio, multi-chart, stock/[symbol],
                                          #   gold/, options/, commodities-guide/, morning-brief/,
                                          #   trailing-bot/, copy-trading/, wheel-bot/, btc-bot/, crons/)
  components/ui/, charts/, layout/, strategy/, buy-zone/, alerts/, ideas/, opportunities/, options/
  lib/api.ts                              # typed fetch wrappers, Bearer token auth
  lib/auth.ts, lib/supabase.ts            # Supabase session helpers
  lib/market-stream.ts                    # useMarketStream hook — fetch-based SSE, exponential backoff, QuoteData type
  middleware.ts                           # route protection (Supabase SSR)
```

### Request Flow
1. Middleware checks Supabase SSR session → redirect to `/login` if absent
2. API calls send `Authorization: Bearer <supabase_access_token>`
3. FastAPI `get_current_user` decodes Supabase JWT. Algorithm detected from JWT header:
   - **ES256 / RS256** (current Supabase projects) → verified via `PyJWKClient` against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` (keys cached 1h)
   - **HS256** (legacy projects, dev_token, anon_key, service_role_key) → verified with `SUPABASE_JWT_SECRET`
   Auto-provisions user by email on first call.
4. All DB queries scoped `WHERE user_id = current_user.id`
5. Broker credentials decrypted in-memory at execution time only; never returned in responses

### Auth Notes
- **Supabase magic link** — passwordless; `signInWithOtp({ email })` → `/auth/callback`
- **Login page modes** — `choose` (default) → `pin` or `magic-sent`. `"magic"` mode never exists as a runtime state.
- **PIN auth** — 4-digit PIN for quick repeat login after initial magic-link.
- **Dev login** — `POST /test/token` (debug only) → `dev_token` cookie; enable with `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`
- **JWT lib:** PyJWT 2.12+ (not python-jose); `audience="authenticated"` always verified; `leeway=10s`
- **Algorithm allow-list:** `ES256`/`RS256`/`HS256` only — `alg=none` and all others rejected
- **401 redirect contract** — `apiFetch` calls `supabase.auth.signOut()` + clears `dev_token` cookie BEFORE `window.location.href = "/login"`. Without signOut, middleware sees stale cookies → infinite redirect loop.
- **pin-setup token** — `handleSetPin` calls `getUser()` first (auto-refreshes in cookies), then `getSession()`, then `refreshSession()` as last resort. On 401 → `signOut()` + redirect to `/login`.

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

**V5 (1):** TrailingBotSession (`trailing_bot_sessions`)

**V6 (2):** `CopyTradingSession` (`copy_trading_sessions`; has `credential_id` FK), `CopiedPoliticianTrade` (`copied_politician_trades`; unique on `user_id+trade_id`)

**V7 (1):** `WheelBotSession` (`wheel_bot_sessions`)

**V8 (1):** `UserPin` (`user_pins`; unique on `user_id`; stores bcrypt `pin_hash`, `attempt_count`, `locked_until`)

**V9 (2):** `BtcBotSession` (`btc_bot_sessions`; partial-unique on `user_id` while `status IN ('active','cooldown')`), `BtcBotAction` (`btc_bot_actions`; sparse audit log of every state change)

**Commodity (1):** `CommodityAlertPrefs` (unique per user; stores alert_email, alert_phone, symbols JSON, min_confidence, cooldown_minutes, last_alerted_at)

## Environment Variables

**Backend `.env`:**
```
DATABASE_URL=postgresql+asyncpg://nextgen:nextgen@localhost:5432/nextgenstock
SECRET_KEY=<generated>
JWT_ALGORITHM=HS256
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=http://localhost:3000,https://nextgenaitrading.vercel.app
FRONTEND_BASE_URL=http://localhost:3000
DEBUG=true
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=NextGenAi Trading <...>
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
COMMODITY_ALERT_MINUTES=15
RISK_FREE_RATE=0.05
OPTIONS_EARNINGS_BLOCK_DAYS=5
OPTIONS_MIN_IV_RANK=30
OPTIONS_MAX_SINGLE_TRADE_LOSS=500
OPTIONS_MIN_POP=0.60
OPTIONS_SCANNER_SYMBOLS=AAPL,TSLA,NVDA,SPY,QQQ,AMZN,MSFT,META,GOOGL,AMD
OPTIONS_ACTIVE_BROKER=alpaca
WHEEL_ALPACA_API_KEY=...
WHEEL_ALPACA_SECRET_KEY=...
WHEEL_ALPACA_BASE_URL=https://paper-api.alpaca.markets
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Render Memory Constraints (512 MB Starter Plan)

- **DB pool:** `pool_size=2`, `max_overflow=3` (5 max connections). Never raise these.
- **uvicorn:** `--workers 1 --limit-concurrency 20 --backlog 64`. Single worker (APScheduler singleton).
- **yfinance:** Hard cap at 750 rows after download. Weekly/monthly intervals limited to `"1825d"` (5 years).
- **Scheduler intervals:** buy-zones=120min, theme-scores=720min, alerts=10min, auto-buy=10min, watchlist=30min, live-scanner=15min, idea-gen=120min, commodity-alerts=30min, trailing-bot=5min, copy-trading=15min, wheel-bot=15min, btc-bot=15min.
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
- **Commodity symbol normalisation:** Always call `market_data.normalize_symbol()` before any `load_ohlcv*` call.
- **Specific futures contracts:** Pattern `^[A-Z]{2,3}[FGHJKMNQUVXZ]\d{2}$` → COMEX metals → `.CMX`; NYMEX energy → `.NYM`.
- **`PriceChart` has 3 effects — do not merge them:** Effect 1 (`[theme, height]`) creates chart; Effect 2 (`[data, signals, bollingerData, maOverlays, theme]`) updates series; Effect 3 (`[drawings]`) attaches drawing primitives. `fitContent()` fires only on first load per symbol.
- **`AppShell` requires `title` prop** — always pass `title="..."`.
- **Valid surface tokens (Tailwind):** `surface-lowest` · `surface-low` · `surface-mid` · `surface` · `surface-high` · `surface-highest` · `surface-bright`. Never use `surface-1`, `surface-2`, etc.
- **Placeholder visibility:** Symbol inputs use `placeholder:text-primary/40`. General inputs use `placeholder:text-muted-foreground/60` minimum. Never `/30` or lower.
- **`useMemo` with derived arrays:** Declare array construction inside the `useMemo` callback, not outside.
- **SSR hydration for time/random values:** Initialize `useState` as `null`; set real value only in `useEffect`.
- **Alembic on Render:** Startup uses `backend/start.sh` (Dockerfile CMD). Script runs `migrate_fix.py` → `alembic upgrade head` → uvicorn. Never revert to inline `alembic upgrade head && uvicorn`.
- **Alembic / PgBouncer:** Use `statement_cache_size=0` in alembic `env.py` engine to avoid `DuplicatePreparedStatementError`.
- **`py_vollib_vectorized` on Render:** Wrap import in `except Exception` (not just `ImportError`) — numba crashes on read-only fs; falls back to analytic B-S.
- **JWT security:** Always verify `audience="authenticated"`; never skip. All decode paths must include `verify_aud=True`. Algorithm allow-list prevents `alg=none` / alg-confusion attacks.
- **JWKS fetch:** `PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)` — keys cached in-memory for 1h. Do NOT fetch on every request.
- **`GET /api/v1/stream/status`** requires `get_current_user` auth.
- **Deprecated APIs:** Use `datetime.now(timezone.utc)` (not `utcnow()`); use `asyncio.get_running_loop()` (not `get_event_loop()`).

## Alpaca Real-Time Streaming

SSE endpoint: `GET /api/v1/stream/quotes?symbols=AAPL,MSFT` — JWT auth required. Events: `status`, `snapshot`, `quote`.  
Stream starts in `lifespan()` only when `ALPACA_API_KEY`+`ALPACA_SECRET_KEY` present.  
Max 20 symbols; per-client queue bounded to 50; stale quotes evicted after 90s.  
On 406 (IEX connection limit): applies 60s backoff, falls back to 30s yfinance polling; dashboard shows orange badge.  
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

## Commodity Alert System

Signal engine (`services/commodity_signal_service.py`): 4-condition gate — EMA-8 > EMA-21 | price > EMA-50 | RSI-14 < 70 | volume ≥ 1.05× 20-day avg.  
RSI uses Wilder's EWM (`ewm(com=period-1, adjust=False)`).  
Scheduler: every `COMMODITY_ALERT_MINUTES` (default 15). Single `AsyncSessionLocal` for full function body; one `db.commit()` after loop.  
API: `GET /commodity-alerts/prefs` + `PATCH /commodity-alerts/prefs`.

## Branding
- **App name:** "NextGen Trading" · **Tagline:** "Play Smart" (sidebar only) · **Auth pages:** "Work Hard, Play Hard"
- **Sidebar:** expanded `w-[190px]`, collapsed `w-12`. No email shown — only "AI Trader" label.

## BTC Trailing Stop Bot

Standalone scripts in `btc-bot/`: `btc_trailing_bot.py` (monitor loop), `btc_execute_now.py` (one-shot buy), `btc_close_now.py` (one-shot close), `btc_status.py` (read-only check). All auto-load creds from `backend/.env` via `Path(__file__).parent.parent / "backend" / ".env"`. Authoritative spec: `btc-bot/BTC_BOT.md`. Executes against Alpaca paper trading via `alpaca-py`.

**Rules implemented:**
- **FLOOR** — hard stop: sell all if price drops 10% below fill price
- **TRAILING FLOOR** — activates after +10% gain; stop = current price × 0.95; advances every +5% milestone; never moves down
- **LADDER IN** — 3-level DCA re-entry after stop-out:
  | Level | Trigger | Buy | New Stop |
  |---|---|---|---|
  | L1 | entry × 0.80 | $10,000 | fill × 0.90 |
  | L2 | entry × 0.70 | $15,000 | fill × 0.90 |
  | L3 | entry × 0.60 | $20,000 | fill × 0.90 |

**Run:** `cd backend && source .venv/Scripts/activate && python ../btc-bot/btc_trailing_bot.py`

**Close out:** `python btc-bot/btc_close_now.py` (cancels open BTC orders, then market-sells any open position; matches positions by normalized symbol so it handles both `BTC/USD` and `BTCUSD` formats from Alpaca's API).

## Trailing Stop Bot — Web Feature (V5)

Frontend page at `/trailing-bot`.

**API routes** (`/api/v1/trailing-bot/`): `POST /setup` · `GET /sessions` · `GET /sessions/{id}` · `DELETE /sessions/{id}`

**Live-mode order constraints (Alpaca):**
- GTC orders require **whole shares** — `_whole_shares()` floors fractional qty (min 1).
- Stop/limit prices rounded to **2 decimal places**.
- Cannot place stop-sell while pending buy for same symbol is open → `_poll_order_fill()` waits up to 14s; if partial, cancels + waits 3s.
- Cannot create second active session for same symbol → 409 guard.
- **Full rollback contract**: if anything fails after market buy, cancels all placed orders before re-raising.

## Copy Trading (V6)

Frontend page at `/copy-trading`. Copies congressional trades via Quiver Quant API using user's saved Alpaca credentials.

**API routes** (`/api/v1/copy-trading/`): `GET /rankings` · `POST /sessions` · `GET /sessions` · `GET /sessions/{id}` · `DELETE /sessions/{id}` · `GET /sessions/{id}/trades` · `GET /trades`

**Ranking:** Score = `win_rate × 0.40 + avg_excess_return × 0.35 + recent_activity × 0.25`. Min 5 trades in last 90 days.

**Deduplication:** `CopiedPoliticianTrade` unique on `(user_id, trade_id)` — safe across sessions.

**Scheduler:** `copy_trading_monitor` every 15 min. Fetches Quiver once, processes all sessions, commits once, `gc.collect()` in `finally`.

## Wheel Strategy Bot (V7)

Frontend page at `/wheel-bot`. Automates Wheel Strategy on TSLA using `WHEEL_ALPACA_*` credentials.

**Stage machine:** `sell_put` → `assigned` → `sell_call` → `called_away` → `sell_put` (cycle repeats)

**API routes** (`/api/v1/wheel-bot/`): `POST /setup` · `GET /sessions` · `GET /sessions/{id}` · `DELETE /sessions/{id}` · `GET /sessions/{id}/summary`

**Rules enforced:**
- Never sell put if `cash < strike × 100`
- Strike target: put = current_price × 0.90; call = cost_basis × 1.10
- Expiration: 14–28 days. Never sell call with strike < cost_basis_per_share.
- 50% profit early close: if `current_price ≤ premium_received × 0.50` → buy_to_close + reopen

**Scheduler:** `wheel_bot_monitor` every 15 min (market hours only). `wheel_bot_daily_summary` cron at 21:05 UTC Mon–Fri.

## PIN Auth (V8)

**Flow:**
1. First login: magic link → `/auth/callback` → `/pin-setup`
2. Subsequent: `email + pin` → backend verifies bcrypt → Supabase admin `generate_link` → `token_hash` → frontend `verifyOtp`
3. Lockout: 5 wrong attempts → 15-min lockout on `user_pins.locked_until`

**API routes** (`/auth/`): `POST /auth/pin-login` (public) · `POST /auth/set-pin` (auth) · `GET /auth/has-pin` (auth)

## BTC Trailing-Stop Bot — Web Feature (V9)

Frontend page at `/btc-bot`. Converts the standalone `btc-bot/` CLI scripts into a multi-tenant scheduled feature managed from `/crons`.

**API routes** (`/api/v1/btc-bot/`): `GET /session` · `GET /sessions` · `GET /sessions/{id}` · `GET /actions` · `POST /sessions` · `POST /sessions/{id}/close` · `POST /sessions/{id}/cancel-cooldown`

**Strategy (from `btc-bot/BTC_BOT.md`):**
- FLOOR: blended_entry × 0.90 (up-only)
- Trailing activates at +10% gain; floor = current × 0.95; advances every +5% step
- 3-level ladder against original_entry: L1 (-20%, $10k), L2 (-30%, $15k), L3 (-40%, $20k)
- After stop-out: 4h cooldown, then auto re-enter with default initial buy

**Credential resolution:** Prefers `BrokerCredential` row; falls back to `VISANU_ALPACA_*` env vars only for the user whose email matches `BTC_BOT_BOOTSTRAP_USER_EMAIL`.

**Scheduler:** `btc_bot_monitor` every 15 min. Iterates active+cooldown sessions across all users + the bootstrap user. Single `AsyncSessionLocal` outside the loop, one commit at the end, `gc.collect()` in `finally`.

**Decision is pure:** `services.btc_bot_service.evaluate_tick(...) -> TickAction` has zero I/O — fully testable. Orchestrator in `scheduler/tasks/btc_bot_monitor.py` dispatches actions through `BtcBotClient` (thin alpaca-py wrapper).

## Crons Management (`/crons`)

**API routes** (`/api/v1/crons/`): `GET /jobs` · `GET /templates` · `PATCH /jobs/{id}` · `DELETE /jobs/{id}` · `POST /jobs` · `POST /jobs/{id}/pause` · `POST /jobs/{id}/resume` · `POST /jobs/{id}/run-now`

**Template registry:** `backend/app/scheduler/jobs.py::JOB_TEMPLATES` — keep in sync with `register_jobs()`. If you add a new scheduled job, add its entry to `JOB_TEMPLATES` too.

**Persistence:** Mutations apply to in-memory scheduler only. `register_jobs()` restores defaults on startup.

## Test Suite

```bash
cd backend && pytest tests/v2/ tests/v3/ tests/v4/ tests/v5/
cd backend && pytest tests/v6/   # standalone only — do NOT run with v5
cd backend && pytest tests/v7/
cd backend && pytest tests/v9/   # BTC bot (V9)
```

## Known Bugs

None currently tracked. (Previous HIGH/MEDIUM bugs in `morning_brief.py`, `politician_scraper_service.py`, and `copy_trading_service.py` were fixed 2026-06-11 — see `_log.md`.)

- **`politician_scraper_service.py`** now raises `QuiverFetchError` when the API is down AND no cache exists; returns stale cache (with warning) otherwise. `create_session` aborts (API returns 503) rather than creating an unseeded session that would bulk-copy historical trades.
- **`copy_trading_service.py`** options fallback validates the OCC symbol via `_build_occ_symbol()` (regex + date parse); falls back to underlying stock when malformed.

## Session Workflow

At the end of every Claude Code session, write two files to the repo root:

- **`status.md`** — current state snapshot: what's working, what's broken, what's pending. Overwrite each session.
- **`_log.md`** — append-only session log. Each entry: date + bullet list of what was done. Never overwrite.

## Known Spec Deviations
- Auth: Supabase magic links (not password-based JWT)
- `POST /strategies/ai-pick/run` → 202 Accepted (async)
- `GET /live/positions` → DB snapshot (not live broker poll)
- Robinhood client is a stub (`NotImplementedError` except `ping()`)
- 4h timeframe resampled from 1h (yfinance limitation)
