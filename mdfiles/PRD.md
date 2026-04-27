# NextGenStock — Product Requirements Document

## Part 1: Core Trading Platform (V1)

**Version:** 1.0
**Date:** 2026-03-19
**Status:** Draft

---

### 1. Executive Summary

NextGenStock is a production-grade, multi-user AI trading platform that gives individual investors and quant enthusiasts a web-based interface to run algorithmic trading strategies, backtest them against historical market data, manage live or paper broker connections, and export Pine Script artifacts for use in TradingView. The platform supports stocks, ETFs, and crypto across four distinct strategy modes — from cautious signal-based approaches to AI-optimized indicator selection — all delivered through a secure, per-user isolated architecture hosted on Vercel (frontend) and Render (backend).

---

### 2. Problem Statement

Retail traders and quant hobbyists who want to run algorithmic strategies face two painful gaps: either they use complex local scripts with no UI, no multi-user support, and no persistence, or they pay for expensive institutional platforms. NextGenStock closes this gap by wrapping a Python quant engine (HMM regime detection, indicator optimization, backtesting) in a polished web application with secure multi-user accounts, encrypted broker credential management, and reproducible Pine Script exports — making quant trading workflows accessible without sacrificing technical depth.

---

### 3. Goals & Success Metrics

#### Business Goals

- Ship a production-ready platform that a small team can run and maintain with zero per-user marginal infrastructure cost at launch
- Preserve 100% of existing trading, backtesting, optimization, and Pine Script logic while wrapping it in a maintainable, scalable API layer
- Establish a multi-tenant architecture that can accommodate future paid tiers, additional brokers, and scheduled signal workers without a rewrite

#### User Goals

- Run any of the four strategy modes against any valid yfinance symbol without touching the command line
- Keep broker API keys confidential and securely stored, with per-provider credential profiles
- Review backtest results, leaderboards, equity curves, and generated Pine Script code in one unified interface
- Switch between paper trading and live execution safely, with a clear dry-run default

#### Key Performance Indicators (KPIs)

| KPI | Target | Measurement Method |
|-----|--------|--------------------|
| Auth round-trip (login → dashboard) | < 2 seconds | Synthetic test on Render + Vercel production |
| Strategy run API response time (conservative/aggressive) | < 30 seconds p95 | Backend request logs |
| AI Pick / BLSH optimization run time | < 120 seconds p95 | Backend request logs |
| Backtest leaderboard page load | < 1.5 seconds | Browser performance panel |
| Zero cross-user data leaks | 0 incidents | Automated ownership-check test suite |
| Broker credential encryption coverage | 100% of stored keys | Code audit + DB inspection |

---

### 4. Target Users & Personas

#### Primary Persona: Solo Quant Hobbyist — "Alex"

- **Role / Context:** Individual investor with programming literacy; runs Python scripts locally today; wants to graduate to a managed web platform accessible from any device
- **Key Pain Points:** No persistent history of past runs; credentials live in `.env` files on a laptop; no charting or leaderboard without writing extra code; hard to share or revisit a winning strategy
- **Jobs To Be Done:** Run a backtest on AAPL with a single click; compare ten strategy variants on a leaderboard; copy a Pine Script to TradingView; check live positions without SSH-ing into a server

#### Secondary Persona: Power User / Small Fund Operator — "Morgan"

- **Role / Context:** Manages multiple broker accounts (paper + live, Alpaca + Robinhood crypto); needs strict separation of credentials and results per broker profile
- **Key Pain Points:** Accidental live order submission when testing; mixing paper and live results in reporting; no audit trail of which strategy produced which order
- **Jobs To Be Done:** Keep Alpaca paper and Alpaca live credentials separate; view a full order history per credential; be warned before any live execution; never have a dry-run result appear in live reporting

---

### 5. Scope

#### In Scope (MVP)

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

#### Out of Scope (v1)

- Scheduled / cron-driven automated signal checks (background worker is optional infrastructure; signals are request-driven in v1)
- Mobile native apps (iOS / Android)
- Additional brokers beyond Alpaca and Robinhood
- Social or sharing features (sharing strategies or artifacts between users)
- Stripe or any payment / subscription billing
- WebSocket real-time price streaming in the UI
- Multi-factor authentication (MFA / TOTP)
- Admin panel or internal tooling for platform operators

#### Future Considerations (Post-MVP)

- Scheduled signal worker on Render Background Worker service (hourly regime checks)
- Real-time WebSocket price feed via Alpaca streaming API
- Additional broker integrations (Interactive Brokers, TD Ameritrade)
- Subscription tiers with usage quotas
- Strategy sharing / marketplace
- MFA / passkey support
- Notification webhooks (Discord, Slack, email) on signal changes

---

### 6. Functional Requirements

#### 6.1 Authentication & Session Management

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

#### 6.2 Multi-Tenant Data Isolation

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-09 | Every user-owned database table contains a `user_id` foreign key | Must Have | |
| FR-10 | Every database query in the backend is scoped with `WHERE user_id = current_user.id` | Must Have | |
| FR-11 | User IDs are always derived from the validated JWT, never from request body or query parameters | Must Have | |
| FR-12 | An `assert_ownership(record, current_user)` utility is called in every service method before returning or modifying a record; returns HTTP 403 on mismatch | Must Have | |

#### 6.3 User Profile Management

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-13 | `GET /profile` returns the current user's profile (display name, timezone, default symbol, default mode) | Must Have | |
| FR-14 | `PATCH /profile` allows the user to update display name, timezone, default symbol, and default strategy mode | Must Have | |
| FR-15 | Profile page renders a form with current values pre-populated; submission shows a success toast | Must Have | |

#### 6.4 Broker Credential Management

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

#### 6.5 Strategy Execution

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

#### 6.6 Backtesting

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-35 | `POST /backtests/run` accepts a strategy configuration and runs the backtesting engine, persisting a `StrategyRun` and associated `BacktestTrade` records | Must Have | |
| FR-36 | `GET /backtests` returns a paginated list of all backtest runs for the current user | Must Have | |
| FR-37 | `GET /backtests/{id}` returns full run details including summary metrics | Must Have | |
| FR-38 | `GET /backtests/{id}/trades` returns the list of `BacktestTrade` records for a run | Must Have | |
| FR-39 | `GET /backtests/{id}/leaderboard` returns variant results ranked by validation score | Must Have | For AI Pick and BLSH modes |
| FR-40 | `GET /backtests/{id}/chart-data` returns chart-ready arrays: `candles`, `signals`, `equity` | Must Have | Pre-aggregated; no client-side transformation required |
| FR-41 | Backtest results include train / validation / test split returns, max drawdown, Sharpe-like score, and trade count per variant | Must Have | Stored in `VariantBacktestResult` |

#### 6.7 Live Trading

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

#### 6.8 Pine Script Artifacts

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

#### 6.9 Market Data

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-59 | Market data is fetched via `yfinance` using `load_ohlcv(symbol, interval, period)` — no hardcoded symbols or intervals | Must Have | |
| FR-60 | `load_ohlcv` validates that all required columns (`Open`, `High`, `Low`, `Close`, `Volume`) are present and the dataframe is non-empty; raises a clear `ValueError` otherwise | Must Have | |
| FR-61 | HMM-based intraday modes use `period="730d"`, `interval="1h"` | Must Have | |
| FR-62 | AI Pick and Buy Low / Sell High use `period="730d"`, `interval=<user-supplied timeframe>` | Must Have | |

---

### 7. Non-Functional Requirements

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

### 8. Authentication & Authorisation

#### Method

JWT-based authentication with HTTP-only cookies. No token is ever exposed to JavaScript.

#### Token Specification

| Token | Expiry | Claims | Storage |
|-------|--------|--------|---------|
| Access token | 15 minutes | `sub` (user_id), `email`, `type: "access"` | HTTP-only, Secure, SameSite=Lax cookie |
| Refresh token | 7 days | `sub`, `type: "refresh"` | HTTP-only, Secure, SameSite=Lax cookie |

#### Session Persistence

- Refresh tokens are hashed (bcrypt or SHA-256) before storage in `UserSession`
- On every refresh: verify hash matches, check `revoked_at` is null, check `expires_at` is in the future, rotate token (old record revoked, new record inserted)
- On logout: set `revoked_at = now()`, clear both cookies

#### Roles & Permissions

v1 has a single role: authenticated user. All resources are owned by and accessible only to the creating user. There is no admin role in scope for v1.

#### FastAPI Dependency

`get_current_user` reads the access token cookie, validates signature and expiry, returns the `User` ORM object, raises HTTP 401 on any failure. All protected routes declare `Depends(get_current_user)`.

#### Frontend Refresh Logic

On a 401 response, the client calls `POST /auth/refresh` once. If that succeeds, the original request is retried. If it fails, the user is redirected to `/login`.

---

### 9. Data Model (High-Level)

#### Entity Relationships

All user-owned entities have a `user_id` foreign key referencing `User.id`. `StrategyRun` is the central pivot; most downstream records reference both `user_id` and `strategy_run_id`.

#### Tables

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

#### Schema Management

All schema changes are managed via Alembic migrations stored in `backend/alembic/`. No manual `ALTER TABLE` statements in production.

---

### 10. API Surface Summary

All endpoints except `POST /auth/register` and `POST /auth/login` require a valid access token cookie (`Depends(get_current_user)`).

#### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account; returns 201 |
| POST | `/auth/login` | Issue access + refresh cookies |
| GET | `/auth/me` | Return current user from token |
| POST | `/auth/refresh` | Rotate refresh token; issue new access token |
| POST | `/auth/logout` | Revoke session; clear cookies |

#### Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Get current user profile |
| PATCH | `/profile` | Update display name, timezone, defaults |

#### Broker Credentials

| Method | Path | Description |
|--------|------|-------------|
| GET | `/broker/credentials` | List credential profiles (masked) |
| POST | `/broker/credentials` | Create and encrypt new credential |
| PATCH | `/broker/credentials/{id}` | Update credential (re-encrypt keys) |
| DELETE | `/broker/credentials/{id}` | Delete credential after ownership check |
| POST | `/broker/credentials/{id}/test` | Ping broker; return `{ "ok": bool }` |

#### Backtests

| Method | Path | Description |
|--------|------|-------------|
| POST | `/backtests/run` | Run backtest; persist StrategyRun + BacktestTrades |
| GET | `/backtests` | List user's backtest runs (paginated) |
| GET | `/backtests/{id}` | Full run detail with summary metrics |
| GET | `/backtests/{id}/trades` | BacktestTrade records for a run |
| GET | `/backtests/{id}/leaderboard` | Variant results ranked by score |
| GET | `/backtests/{id}/chart-data` | Chart-ready `{ candles, signals, equity }` |

#### Strategies

| Method | Path | Description |
|--------|------|-------------|
| POST | `/strategies/ai-pick/run` | Run AI Pick optimization |
| POST | `/strategies/buy-low-sell-high/run` | Run Buy Low / Sell High optimization |
| GET | `/strategies/runs` | List all strategy runs |
| GET | `/strategies/runs/{id}` | Full run detail |
| GET | `/strategies/runs/{id}/optimization-chart` | Variant scatter data for Plotly |

#### Live Trading

| Method | Path | Description |
|--------|------|-------------|
| POST | `/live/run-signal-check` | Run regime/signal logic; return signal without ordering |
| POST | `/live/execute` | Submit order to broker (dry_run=true by default) |
| GET | `/live/orders` | Proxied order list from broker |
| GET | `/live/positions` | Proxied positions from broker |
| GET | `/live/status` | Broker connection and credential status |
| GET | `/live/chart-data` | OHLCV candle data for a symbol |

#### Artifacts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/artifacts` | List all artifacts for current user |
| GET | `/artifacts/{id}` | Artifact metadata |
| GET | `/artifacts/{id}/pine-script` | Raw Pine Script v5 code |

---

### 11. UI/UX Requirements Per Page

#### Global Layout

