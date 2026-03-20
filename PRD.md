# Product Requirements Document: NextGenStock

**Version:** 1.0
**Date:** 2026-03-19
**Status:** Draft

---

## 1. Executive Summary

NextGenStock is a production-grade, multi-user AI trading platform that gives individual investors and quant enthusiasts a web-based interface to run algorithmic trading strategies, backtest them against historical market data, manage live or paper broker connections, and export Pine Script artifacts for use in TradingView. The platform supports stocks, ETFs, and crypto across four distinct strategy modes — from cautious signal-based approaches to AI-optimized indicator selection — all delivered through a secure, per-user isolated architecture hosted on Vercel (frontend) and Render (backend).

---

## 2. Problem Statement

Retail traders and quant hobbyists who want to run algorithmic strategies face two painful gaps: either they use complex local scripts with no UI, no multi-user support, and no persistence, or they pay for expensive institutional platforms. NextGenStock closes this gap by wrapping a Python quant engine (HMM regime detection, indicator optimization, backtesting) in a polished web application with secure multi-user accounts, encrypted broker credential management, and reproducible Pine Script exports — making quant trading workflows accessible without sacrificing technical depth.

---

## 3. Goals & Success Metrics

### Business Goals

- Ship a production-ready platform that a small team can run and maintain with zero per-user marginal infrastructure cost at launch
- Preserve 100% of existing trading, backtesting, optimization, and Pine Script logic while wrapping it in a maintainable, scalable API layer
- Establish a multi-tenant architecture that can accommodate future paid tiers, additional brokers, and scheduled signal workers without a rewrite

### User Goals

- Run any of the four strategy modes against any valid yfinance symbol without touching the command line
- Keep broker API keys confidential and securely stored, with per-provider credential profiles
- Review backtest results, leaderboards, equity curves, and generated Pine Script code in one unified interface
- Switch between paper trading and live execution safely, with a clear dry-run default

### Key Performance Indicators (KPIs)

| KPI | Target | Measurement Method |
|-----|--------|--------------------|
| Auth round-trip (login → dashboard) | < 2 seconds | Synthetic test on Render + Vercel production |
| Strategy run API response time (conservative/aggressive) | < 30 seconds p95 | Backend request logs |
| AI Pick / BLSH optimization run time | < 120 seconds p95 | Backend request logs |
| Backtest leaderboard page load | < 1.5 seconds | Browser performance panel |
| Zero cross-user data leaks | 0 incidents | Automated ownership-check test suite |
| Broker credential encryption coverage | 100% of stored keys | Code audit + DB inspection |

---

## 4. Target Users & Personas

### Primary Persona: Solo Quant Hobbyist — "Alex"

- **Role / Context:** Individual investor with programming literacy; runs Python scripts locally today; wants to graduate to a managed web platform accessible from any device
- **Key Pain Points:** No persistent history of past runs; credentials live in `.env` files on a laptop; no charting or leaderboard without writing extra code; hard to share or revisit a winning strategy
- **Jobs To Be Done:** Run a backtest on AAPL with a single click; compare ten strategy variants on a leaderboard; copy a Pine Script to TradingView; check live positions without SSH-ing into a server

### Secondary Persona: Power User / Small Fund Operator — "Morgan"

- **Role / Context:** Manages multiple broker accounts (paper + live, Alpaca + Robinhood crypto); needs strict separation of credentials and results per broker profile
- **Key Pain Points:** Accidental live order submission when testing; mixing paper and live results in reporting; no audit trail of which strategy produced which order
- **Jobs To Be Done:** Keep Alpaca paper and Alpaca live credentials separate; view a full order history per credential; be warned before any live execution; never have a dry-run result appear in live reporting

---

## 5. Scope

### In Scope (MVP)

- Full user registration, login, session management, and logout with JWT + HTTP-only cookies
- Per-user data isolation enforced at every database query and ownership check
- Four strategy modes: Conservative, Aggressive, AI Pick, Buy Low / Sell High
- Backtesting engine with trade-level results, leaderboard, and equity curve
- Broker credential management for Alpaca (stocks/ETFs) and Robinhood (crypto only)
- Fernet encryption of all stored broker API keys and secrets
- Live signal check and order execution (paper and live) routed through the abstract broker interface
- Pine Script v5 artifact generation and display for AI Pick and Buy Low / Sell High winning variants
- All six protected frontend pages: Dashboard, Strategies, Backtests, Live Trading, Artifacts, Profile
- shadcn/ui component system throughout; Lightweight Charts, Recharts, and Plotly.js for charting
- Deployment: Vercel (Next.js), Render (FastAPI), Supabase (PostgreSQL)

### Out of Scope (v1)

- Scheduled / cron-driven automated signal checks (background worker is optional infrastructure; signals are request-driven in v1)
- Mobile native apps (iOS / Android)
- Additional brokers beyond Alpaca and Robinhood
- Social or sharing features (sharing strategies or artifacts between users)
- Stripe or any payment / subscription billing
- WebSocket real-time price streaming in the UI
- Multi-factor authentication (MFA / TOTP)
- Admin panel or internal tooling for platform operators

### Future Considerations (Post-MVP)

- Scheduled signal worker on Render Background Worker service (hourly regime checks)
- Real-time WebSocket price feed via Alpaca streaming API
- Additional broker integrations (Interactive Brokers, TD Ameritrade)
- Subscription tiers with usage quotas
- Strategy sharing / marketplace
- MFA / passkey support
- Notification webhooks (Discord, Slack, email) on signal changes

