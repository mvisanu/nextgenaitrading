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
                                          #   alpaca_data.py — Alpaca StockHistoricalDataClient; primary source for stocks/ETFs
                                          #   alpaca_stream.py — AlpacaStreamManager singleton; WebSocket→SSE fan-out; max 20 symbols; bounded queues
                                          #   market_data.py — routes load_ohlcv(): Alpaca→yfinance fallback; yfinance-only for commodities/forex/crypto
                                          #   yfinance_cache.py — 30-min TTL cache for yf.Ticker.info; use get_ticker_info(t) instead of yf.Ticker(t).info directly
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
  lib/market-stream.ts                    # useMarketStream hook — fetch-based SSE, exponential backoff, QuoteData type
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
FRONTEND_BASE_URL=http://localhost:3000   # set to https://nextgenaitrading.vercel.app on Render
DEBUG=true
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets
# Alpaca market data — same key pair used for trading; enables Alpaca as primary OHLCV source for stocks/ETFs
# Also starts the real-time WebSocket stream (bid/ask quotes) on backend startup
ALPACA_API_KEY=your-alpaca-api-key
ALPACA_SECRET_KEY=your-alpaca-secret-key
# ALPACA_FEED=iex     # iex = free/delayed (default), sip = paid/real-time
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

## Render Memory Constraints (512 MB Starter Plan)

- **DB pool:** `pool_size=2`, `max_overflow=3` (5 max connections). Never raise these on Render Starter — each asyncpg connection uses ~3-5 MB.
- **uvicorn:** `--workers 1 --limit-concurrency 20 --backlog 64`. Single worker (APScheduler is in-process singleton).
- **yfinance downloads:** Hard cap at 750 rows after download. Weekly/monthly intervals limited to `"1825d"` (5 years) — never use `"3650d"` or `"max"` for periodic intervals.
- **Scheduler intervals (render.yaml):** buy-zones=120min, theme-scores=720min, alerts=10min, auto-buy=10min, watchlist=30min, live-scanner=15min, idea-gen=120min, commodity-alerts=30min. Do not lower these without memory testing.
- **Scheduler gc:** Every scheduler task must have `gc.collect()` in its `finally` block to release DataFrames immediately.
- **chart-data endpoint:** Never add `db: Depends(get_db)` unless actually used — dashboard fires 15+ concurrent polls per symbol, each acquiring a pool connection.

## Critical Constraints