- Fixed left sidebar containing navigation links and user avatar / email
- Main content area with consistent page header (title + contextual action buttons)
- shadcn/ui design system throughout; dark background with green (#22c55e) / red (#ef4444) signal accents
- `Toast` / `Sonner` for all success and error notifications
- Responsive layout; `Sheet` or `Drawer` for mobile navigation if the sidebar cannot fit

#### `/login` (Public)

- Email and password fields using shadcn/ui `Form`, `Input`, `Label`, `Button`
- On success: redirect to `/dashboard`
- On failure: inline error message via `Toast`
- Link to `/register`

#### `/register` (Public)

- Email, password, and confirm password fields
- Zod validation: email format, password minimum length, passwords must match
- On success: redirect to `/login` or auto-login to `/dashboard`
- Link to `/login`

#### `/dashboard` (Protected)

- Metric cards (`Card`, `CardHeader`, `CardContent`) showing: current regime, current signal, confirmation count, most recent strategy run summary
- Broker connection status indicator
- Recent runs table (`Table`, `TableRow`, `TableCell`) — last 5–10 runs with symbol, mode, signal, created_at
- KPI sparklines using Recharts (`LineChart` or `AreaChart`) for recent PnL trend
- `Badge` components for regime (bull/bear/uncertain) and signal (buy/sell/hold)

#### `/strategies` (Protected)

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

#### `/backtests` (Protected)

- "Run New Backtest" button opens a form (same fields as strategy run form)
- Table of past backtest runs: symbol, mode, timeframe, trade count, best variant score, created_at
- Clicking a run drills into:
  - Summary metrics cards (total return, max drawdown, Sharpe-like, trade count)
  - Equity curve (`EquityCurve` Recharts component)
  - Candlestick price chart with entry/exit signal markers (Lightweight Charts)
  - Trade-level table with entry/exit times, prices, return%, holding hours, exit reason
  - Variant leaderboard table (for AI Pick / BLSH runs) with winner highlighted

#### `/live-trading` (Protected)

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

#### `/artifacts` (Protected)

- List of all Pine Script artifacts: mode name, variant name, symbol, created_at
- Clicking an artifact shows:
  - Metadata: strategy run link, mode, variant, symbol, timeframe, date created
  - Pine Script v5 code in a shadcn/ui `ScrollArea` with syntax highlighting and a copy button
- Link back to the originating strategy run in `/strategies` or `/backtests`

#### `/profile` (Protected)

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

### 12. Integration Requirements

#### Broker Integrations

| Service | Purpose | Auth Method | Notes |
|---------|---------|-------------|-------|
| Alpaca Markets (REST) | Stock, ETF, and crypto order execution; position and order retrieval | API Key + Secret Key (Fernet-encrypted at rest) | Default broker; paper URL: `https://paper-api.alpaca.markets`; live URL: `https://api.alpaca.markets`; SDK: `alpaca-py` |
| Robinhood (REST) | Crypto-only order execution | API Key + Private Key (Fernet-encrypted at rest) | Legacy/optional; labelled "Crypto only" in UI; returns HTTP 422 if used for stock symbols |

#### Market Data Integration

| Service | Purpose | Auth Method | Notes |
|---------|---------|-------------|-------|
| yfinance | Historical OHLCV data for backtesting and strategy runs | None (public API) | `load_ohlcv(symbol, interval, period)` is the sole data loader; symbol validated before any strategy runs |

#### Abstract Broker Interface

All broker clients implement `AbstractBrokerClient` with methods: `get_account()`, `place_order()`, `get_positions()`, `get_orders()`, `ping()`. The factory function `get_broker_client(credential, paper)` decrypts credentials in memory and returns the correct client instance. Decrypted values are never stored, logged, or returned.

---

### 13. Charting Technology

| Library | Assigned Use | Pages |
|---------|-------------|-------|
| Lightweight Charts (TradingView OSS) | Candlestick price charts, OHLCV bars, volume, EMA/MACD overlays, buy/sell signal markers | `/strategies`, `/live-trading`, `/backtests` |
| Recharts | Equity curve (AreaChart), cumulative PnL, drawdown, return histogram, leaderboard bar chart, dashboard KPI sparklines | `/dashboard`, `/backtests`, `/strategies` |
| Plotly.js | AI Pick / BLSH optimization scatter plots (drawdown vs validation return), regime heatmaps, candlestick + indicator subplots for research | `/strategies` (AI Pick and BLSH tabs only) |

Plotly must be imported via `dynamic(..., { ssr: false })` in Next.js App Router. Chart data endpoints return pre-aggregated, time-sorted arrays — no client-side transformation of raw database rows.

---

### 14. Platform & Deployment

- **Frontend Platform:** Next.js 14+ with App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Frontend Hosting:** Vercel (free tier) — zero-config Git deploys; App Router, middleware, and server components all supported natively
- **Backend Platform:** FastAPI with Python, SQLAlchemy 2.x async ORM, Alembic, Pydantic v2
- **Backend Hosting:** Render (existing subscription) — Dockerized Python, persistent process (no cold starts on paid plans), env var management, auto-deploy from Git
- **Database:** PostgreSQL on Supabase (free tier) with connection pooling; Render built-in PostgreSQL is an alternative if single-vendor is preferred
- **Background Workers:** Render Background Worker service — optional in v1; only required when scheduled signal checks are added post-MVP
- **Offline Support:** None required; the platform is fully online
- **Browser Targets:** Modern evergreen browsers (Chrome 110+, Firefox 110+, Safari 16+, Edge 110+); no IE support
- **Do not host FastAPI on Vercel** — serverless timeout (10 seconds on hobby plan) is incompatible with quant workloads and HMM model computation

#### Environment Variables

##### Backend (`.env`)

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

##### Frontend (`.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI backend base URL (e.g. `http://localhost:8000`) |

---

### 15. Technology Stack Summary

#### Frontend

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

#### Backend

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

### 16. Security Checklist (Acceptance Gate)

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

### 17. Acceptance Criteria

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

### 18. Constraints & Assumptions

#### Constraints

- **Budget:** Zero additional infrastructure cost beyond the existing Render subscription; Vercel free tier and Supabase free tier must be sufficient at launch
- **Timeline:** Not specified; implementation should proceed incrementally — one logical unit at a time with lint, type checks, and test validation after each unit
- **Team:** Small team (likely solo or pair); architecture must be maintainable without dedicated DevOps
- **Stack:** Stack is fixed as specified; no substitutions (e.g. do not replace FastAPI with Django, do not replace Vercel with Netlify, do not replace PostgreSQL with MongoDB)
- **Compliance:** No HIPAA or PCI DSS requirements; standard web security practices apply; platform must carry a financial risk disclaimer ("educational software; live trading carries real financial risk")
- **Broker:** Alpaca is the default and primary broker; Robinhood support is legacy/optional and crypto-only

#### Assumptions

- The existing Python strategy, backtesting, and Pine Script logic is correct and will be preserved as-is; this project wraps it in an API layer, not rewritten
- `yfinance` data availability is sufficient for the target symbols and timeframes; no premium market data subscription is required
- Supabase free tier connection limits are sufficient for the expected concurrent user count at launch
- Robinhood's API is accessible and stable; the `RobinhoodClient` implementation follows the same `AbstractBrokerClient` interface as Alpaca
- Paper trading vs. live trading distinction is controlled by the `paper` flag passed to `get_broker_client()`, which is driven by the credential's `base_url` or a per-request `dry_run` parameter
- The HMM model and all scikit-learn/hmmlearn dependencies can be installed on Render without custom build steps

---

### 19. Open Questions

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

### 20. Appendix

#### A. Directory Structure (Canonical)

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

#### B. Strategy Mode Quick Reference

| Mode | Leverage | Min Confirmations | Trailing Stop | Default Symbol | Timeframes | Pine Script |
|------|----------|-------------------|---------------|----------------|------------|-------------|
| Conservative | 2.5x | 7/8 | Disabled | User-supplied | 1d, 1h | No |
| Aggressive | 4.0x | 5/8 | 5% | User-supplied | 1d, 1h | No |
| AI Pick | User override | — | — | BTC-USD | 1d, 1h, 4h, 1wk | Yes (winning variant) |
| Buy Low / Sell High | User override | — | — | BTC-USD | 1d, 1h, 4h, 1wk | Yes (winning variant) |

#### C. Hosting Cost Summary

| Layer | Service | Tier | Marginal Cost |
|-------|---------|------|---------------|
| Next.js frontend | Vercel | Free | $0 |
| FastAPI backend | Render | Existing subscription | $0 additional |
| PostgreSQL | Supabase | Free | $0 |
| Background worker | Render | Existing subscription | $0 additional (if needed) |

#### D. Glossary

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

## Part 2: Buy Zone, Alerts, Auto-Buy & Ideas (V2)

**Version:** 2.0
**Date:** 2026-03-24
**Status:** Draft
**Supersedes:** PRD.md (v1.0, 2026-03-19)

---

### 1. Executive Summary

This document covers the second major feature wave for NextGenStock: an Intelligent Buy Zone Estimator, a Smart Price Alert Engine, an Optional Auto-Buy Execution system, a Theme / World Trend Scoring Engine, and an Idea Pipeline with conviction-weighted watchlists. Together these five features transform the platform from a backtest-and-execute tool into a continuous market intelligence layer that surfaces high-probability entry opportunities, notifies users in real time, and optionally executes trades autonomously — all within the same secure, per-user-isolated architecture established in v1.

---

### 2. Problem Statement

The v1 platform lets users run strategies and review historical results, but it is entirely reactive: users must know which ticker to run, when to run it, and manually interpret the output. There is no proactive layer that watches a universe of stocks, identifies when conditions become favorable, or alerts the user before an opportunity passes. This gap means users either miss entries or spend significant time manually checking each ticker. The five features in this PRD close that gap by introducing a structured intelligence pipeline from idea capture through to optional automated execution.

---

### 3. Goals & Success Metrics

#### Business Goals

- Increase daily active sessions by giving users a reason to return to the platform every trading day
- Establish a defensible data moat through per-user idea history, conviction scores, and theme alignment records
- Lay the groundwork for a premium tier gated on auto-buy execution and real-time alert quotas
- Maintain zero cross-user data leaks and zero guaranteed-profit language throughout all new features

#### User Goals

- Know immediately when a tracked ticker enters a historically favorable buy zone
- Understand exactly why a buy zone was identified, not just that it was
- Save and rank investment theses without committing to a trade
- Optionally let the platform execute small positions when all risk controls pass

#### Key Performance Indicators (KPIs)

| KPI | Target | Measurement Method |
|-----|--------|--------------------|
| Buy zone calculation latency (on-demand) | < 8 seconds p95 | Backend request logs |
| Alert evaluation cycle time | < 60 seconds end-to-end | Scheduler job logs |
| Auto-buy dry-run API response | < 3 seconds p95 | Backend request logs |
| False alert rate (alert fired but zone not actually entered) | < 2% | Alert audit log sampling |
| Cross-user data access incidents | 0 | Automated ownership-check test suite |
| UI text containing banned profit language | 0 phrases | Pre-release linting scan |
| Theme score refresh staleness | < 6 hours | Scheduler completion logs |
| Buy zone snapshot staleness | < 1 hour | Scheduler completion logs |

---

### 4. Target Users & Personas

#### Primary Persona: Solo Quant Hobbyist — "Alex" (carried from v1)

- **Role / Context:** Individual investor with programming literacy; already using v1 strategy runs and backtests; wants proactive signals without building a separate monitoring script
- **Key Pain Points:** Misses entries because there is no alert when a stock pulls back into a good zone; spends time manually re-running strategies to check regime; no structured place to record why a stock is interesting
- **Jobs To Be Done:** Set a buy zone alert on NVDA and get notified when price approaches; record a thesis about AI infrastructure plays with linked tickers and a conviction rating; review ranked opportunity list each morning

#### Secondary Persona: Power User / Small Fund Operator — "Morgan" (carried from v1)

- **Role / Context:** Manages paper and live Alpaca accounts; evaluates multiple opportunities simultaneously; values audit trails above all else
- **Key Pain Points:** Cannot delegate monitoring to the platform; must manually verify each safeguard before placing a trade; no structured log of why an auto-trade was or was not executed
- **Jobs To Be Done:** Enable auto-buy only for paper mode; review the full safeguard breakdown for every blocked decision; see which tickers are closest to triggering across theme categories

#### Tertiary Persona: Theme Investor — "Jordan" (new in v2)

- **Role / Context:** Invests thematically — AI infrastructure, renewable energy, defense — and wants to track an entire basket of tickers aligned to a macro view
- **Key Pain Points:** No way to see which tickers in a theme are best positioned technically; conviction about a theme does not translate into prioritized action
- **Jobs To Be Done:** Tag a group of tickers under "AI" and "power infrastructure"; see them ranked by entry quality and theme alignment; get alerted when the highest-conviction one enters a favorable zone

---

### 5. Scope

#### In Scope (v2 MVP)

- **Feature A — Intelligent Buy Zone Estimator:** On-demand and scheduled calculation of buy zone ranges, confidence scores, expected return/drawdown estimates, and human-readable explanations for any yfinance-trackable ticker
- **Feature B — Smart Price Alert Engine:** Six alert types evaluated on a 5-minute scheduler cycle with in-app, email, and webhook notification channels; per-rule cooldown and market-hours filtering
- **Feature C — Optional Auto-Buy Execution:** Nine-safeguard decision engine; disabled by default; paper-mode default when enabled; full decision log; dry-run endpoint; broker execution via existing `factory.py`
- **Feature D — Theme / World Trend Scoring Engine:** Ten supported themes; blended score from sector mapping, user tags, and idea thesis text; 6-hour refresh cycle; theme score feeds into buy zone confidence and idea ranking
- **Feature E — Idea Pipeline and Conviction Watchlist:** CRUD idea cards with thesis text, theme tags, linked tickers, conviction slider, and watch-only guard; composite auto-ranking formula
- **Seven new database tables** with full Alembic migrations (reversible)
- **Four new frontend pages:** `/opportunities`, `/ideas`, `/alerts`, `/auto-buy`
- **Buy zone analysis panel** added to existing stock detail views
- **Background scheduler** (APScheduler) wired into FastAPI lifespan
- **Unit and integration test suites** for all five features

#### Out of Scope (v2)

- WebSocket real-time price streaming (alert evaluation remains poll-based)
- Robinhood broker execution (stub remains; auto-buy routes through Alpaca only)
- News ingestion pipeline or NLP classification (theme scoring uses sector mapping and user tags only)
- Earnings date API integration (earnings blackout uses a static or manually maintained flag in v2; live earnings calendar is post-v2)
- Mobile native apps
- Subscription billing or feature gating
- Social or sharing features between users
- Admin panel

#### Future Considerations (Post-v2)

- Real-time alert delivery via WebSocket or Alpaca streaming
- News/topic classification pipeline feeding theme scores automatically
- Live earnings calendar integration (Polygon.io or similar)
- Robinhood auto-buy support once the client is fully implemented
- User-configurable theme definitions beyond the ten built-in themes
- Strategy marketplace that exposes buy zone signals as a shareable artifact
- Notification channels: Discord webhook, Slack webhook, SMS

---

### 6. Functional Requirements

#### 6.1 Feature A — Intelligent Buy Zone Estimator

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-A01 | System calculates a buy zone for any yfinance-trackable ticker on demand via `GET /api/stocks/{ticker}/buy-zone` | Must Have | Returns latest snapshot if < 1 hour old; otherwise triggers recalculation |
| FR-A02 | Force-recalculate endpoint `POST /api/stocks/{ticker}/recalculate-buy-zone` persists a new snapshot and returns the result | Must Have | Always runs full pipeline regardless of snapshot age |
| FR-A03 | Calculation pipeline has seven independently scored layers: trend quality (0.20), pullback quality (0.20), support proximity (0.20), volatility normalization (0.10), historical analog win rate (0.20), drawdown penalty (0.05), theme alignment bonus (0.05) | Must Have | Each layer returns a sub-score 0.0–1.0 and one explanation string |
| FR-A04 | Buy zone range (`buy_zone_low`, `buy_zone_high`) is derived from ATR-adjusted support bands at the reward/risk optimum identified by analog scoring | Must Have | |
| FR-A05 | Result includes `confidence_score`, `entry_quality_score`, `expected_return_30d`, `expected_return_90d`, `expected_drawdown`, `positive_outcome_rate_30d`, `positive_outcome_rate_90d`, `invalidation_price`, `time_horizon_days` | Must Have | All fields persisted to `stock_buy_zone_snapshots` |
| FR-A06 | Result includes `explanation` array of human-readable strings, one per scoring layer plus any blocking conditions | Must Have | Displayed verbatim in UI |
| FR-A07 | `feature_payload_json` field captures raw inputs (OHLCV window, indicator values) for post-hoc auditability | Must Have | Never exposed in API response; backend-only |
| FR-A08 | `user_id` is nullable on `stock_buy_zone_snapshots`; system-wide snapshots (user_id = NULL) may be shared across users to reduce redundant computation | Should Have | Per-user recalculate always produces a user-scoped row |
| FR-A09 | Historical OHLCV data is loaded via the existing backtesting data loader, not a separate yfinance call | Must Have | Prevents duplicated data fetching logic |
| FR-A10 | Analog scoring finds historical windows with similar multi-factor state (RSI band, ATR ratio, trend slope, pullback depth) and computes forward returns at 5, 20, 60, and 120 trading days | Must Have | Minimum 5 analog matches required to produce a score; else confidence is capped at 0.40 |
| FR-A11 | Scheduler refreshes all buy zone snapshots older than 1 hour every 60 minutes | Must Have | Job is idempotent; logs start, finish, and error per ticker |
| FR-A12 | No result text uses the banned phrases listed in Section 13; all probabilistic language follows the approved vocabulary | Must Have | Enforced by pre-release linting scan |

#### 6.2 Feature B — Smart Price Alert Engine

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-B01 | Users can create, read, update, and delete `PriceAlertRule` records via `/api/alerts` CRUD endpoints | Must Have | All operations scoped by `current_user.id`; 403 on ownership mismatch |
| FR-B02 | Six alert types supported: `entered_buy_zone`, `near_buy_zone`, `below_invalidation`, `confidence_improved`, `theme_score_increased`, `macro_deterioration` | Must Have | See trigger conditions in Section 9 |
| FR-B03 | `near_buy_zone` alert uses a user-configurable `proximity_pct` threshold stored in `threshold_json` | Must Have | Default 2.0% |
| FR-B04 | `confidence_improved` fires when `confidence_score` increases by >= 0.10 versus the previous snapshot | Must Have | |
| FR-B05 | `theme_score_increased` fires when `theme_score_total` increases by >= 0.15 | Must Have | |
| FR-B06 | Each rule has a `cooldown_minutes` field (default 60) that prevents re-firing within the cooldown window after the last trigger | Must Have | |
| FR-B07 | `market_hours_only` flag (default True) suppresses alert evaluation outside NYSE market hours (09:30–16:00 ET, weekdays) | Must Have | |
| FR-B08 | Scheduler evaluates all enabled alert rules every 5 minutes | Must Have | Evaluation is idempotent across concurrent runs |
| FR-B09 | Notifications route through the `NotificationChannel` abstraction (`InAppNotification`, `EmailNotification`, `WebhookNotification`) | Must Have | v2 ships InApp; Email and Webhook are wired but configurable |
| FR-B10 | Alert evaluation results (triggered / skipped / cooldown) are written to the application log | Must Have | |
| FR-B11 | UI `/alerts` page displays all user alert rules with enable/disable toggle, alert type, threshold, and last-triggered timestamp | Must Have | |

#### 6.3 Feature C — Optional Auto-Buy Execution

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-C01 | `AutoBuySettings.enabled` defaults to `False` for every user; cannot be set to `True` without the user completing the confirmation dialog | Must Have | Dialog text: "Enabling auto-buy may result in real orders being placed. Confirm you understand the risks." |
| FR-C02 | `AutoBuySettings.paper_mode` defaults to `True`; switching to live mode requires a second explicit confirmation | Must Have | |
| FR-C03 | Nine safeguard checks must all pass before any order is submitted: `price_inside_buy_zone`, `confidence_above_threshold`, `drawdown_within_limit`, `liquidity_filter`, `spread_filter`, `not_near_earnings`, `position_size_limit`, `daily_risk_budget`, `no_duplicate_order` | Must Have | Any single failure produces decision state `blocked_by_risk` |
| FR-C04 | Every decision is persisted to `auto_buy_decision_logs` with the full safeguard breakdown (`reason_codes_json` contains PASSED or FAILED: <reason> per check) | Must Have | |
| FR-C05 | `POST /api/auto-buy/dry-run/{ticker}` runs the full decision pipeline and returns the result without submitting an order, regardless of settings | Must Have | `dry_run: true` in response |
| FR-C06 | Order submission reuses `broker/factory.py` → `get_broker_client()` → `client.place_order()` | Must Have | No new broker abstraction |
| FR-C07 | When `paper_mode=True`, route to `AlpacaClient(paper=True)`; log simulated order details without hitting live broker | Must Have | |
| FR-C08 | Decision states are: `candidate`, `ready_to_alert`, `ready_to_buy`, `blocked_by_risk`, `order_submitted`, `order_filled`, `order_rejected`, `cancelled` | Must Have | |
| FR-C09 | Scheduler evaluates auto-buy candidates every 5 minutes; candidates are tickers from user's active watchlist ideas with `tradable=True` | Must Have | |
| FR-C10 | `GET /api/auto-buy/decision-log` returns paginated log of all decisions for the current user | Must Have | |
| FR-C11 | High theme score on a poor technical setup must never override the `price_inside_buy_zone` or `confidence_above_threshold` checks | Must Have | Non-negotiable per feature spec |
| FR-C12 | UI `/auto-buy` settings panel shows each safeguard check and its current pass/fail state for the most recent dry-run result | Should Have | |

#### 6.4 Feature D — Theme / World Trend Scoring Engine

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-D01 | Ten themes are supported in v2: `ai`, `renewable_energy`, `power_infrastructure`, `data_centers`, `space_economy`, `aerospace`, `defense`, `robotics`, `semiconductors`, `cybersecurity` | Must Have | |
| FR-D02 | Theme score is a blend of: sector/industry mapping (yfinance sector field), curated ticker-to-theme tag map, user-assigned tags from watchlist ideas, and analyst notes from idea thesis text | Must Have | News classification is out of scope for v2 |
| FR-D03 | `ThemeScoreResult` includes `theme_score_total` (0.0–1.0), `theme_scores_by_category` (dict), `narrative_momentum_score`, `sector_tailwind_score`, `macro_alignment_score`, `user_conviction_score`, and `explanation` array | Must Have | |
| FR-D04 | `GET /api/stocks/{ticker}/theme-score` returns the current score; `POST /api/stocks/{ticker}/theme-score/recompute` forces a fresh calculation | Must Have | |
| FR-D05 | Scheduler refreshes all theme scores every 360 minutes | Must Have | Job is idempotent |
| FR-D06 | Theme score feeds into buy zone confidence (5% weight per FR-A03) and idea ranking formula (35% weight per FR-E03) | Must Have | |
| FR-D07 | User-assigned theme tags on a watchlist idea update the `user_conviction_score` sub-component for all linked tickers | Must Have | |
| FR-D08 | `StockThemeScore` table has no `user_id` column; scores are system-wide per ticker | Must Have | User influence is captured via `user_conviction_score` computed at query time from that user's ideas |

#### 6.5 Feature E — Idea Pipeline and Conviction Watchlist

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-E01 | Users can create, read, update, and delete `WatchlistIdea` records via `/api/ideas` CRUD endpoints | Must Have | Scoped by `current_user.id` |
| FR-E02 | Each idea has: `title`, `thesis` (free text), `conviction_score` (integer 1–10), `watch_only` flag, `tradable` flag, `tags_json` (list of theme strings), and one-or-more linked `WatchlistIdeaTicker` rows | Must Have | |
| FR-E03 | Ideas are auto-ranked by: `(theme_score_total * 0.35) + (entry_quality_score * 0.35) + (conviction_score / 10 * 0.20) + (alert_readiness_bonus * 0.10)` | Must Have | `GET /api/ideas` returns list sorted by `rank_score` descending |
| FR-E04 | Ideas with `watch_only=True` are excluded from all broker actions; the auto-buy engine skips these entirely | Must Have | |
| FR-E05 | Ideas with `tradable=False` (e.g. pre-IPO tickers) are excluded from auto-buy candidate evaluation | Must Have | |
| FR-E06 | UI `/ideas` page includes: add/edit/delete cards, thesis textarea, theme tag multi-select, linked tickers input, watch-only toggle with tooltip, conviction slider 1–10 | Must Have | |
| FR-E07 | `GET /api/ideas` response includes the computed `rank_score` for each idea | Must Have | |

---

### 7. Non-Functional Requirements

| ID | Category | Requirement | Rationale |
|----|----------|-------------|-----------|
| NFR-01 | Performance | Buy zone on-demand response: < 8 seconds p95 (cold cache) | yfinance + analog scoring is compute-heavy; set user expectation |
| NFR-02 | Performance | Dry-run auto-buy decision: < 3 seconds p95 | User-initiated, synchronous; must feel responsive |
| NFR-03 | Performance | Alert evaluation cycle completes within 60 seconds for up to 500 active rules | Scheduler fires every 5 minutes; must complete well within window |
| NFR-04 | Scalability | Scheduler jobs are idempotent and safe to run with a single worker | Render free tier has one background worker; no distributed locking required at v2 scale |
| NFR-05 | Security | All new API endpoints require `Depends(get_current_user)` | No anonymous access to buy zone, alerts, ideas, or auto-buy |
| NFR-06 | Security | All data reads and writes are scoped by `user_id`; ownership assertions use the existing `assert_ownership()` pattern | Multi-tenancy is non-negotiable |
| NFR-07 | Security | Broker API keys are never returned in auto-buy API responses; auto-buy engine reads credentials in-memory only | Consistent with v1 constraint |
| NFR-08 | Reliability | All scheduler jobs log start, completion, and any per-ticker errors | Enables debugging without stopping the scheduler |
| NFR-09 | Reliability | All new Alembic migrations implement a reversible `downgrade()` | Required for safe rollback |
| NFR-10 | Compliance | No UI text, API response, log line, or comment may use the banned profit language phrases | See Section 13; pre-release linting scan required |
| NFR-11 | Auditability | Every auto-buy order attempt (success or failure) is persisted to `auto_buy_decision_logs` before the broker call is made | Ensures an audit record exists even if the broker call hangs |
| NFR-12 | Observability | Buy zone calculation, alert evaluation, and auto-buy decisions are logged at INFO level with ticker, user_id, and outcome | Structured logs compatible with Render log drain |

---

### 8. Authentication and Authorisation

All five features are additive to the existing auth architecture. No changes to the auth layer are required.

- All new endpoints use `Depends(get_current_user)` from `auth/dependencies.py`
- Access token: 15-minute expiry, HTTP-only cookie, SameSite=Lax (unchanged)
- Refresh token: 7-day expiry, stored as SHA-256 hash in `UserSession` (unchanged)
- `auto_buy_settings.enabled = True` requires a client-side confirmation dialog before the PATCH call is made; the backend does not enforce a two-step flow — the client is responsible for the UX gate
- `auto_buy_settings.paper_mode = False` (live mode) requires a second confirmation dialog in the UI
- No new roles or permission tiers are introduced in v2; all users have identical capability access

---

### 9. Data Model (High-Level)

Seven new tables are added to the existing 14-table schema. All existing tables are unchanged.

#### `stock_buy_zone_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int, nullable, FK → users | NULL = system-wide snapshot |
| ticker | str | |
| current_price | float | |
| buy_zone_low | float | |
| buy_zone_high | float | |
| confidence_score | float | 0.0–1.0 |
| entry_quality_score | float | 0.0–1.0 |
| expected_return_30d | float | percent |
| expected_return_90d | float | percent |
| expected_drawdown | float | percent, negative |
| positive_outcome_rate_30d | float | 0.0–1.0 |
| positive_outcome_rate_90d | float | 0.0–1.0 |
| invalidation_price | float | |
| horizon_days | int | |
| explanation_json | dict | list of explanation strings |
| feature_payload_json | dict | raw inputs; not exposed in API |
| model_version | str | |
| created_at | datetime | |

#### `stock_theme_scores`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| ticker | str | system-wide, no user_id |
| theme_score_total | float | 0.0–1.0 |
| theme_scores_json | dict | per-category breakdown |
| narrative_momentum_score | float | |
| sector_tailwind_score | float | |
| macro_alignment_score | float | |
| created_at | datetime | |
| updated_at | datetime | |

#### `watchlist_ideas`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users | |
| title | str | |
| thesis | str | free text |
| conviction_score | int | 1–10 |
| watch_only | bool | default False |
| tradable | bool | default True |
| tags_json | list | theme strings |
| metadata_json | dict | extensible |
| created_at | datetime | |
| updated_at | datetime | |

#### `watchlist_idea_tickers`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| idea_id | int FK → watchlist_ideas | |
| ticker | str | |
| is_primary | bool | |

#### `price_alert_rules`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users | |
| ticker | str | |
| alert_type | str | enum: see FR-B02 |
| threshold_json | dict | e.g. {"proximity_pct": 2.0} |
| cooldown_minutes | int | default 60 |
| market_hours_only | bool | default True |
| enabled | bool | default True |
| last_triggered_at | datetime, nullable | |
| created_at | datetime | |
| updated_at | datetime | |

#### `auto_buy_settings`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users, unique | one row per user |
| enabled | bool | default False |
| paper_mode | bool | default True |
| confidence_threshold | float | default 0.70 |
| max_trade_amount | float | hard dollar cap per trade |
| max_position_percent | float | max % of portfolio per position |
| max_expected_drawdown | float | e.g. -0.10 |
| allow_near_earnings | bool | default False |
| allowed_account_ids_json | list | broker account IDs permitted to execute |
| created_at | datetime | |
| updated_at | datetime | |

#### `auto_buy_decision_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users | |
| ticker | str | |
| decision_state | str | see FR-C08 |
| reason_codes_json | list | PASSED or FAILED: <reason> per safeguard |
| signal_payload_json | dict | buy zone snapshot used |
| order_payload_json | dict, nullable | filled only if order was submitted |
| dry_run | bool | |
| created_at | datetime | |

#### Entity Relationships (new tables only)

```
users (existing)
  ├─< watchlist_ideas (user_id)
  │     └─< watchlist_idea_tickers (idea_id)
  ├─< price_alert_rules (user_id)
  ├─< auto_buy_settings (user_id, unique)
  └─< auto_buy_decision_logs (user_id)

stock_buy_zone_snapshots (user_id nullable → users)
stock_theme_scores (no user_id; system-wide)
```

---

### 10. Integrations and External Dependencies

| Service / Module | Purpose | Auth Method | Notes |
|-----------------|---------|-------------|-------|
| `backtesting/engine.py` (existing) | OHLCV data loading for buy zone calculation | Internal | Reuse data loader; do not duplicate yfinance calls |
| `broker/factory.py` (existing) | Order execution in auto-buy engine | Fernet-decrypted credentials | Paper mode routes to `AlpacaClient(paper=True)` |
| `strategies/` (existing) | Regime and signal logic for trend quality layer | Internal | Read-only reuse |
| APScheduler | Background job scheduling | N/A | Added via `apscheduler` package; wired to FastAPI lifespan |
| yfinance | Sector/industry field for theme scoring | None | Already a dependency |
| `notification_service.py` (new) | Alert delivery abstraction | Per-channel config | In-app ships v2; email/webhook are wired but require config |

---

### 11. Platform and Deployment

- **Platform:** Web (unchanged from v1)
- **Backend hosting:** Render (FastAPI on web service; APScheduler runs in-process on the same dyno)
- **Frontend hosting:** Vercel (Next.js, unchanged)
- **Database:** Supabase PostgreSQL (unchanged); seven new tables added via Alembic migrations
- **Offline support:** None; all features require an active connection
- **Browser targets:** Same as v1 — modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **Background worker:** APScheduler `AsyncIOScheduler` runs inside the FastAPI process; no separate Render Background Worker service required in v2
- **New environment variables required:**

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCHEDULER_ENABLE` | Master on/off switch for all scheduled jobs | `true` |
| `BUY_ZONE_REFRESH_MINUTES` | Scheduler interval for buy zone refresh | `60` |
| `THEME_SCORE_REFRESH_MINUTES` | Scheduler interval for theme score refresh | `360` |
| `ALERT_EVAL_MINUTES` | Scheduler interval for alert evaluation | `5` |
| `AUTO_BUY_EVAL_MINUTES` | Scheduler interval for auto-buy evaluation | `5` |
| `NOTIFICATION_EMAIL_ENABLED` | Enable email notification channel | `false` |
| `NOTIFICATION_WEBHOOK_ENABLED` | Enable webhook notification channel | `false` |

---

### 12. Monetisation Model

No changes to monetisation in v2. The platform remains free to operate. Auto-buy execution and real-time alert quotas are identified as potential premium-tier gates post-v2 but are not gated in this release.

---

### 13. Constraints and Assumptions

#### Language Constraints (Non-Negotiable)

The following phrases are banned from all code, UI text, API responses, comments, and log messages. A linting scan must be run before any v2 feature is marked complete:

| Banned phrase | Required replacement |
|---------------|---------------------|
| "guaranteed profit" | "historically favorable outcome" |
| "no chance of loss" | "lower-risk area based on past data" |
| "safe entry" | "high-probability entry zone" |
| "certain to go up" | "positive outcome rate of X%" |
| "buy now" (as a command) | "entered buy zone" |
| "guaranteed winner" | (remove entirely or rephrase) |
| "safe forever" | (remove entirely or rephrase) |

Every recommendation surface must expose: confidence score, expected upside, expected drawdown, time horizon, major assumptions, and invalidation level.

#### Technical Constraints

- **Extend, do not replace:** If any part of a feature already exists in the codebase, inspect and extend it; never rebuild from scratch
- **Backwards compatibility:** All existing v1 API endpoints, data models, and frontend pages must continue to function unchanged
- **Migration chain:** All new Alembic migrations must chain from the current migration head; every migration must have a working `downgrade()`
- **Auth pattern:** All new endpoints use `Depends(get_current_user)` from `auth/dependencies.py`; no new auth mechanism is introduced
- **Naming conventions:** Follow existing SQLAlchemy 2.x `Mapped[]` / `mapped_column()` patterns, async session usage from `db/session.py`, and router registration style from `main.py`
- **Charting libraries:** Do not introduce new charting libraries; use Lightweight Charts for price overlays, Recharts for metric panels, Plotly for scatter/heatmap if needed

#### Auto-Buy Constraints

- Auto-buy is disabled by default and requires explicit user opt-in through a confirmation dialog
- Paper mode is the default when auto-buy is enabled; live mode requires a second confirmation
- All nine safeguards must pass; partial passes are not sufficient
- High theme score never overrides price or risk controls
- Every order attempt is logged to `auto_buy_decision_logs` before the broker call

#### Assumptions

- The existing Alpaca broker client (`alpaca_client.py`) supports `place_order()` with a paper flag parameter; if not, this must be confirmed before implementing Feature C
- yfinance provides sector and industry fields for all tickers in the supported universe; tickers with no sector data receive a zero `sector_tailwind_score`
- APScheduler can run reliably inside the Render web dyno without being killed by the platform's request timeout; if this proves unstable, a Render Background Worker service will be added post-v2
- The five-minute scheduler interval for alert evaluation is fast enough for the "entered buy zone" alert type given that buy zone snapshots themselves refresh hourly; sub-minute freshness is not promised
- Earnings date data is not available from an integrated live source in v2; the `not_near_earnings` safeguard in Feature C is implemented as a manual flag on `WatchlistIdeaTicker` until a live earnings calendar is integrated

---

### 14. New Backend Directory Structure

The following additions extend the existing backend layout. No existing files are moved or renamed.

```
backend/app/
  api/
    buy_zone.py          # GET /api/stocks/{ticker}/buy-zone, POST recalculate
    theme_score.py       # GET /api/stocks/{ticker}/theme-score, POST recompute
    alerts.py            # CRUD /api/alerts
    ideas.py             # CRUD /api/ideas
    auto_buy.py          # settings, decision-log, dry-run
    opportunities.py     # GET /api/opportunities (aggregated ranked list)
  services/
    buy_zone_service.py        # zone calculation orchestrator
    analog_scoring_service.py  # historical pattern matching, forward return scoring
    theme_scoring_service.py   # theme alignment blending
    alert_engine_service.py    # alert rule evaluation and dispatch
    auto_buy_engine.py         # nine-safeguard decision engine
    notification_service.py    # NotificationChannel abstraction
  scheduler/
    jobs.py              # APScheduler setup, job registration
    tasks/
      refresh_buy_zones.py
      refresh_theme_scores.py
      evaluate_alerts.py
      evaluate_auto_buy.py
  models/
    buy_zone.py          # StockBuyZoneSnapshot
    theme_score.py       # StockThemeScore
    idea.py              # WatchlistIdea, WatchlistIdeaTicker
    alert.py             # PriceAlertRule
    auto_buy.py          # AutoBuySettings, AutoBuyDecisionLog
```

---

### 15. New Frontend Directory Structure

```
frontend/app/
  opportunities/page.tsx       # watchlist + buy zone ranked dashboard
  ideas/page.tsx               # idea and thesis management
  alerts/page.tsx              # alert rule configuration
  auto-buy/page.tsx            # auto-buy settings and decision log

frontend/components/
  buy-zone/
    BuyZoneCard.tsx            # zone range, confidence meter, invalidation level
    HistoricalOutcomePanel.tsx # positive outcome rate, return distribution
    ThemeScoreBadge.tsx        # per-category theme alignment display
  ideas/
    IdeaForm.tsx               # create/edit idea with all fields
    IdeaList.tsx               # ranked list with composite score display
  alerts/
    AlertConfigForm.tsx        # alert type, threshold, cooldown, toggle
  auto-buy/
    AutoBuySettings.tsx        # master switch, mode toggle, parameter sliders
    AutoBuyDecisionLog.tsx     # paginated log table with state badges
```

#### `/opportunities` Page Requirements

- Table columns: ticker, current price, buy zone range, distance to zone (%), confidence score, theme score, alert status, auto-buy readiness, last updated
- Sorting: by confidence (desc), by distance to zone (asc), by theme score (desc), by risk/reward ratio
- Filtering: by theme tag, by sector, by alert status, by auto-buy eligibility
- Each row links to the stock detail page with the buy zone analysis panel

#### `/ideas` Page Requirements

- Add, edit, and delete idea cards
- Thesis text area (free form)
- Theme tag multi-select from the ten supported themes
- Linked tickers input (primary ticker flag)
- Watch-only toggle with tooltip: "Watch-only ideas are tracked but never sent to a broker"
- Conviction slider 1–10
- List sorted by composite rank score descending; rank score displayed per card

#### `/alerts` Page Requirements

- Per-ticker alert rules listed with shadcn/ui Switch for enable/disable
- Form fields: alert type dropdown, proximity threshold (for `near_buy_zone`), cooldown window, market hours only toggle
- Last triggered timestamp displayed per rule

#### `/auto-buy` Page Requirements

- Settings panel: master enable switch with confirmation dialog, paper/live mode toggle with second confirmation for live, per-trade max amount input, confidence threshold slider, max expected drawdown slider, earnings blackout toggle, allowed broker accounts multi-select
- Decision log table: timestamp, ticker, decision state, reason codes (expandable), dry-run flag
- Badge colors: green = `order_filled`, amber = `ready_to_buy`, red = `blocked_by_risk`, gray = `candidate`

#### Stock Detail Page Enhancement

Add a collapsible "Buy Zone Analysis" section to any existing stock detail view. Contents:

- Buy zone range, confidence score (as percentage)
- Expected 30-day return, expected drawdown
- 90-day positive outcome rate, invalidation price
- Expandable explanation string list
- Theme alignment: one `ThemeScoreBadge` per scored category
- Alert toggle (creates or enables a `near_buy_zone` rule for this ticker)
- Auto-buy eligibility badge (reads from the latest `auto_buy_decision_log` for this ticker)

---

### 16. Implementation Order

Follow this sequence to minimize integration conflicts:

1. Database migrations (all 7 tables, chained from current head)
2. ORM models (all 5 new model files)
3. Pydantic schemas for all new request/response DTOs
4. `buy_zone_service.py` + `analog_scoring_service.py`
5. `theme_scoring_service.py`
6. `alert_engine_service.py` + `notification_service.py`
7. `auto_buy_engine.py`
8. API routers (`buy_zone.py`, `theme_score.py`, `alerts.py`, `ideas.py`, `auto_buy.py`, `opportunities.py`); register all in `main.py`
9. Scheduler setup (`scheduler/jobs.py` + four task files); wire into FastAPI lifespan
10. Frontend pages and components (four new pages + stock detail panel)
11. Unit and integration tests
12. Pre-release linting scan for banned language phrases

---

### 17. Testing Requirements

#### Backend Unit Tests

| File | Coverage target |
|------|----------------|
| `test_buy_zone_service.py` | Layer scoring, zone calculation, edge cases: no data, single bar, fewer than 5 analogs |
| `test_analog_scoring.py` | Historical window matching, forward return computation, minimum analog threshold |
| `test_theme_scoring.py` | Theme tag mapping, score blending, zero-sector-data fallback |
| `test_alert_engine.py` | Each of the six alert types, cooldown logic, market-hours filter |
| `test_auto_buy_engine.py` | Each of the nine safeguards independently, full pipeline pass, full pipeline block |
| `test_auto_buy_api.py` | Dry-run endpoint, settings CRUD, decision log retrieval, ownership enforcement |

#### Backend Integration Tests

| Scenario | Description |
|----------|-------------|
| Price → zone → alert end-to-end | Simulate price update → buy zone recalculation → alert rule evaluation → notification dispatch |
| Dry-run auto-buy, all safeguards pass | All nine checks pass; decision state is `ready_to_buy`; no broker call made |
| Dry-run auto-buy blocked by earnings | `not_near_earnings` check fails; `reason_codes_json` contains `FAILED: earnings within 3 days` |
| Idea creation → theme score → ranking | Create idea with theme tags → recompute theme score for linked ticker → verify `rank_score` updates |

All tests mock `yfinance`, broker clients, and notification channels. No live network calls in the test suite.

---

### 18. Acceptance Criteria

The v2 feature set is complete when all of the following are true:

- [ ] User can view a computed buy zone with confidence score, expected upside, expected drawdown, and invalidation price for any tracked ticker
- [ ] Buy zone explanation strings are displayed verbatim in the UI
- [ ] User can create, enable, and disable price alert rules per ticker and per alert type
- [ ] Alert engine evaluates rules on a 5-minute schedule and dispatches in-app notifications
- [ ] User can save idea and thesis entries with theme tags, linked tickers, watch-only flag, and conviction rating
- [ ] Ideas are auto-ranked by the composite formula and the rank score is visible in the UI
- [ ] Theme scores are computed and displayed per ticker with per-category breakdown
- [ ] Auto-buy settings can be configured; all nine safeguards are visible in the UI
- [ ] Auto-buy dry-run returns a full decision breakdown with a PASSED or FAILED reason per safeguard
- [ ] Auto-buy is disabled by default; enabling requires an explicit confirmation dialog
- [ ] Switching auto-buy from paper to live mode requires a second confirmation dialog
- [ ] All seven new tables have Alembic migrations chained from the current head with working `downgrade()`
- [ ] All new endpoints return 401 without a valid JWT cookie and 403 on ownership mismatch
- [ ] All data reads and writes are scoped by `user_id`; no cross-user access is possible
- [ ] Pre-release linting scan finds zero instances of the banned profit language phrases in UI, API responses, or backend code
- [ ] Unit tests cover buy zone layer scoring, all six alert trigger conditions, all nine auto-buy safeguards
- [ ] Integration test covers the price → zone → alert end-to-end flow
- [ ] All existing v1 E2E tests continue to pass (no regressions)

---

### 19. Open Questions

| # | Question | Owner | Required before |
|---|----------|-------|----------------|
| OQ-01 | Does `AlpacaClient.place_order()` currently accept a `paper` flag, or does paper routing depend on which base URL the client was instantiated with? Confirm before implementing Feature C broker integration | Engineering | Feature C implementation |
| OQ-02 | What is the earnings date data source? yfinance provides `calendar` data but it is unreliable for near-term dates. Should the `not_near_earnings` safeguard use a manual flag on `WatchlistIdeaTicker` in v2 and a live calendar API in v3? | Product + Engineering | Feature C implementation |
| OQ-03 | Should the scheduler run in-process on the Render web dyno, or should a separate Render Background Worker be provisioned? In-process is simpler but risks being killed on dyno restart | Engineering | Scheduler implementation |
| OQ-04 | Is the InApp notification channel sufficient for v2 launch, or does at least one email provider (e.g. SendGrid) need to be wired before launch? | Product | Feature B implementation |
| OQ-05 | What is the expected ticker universe size per user? Analog scoring is O(n * windows) per ticker; if users track 200+ tickers, the 60-minute refresh window may be too short at launch scale | Engineering | Scheduler implementation |
| OQ-06 | Should `/opportunities` aggregate across all of a user's ideas, or should it show a curated set (e.g. top 50 by rank score)? | Product | Feature E + opportunities page |

---

### 20. Appendix

#### Approved Probabilistic Vocabulary

Always use these phrasings when surfacing buy zone or theme score information to users:

- "historically favorable buy zone"
- "high-probability entry area"
- "confidence score of X%"
- "expected drawdown of X%"
- "scenario-based estimate"
- "positive outcome rate of X%"
- "entered buy zone" (not "buy now")
- "invalidation level at $X"
- "X analog setups produced a median Y% return over Z days"

#### Safeguard Check Reference (Feature C)

| Safeguard | What it checks |
|-----------|---------------|
| `price_inside_buy_zone` | Current price is within `buy_zone_low`..`buy_zone_high` |
| `confidence_above_threshold` | `confidence_score` >= `AutoBuySettings.confidence_threshold` |
| `drawdown_within_limit` | `expected_drawdown` >= `AutoBuySettings.max_expected_drawdown` |
| `liquidity_filter` | Average daily volume meets a minimum threshold (configurable) |
| `spread_filter` | Bid-ask spread is within an acceptable percentage of mid price |
| `not_near_earnings` | No earnings event within 3 days (or `allow_near_earnings=True`) |
| `position_size_limit` | Order value <= `max_trade_amount` and <= `max_position_percent` of portfolio |
| `daily_risk_budget` | Total auto-buy spend today has not exceeded daily budget |
| `no_duplicate_order` | No open or pending order for this ticker already exists |

#### Alert Type Reference (Feature B)

| Alert type | Trigger condition |
|------------|------------------|
| `entered_buy_zone` | Current price moved inside `buy_zone_low`..`buy_zone_high` |
| `near_buy_zone` | Current price within `proximity_pct`% of `buy_zone_low` |
| `below_invalidation` | Current price dropped below `invalidation_price` |
| `confidence_improved` | `confidence_score` increased by >= 0.10 since last snapshot |
| `theme_score_increased` | `theme_score_total` increased by >= 0.15 |
| `macro_deterioration` | `theme_score_total` dropped sharply or sector tailwind reversed |

#### Existing Tables Unchanged in v2

`User`, `UserProfile`, `UserSession`, `BrokerCredential`, `StrategyRun`, `TradeDecision`, `BrokerOrder`, `PositionSnapshot`, `CooldownState`, `TrailingStopState`, `VariantBacktestResult`, `WinningStrategyArtifact`, `BacktestTrade`

## Part 3: Watchlist Scanner, Buy Signals & Idea Engine (V3)

**Version:** 1.0
**Date:** 2026-03-24
**Status:** Draft
**Depends on:** V1 (auth, strategies, backtests, live trading) + V2 (buy zone, alerts, auto-buy, themes, ideas, scheduler)

---

### 1. Overview

V3 adds three connected capabilities to NextGenStock:

1. **Watchlist Scanner** — the Opportunities page gains a first-class per-ticker watchlist. Each ticker gets a persistent estimated buy zone (from the V2 buy zone pipeline) and a live 5-minute technical scan. When all 10 conditions pass simultaneously, a "STRONG BUY" signal fires and dispatches an immediate in-app + email notification.

2. **Auto-Idea Engine** — the Ideas page is upgraded from a manual user-authored feed to a fully automated idea feed. Three background scanners run every 60 minutes during market hours: a news RSS scanner, a theme scanner, and a technical universe scanner. Results are merged, scored, and surfaced as ranked idea cards with one-click "Add to Watchlist."

3. **Persistent Buy Signal Audit Trail** — every scanner evaluation (pass or fail) is written to a new `buy_now_signals` table, giving users a transparent record of which conditions passed and which caused suppression.

#### How V3 connects to V1/V2

| V1/V2 layer | How V3 uses it |
|---|---|
| `buy_zone_service.py` | Powers the estimated entry zone on every watchlist row |
| `analog_scoring_service.py` | Provides 90-day win rate and historical setup count |
| `theme_scoring_service.py` | Theme tags used by idea scorer and watchlist filter |
| `alert_engine_service.py` | Extended with a new `BUY_NOW` alert type |
| `notification_service.py` | Dispatches in-app + email on STRONG BUY |
| `scheduler/jobs.py` | Two new cron jobs added (no new scheduler instance) |
| `models/alert.py` PriceAlertRule | Auto-created on "Add to Watchlist" from idea card |
| `api/opportunities.py` | Extended with watchlist CRUD and signal status columns |
| `api/ideas.py` | Extended to expose the generated idea feed |
| `api/scanner.py` | Existing endpoints kept; new `/status` and `/run-now` added |
| `WatchlistIdea` / `WatchlistIdeaTicker` | Primary watchlist store; `user_watchlist` table added only if a simpler direct-ticker model is warranted (see Section 6) |

---

### 2. Goals and Non-Goals

#### Goals

- Users can maintain a personal watchlist on the Opportunities page and see buy zone + live signal status per ticker in one table.
- A "STRONG BUY" alert fires only when ALL 10 conditions pass — never partial, never approximate.
- The Ideas page auto-populates every hour with ranked, auto-generated cards from three independent data sources.
- Every idea card shows enough context (reason flagged, buy zone, confidence, win rate, news catalyst, moat score, financial quality, entry priority) for the user to make an informed judgment.
- One-click "Add to Watchlist" from any idea card creates the watchlist entry and the alert rule in a single action.
- No paid external APIs are required. News scanning uses free RSS feeds only.
- No scanner job runs outside market hours (9:30 AM – 4:00 PM ET, Mon–Fri).
- Ideas and scan candidates are prioritized by megatrend fit (AI / Robotics-Humanoids-Autopilot / Longevity), competitive moat, and financial quality. Manually added watchlist tickers are never filtered out.

#### Non-Goals (V3)

- Real-time order execution triggered by STRONG BUY signals (covered by V2 auto-buy engine).
- Earnings calendar live API integration (near_earnings flag is manually set in V2; live lookup deferred to V4).
- LLM-generated natural-language thesis copy.
- Multi-language UI for new V3 pages (Thai/English i18n added in V2 for FAQ only; V3 pages are English).
- Redis-backed cross-worker cache (noted in `idea_generator_service.py` as a V3 upgrade; deferred to V4 if needed).

---

### 3. User Stories

| ID | Story | Acceptance condition |
|----|-------|----------------------|
| US-01 | As a user, I can type a ticker symbol and add it to my watchlist on the Opportunities page. | POST `/api/watchlist` succeeds; new row appears with "Checking..." state. |
| US-02 | As a user, I can see the estimated buy zone range and ideal entry price for each watchlist ticker. | Row shows `$low – $high` and ideal entry populated once buy zone calculation completes. |
| US-03 | As a user, I can see a live signal status badge on each watchlist row updated every 5 minutes. | Badge cycles between "Checking…", "Watching", and "STRONG BUY". |
| US-04 | As a user, I receive an in-app notification the moment a STRONG BUY signal fires for one of my watchlist tickers. | Notification arrives within one scan cycle (≤5 min) of all 10 conditions passing. |
| US-05 | As a user, I receive an email with ticker, zone, confidence, win rate, and a link to the Opportunities page. | Email dispatched by `notification_service` with correct content template. |
| US-06 | As a user, I can see exactly which of the 10 conditions passed or failed for any ticker by hovering the badge. | Tooltip on BuyNowBadge lists all 10 conditions with pass/fail icons. |
| US-07 | As a user, I can remove a ticker from my watchlist. | DELETE `/api/watchlist/{ticker}` succeeds; row disappears. |
| US-08 | As a user, I can toggle alerts on or off per ticker. | Alert toggle persists to PriceAlertRule.enabled; no notifications dispatched when off. |
| US-09 | As a user, I cannot receive duplicate STRONG BUY alerts for the same ticker within 4 hours. | Cooldown check in `buy_signal_service` suppresses re-fire. |
| US-10 | As a user, I can browse auto-generated idea cards on the Ideas page without any manual action. | `generated_ideas` table is populated by the scheduler; GET `/api/ideas/generated` returns results. |
| US-11 | As a user, I can filter idea cards by source (News / Theme / Technical) and by theme tag. | Filter params on GET `/api/ideas/generated` work correctly. |
| US-12 | As a user, idea cards older than 24 hours disappear from the feed automatically. | Expired rows are purged by the `run_idea_generator` job on each cycle. |
| US-13 | As a user, I can add any idea card to my watchlist with one click and receive a confirmation toast. | POST to add-to-watchlist creates WatchlistIdeaTicker + PriceAlertRule; toast fires. |
| US-14 | As a user, an idea card I have already added shows a checkmark and the button is disabled. | `added_to_watchlist=True` state is reflected in the card UI. |
| US-15 | As a user, I can see when the last idea scan ran and how many ideas were generated. | GET `/api/ideas/generated/last-scan` returns timestamp + count. |
| US-16 | As a user, I can manually trigger a live scan of my watchlist tickers. | POST `/api/scanner/run-now` executes synchronously and returns results. |

---

### 4. Feature 1: Opportunities Page — Watchlist + Buy Zone + Live Scanner

#### 4.1 Watchlist mechanics

- Users add tickers via a text input + "Add" button at the top of the Opportunities page.
- On submission: POST `/api/watchlist` is called. The backend stores the ticker in `user_watchlist` (or via `WatchlistIdea`/`WatchlistIdeaTicker` — see Section 6.1 for the decision), then fires `calculate_buy_zone(ticker)` as a background task.
- The new row enters the table immediately in an "Checking…" state while buy zone calculates.
- On remove: DELETE `/api/watchlist/{ticker}` removes the row; any associated `BuyNowSignal` records are retained for audit (soft approach: they remain orphaned, not cascaded).

#### 4.2 Estimated buy price display

The Opportunities table shows both outputs of the buy zone pipeline:

```
Estimated entry zone (historically favorable): $140.20 – $144.80
Ideal entry based on backtest: $141.50
This is not a guaranteed price. Based on X similar historical setups.
```

**Ideal entry price** is the ATR midpoint of the zone where historical reward/risk is strongest — computed as `(buy_zone_low + buy_zone_high) / 2` as a baseline, refined by analog scoring to the price level with the highest 90-day win rate within the zone.

#### 4.3 Opportunities table columns

| Column | Source | Notes |
|---|---|---|
| Ticker | User input | Symbol + company name (resolved via yfinance metadata) |
| Current Price | Live yfinance quote | Refreshed on each scan cycle |
| Buy Zone | `StockBuyZoneSnapshot.buy_zone_low / high` | `$140.20 – $144.80` format |
| Ideal Entry | `BuyNowSignal.ideal_entry_price` | `$141.50` |
| Distance to Zone | Computed | `+2.3%` above (red) / `-1.1%` below (green) |
| Confidence | `BuyNowSignal.backtest_confidence` | Badge: `74%` |
| 90d Win Rate | `BuyNowSignal.backtest_win_rate_90d` | `68%` |
| Signal Status | `BuyNowSignal.all_conditions_pass` | `STRONG BUY` (green) / `Watching` (gray) / `Not Ready` |
| Alert Toggle | `PriceAlertRule.enabled` | Per-ticker on/off |
| Last Updated | `BuyNowSignal.created_at` | Relative timestamp |

Default sort: STRONG BUY at top, then by `backtest_confidence` descending.
Filter controls: "Ready only" toggle (hides Not Ready rows), theme filter chip set.

#### 4.4 Expanded row — EstimatedEntryPanel

Clicking any row expands a detail panel:

```
Estimated entry zone: $140.20 – $144.80
Ideal entry price:    $141.50
Based on 17 similar historical setups over 5 years.
90-day positive outcome rate: 68%  |  Worst drawdown: -8.4%
Invalidation level: $136.00
```

All wording must comply with the approved language constraints in Section 16.

---

### 5. Feature 2: Ideas Page — Auto-Generated Idea Feed

#### 5.1 Three automatic sources

The `run_idea_generator` job (every 60 min, market hours) orchestrates three parallel sub-scanners:

**Source 1 — News scanner** (`news_scanner_service.py`):
- Fetches five free RSS feeds (see Section 10 for full list).
- Extracts headlines, source names, published timestamps, URLs, and text snippets.
- Runs keyword extraction to find ticker symbols, company names, and sector keywords.
- Matches against SUPPORTED_THEMES and known ticker list.
- Scores items by theme keyword count + ticker mention frequency.
- Fails gracefully: if any individual feed times out or errors, that feed is skipped and the error is logged. The job continues with remaining feeds.

**Source 2 — Theme scanner** (`idea_generator_service.scan_by_theme()`):

```python
async def scan_by_theme() -> list[IdeaCandidate]:
    """
    For each theme in SUPPORTED_THEMES:
      1. Load tickers tagged with that theme from stock_theme_scores.
      2. Filter: theme_score_total >= 0.60.
      3. Run buy zone calculation if stale (>4hr).
      4. Filter: entry_quality_score >= 0.55 AND confidence_score >= 0.60.
      5. Compute moat_score: use HIGH_MOAT_TICKERS map first,
         fallback to yfinance marketCap + competitor count heuristic.
      6. Compute financial_quality_score from yfinance revenueGrowth,
         grossMargins, earningsGrowth, operatingMargins.
      7. Check near_52w_low: current_price <= (fiftyTwoWeekLow * 1.10).
      8. Check at_weekly_support: price within 2x ATR of most recent weekly swing low
         (use 1W interval OHLCV, detect pivot lows over past 52 weekly bars).
      9. Return candidates sorted by full idea_score formula.
    """
```

**Source 3 — Technical universe scanner** (`idea_generator_service.scan_technical_universe()`):
- Iterates the `SCAN_UNIVERSE` ticker list (see Section 11).
- Per ticker: checks 4 conditions (above 50d MA, above 200d MA, RSI 35–55, volume declining on pullback).
- Returns tickers where 3 or 4 of the 4 checks pass, sorted by score.

#### 5.2 Deduplication and scoring

When the same ticker appears in multiple sources:
1. Merge into one `GeneratedIdea` record.
2. Combine `reason_summary` strings (e.g., "RSI pullback to support. News: NVIDIA wins $2B contract.").
3. Assign the highest `idea_score` from any individual source calculation.

All ideas are assigned a composite `idea_score` before persistence (see Section 8 for formula).

#### 5.3 Idea card UI spec

```
┌─────────────────────────────────────────────────────┐
│  NVDA  NVIDIA Corporation
│  [AI] [Semiconductors] [Robotics]       Megatrend fit
│
│  Why flagged: RSI pullback to support near 50d MA.
│               News: "NVIDIA wins $2B data center contract"
│
│  [⚠ Near 52-week low]  or  [⚠ At weekly support]   <- entry priority badge
│
│  Current price: $487.20
│  Estimated entry zone: $472.00 – $485.00
│  Ideal entry: $476.50
│
│  Competitive moat: Strong (85%)
│    "Dominant GPU share for AI training"
│
│  Financial quality: Strong
│    Revenue +122% YoY  |  Margins: improving
│
│  Confidence: 71%    Historical 90d win rate: 66%
│
│  [ + Add to Watchlist ]                [View Chart]
└─────────────────────────────────────────────────────┘
```

- Cards are sorted by `idea_score` descending. Newest cards appear at top within each score tier.
- Each card shows a "Generated X minutes ago" badge.
- Cards expire after 24 hours and are removed from the feed on the next job cycle.
- `moat_score >= 0.70` shows a green "Strong moat" badge; `moat_score < 0.30` shows a red "Low competitive moat — higher risk" badge.
- When `financial_quality_score` data is unavailable from yfinance, the card shows "Financials unavailable" instead of the financial quality block.

#### 5.4 Add to Watchlist behavior

When the user clicks "Add to Watchlist" on an idea card:

1. Add ticker to `user_watchlist`.
2. Trigger `calculate_buy_zone(ticker)` in background.
3. Create `PriceAlertRule` with `alert_type="entered_buy_zone"` and `enabled=True` by default.
4. Show toast: `"[TICKER] added to watchlist. Alert created for buy zone entry."`
5. Set `generated_idea.added_to_watchlist = True` (card shows a checkmark; button changes to "Added ✓" and is disabled).

Implementation note: steps 1–3 and 5 execute server-side in response to `POST /api/ideas/generated/{id}/add-to-watchlist`; step 4 is triggered client-side on 200 response.

---

### 6. Data Models

#### 6.1 UserWatchlist (new table — or extend WatchlistIdea)

**Decision:** The existing `WatchlistIdea` + `WatchlistIdeaTicker` model stores tickers as children of an idea thesis. V3 needs a lighter-weight direct ticker-to-user association for the Opportunities page (no thesis required). Two options:

- **Option A (recommended):** Add a `user_watchlist` table (simple join of `user_id` + `ticker`). Zero impact on existing `WatchlistIdea` logic. Used exclusively by the V3 scanner.
- **Option B:** Reuse `WatchlistIdea` with a synthetic title (`"[ticker] — Scanner watchlist"`) and a `metadata_json.source = "v3_watchlist"` flag. More complex queries; pollutes the V2 Ideas page feed.

The PRD recommends Option A. The Alembic migration for `user_watchlist` is migration step 1 (see Section 8).

```python
# models/user_watchlist.py
class UserWatchlist(Base):
    __tablename__ = "user_watchlist"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (UniqueConstraint("user_id", "ticker"),)
```

#### 6.2 BuyNowSignal (new table)

Full ORM model as specified in the source prompt:

```python
# models/buy_signal.py
class BuyNowSignal(Base):
    __tablename__ = "buy_now_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Backtest layer (from buy_zone_service / analog_scoring_service)
    buy_zone_low: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    buy_zone_high: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    ideal_entry_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    backtest_confidence: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    backtest_win_rate_90d: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    # Live technical layer (from live_scanner_service / yfinance)
    current_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    price_in_zone: Mapped[bool] = mapped_column(Boolean, nullable=False)
    above_50d_ma: Mapped[bool] = mapped_column(Boolean, nullable=False)
    above_200d_ma: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rsi_value: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    rsi_confirms: Mapped[bool] = mapped_column(Boolean, nullable=False)     # RSI 30–55
    volume_confirms: Mapped[bool] = mapped_column(Boolean, nullable=False)  # declining on pullback
    near_support: Mapped[bool] = mapped_column(Boolean, nullable=False)     # within 1.5x ATR
    trend_regime_bullish: Mapped[bool] = mapped_column(Boolean, nullable=False)  # HMM regime

    # Final decision
    all_conditions_pass: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    signal_strength: Mapped[str] = mapped_column(String(20), nullable=False)
    # Which condition failed first (None when all_conditions_pass=True)
    suppressed_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Risk metadata
    invalidation_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    expected_drawdown: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
```

**Column notes:**
- `signal_strength` is always `"STRONG_BUY"` when `all_conditions_pass=True`; `"SUPPRESSED"` otherwise.
- `suppressed_reason` stores the string key of the first failed condition from `ALL_CONDITIONS` (e.g., `"above_200d_moving_average"`).
- Every evaluation is persisted regardless of pass/fail — this is the audit trail.

#### 6.3 GeneratedIdea (new table)

```python
# models/generated_idea.py
class GeneratedIdea(Base):
    __tablename__ = "generated_ideas"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    # Why it was flagged
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # "news" | "theme" | "technical" | "merged" (when from multiple sources)
    reason_summary: Mapped[str] = mapped_column(Text, nullable=False)
    news_headline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    news_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    news_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    catalyst_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # "earnings" | "policy" | "sector_rotation" | "technical"

    # Price + zone
    current_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    buy_zone_low: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    buy_zone_high: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    ideal_entry_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)

    # Scores
    confidence_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.0)
    historical_win_rate_90d: Mapped[Optional[float]] = mapped_column(Numeric(6, 4), nullable=True)
    theme_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # e.g. ["ai", "semiconductors"]
    megatrend_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # subset of theme_tags that are megatrend-aligned: ["ai", "robotics", "longevity"]

    # Competitive moat
    moat_score: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=0.0)
    # 0.0–1.0; seeded from HIGH_MOAT_TICKERS, fallback yfinance heuristic
    moat_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # e.g. "~80% surgical robot market share"

    # Financial quality
    financial_quality_score: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=0.0)
    # 0.0–1.0 from yfinance revenueGrowth / grossMargins / earningsGrowth / operatingMargins
    financial_flags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # e.g. ["revenue_growth_positive", "margins_improving"]

    # Entry priority
    near_52w_low: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # True when current_price <= fiftyTwoWeekLow * 1.10
    at_weekly_support: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # True when price is within 2x ATR of most recent weekly swing low (1W OHLCV, 52 bars)
    entry_priority: Mapped[str] = mapped_column(String(20), nullable=False, default="STANDARD")
    # "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD"

    idea_score: Mapped[float] = mapped_column(Numeric(8, 6), nullable=False, default=0.0, index=True)

    # Lifecycle
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    # expires_at = generated_at + 24 hours; set at insert time
    added_to_watchlist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