---

## 6. Functional Requirements

### 6.1 Authentication & Session Management

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-01 | Users can register with email and password via `POST /auth/register` | Must Have | Password hashed with bcrypt; returns HTTP 201 |
| FR-02 | Users can log in via `POST /auth/login`; backend issues access token (15 min) and refresh token (7 days) as HTTP-only, Secure, SameSite=Lax cookies | Must Have | Tokens never exposed to JavaScript |
| FR-03 | `GET /auth/me` validates the access token cookie and returns the authenticated user object | Must Have | Used on every page load to hydrate user context |
| FR-04 | `POST /auth/refresh` validates the stored refresh token hash, checks it is not revoked and not expired, issues a new access token, and rotates the refresh token | Must Have | Old refresh token marked revoked after rotation |
| FR-05 | `POST /auth/logout` clears both cookies and sets `revoked_at` on the UserSession record | Must Have | |
| FR-06 | Frontend middleware (`middleware.ts`) reads the auth cookie and redirects to `/login` if missing or invalid on all protected routes | Must Have | |
| FR-07 | On a 401 response, the frontend attempts one silent refresh before redirecting to login | Must Have | Prevents spurious logouts on near-expiry tokens |
| FR-08 | Tokens are never stored in `localStorage` or `sessionStorage` | Must Have | Security non-negotiable |

### 6.2 Multi-Tenant Data Isolation

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-09 | Every user-owned database table contains a `user_id` foreign key | Must Have | |
| FR-10 | Every database query in the backend is scoped with `WHERE user_id = current_user.id` | Must Have | |
| FR-11 | User IDs are always derived from the validated JWT, never from request body or query parameters | Must Have | |
| FR-12 | An `assert_ownership(record, current_user)` utility is called in every service method before returning or modifying a record; returns HTTP 403 on mismatch | Must Have | |

### 6.3 User Profile Management

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-13 | `GET /profile` returns the current user's profile (display name, timezone, default symbol, default mode) | Must Have | |
| FR-14 | `PATCH /profile` allows the user to update display name, timezone, default symbol, and default strategy mode | Must Have | |
| FR-15 | Profile page renders a form with current values pre-populated; submission shows a success toast | Must Have | |

### 6.4 Broker Credential Management

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-16 | `GET /broker/credentials` lists all broker credential profiles for the current user (masked summaries, never decrypted values) | Must Have | |
| FR-17 | `POST /broker/credentials` accepts provider (`alpaca` or `robinhood`), profile name, api key, secret key, and (for Alpaca) a paper trading toggle; encrypts both key fields with Fernet before storing | Must Have | |
| FR-18 | `PATCH /broker/credentials/{id}` allows updating a credential profile; re-encrypts updated key fields | Must Have | |
| FR-19 | `DELETE /broker/credentials/{id}` hard-deletes the credential record after ownership check | Must Have | |
| FR-20 | `POST /broker/credentials/{id}/test` calls `client.ping()` and returns only `{ "ok": true/false }` | Must Have | Decrypted keys never returned |
| FR-21 | Frontend credential form adapts its fields based on selected provider (Alpaca shows paper toggle; Robinhood shows crypto-only warning alert) | Must Have | |
| FR-22 | Each saved credential displays a badge: green "Alpaca - Stocks & ETFs" or amber "Robinhood - Crypto only" | Must Have | |
| FR-23 | Alpaca is the default pre-selected provider when adding the first credential | Must Have | |
| FR-24 | Delete credential action requires a confirmation dialog before proceeding | Must Have | |

### 6.5 Strategy Execution

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-25 | All four strategy modes accept a user-supplied `symbol` (any valid yfinance ticker) and `timeframe` (`1d`, `1h`, `4h`, `1wk`) | Must Have | |
| FR-26 | Backend validates the symbol by attempting a yfinance fetch before accepting the run; returns HTTP 422 with message `"Symbol 'XYZ' not found or returned no data"` on failure | Must Have | |
| FR-27 | Conservative mode runs with leverage 2.5x, minimum 7/8 confirmations, trailing stop disabled | Must Have | |
| FR-28 | Aggressive mode runs with leverage 4.0x, minimum 5/8 confirmations, 5% trailing stop | Must Have | |
| FR-29 | AI Pick mode runs MACD + RSI + EMA indicator variants, backtests each, ranks by risk-adjusted score, selects a winner, and generates a Pine Script v5 artifact | Must Have | Default symbol BTC-USD, default timeframe 1d |
| FR-30 | Buy Low / Sell High mode runs dip/cycle strategy variants, backtests, ranks, selects winner, and generates a Pine Script v5 artifact | Must Have | Default symbol BTC-USD, default timeframe 1d |
| FR-31 | Every strategy run creates a `StrategyRun` record persisted to the database with all run parameters and results | Must Have | |
| FR-32 | The `RunStrategyRequest` schema normalises `symbol` to uppercase | Must Have | |
| FR-33 | If a user runs a stock strategy with a Robinhood credential, the backend returns HTTP 422: `"Robinhood only supports crypto symbols. Switch to Alpaca for stock trading."` | Must Have | |
| FR-34 | Leverage can be overridden by the user; if not supplied, the mode default is used | Should Have | |