- **Multi-tenancy:** Every service method scopes queries to `user_id`. Use `assert_ownership(record, current_user)`.
- **Live trading defaults to dry-run.** Require explicit opt-in + confirmation dialog.
- **Broker keys never returned in API responses.**
- **`SPEC.md` is authoritative** for all feature specs (V1/V2/V3/Screener/Bitcoin).
- **V3 scanner alerts fire only when ALL 10 conditions pass.** No partial alerts. See `PRD.md` Part 3 §4.3. Condition 9 (`not_near_earnings`) calls `get_days_to_earnings()` from `options/calendar.py` (60-min LRU cache) — blocks within `OPTIONS_EARNINGS_BLOCK_DAYS` (default 5 days).
- **V3 wording:** Use "historically favorable", "high-probability entry zone", "confidence score" — never "guaranteed", "safe", "certain to go up".
- **CORS never `["*"]`.** Use `settings.cors_origins_list`; error handlers validate origin before reflecting. Default includes both `http://localhost:3000` and `https://nextgenaitrading.vercel.app`. Render env var: `CORS_ORIGINS=http://localhost:3000,https://nextgenaitrading.vercel.app`.
- **List endpoints must have bounded `limit`:** `Query(default=50, ge=1, le=200)`.
- **Credential errors:** Return generic message; log real error server-side.
- **`yf.Ticker(t).info` must use `get_ticker_info(t)` from `services/yfinance_cache.py`** — 30-min TTL cache prevents duplicate large JSON fetches across services in the same scheduler cycle. Never call `yf.Ticker(t).info` directly in a service.
- **`AsyncSessionLocal()` must never open inside a loop body.** Open one session outside the loop, mutate ORM objects in-place, commit once. Per-iteration session opens exhaust the 5-connection pool.
- **Frontend "fetch for every watchlist item" must use the batch endpoint** `GET /live/watchlist-prices?symbols=...` — not `Promise.allSettled(list.map(...))`. N parallel requests saturate the pool.
- **`dangerouslySetInnerHTML` requires DOMPurify sanitization.**
- **DELETE endpoints:** Return `Response(status_code=204)` — don't put `status_code=204` in decorator (FastAPI 0.115+).
- **Intraday chart times:** `df_to_candles()` outputs Unix int timestamps for intraday intervals; ISO strings for daily+.
- **Router prefix:** Never double-prefix routes. `app.include_router()` must not add `/api` if router already has it.
- **Market data routing:** `load_ohlcv()` in `market_data.py` tries Alpaca (`alpaca_data.py`) first for plain US stock/ETF symbols (1-5 uppercase letters), falls back to yfinance on failure or when keys absent. Commodities (`=F`), forex (`=X`), and crypto (`-USD`) always go to yfinance. Never call `load_ohlcv_alpaca()` directly — always use `load_ohlcv()` or `load_ohlcv_for_strategy()`.
- **Alpaca stream manager:** `AlpacaStreamManager` in `alpaca_stream.py` is a module-level singleton. It maintains ONE WebSocket connection to Alpaca's data stream and fans updates to SSE clients. Max 20 symbols subscribed. Each SSE client queue is bounded to 50 entries. Stale quotes dropped after 90s. Started in `lifespan()` only when `ALPACA_API_KEY`/`ALPACA_SECRET_KEY` are present. Dashboard uses `useMarketStream()` hook (`lib/market-stream.ts`) for live watchlist prices + bid/ask; falls back silently to 30s REST polling when stream is unavailable. SSE endpoint: `GET /api/v1/stream/quotes?symbols=...` — requires JWT auth; streams `status`, `snapshot`, and `quote` events.
- **Commodity symbol normalisation:** `market_data.normalize_symbol()` translates display symbols (XAU-USD, XAUUSD, XAU/USD) to yfinance tickers (GC=F) and index display names (SPX→^GSPC, NDQ→^NDX, DJI→^DJI, VIX→^VIX, DXY→DX-Y.NYB, RUT→^RUT) before any `load_ohlcv*` call. Always call via `load_ohlcv_for_strategy()` — never pass raw commodity or index symbols to yfinance directly.
- **Specific futures contracts:** `normalize_symbol("GCM26")` → `"GCM26.CMX"`. Pattern `^[A-Z]{2,3}[FGHJKMNQUVXZ]\d{2}$` triggers exchange suffix lookup: COMEX metals (GC,SI,HG,PL,PA,MGC,SIL) → `.CMX`; NYMEX energy+PGMs (CL,NG,RB,HO,BZ,PL,PA,QM) → `.NYM`. Unknown roots fall back to `=F`.
- **`PriceChart` has 3 effects — do not merge them:** Effect 1 (`[theme, height]`) creates the chart structure; Effect 2 (`[data, signals, bollingerData, maOverlays, theme]`) updates series data; Effect 3 (`[drawings]`) attaches/detaches drawing primitives. `drawings` must NOT be in Effect 1's deps — FVG auto-detection recalculates on every candle poll and would destroy/recreate the chart on every 30s refresh. `fitContent()` is gated by `fittedSymbolRef` so it only fires on the first load per symbol, never on polling refreshes.
- **`AppShell` requires `title` prop** — always pass `title="..."` or `title={tr("pageTitle", lang)}` for translated pages.
- **`useMemo` with derived arrays:** Never declare arrays outside a `useMemo` and reference them in its deps — move the array construction inside the callback. See `dashboard/page.tsx` `allSymbols` pattern.
- **SSR hydration for time/random values:** Initialize `useState` as `null` for any value derived from `Date.now()` or `Math.random()`. Set the real value only inside `useEffect`. Render an invisible placeholder when `null`. See `LiveClock` in `dashboard/page.tsx`.
- **Alembic on Render:** `backend/Dockerfile` CMD runs `alembic upgrade head && uvicorn ...` — migrations auto-apply on every deploy. Never add new ORM columns without a corresponding migration or the scheduler/API will crash with `UndefinedColumnError`.
- **yfinance row cap:** `_load_ohlcv_yfinance` caps output at 750 rows (most-recent) to prevent Render OOM. Periods for `1wk`/`1mo` are capped at `1825d` (5 years). Do not increase without memory testing on Render Starter.

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
| Mobile responsiveness (all pages) | Complete — deep audit + fixes 2026-03-30 |
| Commodities Guide page (`/commodities-guide`) | Complete — EN/Thai bilingual, 2026-03-30 |
| E2E tests (v1: 263, v2: 159, v3: 34, supabase-auth: 90) | Written; auth system fixed 2026-03-27 |
| Options Trading Engine (v4 backend + frontend dashboard) | Complete — 2026-03-30 |
| Alpaca Market Data integration (stocks/ETFs primary source, yfinance fallback) | Complete — 2026-03-31 |
| Alpaca real-time streaming (WebSocket→SSE, bid/ask, connection badge, bounded caches) | Complete — 2026-03-31 |
| Live Trading page — beginner UX (guide banner, Tip tooltips, signal plain-English, 8 bug fixes) | Complete — 2026-03-31 |
| Auto-Buy UX redesign (beginner-friendly, Define Targets + Execution Timeframe) | Complete — 2026-03-31 |
| Sidebar child-active bug fix (Overview link highlighted on all gold sub-pages) | Fixed — 2026-03-31 |
| Vercel build fixes (ESLint react/no-unescaped-entities in 4 files) | Fixed — 2026-03-31 |
| Options page dead-page fix (auth silent fail, stale closures, expiration selection) | Fixed — 2026-03-31 |
| CORS fix: Vercel→Render cross-origin (added Vercel URL to cors_origins default) | Fixed — 2026-03-31 |
| Dashboard chart anti-flicker (split PriceChart effects; stale-data guard on symbol change) | Fixed — 2026-03-31 |
| Dashboard live terminal animations (LiveClock, price flash, countdown bar, watchlist arrows) | Complete — 2026-03-31 |
| Dashboard live watchlist price polling (30s refetch; terminal refresh progress bar) | Complete — 2026-03-31 |
| LiveClock SSR hydration fix (null init; set real Date only after mount) | Fixed — 2026-03-31 |
| Dashboard bugs: selectedItem undefined guard + chartScale wired to PriceChart log/linear toggle | Fixed — 2026-03-31 |
| Dashboard 500 fix: removed unused db=Depends(get_db) from chart-data endpoint (pool exhaustion) | Fixed — 2026-03-31 |
| Render OOM fix: yfinance 750-row cap, 5yr max, scheduler intervals doubled, gc.collect(), pool_size=2 | Fixed — 2026-03-31 |
| DB pool hardening: pool_recycle=300, jit=off, get_db retry on InterfaceError + engine.dispose() | Fixed — 2026-03-31 |
| Missing auto_buy_settings migration: execution_timeframe/start_date/end_date/target_buy/sell added | Fixed — 2026-03-31 |
| Dockerfile: CMD runs `alembic upgrade head && uvicorn` — auto-migrates on every Render deploy | Fixed — 2026-03-31 |
| Dashboard chart query: added `enabled: !!user` guard to prevent pre-auth API calls | Fixed — 2026-03-31 |
| market_data.py: 3m→5m, 10m→15m interval mapping; 750-row cap; 5yr period for 1wk/1mo | Fixed — 2026-03-31 |
| PriceChart.tsx scale prop: was unstaged (not committed) — now committed; build fixed | Fixed — 2026-03-31 |
| live.py chart-data symbol regex: blocked `=` char, preventing GC=F (gold) and EURUSD=X (forex) from chart endpoint | Fixed — 2026-03-31 |
| Dashboard E2E tests DASH-07/08/09: flawed assertions (email removed from sidebar, `/500/` regex too broad, SPA nav) | Fixed — 2026-03-31 |
| PriceChart chart snap-back on poll: `fitContent()` fired on every 30s refresh; now only fires on initial load per symbol | Fixed — 2026-03-31 |
| PriceChart chart recreated on every poll: `drawings` in Effect 1 deps caused teardown when autoFVGs recalculated; moved drawing attachment to Effect 3 | Fixed — 2026-03-31 |
| npm audit: 3 vulnerabilities (brace-expansion/handlebars/picomatch in jest/eslint dev deps) | Fixed — 2026-03-31 |
| Index symbol 422s: DJI/SPX/NDQ/VIX/DXY not in normalize_symbol map → yfinance returned no data; added 9 index mappings to _SYMBOL_MAP | Fixed — 2026-03-31 |
| py_vollib_vectorized numba crash on Render: `RuntimeError` on import (read-only fs); `except ImportError` → `except Exception` in greeks.py; falls back to analytic B-S | Fixed — 2026-03-31 |
| Alembic `DuplicatePreparedStatementError` on Render: Supabase PgBouncer transaction mode incompatible with asyncpg prepared statements; added `statement_cache_size=0` to alembic env.py engine | Fixed — 2026-03-31 |
| Portfolio live ledger: buys from any page now immediately write `BrokerOrder` + upsert `PositionSnapshot`; portfolio page polls `/live/positions` + `/live/orders` every 30s; DB data shown with Live badge + Refresh button | Complete — 2026-03-31 |
| Auto-buy ledger gap: auto_buy_engine never wrote `BrokerOrder` records; now writes order + upserts position snapshot on every automated buy | Fixed — 2026-03-31 |
| Options page buy flow: Pro mode had no execute button after chain selection; added Place Trade button in P&L panel; `underlying_price` de-hardcoded in BeginnerTradeCard | Fixed — 2026-03-31 |
| Alpaca stream 406 loop: free IEX tier allows 1 connection; on server restart the old connection lingers and new one gets 406; now applies MAX_RECONNECT_BACKOFF (60s) immediately on 406 instead of 1s retry | Fixed — 2026-03-31 |
| Alpaca stream 406 yfinance fallback: when 406 connection limit hit, polls yfinance every 30s for subscribed symbols and broadcasts quote events; `status: "yfinance_fallback"` shown as orange badge in dashboard; switches back to Alpaca after 60s wait | Fixed — 2026-04-01 |
| Options signals: `underlying_trend` was hardcoded "neutral" (all signals = iron_condor); now derived from EMA-20/EMA-50 cross via yfinance; underlying price was hardcoded 100.0, now fetches real `fast_info.last_price` | Fixed — 2026-04-01 |
| Options executor: debit strategies (bull_call_debit, bear_put_debit, long_straddle) were submitting legs as "sell"; now correctly sets action="buy" + limit_debit for debit strategies, action="sell" + limit_credit for credit strategies | Fixed — 2026-04-01 |
| Options Live dialog hydration error: `<DialogDescription>` renders as `<p>`; nested `<p>` tags inside caused React hydration warning; fixed with `asChild` + `<div>` wrapper | Fixed — 2026-04-01 |
| auto_buy_engine.py tautological safeguard: `position_size_limit` check was always true (`quantity * price == max_trade_amount` by construction); now computes `proposed_cost` from `target_buy_price` vs current price before capping | Fixed — 2026-04-01 |
| Missing gc.collect() in 4 schedulers: `evaluate_auto_buy.py`, `evaluate_alerts.py`, `refresh_theme_scores.py`, `scan_watchlist.py` — risk of OOM on Render Starter | Fixed — 2026-04-01 |
| V3 condition 9 hardcoded True: `not_near_earnings` in `buy_signal_service.py` was always True; now calls `get_days_to_earnings()` (60-min LRU cache) and blocks within `OPTIONS_EARNINGS_BLOCK_DAYS` (default 5) | Fixed — 2026-04-01 |
| Auth middleware missing routes: `/portfolio`, `/options`, `/gold`, `/multi-chart`, `/stock` not in `PROTECTED_PREFIXES` in `middleware.ts` — unauthenticated users could reach these pages | Fixed — 2026-04-01 |
| Unbounded limit on decisions endpoint: `limit: int = 100` → `limit: int = Query(default=100, ge=1, le=200)` in `backend/app/api/strategies.py` | Fixed — 2026-04-01 |
| JWT audience bypass on fallback path: `auth/dependencies.py` fallback `jwt.decode()` lacked `audience="authenticated"` + `verify_aud=True` — forged tokens without audience claim accepted | Fixed — 2026-04-01 |
| RSI inconsistency: `commodity_signal_service.py` used Cutler simple rolling mean; standardized to Wilder's EWM (`ewm(com=period-1, adjust=False)`) matching `buy_signal_service.py` | Fixed — 2026-04-01 |
| Deprecated datetime.utcnow(): replaced all `datetime.utcnow()` calls in `options/signals.py` + `api/v4/options.py` with `datetime.now(timezone.utc)` | Fixed — 2026-04-01 |
| Deprecated asyncio.get_event_loop(): replaced with `asyncio.get_running_loop()` at 2 call sites in `api/v4/options.py` | Fixed — 2026-04-01 |
| max_overflow default mismatch: `core/config.py` defaulted to 4; corrected to 3 to match CLAUDE.md constraint and render.yaml | Fixed — 2026-04-01 |
| Alert email hardcoded localhost URL: commodity alert emails now use `settings.frontend_base_url` (set `FRONTEND_BASE_URL=https://nextgenaitrading.vercel.app` in Render env) | Fixed — 2026-04-01 |
| Perf: v3_idea_generator_service — shared `_df_cache` dict + static `_COMPANY_NAMES` dict; eliminates 80+ duplicate yfinance downloads + `.info` calls per scheduler cycle; ~150 MB peak memory reduction | Fixed — 2026-04-01 |
| Perf: dashboard watchlist prices — new `GET /live/watchlist-prices?symbols=...` batch endpoint; frontend replaces `Promise.allSettled(N)` fan-out with single call; drops concurrent pool connections from 15→1 every 30s | Fixed — 2026-04-01 |
| Perf: options /signals — extracted `_eval_symbol` coroutine + `asyncio.gather` for all 10 symbols; module-level 60s TTL `_TREND_CACHE`; response time ~600ms vs previous 6s+ | Fixed — 2026-04-01 |
| Perf: buy_signal_service — replaced direct uncapped `yf.download(period="2y")` with `load_ohlcv(period="730d")` enforcing 750-row cap and Alpaca-first routing | Fixed — 2026-04-01 |
| Perf: run_commodity_alerts — single `AsyncSessionLocal` for full function body; ORM object mutated in-place; one `db.commit()` after loop; eliminates N pool connections per alert cycle | Fixed — 2026-04-01 |
| Perf: auto_buy_engine N+1 — replaced per-iteration `SELECT users WHERE id=?` with JOIN on initial `AutoBuySettings` query; unpacked as `(settings_row, user)` tuples | Fixed — 2026-04-01 |
| Perf: greeks.py vectorization — full chain evaluated in 2 batched `pv.greeks.analytical` calls (calls + puts) instead of 400 single-element numpy array allocations per 100-contract chain | Fixed — 2026-04-01 |
| Perf: live.py chart-data — wrapped `load_ohlcv_for_strategy` + Bollinger computation in `asyncio.to_thread()`; frees event loop during blocking yfinance HTTP | Fixed — 2026-04-01 |
| Perf: shared yfinance .info cache — new `services/yfinance_cache.py` with 30-min TTL; `entry_priority_service` + `financial_quality_service` both use `get_ticker_info()` instead of direct `yf.Ticker(t).info`; saves ~20 MB per enrichment cycle | Fixed — 2026-04-01 |
| Perf: live.py /positions — added `limit: int = Query(default=50, ge=1, le=200)` param + `.limit(limit)` on query (was unbounded) | Fixed — 2026-04-01 |
| Perf: market-stream.ts symbolKey — wrapped in `useMemo([symbols])` to prevent SSE reconnect storms on parent re-renders | Fixed — 2026-04-01 |
| Perf: options/page.tsx Pro-mode queries — `chain`, `positions`, `greeks` queries gated with `enabled: viewMode === "pro"`; eliminates 3 polling queries when in Beginner mode | Fixed — 2026-04-01 |
| Perf: dashboard KpiCardsPanel — added `staleTime: 300_000` (5 min) to strategy runs query; was refetching every 30s on state changes | Fixed — 2026-04-01 |