```

**Column notes:**
- `source` is `"merged"` when the same ticker appeared in two or more of the three scanners.
- `theme_tags` stores a JSON list of theme strings, e.g. `["ai", "semiconductors"]`.
- `megatrend_tags` is the subset of `theme_tags` that map to the three megatrends (AI, Robotics/Humanoids/Autopilot, Longevity). Used to compute `megatrend_fit_score` in the idea score formula.
- `moat_score` is sourced first from `HIGH_MOAT_TICKERS` (hardcoded seed map); if the ticker is not in that map, it falls back to a yfinance heuristic using `marketCap` and competitor count.
- `financial_quality_score` is computed from yfinance `.info` fields: `revenueGrowth`, `grossMargins`, `earningsGrowth`, `operatingMargins`. If any fields are unavailable, the score is computed from available fields only; if none are available, the score is 0.0 and `financial_flags = ["financials_unavailable"]`.
- `entry_priority` is set to `"BOTH"` when both `near_52w_low` and `at_weekly_support` are True.
- Rows with `expires_at < now()` are deleted by the idea generator job on each cycle (not soft-deleted).
- The job replaces the batch by deleting non-expired rows from the previous run before inserting the new top-50. Rows with `added_to_watchlist=True` are never deleted (they are retained as a record of user action).

---

### 7. ALL CONDITIONS Gate

`buy_signal_service.evaluate_buy_signal()` evaluates every condition independently. The signal fires only when every condition is True. If any condition fails, `all_conditions_pass` is set to False and `suppressed_reason` captures the key of the first failure.

```python
ALL_CONDITIONS = [
    "price_inside_backtest_buy_zone",
    # current price within buy_zone_low..buy_zone_high
    "above_50d_moving_average",
    # uptrend condition 1
    "above_200d_moving_average",
    # uptrend condition 2
    "rsi_not_overbought",
    # RSI between 30 and 55 (momentum not exhausted at high)
    "volume_declining_on_pullback",
    # healthy pullback, not panic selling
    "near_proven_support_level",
    # within 1.5x ATR of key support
    "trend_regime_not_bearish",
    # HMM regime from strategies/ — reuse existing conservative.py logic
    "backtest_confidence_above_threshold",
    # confidence_score >= 0.65
    "not_near_earnings",
    # no earnings event within 5 trading days (uses near_earnings flag on WatchlistIdeaTicker
    # until live earnings API is integrated in V4)
    "no_duplicate_signal_in_cooldown",
    # no STRONG_BUY signal persisted for this user+ticker in the last 4 hours
]
```

**Evaluation contract:**

```python
async def evaluate_buy_signal(
    ticker: str,
    user_id: int,
    db: AsyncSession,
) -> BuyNowSignal:
    """
    1. Load latest BuyZoneResult from buy_zone_service
       (recalculate via calculate_buy_zone() if snapshot > 1 hour stale).
    2. Fetch live quote: current price, volume, RSI, 50d MA, 200d MA via yfinance.
    3. Evaluate each of the 10 conditions independently; record pass/fail per condition.
    4. If ALL pass: set all_conditions_pass=True, signal_strength="STRONG_BUY".
    5. If any fail: set all_conditions_pass=False,
       suppressed_reason=<key of first failed condition>.
    6. Persist BuyNowSignal to DB regardless of outcome (audit trail).
    7. If all_conditions_pass=True AND user's alert_enabled=True:
       dispatch in-app notification + email via notification_service.
    """