### 6.6 Backtesting

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-35 | `POST /backtests/run` accepts a strategy configuration and runs the backtesting engine, persisting a `StrategyRun` and associated `BacktestTrade` records | Must Have | |
| FR-36 | `GET /backtests` returns a paginated list of all backtest runs for the current user | Must Have | |
| FR-37 | `GET /backtests/{id}` returns full run details including summary metrics | Must Have | |
| FR-38 | `GET /backtests/{id}/trades` returns the list of `BacktestTrade` records for a run | Must Have | |
| FR-39 | `GET /backtests/{id}/leaderboard` returns variant results ranked by validation score | Must Have | For AI Pick and BLSH modes |
| FR-40 | `GET /backtests/{id}/chart-data` returns chart-ready arrays: `candles`, `signals`, `equity` | Must Have | Pre-aggregated; no client-side transformation required |
| FR-41 | Backtest results include train / validation / test split returns, max drawdown, Sharpe-like score, and trade count per variant | Must Have | Stored in `VariantBacktestResult` |

### 6.7 Live Trading

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-42 | `POST /live/run-signal-check` runs the regime and signal logic for the selected symbol and returns the current signal without submitting any order | Must Have | |
| FR-43 | `POST /live/execute` submits an order to the selected broker credential; `dry_run: true` is the default and must require explicit override to disable | Must Have | |
| FR-44 | `GET /live/orders` returns recent orders from the broker (proxied via broker client) for the current user | Must Have | |
| FR-45 | `GET /live/positions` returns current open positions from the broker for the current user | Must Have | |
| FR-46 | `GET /live/status` returns broker connection status and active credential info | Must Have | |
| FR-47 | Live trading page displays a warning banner ("You are in LIVE mode — real money at risk") when dry_run is disabled | Must Have | |
| FR-48 | Enabling live trading (disabling dry_run) requires a confirmation dialog | Must Have | |
| FR-49 | Live trading page shows the active credential provider as a badge next to the broker selector | Must Have | |
| FR-50 | `GET /live/chart-data?symbol=AAPL&interval=1d` returns OHLCV candle data for the price chart | Must Have | |

### 6.8 Pine Script Artifacts

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-51 | AI Pick and Buy Low / Sell High optimization runs generate a complete Pine Script v5 code file mirroring the winning variant's logic | Must Have | |
| FR-52 | Generated artifacts are stored in `WinningStrategyArtifact` tied to `user_id` and `strategy_run_id` | Must Have | |
| FR-53 | `GET /artifacts` returns all artifacts for the current user | Must Have | |
| FR-54 | `GET /artifacts/{id}` returns artifact metadata | Must Have | |
| FR-55 | `GET /artifacts/{id}/pine-script` returns the raw Pine Script code | Must Have | |
| FR-56 | Frontend renders Pine Script code in a shadcn/ui `ScrollArea` with a one-click copy button | Must Have | |
| FR-57 | Artifacts page links each artifact back to its originating strategy run | Should Have | |
| FR-58 | Pine Script includes inline comments explaining any Python-to-Pine approximation differences | Should Have | |

### 6.9 Market Data

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-59 | Market data is fetched via `yfinance` using `load_ohlcv(symbol, interval, period)` — no hardcoded symbols or intervals | Must Have | |
| FR-60 | `load_ohlcv` validates that all required columns (`Open`, `High`, `Low`, `Close`, `Volume`) are present and the dataframe is non-empty; raises a clear `ValueError` otherwise | Must Have | |
| FR-61 | HMM-based intraday modes use `period="730d"`, `interval="1h"` | Must Have | |
| FR-62 | AI Pick and Buy Low / Sell High use `period="730d"`, `interval=<user-supplied timeframe>` | Must Have | |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Rationale |
|----|----------|-------------|-----------|
| NFR-01 | Security | Passwords stored as bcrypt hashes; plaintext never persisted or logged | Industry baseline |
| NFR-02 | Security | JWT access tokens expire in 15 minutes; refresh tokens in 7 days | Limits blast radius of a stolen token |
| NFR-03 | Security | Refresh tokens stored as hash only (bcrypt or SHA-256) in `UserSession` | Stolen DB dump cannot be replayed |
| NFR-04 | Security | Broker `api_key` and `secret_key` encrypted at rest with Fernet (`ENCRYPTION_KEY` env var) | Stolen DB dump cannot be used to trade |
| NFR-05 | Security | Decrypted broker keys are never returned in any API response, never logged | Prevents credential leakage via logs or API clients |
| NFR-06 | Security | CORS restricted to `CORS_ORIGINS` env var | Prevents cross-origin credential theft |
| NFR-07 | Security | All protected backend routes use `Depends(get_current_user)` | No unguarded endpoint |
| NFR-08 | Security | No secrets in frontend code or environment variables prefixed `NEXT_PUBLIC_` | Browser bundle is public |
| NFR-09 | Data Isolation | Every user-owned query scoped by `user_id` derived from JWT | Non-negotiable per spec |
| NFR-10 | Performance | Strategy run endpoints respond within 30 seconds p95 for Conservative and Aggressive modes | Acceptable UX for synchronous HTTP request |
| NFR-11 | Performance | AI Pick and Buy Low / Sell High optimization runs complete within 120 seconds p95 | Long-running; frontend should show a loading state |
| NFR-12 | Performance | Dashboard and list pages load within 1.5 seconds on Vercel + Render production | Derived from typical Render response times |
| NFR-13 | Reliability | Backend deployed on Render paid plan with no cold-start delays | Persistent process required for quant workloads |
| NFR-14 | Reliability | Database migrations managed by Alembic; no manual schema changes | Reproducible schema evolution |
| NFR-15 | Availability | PostgreSQL hosted on Supabase free tier with connection pooling enabled | Prevents connection exhaustion under concurrent users |
| NFR-16 | Maintainability | All backend models defined in `backend/app/models/`; schemas in `backend/app/schemas/` | Clear separation of ORM and API contracts |
| NFR-17 | Maintainability | Broker clients implement `AbstractBrokerClient`; strategy code is broker-agnostic | Adding a new broker requires only a new client class |
| NFR-18 | Compliance | Platform is educational / research software; a disclaimer must appear in the UI and README | Financial risk disclosure |
| NFR-19 | Observability | Backend logs must not contain decrypted credentials, raw JWT values, or plaintext passwords | Log safety |
| NFR-20 | Testability | Every functional requirement has a corresponding acceptance criterion checkable without manual intervention | Enables CI gating |