## Alpaca Real-Time Streaming (2026-03-31)

Live bid/ask/trade data streamed from Alpaca WebSocket → SSE → frontend dashboard.

**Backend (`backend/app/services/alpaca_stream.py`, `backend/app/api/v1/stream.py`):**
- `AlpacaStreamManager` — module-level singleton; one WebSocket to Alpaca; reconnects with exponential backoff (1s→60s)
- Supports IEX (free, 15-min delayed) and SIP (paid, real-time) feeds via `ALPACA_FEED` env var
- Hard limit: 20 symbols subscribed; per-client queue bounded to 50 entries; stale quotes evicted after 90s
- SSE endpoint: `GET /api/v1/stream/quotes?symbols=AAPL,MSFT` — requires JWT auth; 3 event types:
  - `event: status` — stream connection state (`live`, `connecting`, `reconnecting`, `unconfigured`, etc.)
  - `event: snapshot` — full current quote map on first connect
  - `event: quote` — incremental update per symbol as data arrives
- `GET /api/v1/stream/status` — diagnostics (no auth): connected, symbol count, client count, queue depths
- Stream starts in `lifespan()` only when `ALPACA_API_KEY`+`ALPACA_SECRET_KEY` present; no-op otherwise
- Alpaca credentials never leave the backend

**Frontend (`frontend/lib/market-stream.ts`):**
- `useMarketStream(symbols: string[])` — fetch-based SSE (not `EventSource`) so `Authorization` header can be sent
- Exponential backoff reconnect (1s→30s); stable `symbols` key avoids reconnects on every render
- Returns `{ quotes: Record<string, QuoteData>, status: StreamStatus }`
- Falls back silently when unconfigured — dashboard reverts to 30s REST polling
- Cleanup on unmount: aborts fetch, clears reconnect timer