```

---

### 8. Idea Score Formula

```python
# Base score (weights sum to 1.0)
idea_score = (confidence_score         * 0.25)   # backtest + technical confidence
           + (megatrend_fit_score      * 0.20)   # 1.0=AI/Robotics/Longevity, 0.5=other theme, 0.0=none
           + (moat_score              * 0.15)   # competitive moat strength
           + (financial_quality_score * 0.15)   # revenue/margin/growth quality
           + (technical_setup_score   * 0.15)   # fraction of 4 technical checks passed
           + (news_relevance_score    * 0.10)   # news catalyst freshness and relevance

# Entry priority boosts (additive, capped at 1.0)
if near_52w_low:       idea_score += 0.15
if at_weekly_support:  idea_score += 0.10
idea_score = min(idea_score, 1.0)
```

Where:
- `confidence_score` — from `StockBuyZoneSnapshot.confidence_score` (0–1); 0.0 if no snapshot.
- `megatrend_fit_score` — 1.0 if the ticker fits one or more of AI / Robotics-Humanoids-Autopilot / Longevity; 0.5 if it fits another SUPPORTED_THEME but not a megatrend; 0.0 if no theme connection. Derived from `megatrend_tags`.
- `moat_score` — sourced from `HIGH_MOAT_TICKERS` seed map first, fallback yfinance heuristic (0–1).
- `financial_quality_score` — composite of yfinance `revenueGrowth`, `grossMargins`, `earningsGrowth`, `operatingMargins` (0–1); 0.0 when data unavailable.
- `technical_setup_score` — number of the 4 technical checks passed divided by 4 (0–1).
- `news_relevance_score` — keyword match score from `news_scanner_service` (0–1); 0.0 for non-news sources.
- `near_52w_low` — True when `current_price <= fiftyTwoWeekLow * 1.10`. Adds +0.15 boost and "Near 52-week low" amber badge.
- `at_weekly_support` — True when price is within 2x ATR of most recent weekly swing low. Adds +0.10 boost and "At weekly support" amber badge.
- Both boosts apply simultaneously when both conditions are True (max additive boost = +0.25).

**Note:** This formula differs from the existing `composite_score` in `idea_generator_service.py` (which weights signal=0.40, confirmation_ratio=0.25, momentum=0.20, volume=0.15). The V3 `idea_score` is the canonical ranking formula for `GeneratedIdea` records stored in the DB. The in-process cache in `idea_generator_service.py` uses the old formula for its own `GeneratedIdeaOut` response shape; these are two separate scoring paths and should not be conflated.

---

### 9. Idea Quality Filters

These four filters are applied during `scan_by_theme()` and `scan_technical_universe()` to rank and annotate ideas. They do not hard-block ideas (except where thresholds explicitly gate inclusion — see scan_by_theme steps 2 and 4). Manually added watchlist tickers are **never** filtered out.

#### 9.1 Megatrend filter

Prioritize stocks that fit one or more of:
- **AI** — artificial intelligence, machine learning, GPU compute, data infrastructure
- **Robotics / Humanoids / Autopilot** — industrial robots, humanoid robots, autonomous vehicles, drones
- **Longevity** — biotech, genomics, anti-aging therapeutics, diagnostics, precision medicine

`megatrend_fit_score` values used in the idea score formula:
- `1.0` — fits at least one megatrend (AI / Robotics / Longevity)
- `0.5` — fits another SUPPORTED_THEME but not a megatrend
- `0.0` — no theme connection

Stocks with no megatrend connection are deprioritized in ranking but never hard-blocked from the feed.

#### 9.2 Competitive moat filter

Prefer companies that meet at least one of:
- Market share >= 50% within their primary industry or product category
- Difficult to replicate: proprietary IP, switching costs, network effects, regulatory moat
- Very few direct competitors (oligopoly or near-monopoly position)

`moat_score` is stored per ticker (0.0–1.0):
- Score sourced first from `HIGH_MOAT_TICKERS` seed map (see Section 10 for the full map).
- Fallback: yfinance `marketCap` + competitor count heuristic.
- Score >= 0.70: green "Strong moat" badge on the idea card.
- Score < 0.30: red badge "Low competitive moat — higher risk."

#### 9.3 Financial quality filter

Prefer companies that meet the majority of:
- Revenue growth year-over-year (positive): `yfinance.info["revenueGrowth"]`
- Profit growth YoY OR strong demand + clear path to profitability: `earningsGrowth`
- Improving or stable gross margins: `grossMargins`
- Good cost control (improving operating leverage): `operatingMargins`
- If not yet profitable: strong and accelerating revenue growth as a substitute

`financial_quality_score` (0.0–1.0) is computed from the above four yfinance `.info` fields. If data is unavailable, the score defaults to 0.0 and `financial_flags = ["financials_unavailable"]`. The card shows "Financials unavailable" instead of the financial quality block.

#### 9.4 Chart-based entry priority rules

Two conditions qualify as high-priority entries and boost `idea_score`:

**Priority Entry 1: Near 52-week low**
- Trigger: `current_price <= fiftyTwoWeekLow * 1.10`
- Badge: amber "Near 52-week low — historically attractive entry area"
- Score boost: +0.15 to `idea_score`
- Only applies when the long-term fundamental thesis (megatrend + moat) is still intact

**Priority Entry 2: Weekly chart support**
- Trigger: price has pulled back to a significant support level on the weekly (1W) chart
- Detection: identify swing lows on the weekly timeframe over the past 52 weeks; flag when current price is within 2x ATR of the most recent weekly support pivot (use 1W interval OHLCV)
- Badge: amber "At weekly support — historically favorable entry zone"
- Score boost: +0.10 to `idea_score`

Both can be true simultaneously; boosts are additive (max +0.25 total), capped at 1.0. When both apply, `entry_priority = "BOTH"` and both amber badges are shown on the card.

---

### 10. RSS News Sources

```python
NEWS_SOURCES = [
    # Free RSS feeds — no API key required
    "https://feeds.finance.yahoo.com/rss/2.0/headline",    # Yahoo Finance
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",       # WSJ Markets (free tier)
    "https://rss.cnn.com/rss/money_markets.rss",           # CNN Money Markets
    # Macro / policy
    "https://feeds.federalreserve.gov/feeds/press_all.xml", # Federal Reserve announcements
    "https://www.eia.gov/rss/news.xml",                    # Energy policy (EIA)
]
```

Fetch strategy: `httpx.AsyncClient` with a `timeout=10` seconds per feed. Each feed is fetched independently; a timeout or HTTP error on one feed does not abort the others. All errors are logged at WARNING level. If all five feeds fail, the news source returns an empty list and the job continues with theme + technical scanners.

---

### 11. SCAN_UNIVERSE Ticker List

Used by `scan_technical_universe()` in `idea_generator_service.py`:

```python
SCAN_UNIVERSE = [
    # Mega cap tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    # Financials
    "JPM", "BAC", "GS", "V", "MA",
    # Energy + infrastructure
    "ETN", "NEE", "XOM", "CVX",
    # Defense + aerospace
    "LMT", "RTX", "NOC", "GD",
    # Semiconductors
    "AMD", "INTC", "AVGO", "TSM", "AMAT",
    # Space + emerging
    "ASTS", "RKLB",
    # Longevity / biotech
    "LLY",    # GLP-1 leader, longevity (duopoly with NVO)
    "NVO",    # GLP-1 duopoly
    "REGN",   # rare disease + biologics
    "CRSP",   # CRISPR gene editing
    "ILMN",   # DNA sequencing (dominant market share)
    # Defense + AI
    "PLTR",
    # ETFs — market context only, excluded from idea generation
    "SPY", "QQQ", "IWM", "XLE", "XLK", "XLF",
]