---

## 8. Authentication & Authorisation

### Method

JWT-based authentication with HTTP-only cookies. No token is ever exposed to JavaScript.

### Token Specification

| Token | Expiry | Claims | Storage |
|-------|--------|--------|---------|
| Access token | 15 minutes | `sub` (user_id), `email`, `type: "access"` | HTTP-only, Secure, SameSite=Lax cookie |
| Refresh token | 7 days | `sub`, `type: "refresh"` | HTTP-only, Secure, SameSite=Lax cookie |

### Session Persistence

- Refresh tokens are hashed (bcrypt or SHA-256) before storage in `UserSession`
- On every refresh: verify hash matches, check `revoked_at` is null, check `expires_at` is in the future, rotate token (old record revoked, new record inserted)
- On logout: set `revoked_at = now()`, clear both cookies

### Roles & Permissions

v1 has a single role: authenticated user. All resources are owned by and accessible only to the creating user. There is no admin role in scope for v1.

### FastAPI Dependency

`get_current_user` reads the access token cookie, validates signature and expiry, returns the `User` ORM object, raises HTTP 401 on any failure. All protected routes declare `Depends(get_current_user)`.

### Frontend Refresh Logic

On a 401 response, the client calls `POST /auth/refresh` once. If that succeeds, the original request is retried. If it fails, the user is redirected to `/login`.

---

## 9. Data Model (High-Level)

### Entity Relationships

All user-owned entities have a `user_id` foreign key referencing `User.id`. `StrategyRun` is the central pivot; most downstream records reference both `user_id` and `strategy_run_id`.

### Tables

| Table | Key Fields | Purpose |
|-------|------------|---------|
| `User` | id, email, password_hash, is_active, created_at, updated_at | Core identity record |
| `UserProfile` | id, user_id (FK), display_name, timezone, default_symbol, default_mode | User preferences and display settings |
| `UserSession` | id, user_id (FK), refresh_token_hash, user_agent, ip_address, created_at, expires_at, revoked_at, last_used_at | Refresh token persistence and revocation |
| `BrokerCredential` | id, user_id (FK), provider (`alpaca`/`robinhood`), profile_name, api_key (encrypted), encrypted_secret_key, base_url, is_active, created_at, updated_at | Per-provider encrypted broker credentials |
| `StrategyRun` | id, user_id (FK), created_at, run_type, mode_name, strategy_family, symbol, timeframe, leverage, min_confirmations, trailing_stop_pct, bull_state_id, bear_state_id, current_state_id, current_regime, current_signal, confirmation_count, selected_variant_name, selected_variant_score, selected_variant_reason, notes, error_message | Master record for every strategy execution |
| `TradeDecision` | id, user_id (FK), strategy_run_id (FK), created_at, symbol, timeframe, timestamp_of_bar, regime, state_id, signal, confirmation_count, entry_eligible, cooldown_active, reason_summary | Per-bar signal decision log |
| `BrokerOrder` | id, user_id (FK), strategy_run_id (FK), created_at, symbol, side, order_type, quantity, notional_usd, broker_order_id, status, submitted_price_estimate, filled_price, filled_quantity, mode_name, dry_run, error_message, raw_response_json | Submitted broker orders with dry_run flag |
| `PositionSnapshot` | id, user_id (FK), created_at, symbol, position_side, quantity, avg_entry_price, mark_price, unrealized_pnl, realized_pnl, is_open, strategy_mode | Point-in-time position snapshots |
| `CooldownState` | id, user_id (FK), symbol, cooldown_until, last_exit_time, last_exit_reason, updated_at | Per-symbol cooldown tracking |
| `TrailingStopState` | id, user_id (FK), symbol, is_active, entry_time, entry_price, highest_price_seen, trailing_stop_pct, trailing_stop_price, updated_at | Trailing stop management state |
| `VariantBacktestResult` | id, user_id (FK), strategy_run_id (FK), created_at, mode_name, variant_name, family_name, symbol, timeframe, parameter_json, train_return, validation_return, test_return, validation_score, max_drawdown, sharpe_like, trade_count, selected_winner | Per-variant backtest metrics for leaderboard |
| `WinningStrategyArtifact` | id, user_id (FK), strategy_run_id (FK), created_at, mode_name, variant_name, pine_script_version, pine_script_code, notes, selected_winner | Generated Pine Script artifacts |
| `BacktestTrade` | id, user_id (FK), strategy_run_id (FK), entry_time, exit_time, entry_price, exit_price, return_pct, leveraged_return_pct, pnl, holding_hours, exit_reason, mode_name | Individual trade records within a backtest |