**Activate:** Set `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` in backend `.env`. No migration needed.
**Optional:** Set `ALPACA_FEED=sip` for real-time (requires paid Alpaca plan); default `iex` = free/delayed.

## Options Trading Engine (2026-03-30)

Full-stack options engine at `/options` with four integrated panels: chain scanner, Greeks dashboard, P&L modeling, signal feed.

**Backend (`backend/app/options/`):**
- `broker/base.py` — `OptionContract`, `OptionsOrderRequest`, `OptionsBrokerBase` ABC
- `broker/alpaca.py` — Alpaca v2 options API via httpx async (`/v2/options/contracts`, `/v2/orders`)
- `greeks.py` — Greeks via `py_vollib_vectorized`; analytic B-S fallback; illiquid flag (spread > 10%)
- `iv.py` — IV rank + IV percentile from 52-week `iv_history` DB table
- `scanner.py` — chain screener: delta / OI / IV rank / strategy-bias filters; excludes illiquid
- `signals.py` — 5-gate evaluation: earnings → IV rank → strategy matrix → contract selection → confidence
- `risk.py` — P&L at expiry (41 pts ±20%), max profit/loss, breakevens, POP, risk gate checks
- `calendar.py` — `get_days_to_earnings()` via yfinance; 60-min in-process LRU cache
- `executor.py` — dry-run default; live requires explicit `dry_run=False`; logs to `options_executions`