# ETFs are used only for broad market context — never included in idea generation output
UNIVERSE_CONTEXT_ONLY = ["SPY", "QQQ", "IWM", "XLE", "XLK", "XLF"]

# Pre-seeded moat scores for well-known names; used by moat_scoring_service before yfinance fallback
HIGH_MOAT_TICKERS = {
    "NVDA": 0.85,   # dominant GPU share for AI training
    "ISRG": 0.90,   # ~80% surgical robot market share
    "ASML": 0.95,   # only company making EUV lithography machines
    "ILMN": 0.80,   # dominant DNA sequencing platform
    "MSFT": 0.80,   # enterprise software + cloud lock-in
    "TSM":  0.85,   # leading-edge chip foundry
    "V":    0.80,   # payment network duopoly
    "MA":   0.80,   # payment network duopoly
    "LLY":  0.75,   # GLP-1 biologics duopoly
    "NVO":  0.75,   # GLP-1 biologics duopoly
}
```

**Note:** The current `STOCK_UNIVERSE` in `idea_generator_service.py` contains ~40 tickers including crypto (`BTC-USD`, `ETH-USD`, `SOL-USD`). V3 replaces this list with `SCAN_UNIVERSE` for the technical scanner path (no crypto, adds defense/aerospace, space, longevity/biotech, and sector ETFs). The existing in-process cache path in `idea_generator_service.py` is unaffected — it is a V2 endpoint (`GET /api/scanner/ideas`) that continues to serve its own universe.

---

### 12. API Endpoints

#### 12.1 Watchlist endpoints (new)

##### POST /api/watchlist

Add a ticker to the user's watchlist and trigger background buy zone calculation.

**Request body:**
```json
{ "ticker": "AAPL" }
```

**Response 201:**
```json
{
  "ticker": "AAPL",
  "user_id": 42,
  "alert_enabled": true,
  "created_at": "2026-03-24T14:32:00Z"
}
```

**Errors:** 409 if ticker already in watchlist. 422 if ticker format invalid.

**Side effects:** Fires `BackgroundTask` calling `calculate_buy_zone(ticker)`.

---

##### DELETE /api/watchlist/{ticker}

Remove a ticker from the user's watchlist.

**Response 204:** No content.

**Errors:** 404 if ticker not in user's watchlist.

---

##### GET /api/opportunities (extend existing)

Returns the watchlist table with buy zone + live signal status per ticker. Extends the existing `GET /api/opportunities` response shape with new fields.

**New query params:**
- `signal_status`: `"strong_buy"` | `"watching"` | `"not_ready"` | `"all"` (default: `"all"`)

**Extended response shape (adds to existing `OpportunityOut`):**
```json
{
  "ticker": "AAPL",
  "current_price": 182.50,
  "buy_zone_low": 175.00,
  "buy_zone_high": 180.00,
  "ideal_entry_price": 177.50,
  "distance_to_zone_pct": 1.4,
  "backtest_confidence": 0.74,
  "backtest_win_rate_90d": 0.68,
  "signal_status": "STRONG_BUY",
  "all_conditions_pass": true,
  "condition_details": [
    { "key": "price_inside_backtest_buy_zone", "pass": true },
    { "key": "above_50d_moving_average", "pass": true },
    ...
  ],
  "suppressed_reason": null,
  "invalidation_price": 170.00,
  "expected_drawdown": 0.084,
  "alert_enabled": true,
  "last_updated": "2026-03-24T14:30:00Z"
}
```

---

#### 12.2 Scanner endpoints (extend existing)

##### POST /api/scanner/run-now

Manually trigger an immediate live scan for all of the user's watchlist tickers. Same logic as the scheduler job but user-initiated.

**Response 200:**
```json
{
  "tickers_scanned": 5,
  "strong_buy_signals": 1,
  "results": [ ...ScanResultOut array... ]
}
```

---

##### GET /api/scanner/status

**Response 200:**
```json
{
  "last_scan_at": "2026-03-24T14:25:00Z",
  "next_scan_at": "2026-03-24T14:30:00Z",
  "tickers_in_queue": 5,
  "market_hours_active": true
}
```

**Note:** These are extensions to the existing `api/scanner.py` router, not a new file. The existing endpoints (`POST /run`, `POST /estimate-buy-prices`, `GET /ideas`, `POST /ideas/{ticker}/save`) are preserved unchanged.

---

#### 12.3 Generated ideas endpoints (new, extend ideas router)

##### GET /api/ideas/generated

List current auto-generated idea cards sorted by `idea_score` descending.

**Query params:**
- `source`: `"news"` | `"theme"` | `"technical"` | `"merged"` (optional)
- `theme`: e.g., `"ai"` | `"defense"` | `"semiconductors"` (optional)
- `limit`: 1–50, default 50

**Response 200:**
```json
[
  {
    "id": 1,
    "ticker": "NVDA",
    "company_name": "NVIDIA Corporation",
    "source": "merged",
    "reason_summary": "RSI pullback to support near 50d MA. News: NVIDIA wins $2B data center contract.",
    "news_headline": "NVIDIA wins $2B data center contract",
    "news_url": "https://...",
    "news_source": "Yahoo Finance",
    "catalyst_type": "sector_rotation",
    "current_price": 487.20,
    "buy_zone_low": 472.00,
    "buy_zone_high": 485.00,
    "ideal_entry_price": 476.50,
    "confidence_score": 0.71,
    "historical_win_rate_90d": 0.66,
    "theme_tags": ["ai", "semiconductors"],
    "megatrend_tags": ["ai"],
    "moat_score": 0.85,
    "moat_description": "Dominant GPU share for AI training",
    "financial_quality_score": 0.90,
    "financial_flags": ["revenue_growth_positive", "margins_improving"],
    "near_52w_low": false,
    "at_weekly_support": true,
    "entry_priority": "WEEKLY_SUPPORT",
    "idea_score": 0.7325,
    "generated_at": "2026-03-24T10:00:00Z",
    "expires_at": "2026-03-25T10:00:00Z",
    "added_to_watchlist": false
  }
]
```

---

##### POST /api/ideas/generated/{id}/add-to-watchlist

Add the idea's ticker to the user's watchlist and create a buy zone alert rule.

**Response 200:**
```json
{
  "ticker": "NVDA",
  "watchlist_entry_created": true,
  "alert_rule_created": true,
  "idea_id": 1
}
```

**Idempotent:** If ticker is already in the watchlist, returns 200 with `watchlist_entry_created: false`.

---

##### GET /api/ideas/generated/last-scan

**Response 200:**
```json
{
  "last_scan_at": "2026-03-24T10:00:00Z",
  "ideas_generated": 47,
  "next_scan_at": "2026-03-24T11:00:00Z"
}
```

---

### 13. Scheduler Jobs

Both jobs are added to the **existing** `scheduler/jobs.py`. No second APScheduler instance is created.

#### Job 1: Live Scanner (every 5 minutes, market hours)

```python
scheduler.add_job(
    run_live_scanner,
    "cron",
    day_of_week="mon-fri",
    hour="9-15",
    minute="*/5",
    id="live_scanner",
    replace_existing=True,
)
```

**Job logic (`scheduler/tasks/run_live_scanner.py`):**

```python
async def run_live_scanner():
    """
    1. is_market_hours() check — return immediately if outside hours.
    2. Query all distinct (user_id, ticker) pairs from user_watchlist
       where alert_enabled=True.
    3. For each pair: call evaluate_buy_signal(ticker, user_id, db).
    4. BuyNowSignal is persisted inside evaluate_buy_signal.
    5. Notification dispatched inside evaluate_buy_signal
       when all_conditions_pass=True.
    6. Log summary: N tickers scanned, M signals fired.
    """