### Schema Management

All schema changes are managed via Alembic migrations stored in `backend/alembic/`. No manual `ALTER TABLE` statements in production.

---

## 10. API Surface Summary

All endpoints except `POST /auth/register` and `POST /auth/login` require a valid access token cookie (`Depends(get_current_user)`).

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account; returns 201 |
| POST | `/auth/login` | Issue access + refresh cookies |
| GET | `/auth/me` | Return current user from token |
| POST | `/auth/refresh` | Rotate refresh token; issue new access token |
| POST | `/auth/logout` | Revoke session; clear cookies |

### Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Get current user profile |
| PATCH | `/profile` | Update display name, timezone, defaults |

### Broker Credentials

| Method | Path | Description |
|--------|------|-------------|
| GET | `/broker/credentials` | List credential profiles (masked) |
| POST | `/broker/credentials` | Create and encrypt new credential |
| PATCH | `/broker/credentials/{id}` | Update credential (re-encrypt keys) |
| DELETE | `/broker/credentials/{id}` | Delete credential after ownership check |
| POST | `/broker/credentials/{id}/test` | Ping broker; return `{ "ok": bool }` |

### Backtests

| Method | Path | Description |
|--------|------|-------------|
| POST | `/backtests/run` | Run backtest; persist StrategyRun + BacktestTrades |
| GET | `/backtests` | List user's backtest runs (paginated) |
| GET | `/backtests/{id}` | Full run detail with summary metrics |
| GET | `/backtests/{id}/trades` | BacktestTrade records for a run |
| GET | `/backtests/{id}/leaderboard` | Variant results ranked by score |
| GET | `/backtests/{id}/chart-data` | Chart-ready `{ candles, signals, equity }` |

### Strategies

| Method | Path | Description |
|--------|------|-------------|
| POST | `/strategies/ai-pick/run` | Run AI Pick optimization |
| POST | `/strategies/buy-low-sell-high/run` | Run Buy Low / Sell High optimization |
| GET | `/strategies/runs` | List all strategy runs |
| GET | `/strategies/runs/{id}` | Full run detail |
| GET | `/strategies/runs/{id}/optimization-chart` | Variant scatter data for Plotly |

### Live Trading

| Method | Path | Description |
|--------|------|-------------|
| POST | `/live/run-signal-check` | Run regime/signal logic; return signal without ordering |
| POST | `/live/execute` | Submit order to broker (dry_run=true by default) |
| GET | `/live/orders` | Proxied order list from broker |
| GET | `/live/positions` | Proxied positions from broker |
| GET | `/live/status` | Broker connection and credential status |
| GET | `/live/chart-data` | OHLCV candle data for a symbol |

### Artifacts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/artifacts` | List all artifacts for current user |
| GET | `/artifacts/{id}` | Artifact metadata |
| GET | `/artifacts/{id}/pine-script` | Raw Pine Script v5 code |

---

## 11. UI/UX Requirements Per Page

### Global Layout