**API (`backend/app/api/v4/options.py`):** 10 routes at `/api/v4/options/` — all scoped to `current_user.id`
`GET /expirations` · `GET /chain` · `POST /scan` · `GET /signals` · `GET /positions` · `POST /execute` · `GET /risk` · `GET /greeks/portfolio` · `GET /iv/{symbol}` · `GET /executions`

**Models:** `OptionsPosition`, `OptionsExecution`, `IVHistory` — migration `f5a6b1c2d3e4`

**Frontend (`frontend/app/options/`, `frontend/components/options/`):**
- `page.tsx` — 4-panel CSS Grid; symbol search + expiration picker + dry-run/live toggle
- `OptionsChainTable.tsx` — calls ↔ puts side-by-side; ITM highlight; illiquid dimming; delta color coding
- `GreeksDashboard.tsx` — net Δ/Γ/Θ/ν KPI cards; per-position table; theta decay Recharts chart
- `PLChart.tsx` — Recharts payoff diagram; breakeven/max profit/max loss markers; risk summary stats
- `SignalCard.tsx` — approve/skip/view-chain actions; dry-run vs live badge; mutation via TanStack
- `StrategyBadge.tsx` / `IVRankBadge.tsx` — color-coded chips
- `lib/options-api.ts` — typed wrappers for all 10 endpoints