```

**Idempotency:** The 4-hour cooldown check (`"no_duplicate_signal_in_cooldown"`) inside `evaluate_buy_signal` prevents duplicate notifications within the same window. The scheduler itself does not track state.

#### Job 2: Idea Generator (every 60 minutes, market hours)

```python
scheduler.add_job(
    run_idea_generator,
    "cron",
    day_of_week="mon-fri",
    hour="9-15",
    minute="0",
    id="idea_generator",
    replace_existing=True,
)
```

**Job logic (`scheduler/tasks/run_idea_generator.py`):**

```python
async def run_idea_generator():
    """
    1. is_market_hours() check — return immediately if outside hours.
    2. Run news_scanner_service.scan_news() — returns list[NewsItem].
    3. Run idea_generator_service.scan_by_theme() — returns list[IdeaCandidate].
    4. Run idea_generator_service.scan_technical_universe() — returns list[IdeaCandidate].
    5. Deduplicate: merge same-ticker results; combined reason_summary; highest idea_score.
    6. Compute idea_score for all candidates.
    7. Delete existing generated_ideas rows where:
       - expires_at < now()  (always delete expired)
       - added_to_watchlist = False (replace non-actioned rows from previous batch)
    8. Insert top 50 candidates as new GeneratedIdea rows
       (expires_at = now() + 24 hours).
    9. Update last_scan metadata (stored in a process-level dict or a single-row
       system_scan_metadata table — see Open Questions).
    """