- Fixed left sidebar containing navigation links and user avatar / email
- Main content area with consistent page header (title + contextual action buttons)
- shadcn/ui design system throughout; dark background with green (#22c55e) / red (#ef4444) signal accents
- `Toast` / `Sonner` for all success and error notifications
- Responsive layout; `Sheet` or `Drawer` for mobile navigation if the sidebar cannot fit

### `/login` (Public)

- Email and password fields using shadcn/ui `Form`, `Input`, `Label`, `Button`
- On success: redirect to `/dashboard`
- On failure: inline error message via `Toast`
- Link to `/register`

### `/register` (Public)

- Email, password, and confirm password fields
- Zod validation: email format, password minimum length, passwords must match
- On success: redirect to `/login` or auto-login to `/dashboard`
- Link to `/login`

### `/dashboard` (Protected)

- Metric cards (`Card`, `CardHeader`, `CardContent`) showing: current regime, current signal, confirmation count, most recent strategy run summary
- Broker connection status indicator
- Recent runs table (`Table`, `TableRow`, `TableCell`) — last 5–10 runs with symbol, mode, signal, created_at
- KPI sparklines using Recharts (`LineChart` or `AreaChart`) for recent PnL trend
- `Badge` components for regime (bull/bear/uncertain) and signal (buy/sell/hold)

### `/strategies` (Protected)

- `Tabs` for mode selection: Conservative | Aggressive | AI Pick | Buy Low / Sell High
- Each tab contains a run form with:
  - Symbol text input (examples shown as placeholder: `AAPL`, `BTC-USD`, `SPY`)
  - Timeframe dropdown (`1d`, `1h`, `4h`, `1wk`)
  - Leverage override (optional numeric input)
  - Dry-run toggle (default on)
  - Submit button with loading state during execution
- After run: display `StrategyRun` summary, current signal/regime, `Badge` indicators
- Price chart (Lightweight Charts `PriceChart`) with buy/sell signal markers overlaid
- For AI Pick and Buy Low / Sell High: show variant leaderboard table + Plotly `OptimizationScatter` (drawdown vs validation return)
- Link to generated artifact on the Artifacts page

### `/backtests` (Protected)

- "Run New Backtest" button opens a form (same fields as strategy run form)
- Table of past backtest runs: symbol, mode, timeframe, trade count, best variant score, created_at
- Clicking a run drills into:
  - Summary metrics cards (total return, max drawdown, Sharpe-like, trade count)
  - Equity curve (`EquityCurve` Recharts component)
  - Candlestick price chart with entry/exit signal markers (Lightweight Charts)
  - Trade-level table with entry/exit times, prices, return%, holding hours, exit reason
  - Variant leaderboard table (for AI Pick / BLSH runs) with winner highlighted

### `/live-trading` (Protected)

- Broker selector dropdown listing all active credentials with provider badge
- Symbol input and timeframe selector
- "Check Signal" button calling `POST /live/run-signal-check`; displays result in a signal card
- Dry-run toggle: ON by default; disabling requires a confirmation `Dialog` ("You are switching to LIVE mode. Real money will be used.")
- Warning `Alert` banner displayed whenever dry-run is off
- "Execute Order" button calling `POST /live/execute`
- Active provider badge displayed prominently next to broker selector
- Positions table from `GET /live/positions`
- Orders table from `GET /live/orders`
- Price chart (Lightweight Charts) for selected symbol

### `/artifacts` (Protected)

- List of all Pine Script artifacts: mode name, variant name, symbol, created_at
- Clicking an artifact shows:
  - Metadata: strategy run link, mode, variant, symbol, timeframe, date created
  - Pine Script v5 code in a shadcn/ui `ScrollArea` with syntax highlighting and a copy button
- Link back to the originating strategy run in `/strategies` or `/backtests`

### `/profile` (Protected)

- Display name and timezone form fields; "Save" button
- Default symbol and default strategy mode selectors
- Broker credentials section:
  - List of saved credentials with masked key summary, provider badge, and action buttons (Edit / Test / Delete)
  - "Add Credential" button opens a modal `Dialog` with the adaptive form:
    - Provider dropdown (Alpaca default, Robinhood crypto-only)
    - Alpaca fields: API Key ID, Secret Key (masked), Paper Trading toggle
    - Robinhood fields: API Key, Private Key (masked), plus warning `Alert`
    - Profile name input
    - "Save" and "Test Connection" buttons
  - Delete confirmation `Dialog` before removal

---

## 12. Integration Requirements

### Broker Integrations

| Service | Purpose | Auth Method | Notes |
|---------|---------|-------------|-------|
| Alpaca Markets (REST) | Stock, ETF, and crypto order execution; position and order retrieval | API Key + Secret Key (Fernet-encrypted at rest) | Default broker; paper URL: `https://paper-api.alpaca.markets`; live URL: `https://api.alpaca.markets`; SDK: `alpaca-py` |
| Robinhood (REST) | Crypto-only order execution | API Key + Private Key (Fernet-encrypted at rest) | Legacy/optional; labelled "Crypto only" in UI; returns HTTP 422 if used for stock symbols |

### Market Data Integration

| Service | Purpose | Auth Method | Notes |
|---------|---------|-------------|-------|
| yfinance | Historical OHLCV data for backtesting and strategy runs | None (public API) | `load_ohlcv(symbol, interval, period)` is the sole data loader; symbol validated before any strategy runs |

### Abstract Broker Interface

All broker clients implement `AbstractBrokerClient` with methods: `get_account()`, `place_order()`, `get_positions()`, `get_orders()`, `ping()`. The factory function `get_broker_client(credential, paper)` decrypts credentials in memory and returns the correct client instance. Decrypted values are never stored, logged, or returned.

---

## 13. Charting Technology

| Library | Assigned Use | Pages |
|---------|-------------|-------|
| Lightweight Charts (TradingView OSS) | Candlestick price charts, OHLCV bars, volume, EMA/MACD overlays, buy/sell signal markers | `/strategies`, `/live-trading`, `/backtests` |
| Recharts | Equity curve (AreaChart), cumulative PnL, drawdown, return histogram, leaderboard bar chart, dashboard KPI sparklines | `/dashboard`, `/backtests`, `/strategies` |
| Plotly.js | AI Pick / BLSH optimization scatter plots (drawdown vs validation return), regime heatmaps, candlestick + indicator subplots for research | `/strategies` (AI Pick and BLSH tabs only) |

Plotly must be imported via `dynamic(..., { ssr: false })` in Next.js App Router. Chart data endpoints return pre-aggregated, time-sorted arrays — no client-side transformation of raw database rows.

---

## 14. Platform & Deployment

- **Frontend Platform:** Next.js 14+ with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Frontend Hosting:** Vercel (free tier) — zero-config Git deploys; App Router, middleware, and server components all supported natively
- **Backend Platform:** FastAPI with Python, SQLAlchemy 2.x async ORM, Alembic, Pydantic v2
- **Backend Hosting:** Render (existing subscription) — Dockerized Python, persistent process (no cold starts on paid plans), env var management, auto-deploy from Git
- **Database:** PostgreSQL on Supabase (free tier) with connection pooling; Render built-in PostgreSQL is an alternative if single-vendor is preferred
- **Background Workers:** Render Background Worker service — optional in v1; only required when scheduled signal checks are added post-MVP
- **Offline Support:** None required; the platform is fully online
- **Browser Targets:** Modern evergreen browsers (Chrome 110+, Firefox 110+, Safari 16+, Edge 110+); no IE support
- **Do not host FastAPI on Vercel** — serverless timeout (10 seconds on hobby plan) is incompatible with quant workloads and HMM model computation

### Environment Variables

#### Backend (`.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/db` |
| `SECRET_KEY` | JWT signing secret (strong random value) |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `ENCRYPTION_KEY` | Fernet 32-byte base64 URL-safe key for broker credential encryption |
| `CORS_ORIGINS` | Comma-separated allowed origins (e.g. `http://localhost:3000,https://nextgenstock.vercel.app`) |
| `COOKIE_SECURE` | `false` in dev, `true` in production |
| `COOKIE_SAMESITE` | `lax` |
| `ALPACA_BASE_URL` | `https://api.alpaca.markets` |
| `ALPACA_PAPER_URL` | `https://paper-api.alpaca.markets` |
| `ALPACA_DATA_URL` | `https://data.alpaca.markets` |
| `ROBINHOOD_BASE_URL` | `https://trading.robinhood.com` |

#### Frontend (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI backend base URL (e.g. `http://localhost:8000`) |

---

## 15. Technology Stack Summary

### Frontend

| Technology | Version / Notes |
|-----------|-----------------|
| Next.js | 14+ with App Router |
| TypeScript | Strict mode |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Component library throughout |
| React Hook Form + Zod | All form validation |
| TanStack Query | Server state management and caching |
| Lightweight Charts | Candlestick / OHLCV price charts |
| Recharts | Equity curve, PnL, drawdown, KPI charts |
| Plotly.js / react-plotly.js | Optimization scatter plots, heatmaps |

### Backend

| Technology | Version / Notes |
|-----------|-----------------|
| FastAPI | Latest stable |
| Pydantic | v2 |
| SQLAlchemy | 2.x async ORM |
| Alembic | Migration management |
| PostgreSQL | Target database |
| passlib / pwdlib | Password hashing (bcrypt) |
| python-jose | JWT signing and verification |
| cryptography (Fernet) | Broker credential encryption |
| yfinance | Market data loader |
| pandas, numpy | Data manipulation |
| hmmlearn | Hidden Markov Model for regime detection |
| scikit-learn | ML utilities |
| ta / pandas_ta | Technical indicators |
| alpaca-py | Alpaca broker SDK |

---

## 16. Security Checklist (Acceptance Gate)

The following must all be true before any release:

- Passwords hashed with bcrypt; never stored plaintext
- JWTs signed with `SECRET_KEY`; access tokens expire in 15 minutes
- Refresh tokens stored as hash only; raw token never persisted
- All protected routes use `Depends(get_current_user)`
- All DB queries scoped by `user_id` from validated token
- `assert_ownership()` called before returning or modifying any user-owned record
- Broker private keys encrypted at rest with Fernet
- Decrypted keys never returned in any API response
- No secrets in frontend code or logs
- CORS restricted to `CORS_ORIGINS`
- Confirmation dialog required before enabling live trading
- `dry_run: true` is the default for all live execution endpoints

---

## 17. Acceptance Criteria

The implementation is complete only when all of the following pass:

1. Users can register with email and password
2. Users can log in and receive JWT cookies
3. Sessions persist across page refresh via `/auth/me`
4. Refresh flow renews access token without re-login
5. Logout clears cookies and revokes the refresh token
6. All protected frontend routes redirect unauthenticated users to `/login`
7. All protected backend routes return 401 or 403 without a valid JWT
8. User A cannot access User B's runs, orders, credentials, or artifacts
9. Broker credentials are encrypted in the database; decrypted keys are never returned by the API
10. Conservative, Aggressive, AI Pick, and Buy Low / Sell High modes work end-to-end via the API with any valid yfinance symbol
11. Optimized modes (AI Pick, BLSH) produce a variant leaderboard, a selected winner, and a Pine Script v5 artifact
12. Pine Script artifacts are displayed in a copyable code block on `/artifacts`
13. Dashboard shows accurate, per-user data only
14. All shadcn/ui components are used consistently; pages are production-ready in appearance

---

## 18. Constraints & Assumptions

### Constraints

- **Budget:** Zero additional infrastructure cost beyond the existing Render subscription; Vercel free tier and Supabase free tier must be sufficient at launch
- **Timeline:** Not specified; implementation should proceed incrementally — one logical unit at a time with lint, type checks, and test validation after each unit
- **Team:** Small team (likely solo or pair); architecture must be maintainable without dedicated DevOps
- **Stack:** Stack is fixed as specified; no substitutions (e.g. do not replace FastAPI with Django, do not replace Vercel with Netlify, do not replace PostgreSQL with MongoDB)
- **Compliance:** No HIPAA or PCI DSS requirements; standard web security practices apply; platform must carry a financial risk disclaimer ("educational software; live trading carries real financial risk")
- **Broker:** Alpaca is the default and primary broker; Robinhood support is legacy/optional and crypto-only

### Assumptions

- The existing Python strategy, backtesting, and Pine Script logic is correct and will be preserved as-is; this project wraps it in an API layer, not rewritten
- `yfinance` data availability is sufficient for the target symbols and timeframes; no premium market data subscription is required
- Supabase free tier connection limits are sufficient for the expected concurrent user count at launch
- Robinhood's API is accessible and stable; the `RobinhoodClient` implementation follows the same `AbstractBrokerClient` interface as Alpaca
- Paper trading vs. live trading distinction is controlled by the `paper` flag passed to `get_broker_client()`, which is driven by the credential's `base_url` or a per-request `dry_run` parameter
- The HMM model and all scikit-learn/hmmlearn dependencies can be installed on Render without custom build steps

---

## 19. Open Questions

| # | Question | Owner | Impact |
|---|----------|-------|--------|
| OQ-01 | Should the Robinhood client use the official Robinhood crypto API or a third-party library? The spec references a REST API but does not specify the SDK. | Engineering | Implementation effort for `RobinhoodClient` |
| OQ-02 | Is pagination required on `/backtests`, `/strategies/runs`, and `/artifacts` at launch, or is a simple time-ordered list sufficient? | Product | API contract and frontend list component design |
| OQ-03 | Should the live trading page poll `GET /live/positions` and `GET /live/orders` on a timer, or only refresh on user action? | Product / Engineering | Frontend complexity and Render load |
| OQ-04 | What is the maximum number of strategy variants to run in AI Pick and Buy Low / Sell High optimization? A higher count increases quality but extends the 120-second target runtime. | Engineering | NFR-11 compliance |
| OQ-05 | Is a `GET /backtests/{id}/chart-data` endpoint (chart-ready OHLCV + signals) sufficient, or does the frontend also need a separate raw OHLCV endpoint for custom chart ranges? | Engineering | API surface scope |
| OQ-06 | Should `WinningStrategyArtifact` store the full Pine Script in the database column, or should it be stored in object storage (e.g. Supabase Storage) and referenced by URL? Large scripts in a text column are fine at small scale but may need revisiting. | Engineering | Storage strategy for artifacts |
| OQ-07 | Is there a requirement to display a financial risk disclaimer on the live trading page in addition to the README? | Legal / Product | UI requirement for `/live-trading` |

---

## 20. Appendix

### A. Directory Structure (Canonical)

```
frontend/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
    dashboard/page.tsx
    strategies/page.tsx
    backtests/page.tsx
    live-trading/page.tsx
    artifacts/page.tsx
    profile/page.tsx
  components/
    ui/                     # shadcn/ui generated components
    layout/                 # sidebar, nav, shell
    charts/                 # PriceChart, EquityCurve, OptimizationScatter
    strategy/               # mode-specific panels
  hooks/
  lib/
    api.ts                  # typed fetch abstraction
    auth.ts                 # session helpers (getCurrentUser, refresh logic)
  types/
  middleware.ts             # route protection (redirect to /login)

backend/
  app/
    main.py
    core/
      config.py
      security.py           # JWT signing, cookie helpers
    auth/
      router.py
      service.py
      dependencies.py       # get_current_user
    api/
      profile.py
      broker.py
      backtests.py
      strategies.py
      live.py
      artifacts.py
    models/                 # SQLAlchemy ORM models (one file per table or grouped)
    schemas/                # Pydantic request/response schemas
    db/
      session.py
      base.py
    broker/
      base.py               # AbstractBrokerClient + OrderResult
      alpaca_client.py
      robinhood_client.py
      factory.py            # get_broker_client(credential, paper) -> client
    services/
      credential_service.py # encrypt / decrypt helpers
      execution_service.py
      strategy_run_service.py
    strategies/
      conservative.py
      aggressive.py
    optimizers/
      ai_pick_optimizer.py
      buy_low_sell_high_optimizer.py
    backtesting/
      engine.py
    artifacts/
      pine_script_generator.py
  alembic/
  requirements.txt
  .env.example
```

### B. Strategy Mode Quick Reference

| Mode | Leverage | Min Confirmations | Trailing Stop | Default Symbol | Timeframes | Pine Script |
|------|----------|-------------------|---------------|----------------|------------|-------------|
| Conservative | 2.5x | 7/8 | Disabled | User-supplied | 1d, 1h | No |
| Aggressive | 4.0x | 5/8 | 5% | User-supplied | 1d, 1h | No |
| AI Pick | User override | — | — | BTC-USD | 1d, 1h, 4h, 1wk | Yes (winning variant) |
| Buy Low / Sell High | User override | — | — | BTC-USD | 1d, 1h, 4h, 1wk | Yes (winning variant) |

### C. Hosting Cost Summary

| Layer | Service | Tier | Marginal Cost |
|-------|---------|------|---------------|
| Next.js frontend | Vercel | Free | $0 |
| FastAPI backend | Render | Existing subscription | $0 additional |
| PostgreSQL | Supabase | Free | $0 |
| Background worker | Render | Existing subscription | $0 additional (if needed) |

### D. Glossary

| Term | Definition |
|------|-----------|
| HMM | Hidden Markov Model — used for market regime detection (bull/bear/uncertain) |
| Regime | The inferred market state: bull, bear, or uncertain |
| Signal | The trading action output: buy, sell, or hold |
| Dry run | Order execution mode where logic runs but no real order is submitted to the broker |
| Pine Script | TradingView's proprietary scripting language for strategy indicators; exported as v5 |
| Artifact | A generated Pine Script v5 file tied to a winning strategy variant |
| Fernet | Symmetric authenticated encryption from the Python `cryptography` library |
| Variant | A specific parameterisation of a strategy (e.g. MACD(12,26) + RSI(14) combination) |
| Leaderboard | Ranked table of all tested variants for a single optimization run |
| BLSH | Buy Low / Sell High — one of the four strategy modes |

---

*This document is a product requirements specification for engineering and planning purposes. NextGenStock is educational and research software. Live trading carries real financial risk. Past backtest performance does not guarantee future results.*