**Sidebar:** Options nav item added to Terminal group (after Auto-Buy), route `/options`

**Strategy selection matrix:**
| Trend | IV Rank | Strategy |
|---|---|---|
| bullish | >50 | cash_secured_put |
| bearish | >50 | covered_call |
| neutral | >50 | iron_condor |
| bullish | <30 | bull_call_debit |
| bearish | <30 | bear_put_debit |
| neutral | <30 | long_straddle |

**New env vars (backend `.env`):**
```env
RISK_FREE_RATE=0.05
OPTIONS_EARNINGS_BLOCK_DAYS=5
OPTIONS_MIN_IV_RANK=30
OPTIONS_MAX_SINGLE_TRADE_LOSS=500
OPTIONS_MIN_POP=0.60
OPTIONS_SCANNER_SYMBOLS=AAPL,TSLA,NVDA,SPY,QQQ,AMZN,MSFT,META,GOOGL,AMD
OPTIONS_ACTIVE_BROKER=alpaca
```

**Activate:** `pip install py_vollib_vectorized` + `alembic upgrade head`

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

## Branding
- **App name:** "NextGen Trading" (display title in sidebar, login, register, profile)
- **Tagline:** "Play Smart" (sidebar subtitle only, `text-3xs tracking-widest uppercase`)
- **Auth pages tagline:** "Work Hard, Play Hard" (login + register pages use this variant)
- **Sidebar expanded width:** `w-[190px]` (sized to fit title + pin button); collapsed: `w-12`
- **No email shown in sidebar** — removed from profile section; only "AI Trader" label remains
- Files: `frontend/components/layout/Sidebar.tsx`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/register/page.tsx`, `frontend/app/profile/page.tsx`

## Commodities Guide (`/commodities-guide`)
Beginner-friendly reference page. Linked from sidebar under **Commodities → Beginner Guide**.
- **Bilingual:** EN / Thai toggle (`translations.ts` + `tr()` helper). Same pattern as FAQ/Learn pages.
- **Sections:** What are Commodities, Key Terms (14 defs), How to Use (6 steps), Signal Engine (4-gate), Supported Symbols table, Risk Management, FAQ (9 Qs), Alert Setup (6 steps), Disclaimer
- **Files:** `frontend/app/commodities-guide/page.tsx`, `frontend/app/commodities-guide/translations.ts`
- **Language toggle pattern:** `useState<Lang>("en")` + `<LanguageToggle>` component top-right of header

## Ideas Page — Scan Universe Themes
Theme chips: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics, Bitcoin, Healthcare, Medicine (~50 tickers total including mega-cap tech, financials, energy, defense, semis, space, biotech, bitcoin/crypto-adjacent).

## Auto-Buy Page UX (2026-03-31)

Redesigned for beginner accessibility while retaining all existing backend bindings.

**Define Targets section** (`TargetFields` component):
- 2×2 grid: Symbol Search + Max Order Size (row 1) | Target Buy Price + Target Sell Price (row 2)
- Target buy/sell price fields **moved here** from Execution Timeframe section (logical grouping)
- Beginner hint banner explains each field in plain English
- `DEFAULT_SETTINGS` fallback: sections always render even before API responds (fixes blank-section bug during auth-loading window when `!!user` is still false)

**Execution Timeframe section** (`ExecutionSettings` component):
- 5-button pill selector replaces 8-option dropdown: **Live (~1 min) | 15 min | 30 min | 1 hr | 2 hrs**
- "Live" pill: distinct emerald color, "live" badge, beginner caution message on select
- `EXEC_TIMEFRAMES` constant: `value` + `label` + `sublabel` + `desc` + optional `live: true` flag
- "Max Drawdown Limit" → "Max Loss Limit" with plain description
- "Earnings Blackout" → "Avoid Earnings Days" with beginner explanation

**Sidebar childActive fix (`frontend/components/layout/Sidebar.tsx`):**
- Sub-menu child active state now uses exact `pathname === child.href` (not `startsWith`)
- Fixes Overview link incorrectly highlighted on all `/gold/*` sub-pages