```

#### Market hours utility

```python
# utils/market_hours.py
from datetime import datetime
import pytz

def is_market_hours() -> bool:
    """Returns True if current time is between 9:30 AM and 4:00 PM ET on a weekday."""
    et = pytz.timezone("America/New_York")
    now = datetime.now(et)
    if now.weekday() >= 5:   # Saturday=5, Sunday=6
        return False
    market_open  = now.replace(hour=9,  minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0,  second=0, microsecond=0)
    return market_open <= now <= market_close
```

This utility is new. The V2 scheduler jobs use inline time checks; V3 centralises the logic here and all new jobs import it.

---

### 14. Frontend Components

#### 14.1 Opportunities page changes

The existing `frontend/app/opportunities/page.tsx` is extended. The existing watchlist sidebar panel (introduced in a prior bug-fix commit) is replaced by the full `WatchlistTable` as the primary page content.

##### WatchlistTable.tsx

Location: `frontend/components/opportunities/WatchlistTable.tsx`

- Full-width table rendering all columns from Section 4.3.
- Expandable rows: click a row to show `EstimatedEntryPanel` inline.
- Each row has an inline trash-icon "Remove" button.
- Rows in a loading/calculating state show a gray "Checking…" skeleton in Signal Status.
- Default sort: STRONG BUY rows first, then by `backtest_confidence` descending.
- Filter controls: "Ready only" toggle + theme chip set above the table.

##### BuyNowBadge.tsx

Location: `frontend/components/opportunities/BuyNowBadge.tsx`

States:
- **STRONG BUY** — green background, pulsing dot, bold white text.
- **Watching** — gray background, no pulse.
- **Checking…** — amber background, spinner.
- **Not Ready** — gray, no pulse.

Tooltip (on hover): renders a 10-row condition checklist with green checkmark or red X per condition, using the `condition_details` array from the API response.

##### EstimatedEntryPanel.tsx

Location: `frontend/components/opportunities/EstimatedEntryPanel.tsx`

Renders the expanded row detail:
```
Estimated entry zone: $[low] – $[high]
Ideal entry price:    $[ideal]
Based on [N] similar historical setups over 5 years.
90-day positive outcome rate: [win_rate]%  |  Worst drawdown: -[drawdown]%
Invalidation level: $[invalidation]
```

All monetary values formatted with `Intl.NumberFormat` (2 decimal places, USD).

##### Add ticker input

Simple `<input type="text">` + "Add" button at the top of the Opportunities page. On submit:
- POST `/api/watchlist`.
- New row appears immediately in "Checking…" state.
- Input clears after successful add.
- Shows inline error on 409 (already in watchlist) or 422 (invalid ticker).

---

#### 14.2 Ideas page changes

The existing `frontend/app/ideas/page.tsx` gains the generated idea feed alongside (or replacing) the manual idea cards section.

##### IdeaFeed.tsx

Location: `frontend/components/ideas/IdeaFeed.tsx`

- Filter bar: All / News / Theme / Technical tabs (maps to `?source=` query param).
- Theme filter chips: AI, Energy, Defense, Space, Semiconductors.
- "Last updated X minutes ago" banner using `last-scan` endpoint data.
- Refresh button: calls `POST /api/scanner/run-now` equivalent for ideas; shows spinner during fetch; re-fetches idea list on completion.
- Scrollable list of `GeneratedIdeaCard` components sorted by `idea_score`.

##### GeneratedIdeaCard.tsx

Location: `frontend/components/ideas/GeneratedIdeaCard.tsx`

Uses `shadcn/ui Card` component. Renders all fields from Section 5.3 idea card spec. Includes:
- Ticker + company name header.
- Theme tag badges (including megatrend tags highlighted).
- Entry priority amber badge: "Near 52-week low" and/or "At weekly support" (shown when applicable).
- `reason_summary` paragraph with optional news headline link.
- Price + zone data block.
- Competitive moat block: moat score badge (green >= 0.70, red < 0.30) + moat description.
- Financial quality block: score label + `financial_flags` summary; shows "Financials unavailable" when data is missing.
- Confidence + win rate badges.
- `AddToWatchlistButton` (see below).
- "View Chart" link to dashboard with ticker pre-selected.
- "Generated X minutes ago" footer badge.

##### AddToWatchlistButton.tsx

Location: `frontend/components/ideas/AddToWatchlistButton.tsx`

States:
- Default: `[ + Add to Watchlist ]` — clickable.
- Loading: spinner, disabled.
- Added: `[ Added ✓ ]` — green, disabled. Persists for the session.

On success: triggers a toast notification via the existing toast system.

---

### 15. Notification Content Templates

#### In-app notification (STRONG BUY fired)

```
STRONG BUY SIGNAL — [TICKER]
All conditions confirmed. Historically favorable entry zone: $[low] – $[high]
Ideal entry: $[ideal] | Confidence: [confidence]% | 90-day win rate: [win_rate]%
Worst historical drawdown: -[drawdown]% | Invalidation: $[invalidation]
This is based on historical data, not a guarantee.
```

#### Email notification

**Subject:** `NextGenStock: Buy signal triggered for [TICKER]`

**Body:** Same content as the in-app notification, plus:
```
View your Opportunities page: [link to /opportunities]
```

Both templates are rendered inside `notification_service.dispatch_notification()`. The existing service already abstracts channel routing — V3 adds no new notification channels.

---

### 16. Approved Wording Constraints

The following words and phrases are **prohibited** in all UI text, notification copy, log messages surfaced to users, and API response strings:

| Prohibited | Approved replacement |
|---|---|
| "guaranteed" | "historically favorable" |
| "safe" (in investment context) | "high-probability entry zone" |
| "certain to go up" | "positive outcome rate" |
| "can't lose" | "confidence score" |

These constraints apply to `reason_summary`, `thesis`, notification bodies, tooltip text, and card copy. They do not apply to internal log messages.

---

### 17. Integration Points — Extend vs Create New

| Module | Action | Rationale |
|---|---|---|
| `buy_zone_service.calculate_buy_zone()` | **Reuse as-is** | Already computes zone range, confidence, win rate; used by `evaluate_buy_signal` |
| `analog_scoring_service.find_analog_matches()` | **Reuse as-is** | Powers 90-day win rate + historical setup count in `BuyNowSignal` |
| `theme_scoring_service` | **Reuse as-is** | Theme tags sourced from `StockThemeScore` table |
| `alert_engine_service` | **Extend** — add `BUY_NOW` alert type handling | New type dispatches immediately on `all_conditions_pass=True`; existing alert polling loop is separate |
| `notification_service.dispatch_notification()` | **Reuse as-is** | Accepts `subject`, `body`, `metadata`; V3 calls it with new content |
| `scheduler/jobs.py` | **Extend** — add 2 new `add_job` calls | No new scheduler instance |
| `api/opportunities.py` | **Extend** — add signal status fields to response | Extend `OpportunityOut` schema |
| `api/scanner.py` | **Extend** — add `/status` and `/run-now` endpoints | Keep existing `/run`, `/estimate-buy-prices`, `/ideas`, `/ideas/{ticker}/save` |
| `api/ideas.py` | **Extend** — add `/generated`, `/generated/{id}/add-to-watchlist`, `/generated/last-scan` | New sub-resource under existing ideas router |
| `idea_generator_service.py` | **Extend** — add `scan_by_theme()` and `scan_technical_universe()` methods | `generate_ideas()` (V2) is retained for backward compatibility with `GET /api/scanner/ideas` |
| `models/alert.py` PriceAlertRule | **Reuse as-is** | Auto-created with `alert_type="entered_buy_zone"` on add-to-watchlist |
| `WatchlistIdea` / `WatchlistIdeaTicker` | **Reuse for idea save** | `POST /api/ideas/generated/{id}/add-to-watchlist` creates a `WatchlistIdea` entry; scanner watchlist uses new `UserWatchlist` table |
| `strategies/conservative.py` HMM regime | **Reuse** | `trend_regime_not_bearish` condition imports the same regime detection logic |

**New files created (not extensions):**
- `backend/app/models/buy_signal.py`
- `backend/app/models/generated_idea.py`
- `backend/app/models/user_watchlist.py`
- `backend/app/services/live_scanner_service.py`
- `backend/app/services/news_scanner_service.py`
- `backend/app/services/buy_signal_service.py`
- `backend/app/services/moat_scoring_service.py`
- `backend/app/services/financial_quality_service.py`
- `backend/app/services/entry_priority_service.py`
- `backend/app/scheduler/tasks/run_live_scanner.py`
- `backend/app/scheduler/tasks/run_idea_generator.py`
- `backend/app/utils/market_hours.py`
- `frontend/components/opportunities/WatchlistTable.tsx`
- `frontend/components/opportunities/BuyNowBadge.tsx`
- `frontend/components/opportunities/EstimatedEntryPanel.tsx`
- `frontend/components/ideas/GeneratedIdeaCard.tsx`
- `frontend/components/ideas/IdeaFeed.tsx`
- `frontend/components/ideas/AddToWatchlistButton.tsx`

---

### 18. Database Migrations

Three new Alembic migrations, chained from the current V2 head. Each implements `downgrade()`.

| Order | Table | Migration file |
|---|---|---|
| 1 | `user_watchlist` | `xxxx_add_user_watchlist.py` |
| 2 | `buy_now_signals` | `xxxx_add_buy_now_signals.py` |
| 3 | `generated_ideas` | `xxxx_add_generated_ideas.py` |

**Note on `user_watchlist`:** The spec asks to check if `watchlist_ideas` already covers this. It does not — `WatchlistIdea` requires a thesis title and is linked through a many-to-many ticker join. A direct `(user_id, ticker)` table is cleaner for scanner use.

---

### 19. Acceptance Criteria

All items are testable via E2E or unit tests as specified in Section 20.

- [ ] AC-01: User can add a ticker to the watchlist via the text input on the Opportunities page; the row appears immediately in "Checking…" state.
- [ ] AC-02: Each watchlist ticker shows the estimated buy zone range and ideal entry price once the buy zone calculation completes.
- [ ] AC-03: The live scanner runs every 5 minutes during market hours (9:30 AM – 4:00 PM ET, Mon–Fri); it does not run outside those hours.
- [ ] AC-04: A "STRONG BUY" signal fires only when ALL 10 conditions pass; no partial signal is shown or dispatched.
- [ ] AC-05: An in-app notification is dispatched within one 5-minute scan cycle of all 10 conditions becoming true.
- [ ] AC-06: An email notification is dispatched with ticker, zone, confidence, win rate, and a link to the Opportunities page.
- [ ] AC-07: A 4-hour cooldown prevents duplicate STRONG BUY notifications for the same (user, ticker) pair.
- [ ] AC-08: The `BuyNowBadge` tooltip lists all 10 conditions with individual pass/fail icons.
- [ ] AC-09: The user can toggle alerts on or off per ticker; no notification is dispatched when the toggle is off.
- [ ] AC-10: The Ideas page auto-populates with generated cards every 60 minutes during market hours without any user action.
- [ ] AC-11: Each idea card shows: ticker, company name, reason flagged, buy zone, news headline (if applicable), confidence, and 90-day win rate.
- [ ] AC-12: Idea cards can be filtered by source (News / Theme / Technical) and by theme tag.
- [ ] AC-13: Ideas expire after 24 hours and are removed from the feed automatically on the next job cycle.
- [ ] AC-14: One-click "Add to Watchlist" from an idea card creates a watchlist entry AND a `PriceAlertRule` with `alert_type="entered_buy_zone"` in a single action.
- [ ] AC-15: The "Add to Watchlist" button shows "Added ✓" and is disabled after a successful add; `added_to_watchlist=True` is persisted.
- [ ] AC-16: News scanning uses only the five free RSS feeds listed in Section 10; no paid API keys are required.
- [ ] AC-17: If all RSS feeds fail, the job continues with theme + technical scanners and logs the failure.
- [ ] AC-18: All new endpoints require `Depends(get_current_user)` and all DB queries are scoped to `user_id`.
- [ ] AC-19: No UI text, notification copy, or API response string uses the prohibited words listed in Section 16.
- [ ] AC-20: The idea generator job replaces the previous idea batch on each run (rows with `added_to_watchlist=False` are replaced; rows with `added_to_watchlist=True` are retained).
- [ ] AC-21: Ideas are ranked by `megatrend_fit_score` — stocks fitting AI / Robotics / Longevity score 1.0; other themes score 0.5; no theme connection scores 0.0.
- [ ] AC-22: Every idea card shows a moat score badge: green for score >= 0.70, red "Low competitive moat — higher risk" for score < 0.30.
- [ ] AC-23: Every idea card shows a financial quality badge; "Financials unavailable" is shown when yfinance data is missing.
- [ ] AC-24: Stocks within 10% of their 52-week low show an amber "Near 52-week low" badge and receive a +0.15 idea_score boost.
- [ ] AC-25: Stocks at weekly chart support (price within 2x ATR of most recent weekly swing low) show an amber "At weekly support" badge and receive a +0.10 idea_score boost.
- [ ] AC-26: Both entry priority badges and boosts apply simultaneously when both conditions are true (max +0.25, capped at 1.0).
- [ ] AC-27: `HIGH_MOAT_TICKERS` seeds moat scores for NVDA, ISRG, ASML, ILMN, MSFT, TSM, V, MA, LLY, NVO before any yfinance fallback.
- [ ] AC-28: `SCAN_UNIVERSE` includes LLY, NVO, CRSP, ILMN (longevity) and PLTR, TSLA, RKLB alongside the full list defined in Section 11.
- [ ] AC-29: ETFs in `UNIVERSE_CONTEXT_ONLY` (SPY, QQQ, IWM, XLE, XLK, XLF) are never included in idea generation output.

---

### 20. Testing Requirements

#### Backend unit tests

| File | Coverage |
|---|---|
| `test_buy_signal_service.py` | Each of the 10 conditions independently; all-pass scenario produces `all_conditions_pass=True`; single-fail produces correct `suppressed_reason`; 4-hour cooldown suppresses re-fire |
| `test_live_scanner.py` | `is_market_hours()` returns False on weekends and outside 9:30–16:00 ET; scanner runs on valid weekday market hours; cooldown logic |
| `test_news_scanner.py` | RSS feed parsing with valid fixture XML; ticker extraction from headlines; graceful failure when one feed returns 500; graceful failure when all feeds fail |
| `test_idea_generator.py` | Deduplication: same ticker from two sources merges correctly; `idea_score` formula (all 6 components + entry priority boosts); expiry logic (rows with `expires_at < now()` deleted) |
| `test_technical_scanner.py` | Uptrend filter (above 50d + 200d MA); RSI 35–55 range; support proximity check; 3-of-4 pass threshold |
| `test_megatrend_filter.py` | Megatrend tag assignment; `megatrend_fit_score` values: 1.0 for AI/Robotics/Longevity, 0.5 for other theme, 0.0 for no theme; non-megatrend stocks deprioritized but not blocked |
| `test_moat_scoring.py` | `HIGH_MOAT_TICKERS` seed lookup returns correct pre-seeded values; yfinance fallback heuristic activates when ticker not in seed map; missing yfinance data handled gracefully |
| `test_financial_quality.py` | yfinance `.info` field parsing for `revenueGrowth`, `grossMargins`, `earningsGrowth`, `operatingMargins`; missing data defaults to 0.0 with `financial_flags=["financials_unavailable"]`; score output range 0.0–1.0 |
| `test_entry_priority.py` | 52-week low detection: price <= fiftyTwoWeekLow * 1.10 triggers True; weekly support detection: price within 2x ATR of most recent 1W pivot low; additive boost logic: both True = +0.25, capped at 1.0 |

Mock: `yfinance`, RSS HTTP responses (httpx), `notification_service.dispatch_notification`, Alpaca data API.

#### Integration tests

- Ticker added to watchlist → `calculate_buy_zone()` called in background → `BuyNowSignal` evaluated → notification dispatched when all conditions pass.
- Idea card "Add to Watchlist" → `UserWatchlist` entry created → `PriceAlertRule` created with `entered_buy_zone` type → `added_to_watchlist=True` set on idea row.
- News scan returns valid RSS fixture → ticker extracted → `GeneratedIdea` row created with `source="news"` and `news_headline` populated.

---

### 21. Dependencies and Risks

| Item | Risk | Mitigation |
|---|---|---|
| yfinance rate limits | Scanner scans N users × M tickers every 5 minutes; heavy load may hit yfinance throttles | Batch requests; add per-ticker TTL cache (minimum 3 minutes) to avoid redundant fetches within same scan window |
| RSS feed availability | WSJ and Yahoo Finance feeds may change URLs or become paywalled | Fail-gracefully design already specified; monitor feed health; fallback to technical-only if news fails |
| `near_earnings` condition accuracy | V2 stores a manual `near_earnings` flag on `WatchlistIdeaTicker`; no live earnings calendar | Flag is best-effort in V3; live earnings API deferred to V4; document the limitation in the UI |
| `is_market_hours()` timezone correctness | Incorrect ET timezone handling could run or suppress jobs at wrong times | Use `pytz.timezone("America/New_York")` which handles DST automatically; add a unit test for DST boundary |
| process-local idea cache (existing) | `idea_generator_service.py` cache is process-local; Render multi-worker deploys get stale results | Acceptable for current single-worker Render free tier; promote to Redis in V4 as noted in existing code |
| `generated_ideas` table growth | Without proper expiry, table grows unboundedly | Expiry + batch-replace logic in `run_idea_generator`; rows with `added_to_watchlist=True` retained indefinitely — add a 30-day cap for those in V4 |
| `buy_now_signals` table growth | Every 5-minute scan for every user+ticker writes a row | Add a DB-level retention job to prune rows older than 30 days; or archive to a `buy_now_signals_archive` table |

---

### 22. Implementation Order

Ordered by dependency. Each step should pass lint + type checks before proceeding to the next.

1. `backend/app/utils/market_hours.py` — new utility; no dependencies.
2. Alembic migrations: `user_watchlist`, `buy_now_signals`, `generated_ideas` (three chained migrations, each with `downgrade()`).
3. ORM models: `user_watchlist.py`, `buy_signal.py`, `generated_idea.py`.
4. Pydantic schemas for all three new models (request + response DTOs).
5. `news_scanner_service.py` — RSS fetch + keyword extraction + ticker matching.
5b. `moat_scoring_service.py` — `HIGH_MOAT_TICKERS` seed lookup + yfinance fallback heuristic.
5c. `financial_quality_service.py` — yfinance `.info` field parsing + quality score computation.
5d. `entry_priority_service.py` — 52-week low check + weekly support detection on 1W OHLCV.
6. `buy_signal_service.py` — 10-condition gate; calls `buy_zone_service` + yfinance; persists `BuyNowSignal`; dispatches notification.
7. Extend `idea_generator_service.py` — add `scan_by_theme()` (with moat/financial/entry-priority steps) and `scan_technical_universe()` methods; add `SCAN_UNIVERSE` + `HIGH_MOAT_TICKERS` + `UNIVERSE_CONTEXT_ONLY` constants; add deduplication + full `idea_score` formula.
8. `live_scanner_service.py` — batch wrapper: queries `user_watchlist`, iterates (user, ticker) pairs, calls `buy_signal_service.evaluate_buy_signal()`.
9. Scheduler tasks: `scheduler/tasks/run_live_scanner.py` and `scheduler/tasks/run_idea_generator.py`; register both in `scheduler/jobs.py`.
10. API: `POST /api/watchlist`, `DELETE /api/watchlist/{ticker}` (new routes in `api/opportunities.py` or a new `api/watchlist.py`).
11. API: Extend `GET /api/opportunities` response with signal status fields; add `signal_status` filter param.
12. API: Extend `api/scanner.py` with `GET /api/scanner/status` and `POST /api/scanner/run-now`.
13. API: Add `/generated`, `/generated/{id}/add-to-watchlist`, `/generated/last-scan` to `api/ideas.py`.
14. Notification wiring: verify `buy_signal_service` → `notification_service.dispatch_notification()` produces correct in-app + email content per the templates in Section 15.
15. Frontend: `WatchlistTable.tsx`, `BuyNowBadge.tsx`, `EstimatedEntryPanel.tsx` — integrate into `opportunities/page.tsx`.
16. Frontend: `GeneratedIdeaCard.tsx` (with moat/financial/entry-priority blocks), `IdeaFeed.tsx`, `AddToWatchlistButton.tsx` — integrate into `ideas/page.tsx`.
17. Backend unit tests (nine test files listed in Section 20).
18. Integration tests (three scenarios listed in Section 20).

---

### 23. Open Questions

| # | Question | Decision needed by |
|---|---|---|
| OQ-01 | Should `POST /api/watchlist` live in `api/opportunities.py` or a new `api/watchlist.py`? Option A keeps the router count lower; Option B is cleaner separation. | Before step 10 |
| OQ-02 | How is `last_scan_at` stored for `GET /api/ideas/generated/last-scan`? Options: (a) process-level dict, (b) a `system_scan_metadata` single-row table, (c) query `MAX(generated_ideas.generated_at)`. Option (c) is zero-overhead but only works if ideas table is always populated. | Before step 13 |
| OQ-03 | The `not_near_earnings` condition currently relies on the manual `near_earnings` flag from V2 `WatchlistIdeaTicker`. For tickers added directly via `UserWatchlist` (not through an idea), this flag is not set. Should V3 default to `near_earnings=False` (pass condition) or `near_earnings=True` (conservative, suppress)? | Before step 6 |
| OQ-04 | Should `buy_now_signals` rows be pruned automatically? If yes: rolling 30-day retention by a scheduled cleanup job, or on-read filtering only? | Before step 2 |
| OQ-05 | The spec states `idea_score` replaces the existing `composite_score` for ranked ideas. Confirm that `GET /api/scanner/ideas` (V2) continues to return `composite_score`-ranked results from the in-process cache, while `GET /api/ideas/generated` (V3) uses `idea_score` from the DB. No migration of V2 behavior. | Before step 7 |

---

### 24. Appendix

#### A. Supported themes

```python
SUPPORTED_THEMES = [
    "ai",
    "semiconductors",
    "defense",
    "space",
    "energy",
    "renewable_energy",
    "power_infrastructure",
    "data_centers",
]
```

#### B. Conservative scanner definition (from spec, for reference)

Conservative means all three of:
1. Stock is in an established uptrend (price above both 50-day AND 200-day MA).
2. Multiple confirmation signals agree: RSI + volume + trend regime all aligned.
3. Entry is near a proven support level — never chasing a breakout.

#### C. Key existing file paths relevant to V3

| File | Purpose |
|---|---|
| `backend/app/services/buy_zone_service.py` | `calculate_buy_zone()` — reused for backtest zone per ticker |
| `backend/app/services/analog_scoring_service.py` | `find_analog_matches()`, `score_analogs()` — 90d win rate |
| `backend/app/services/theme_scoring_service.py` | Theme tags + `theme_score_total` |
| `backend/app/services/alert_engine_service.py` | Alert eval loop — extend for `BUY_NOW` type |
| `backend/app/services/notification_service.py` | `dispatch_notification(user_id, subject, body, metadata)` |
| `backend/app/services/idea_generator_service.py` | `generate_ideas()` + `STOCK_UNIVERSE` — extend, do not replace |
| `backend/app/services/scanner_service.py` | `scan_watchlist()`, `estimate_buy_price()` — V2 scanner logic |
| `backend/app/api/scanner.py` | Existing scanner router — extend with `/status` and `/run-now` |
| `backend/app/api/opportunities.py` | Extend response shape + add watchlist CRUD |
| `backend/app/api/ideas.py` | Extend with `/generated` sub-resource |
| `backend/app/models/alert.py` | `PriceAlertRule` — auto-created on add-to-watchlist |
| `backend/app/models/idea.py` | `WatchlistIdea`, `WatchlistIdeaTicker` — used for idea-originated watchlist entries |
| `backend/app/scheduler/` | Add two new task files; register in `jobs.py` |
| `frontend/app/opportunities/page.tsx` | Extend with WatchlistTable as primary content |
| `frontend/app/ideas/page.tsx` | Extend with IdeaFeed + GeneratedIdeaCard |
| `frontend/lib/watchlist.ts` | Shared watchlist hook — review for reuse with `UserWatchlist` API |
