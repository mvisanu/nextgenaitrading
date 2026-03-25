# NextGenStock — Task Breakdown

## Part 1: Core Trading Platform (V1)

> Generated from: PRD.md + prompt.md
> Generated on: 2026-03-19
> Total tasks: 62

---

## Assumptions & Clarifications

- **OQ-01 (Robinhood SDK):** `RobinhoodClient` is implemented against the official Robinhood crypto REST API directly using `httpx` (no third-party SDK). The interface mirrors `AbstractBrokerClient` exactly. This avoids unofficial library dependencies and keeps the broker abstraction clean.
- **OQ-02 (Pagination):** Simple time-ordered lists with a configurable `limit` query parameter (default 50) are sufficient at launch. Full cursor-based pagination is a post-MVP enhancement.
- **OQ-03 (Live polling):** Live trading positions and orders refresh on user action only (no auto-polling). A manual "Refresh" button is provided. This reduces Render load and keeps the v1 architecture simple.
- **OQ-04 (Variant count):** AI Pick runs a maximum of 12 variants; Buy Low / Sell High runs a maximum of 8 variants. These caps are defined as named constants and can be tuned without a code change.
- **OQ-05 (Chart data endpoint):** `GET /backtests/{id}/chart-data` is sufficient. No separate raw OHLCV endpoint is added in v1.
- **OQ-06 (Artifact storage):** Pine Script is stored as a `TEXT` column in `WinningStrategyArtifact`. Object storage is a post-MVP consideration.
- **OQ-07 (Risk disclaimer on live page):** A financial risk disclaimer is shown as a persistent `Alert` on `/live-trading` regardless of dry-run state, in addition to the README. This satisfies NFR-18.
- **Indicator library:** `ta` is used for all technical indicators (not `pandas_ta`), consistent with the prior project convention in memory.
- **Conservative / Aggressive modes via `/backtests/run`:** These two modes are also accessible through the backtest endpoint by passing `mode: "conservative"` or `mode: "aggressive"`. The `/strategies/ai-pick/run` and `/strategies/buy-low-sell-high/run` endpoints are the optimizer-specific entry points.
- **`assert_ownership` placement:** Implemented as a utility function in `backend/app/core/security.py` and imported by all service modules.
- **Alembic autogenerate:** All ORM models are imported into `alembic/env.py` so `alembic revision --autogenerate` produces correct migrations.
- **Frontend API proxy:** All backend calls from the Next.js frontend go through `NEXT_PUBLIC_API_BASE_URL`; credentials are included via `credentials: 'include'` on every fetch. No Next.js API route proxy layer is added — direct cross-origin requests with cookies work because CORS is configured on FastAPI.
- **`ta` library choice:** Consistent with stock-app project convention; document the choice in `requirements.txt` comments.

---

## Parallel Work Waves

**Wave 1 — Foundation (no blockers):**
T-01, T-02, T-03, T-04

**Wave 2 — Backend Core:**
T-05, T-06 (after T-01, T-02)

**Wave 3 — Auth Backend + DB Models:**
T-07, T-08 (after T-05, T-06)

**Wave 4 — Auth Frontend + Middleware:**
T-09, T-10 (after T-07)

**Wave 5 — Broker & Profile Backend:**
T-11, T-12 (after T-07, T-08)

**Wave 6 — Market Data + Strategy Core:**
T-13, T-14, T-15, T-16 (after T-07, T-08)

**Wave 7 — Strategy Optimizers + Backtesting Engine:**
T-17, T-18, T-19 (after T-13, T-14, T-15, T-16)

**Wave 8 — Strategy & Backtest API Endpoints:**
T-20, T-21, T-22 (after T-17, T-18, T-19)

**Wave 9 — Live Trading + Artifacts API:**
T-23, T-24 (after T-11, T-20, T-21)

**Wave 10 — Frontend Layout Shell + Shared Components:**
T-25, T-26, T-27, T-28, T-29 (after T-09, T-10)

**Wave 11 — Frontend Chart Components:**
T-30, T-31, T-32 (after T-25)

**Wave 12 — Frontend Pages (can run in parallel once shell exists):**
T-33, T-34, T-35, T-36, T-37, T-38 (after T-25 through T-32, T-20 through T-24)

**Wave 13 — Integration, E2E Validation, Deployment:**
T-39, T-40, T-41, T-42 (after all prior tasks)

**Wave 14 — Hardening & Documentation:**
T-43, T-44 (after T-39 through T-42)

---

## Tasks

---

### T-01 · Initialize backend project scaffold

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | none |

**Description:**
Create the `backend/` directory tree exactly as specified in the PRD appendix. Initialize a Python virtual environment, create `requirements.txt` with all dependencies pinned, create `.env.example` with all required environment variables documented, and create `backend/app/main.py` with a minimal FastAPI app that starts cleanly.

**Acceptance Criteria:**
- [ ] `backend/` directory tree matches the canonical structure in PRD Appendix A: `app/main.py`, `app/core/`, `app/auth/`, `app/api/`, `app/models/`, `app/schemas/`, `app/db/`, `app/broker/`, `app/services/`, `app/strategies/`, `app/optimizers/`, `app/backtesting/`, `app/artifacts/`, `alembic/`
- [ ] `requirements.txt` includes: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]>=2.0`, `alembic`, `asyncpg`, `pydantic>=2.0`, `python-jose[cryptography]`, `passlib[bcrypt]`, `cryptography`, `yfinance`, `pandas`, `numpy`, `hmmlearn`, `scikit-learn`, `ta`, `alpaca-py`, `httpx`, `python-dotenv`
- [ ] `.env.example` documents all 14 backend environment variables listed in PRD section 14
- [ ] `uvicorn app.main:app --reload` starts without errors and `GET /healthz` returns HTTP 200
- [ ] `pyproject.toml` or `setup.cfg` configures `ruff` for linting and `mypy` for type checking; both pass on the scaffold

---

### T-02 · Initialize frontend project scaffold

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | none |

**Description:**
Bootstrap the `frontend/` directory using `create-next-app` with TypeScript, Tailwind CSS, and App Router. Install all required npm packages. Create the full directory structure from PRD Appendix A. Create `.env.local.example` with `NEXT_PUBLIC_API_BASE_URL`.

**Acceptance Criteria:**
- [ ] `frontend/` directory tree matches PRD Appendix A: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `app/dashboard/page.tsx`, `app/strategies/page.tsx`, `app/backtests/page.tsx`, `app/live-trading/page.tsx`, `app/artifacts/page.tsx`, `app/profile/page.tsx`, `components/ui/`, `components/layout/`, `components/charts/`, `components/strategy/`, `hooks/`, `lib/api.ts`, `lib/auth.ts`, `types/`, `middleware.ts`
- [ ] npm packages installed: `shadcn/ui` (init'd), `react-hook-form`, `zod`, `@tanstack/react-query`, `lightweight-charts`, `recharts`, `react-plotly.js`, `plotly.js-dist-min`
- [ ] `next dev` starts without errors and `http://localhost:3000` loads
- [ ] TypeScript strict mode enabled in `tsconfig.json`
- [ ] Tailwind CSS configured with the dark background theme (`#0a0a0a` base, green `#22c55e` / red `#ef4444` accents) described in PRD section 11

---

### T-03 · Configure PostgreSQL connection and Alembic

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | none |

**Description:**
Create `backend/app/db/session.py` with an async SQLAlchemy engine and session factory. Create `backend/app/db/base.py` with the declarative base. Initialize Alembic with `alembic init alembic` and configure `alembic/env.py` to use the async engine and import all models from `app/models/`.

**Acceptance Criteria:**
- [ ] `backend/app/db/session.py` exports `async_engine`, `AsyncSessionLocal`, and an `async_get_db()` dependency function
- [ ] `backend/app/db/base.py` exports `Base` (SQLAlchemy `DeclarativeBase`)
- [ ] `alembic/env.py` imports `Base.metadata` and configures the async Alembic runner correctly
- [ ] `alembic upgrade head` runs without errors against a local PostgreSQL instance
- [ ] Connection pool settings respect `POOL_SIZE` and `MAX_OVERFLOW` env vars (default 5 / 10)

---

### T-04 · Configure backend settings and CORS

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | XS |
| **Blocked by** | none |

**Description:**
Create `backend/app/core/config.py` using Pydantic `BaseSettings` to load all environment variables. Configure FastAPI's `CORSMiddleware` in `main.py` using `CORS_ORIGINS`. Add `trusted_hosts` middleware for production.

**Acceptance Criteria:**
- [ ] `Settings` class loads all 14 backend env vars from `.env` with correct types (e.g., `ACCESS_TOKEN_EXPIRE_MINUTES: int = 15`)
- [ ] `settings` singleton is importable from `app.core.config`
- [ ] CORS middleware allows origins from `CORS_ORIGINS`, allows credentials, and permits `GET`, `POST`, `PATCH`, `DELETE` methods
- [ ] Attempting a request from an unlisted origin returns HTTP 403 (verified with a curl test)
- [ ] `GET /healthz` returns `{"status": "ok"}` — used by Render health checks

---

### T-05 · Define all SQLAlchemy ORM models

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-03, T-04 |

**Description:**
Define all 13 ORM models listed in PRD section 9 in `backend/app/models/`. Each model must import `Base` from `app.db.base`, use proper SQLAlchemy 2.x mapped column syntax, and include all fields listed in the PRD data model table. All user-owned models must have a `user_id` FK with `ondelete="CASCADE"`.

**Acceptance Criteria:**
- [ ] All 13 models exist: `User`, `UserProfile`, `UserSession`, `BrokerCredential`, `StrategyRun`, `TradeDecision`, `BrokerOrder`, `PositionSnapshot`, `CooldownState`, `TrailingStopState`, `VariantBacktestResult`, `WinningStrategyArtifact`, `BacktestTrade`
- [ ] Every user-owned model has `user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)`
- [ ] `BrokerCredential.provider` is a `VARCHAR` with a CHECK constraint limiting values to `'alpaca'` and `'robinhood'`
- [ ] `StrategyRun`, `BacktestTrade`, and `WinningStrategyArtifact` all include a `symbol` column
- [ ] All models are imported in `alembic/env.py`; `alembic revision --autogenerate -m "initial"` produces a migration that creates all 13 tables without errors

---

### T-06 · Create Pydantic schemas for all API contracts

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-05 |

**Description:**
Create all Pydantic v2 request and response schemas in `backend/app/schemas/`. Group by domain: `auth.py`, `profile.py`, `broker.py`, `strategy.py`, `backtest.py`, `live.py`, `artifact.py`. Include the exact `RunStrategyRequest` schema from the PRD (with `symbol_uppercase` validator). Schemas must never include `password_hash`, `encrypted_secret_key`, or any decrypted credential field in response models.

**Acceptance Criteria:**
- [ ] `RunStrategyRequest` implements the exact schema from the PRD including `@field_validator("symbol")` that strips and upper-cases the value
- [ ] `BrokerCredentialResponse` returns `api_key` as a masked string (e.g., last 4 chars visible: `****ABCD`) — never the raw or decrypted value
- [ ] `UserResponse` does not include `password_hash`
- [ ] All response schemas use `model_config = ConfigDict(from_attributes=True)` for ORM compatibility
- [ ] `TimeframeEnum` is defined as `Literal["1d", "1h", "4h", "1wk"]` and reused across schemas
- [ ] `mypy` passes on all schema files with no `Any` leakage

---

### T-07 · Implement JWT security and `get_current_user` dependency

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-05, T-06 |

**Description:**
Implement `backend/app/core/security.py` with all JWT and cookie helper functions. Implement `backend/app/auth/dependencies.py` with the `get_current_user` FastAPI dependency. Implement the `assert_ownership` utility in `security.py`.

**Acceptance Criteria:**
- [ ] `create_access_token(user_id, email)` returns a signed JWT with claims `sub`, `email`, `type: "access"`, `exp` set to `ACCESS_TOKEN_EXPIRE_MINUTES` from settings
- [ ] `create_refresh_token(user_id)` returns a signed JWT with `type: "refresh"` and 7-day expiry
- [ ] `set_auth_cookies(response, access_token, refresh_token)` sets both tokens as HTTP-only, Secure (from `COOKIE_SECURE` setting), SameSite=Lax cookies
- [ ] `get_current_user` reads the `access_token` cookie, verifies signature and expiry, queries the `User` by `sub`, returns the ORM object, and raises `HTTPException(401)` on any failure
- [ ] `assert_ownership(record, current_user)` raises `HTTPException(403)` if `record.user_id != current_user.id`
- [ ] A unit test verifies that a tampered token raises 401 and a valid token returns the correct user

---

### T-08 · Implement auth router (register, login, refresh, logout, me)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-07 |

**Description:**
Implement `backend/app/auth/router.py` and `backend/app/auth/service.py` covering all five auth endpoints. The service layer handles password hashing, `UserSession` creation/rotation/revocation, and refresh token lifecycle.

**Acceptance Criteria:**
- [ ] `POST /auth/register` hashes the password with bcrypt, creates a `User` and a blank `UserProfile`, returns HTTP 201 with `UserResponse`; returns HTTP 409 on duplicate email
- [ ] `POST /auth/login` verifies bcrypt hash, creates a `UserSession` record with the refresh token's SHA-256 hash, sets both HTTP-only cookies, returns `UserResponse`
- [ ] `GET /auth/me` uses `Depends(get_current_user)`, returns the current `UserResponse`; returns 401 without a valid cookie
- [ ] `POST /auth/refresh` reads the refresh token cookie, finds a non-revoked, non-expired `UserSession` by hash, issues new access + refresh tokens, rotates the session (old record marked `revoked_at = now()`, new record inserted), returns HTTP 200
- [ ] `POST /auth/logout` sets `revoked_at` on the `UserSession`, clears both cookies, returns HTTP 200
- [ ] Raw JWT values and passwords are never written to logs at any level

---

### T-09 · Implement frontend auth context and `lib/auth.ts`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-07 |

**Description:**
Implement `frontend/lib/auth.ts` with `getCurrentUser()`, silent refresh logic on 401, and logout. Create a React context (`AuthContext`) that wraps the app and provides the current user object. Initialize TanStack Query client. This depends on T-07 being specced (contract known) but can be developed against a mocked backend.

**Acceptance Criteria:**
- [ ] `getCurrentUser()` calls `GET /auth/me` with `credentials: 'include'`; returns `null` on non-OK response
- [ ] `lib/api.ts` typed fetch wrapper retries once via `POST /auth/refresh` on a 401, then redirects to `/login` on a second 401 — tokens are never stored in `localStorage`
- [ ] `AuthProvider` component wraps `app/layout.tsx` and exposes `useAuth()` hook returning `{ user, isLoading, logout }`
- [ ] `logout()` calls `POST /auth/logout`, clears local auth state, and calls `router.push('/login')`
- [ ] TanStack Query `QueryClient` is configured with `staleTime: 30_000` and `retry: false` (retries are handled by the 401 interceptor, not TanStack)

---

### T-10 · Implement Next.js route protection middleware

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T-09 |

**Description:**
Implement `frontend/middleware.ts` to protect all non-public routes. The middleware reads the auth cookie and redirects to `/login` if it is missing or expired.

**Acceptance Criteria:**
- [ ] `middleware.ts` matches on all routes except `/(auth)/login`, `/(auth)/register`, and `/_next/` static assets
- [ ] A request to `/dashboard` without an auth cookie is redirected to `/login` with a `callbackUrl` search param
- [ ] A request to `/dashboard` with a valid (non-expired) cookie is allowed through
- [ ] The cookie name checked in middleware matches the name set by `set_auth_cookies()` in the backend
- [ ] `next build` completes without middleware-related type errors

---

### T-11 · Implement broker credential backend (encrypt/decrypt, CRUD, test)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-07, T-08 |

**Description:**
Implement `backend/app/services/credential_service.py` with Fernet `encrypt(value, key)` and `decrypt(value, key)` functions. Implement `backend/app/api/broker.py` with all five broker credential endpoints. Implement `backend/app/broker/base.py`, `broker/alpaca_client.py`, `broker/robinhood_client.py`, and `broker/factory.py` exactly as specified in the PRD.

**Acceptance Criteria:**
- [ ] `encrypt()` and `decrypt()` use `cryptography.fernet.Fernet` with the `ENCRYPTION_KEY` env var; a round-trip test confirms correctness
- [ ] `POST /broker/credentials` encrypts both `api_key` and `secret_key` before storing; the DB row contains only ciphertext
- [ ] `GET /broker/credentials` returns masked `api_key` (e.g., `****ABCD`); never returns decrypted values
- [ ] `POST /broker/credentials/{id}/test` calls `client.ping()` and returns only `{ "ok": true }` or `{ "ok": false }`; decrypted keys are not present in any logs
- [ ] `DELETE /broker/credentials/{id}` calls `assert_ownership` before deleting; returns 403 for wrong user
- [ ] `AlpacaClient` and `RobinhoodClient` both implement all five `AbstractBrokerClient` methods; `get_broker_client()` factory instantiates the correct class based on `credential.provider`
- [ ] Provider routing: passing a `robinhood` credential with a stock symbol returns HTTP 422 with the exact message from the PRD

---

### T-12 · Implement user profile backend

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-07, T-08 |

**Description:**
Implement `backend/app/api/profile.py` with `GET /profile` and `PATCH /profile`. The `UserProfile` record is created on registration (via the auth service). The profile endpoint returns and updates `display_name`, `timezone`, `default_symbol`, and `default_mode`.

**Acceptance Criteria:**
- [ ] `GET /profile` returns the `UserProfile` for the authenticated user; returns 404 if no profile exists (defensive guard)
- [ ] `PATCH /profile` accepts a partial update (any subset of `display_name`, `timezone`, `default_symbol`, `default_mode`); uses `model_dump(exclude_unset=True)` to apply only supplied fields
- [ ] Both endpoints use `Depends(get_current_user)` and scope to `current_user.id`
- [ ] `timezone` is validated as a string from the IANA timezone database (e.g., `"America/New_York"`); invalid values return HTTP 422
- [ ] `default_mode` is validated as one of `"conservative"`, `"aggressive"`, `"ai-pick"`, `"buy-low-sell-high"`

---

### T-13 · Implement `load_ohlcv` market data loader

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-04 |

**Description:**
Implement the `load_ohlcv(symbol, interval, period)` function in `backend/app/services/` (or a dedicated `backend/app/data/` module). Implement symbol validation that wraps `load_ohlcv` in a try/except and returns a clean error for the API layer.

**Acceptance Criteria:**
- [ ] `load_ohlcv` signature matches exactly: `def load_ohlcv(symbol: str, interval: str = "1d", period: str = "730d") -> pd.DataFrame`
- [ ] Multi-index column handling: `df.columns = df.columns.get_level_values(0)` is applied when `isinstance(df.columns, pd.MultiIndex)` is true
- [ ] Raises `ValueError(f"Symbol '{symbol}' returned no usable data (missing: {missing})")` if any of `Open`, `High`, `Low`, `Close`, `Volume` are absent or the dataframe is empty
- [ ] `validate_symbol(symbol: str) -> bool` wraps `load_ohlcv` and catches `ValueError`; used by all strategy run endpoints before accepting a request
- [ ] A test confirms that an invalid ticker (e.g., `"FAKEXYZ123"`) triggers the HTTP 422 path with the exact error message from the PRD

---

### T-14 · Implement HMM regime detection and Conservative/Aggressive strategies

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T-13 |

**Description:**
Implement `backend/app/strategies/conservative.py` and `backend/app/strategies/aggressive.py` (and any shared HMM utilities). These modules preserve all existing regime detection, confirmation counting, cooldown, and trailing stop logic. Implement `backend/app/services/strategy_run_service.py` which orchestrates a strategy run, creates `StrategyRun` + `TradeDecision` records, and returns the run summary.

Note: This is rated L because the HMM regime detection, confirmation logic, cooldown state, and trailing stop management form a deeply interdependent unit. Splitting it would leave non-running intermediate states, violating the incremental validation requirement.

**Acceptance Criteria:**
- [ ] Conservative mode: `leverage=2.5`, `min_confirmations=7`, trailing stop disabled
- [ ] Aggressive mode: `leverage=4.0`, `min_confirmations=5`, trailing stop at `5%`
- [ ] HMM is fitted on the loaded OHLCV data and produces bull/bear state labels; the predicted states are written back via `.loc` index alignment (not positional assignment)
- [ ] Each signal decision is persisted as a `TradeDecision` record with all fields from the PRD data model
- [ ] `StrategyRun` record is created with `run_type="signal_check"` and includes the resolved `symbol`, `timeframe`, `current_regime`, `current_signal`, `confirmation_count`
- [ ] `CooldownState` and `TrailingStopState` records are read and updated per-user, per-symbol within the run
- [ ] A test run against `SPY` with `interval="1d"` completes within 30 seconds and returns a valid signal (`"buy"`, `"sell"`, or `"hold"`)

---

### T-15 · Implement backtesting engine

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T-13, T-14 |

**Description:**
Implement `backend/app/backtesting/engine.py`. The engine accepts a strategy configuration and OHLCV data, runs the full strategy over the historical window, and produces a list of `BacktestTrade` records plus summary metrics (total return, max drawdown, Sharpe-like ratio, trade count). Implements train/validation/test splitting for optimizer modes.

Note: Rated L because the engine must correctly handle train/val/test splits, leverage compounding, cooldown state replay, and trailing stop simulation — all in a single coherent simulation loop. Splitting across tasks would leave a non-runnable engine.

**Acceptance Criteria:**
- [ ] `run_backtest(config, ohlcv_df) -> BacktestResult` returns a `BacktestResult` dataclass with `trades: list[BacktestTradeData]`, `total_return_pct`, `max_drawdown_pct`, `sharpe_like`, `trade_count`
- [ ] Train/validation/test split uses a 60/20/20 ratio by row count; the split indices are calculated programmatically, not hardcoded dates
- [ ] Each `BacktestTradeData` includes: `entry_time`, `exit_time`, `entry_price`, `exit_price`, `return_pct`, `leveraged_return_pct`, `pnl`, `holding_hours`, `exit_reason`
- [ ] Max drawdown is calculated as the maximum peak-to-trough decline in the equity curve, not the maximum single-trade loss
- [ ] Trailing stop simulation uses the `trailing_stop_pct` from the strategy config; `0` or `None` disables it
- [ ] A backtest on `BTC-USD` with `interval="1d"` completes within 30 seconds

---

### T-16 · Implement Pine Script v5 generator

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-14 |

**Description:**
Implement `backend/app/artifacts/pine_script_generator.py`. The generator accepts a winning variant's parameter set and produces a complete Pine Script v5 string. Any logic that cannot be exactly replicated in Pine Script must include an `// APPROXIMATION:` inline comment.

**Acceptance Criteria:**
- [ ] `generate_pine_script(variant_params: dict, symbol: str, mode_name: str) -> str` returns a string starting with `// @version=5` and `indicator(...)` or `strategy(...)` declaration
- [ ] The generated code includes: indicator inputs (EMA period, RSI period, MACD params), entry/exit conditions, and a comment block at the top summarizing the variant's backtest score
- [ ] Any HMM-based logic that has no Pine Script equivalent includes an `// APPROXIMATION:` comment explaining the simplification
- [ ] The returned string is syntactically valid Pine Script v5 (verified manually or with a test fixture)
- [ ] `generate_pine_script` is unit-tested with at least one AI Pick variant and one BLSH variant parameter set

---

### T-17 · Implement AI Pick optimizer

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T-15, T-16 |

**Description:**
Implement `backend/app/optimizers/ai_pick_optimizer.py`. This module generates up to 12 MACD + RSI + EMA parameter combinations, backtests each using the engine from T-15, scores by risk-adjusted validation return, selects the winner, generates a Pine Script artifact, and returns a `VariantLeaderboard`.

Note: Rated L because the variant generation, parallel backtesting, scoring, winner selection, and artifact generation form a single unit that must all be correct before any result is usable. The 120-second NFR-11 constraint is an additional integration concern.

**Acceptance Criteria:**
- [ ] Generates exactly up to `AI_PICK_MAX_VARIANTS = 12` parameter combinations (constant defined at module level)
- [ ] Each variant is a combination of MACD fast/slow periods, RSI period, and EMA period drawn from predefined search grids (grids documented in module-level constants)
- [ ] All variants are backtested; results are stored as `VariantBacktestResult` records with `mode_name="ai-pick"`
- [ ] Winner is selected by highest `validation_score`; `selected_winner=True` is set on exactly one record per run
- [ ] A `WinningStrategyArtifact` is created for the winning variant via `generate_pine_script()`
- [ ] Full optimization run on `BTC-USD` with `interval="1d"` completes within 120 seconds (NFR-11)

---

### T-18 · Implement Buy Low / Sell High optimizer

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T-15, T-16 |

**Description:**
Implement `backend/app/optimizers/buy_low_sell_high_optimizer.py`. This module generates up to 8 dip/cycle strategy variants, backtests each, scores, selects winner, and generates a Pine Script artifact. The composite scoring formula uses the same 60/20/20 (validation return / Sharpe / drawdown) weighting as AI Pick.

Note: Rated L for the same reason as T-17 — the variant generation, backtesting, scoring, and artifact pipeline are an interdependent unit.

**Acceptance Criteria:**
- [ ] Generates exactly up to `BLSH_MAX_VARIANTS = 8` parameter combinations (constant at module level)
- [ ] Variant parameters include: dip threshold percentage, cycle lookback period, and minimum hold bars — all drawn from predefined constant grids
- [ ] Composite score formula: `score = 0.6 * validation_return + 0.2 * sharpe_like - 0.2 * max_drawdown` — documented in the module docstring
- [ ] All variants are backtested and stored as `VariantBacktestResult` records with `mode_name="buy-low-sell-high"`
- [ ] Winner selected by highest composite score; `WinningStrategyArtifact` generated
- [ ] Full optimization run completes within 120 seconds on `BTC-USD` (NFR-11)

---

### T-19 · Implement execution service (order submission, position/order persistence)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-11, T-14 |

**Description:**
Implement `backend/app/services/execution_service.py`. This service accepts a strategy run result and a broker credential, calls the broker factory to get a client, submits (or simulates) an order, and persists a `BrokerOrder` record. Also handles `PositionSnapshot` creation on position updates.

**Acceptance Criteria:**
- [ ] `execute_order(strategy_run_id, credential_id, symbol, side, quantity, dry_run, current_user)` resolves the credential, calls `get_broker_client()`, calls `client.place_order()`, persists a `BrokerOrder` record, and returns the `OrderResult`
- [ ] `dry_run=True` is the default; the `BrokerOrder.dry_run` field is always set from the function argument, never inferred
- [ ] If `dry_run=True`, the broker client returns a simulated `OrderResult` and no real order is submitted
- [ ] Stock symbol + Robinhood credential combination is caught before calling `place_order` and raises HTTP 422 with the exact message from the PRD
- [ ] `BrokerOrder.raw_response_json` stores the broker's raw response dict as JSON; decrypted keys are not present in this JSON

---

### T-20 · Implement backtest API endpoints

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-15, T-17, T-18 |

**Description:**
Implement `backend/app/api/backtests.py` with all six backtest endpoints listed in PRD section 10. All endpoints use `Depends(get_current_user)` and scope queries to `current_user.id`.

**Acceptance Criteria:**
- [ ] `POST /backtests/run` accepts `RunStrategyRequest`, validates the symbol, dispatches to the correct engine/optimizer, persists `StrategyRun` + `BacktestTrade` + `VariantBacktestResult` records, and returns the full run summary
- [ ] `GET /backtests` returns time-ordered list of the user's `StrategyRun` records with `run_type="backtest"`, limited to 50 by default
- [ ] `GET /backtests/{id}` calls `assert_ownership` before returning; includes summary metrics computed from `BacktestTrade` records
- [ ] `GET /backtests/{id}/trades` returns all `BacktestTrade` records for the run, ordered by `entry_time`
- [ ] `GET /backtests/{id}/leaderboard` returns `VariantBacktestResult` records sorted by `validation_score` descending; winner is visually indicated by `selected_winner=True`
- [ ] `GET /backtests/{id}/chart-data` returns `{ "candles": [...], "signals": [...], "equity": [...] }` — pre-aggregated arrays ready for direct chart consumption without client-side transformation

---

### T-21 · Implement strategy run API endpoints (AI Pick and BLSH)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-17, T-18 |

**Description:**
Implement `backend/app/api/strategies.py` with the strategy-specific endpoints. These include the optimizer entry points and the run history / detail endpoints.

**Acceptance Criteria:**
- [ ] `POST /strategies/ai-pick/run` validates symbol, runs the AI Pick optimizer, returns the full run summary including winning variant and artifact ID
- [ ] `POST /strategies/buy-low-sell-high/run` validates symbol, runs the BLSH optimizer, returns the full run summary
- [ ] `GET /strategies/runs` returns all `StrategyRun` records for the current user, time-ordered, limited to 50
- [ ] `GET /strategies/runs/{id}` calls `assert_ownership`; returns full run detail including all `VariantBacktestResult` records
- [ ] `GET /strategies/runs/{id}/optimization-chart` returns `{ "variants": [{ "variant_name", "max_drawdown", "validation_return", "selected_winner" }] }` — shape ready for the Plotly `OptimizationScatter` component
- [ ] All endpoints return 403 if the authenticated user does not own the requested run

---

### T-22 · Implement conservative and aggressive strategy run endpoints

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-14, T-20 |

**Description:**
Wire Conservative and Aggressive strategy runs through `POST /backtests/run` (with `mode: "conservative"` or `mode: "aggressive"`) and ensure the `strategy_run_service` dispatches to the correct strategy module. These modes do not use the optimizer; they produce a single `StrategyRun` with `TradeDecision` records.

**Acceptance Criteria:**
- [ ] `POST /backtests/run` with `mode: "conservative"` creates a `StrategyRun` record with `mode_name="conservative"`, `leverage=2.5`, `min_confirmations=7`
- [ ] `POST /backtests/run` with `mode: "aggressive"` creates a `StrategyRun` record with `mode_name="aggressive"`, `leverage=4.0`, `min_confirmations=5`, `trailing_stop_pct=0.05`
- [ ] A leverage override in the request body is applied correctly to the `StrategyRun.leverage` field (FR-34)
- [ ] Both modes complete within 30 seconds p95 on `SPY` with `interval="1d"` (NFR-10)
- [ ] Response includes `current_signal`, `current_regime`, `confirmation_count`

---

### T-23 · Implement live trading API endpoints

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-19, T-14 |

**Description:**
Implement `backend/app/api/live.py` with all six live trading endpoints. These endpoints integrate the execution service, broker client proxy, and strategy run service.

**Acceptance Criteria:**
- [ ] `POST /live/run-signal-check` runs regime/signal logic for the supplied symbol + timeframe + credential, persists a `StrategyRun` with `run_type="signal_check"`, returns signal without submitting any order
- [ ] `POST /live/execute` calls `execution_service.execute_order()`; `dry_run=True` is the default; requires explicit `dry_run: false` in the body to submit a real order
- [ ] `GET /live/orders` proxies `client.get_orders()` for the selected credential; returns broker orders scoped to the current user
- [ ] `GET /live/positions` proxies `client.get_positions()` for the selected credential
- [ ] `GET /live/status` returns `{ "connected": bool, "provider": str, "profile_name": str, "paper": bool }` based on the selected credential
- [ ] `GET /live/chart-data?symbol=AAPL&interval=1d` calls `load_ohlcv()` and returns `{ "candles": [...] }` in Lightweight Charts format (`{ time, open, high, low, close, volume }`)
- [ ] All endpoints use `Depends(get_current_user)`

---

### T-24 · Implement artifacts API endpoints

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-17, T-18 |

**Description:**
Implement `backend/app/api/artifacts.py` with all three artifact endpoints.

**Acceptance Criteria:**
- [ ] `GET /artifacts` returns all `WinningStrategyArtifact` records for the current user, time-ordered, including `strategy_run_id` for deep-linking
- [ ] `GET /artifacts/{id}` calls `assert_ownership` and returns artifact metadata (all fields except `pine_script_code`)
- [ ] `GET /artifacts/{id}/pine-script` calls `assert_ownership` and returns the raw Pine Script v5 code as `text/plain` content type, or wrapped in `{ "code": "..." }` JSON — both approaches are acceptable, the content type must be consistent with the frontend's fetch implementation
- [ ] All three endpoints are registered in `main.py` via `app.include_router()`

---

### T-25 · Build layout shell (sidebar, nav, app shell)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-09, T-10 |

**Description:**
Build `frontend/components/layout/` — the fixed left sidebar with nav links, user avatar/email, logout button, and the main content shell. Implement the mobile-responsive `Sheet`/`Drawer` navigation variant. This shell wraps all protected pages.

**Acceptance Criteria:**
- [ ] `AppShell` component renders a fixed left sidebar (240px width on desktop) containing nav links to: Dashboard, Strategies, Backtests, Live Trading, Artifacts, Profile
- [ ] Active route is highlighted using `usePathname()` with the shadcn/ui `Button` variant styling
- [ ] User avatar / email is shown at the bottom of the sidebar, sourced from `useAuth()`
- [ ] "Logout" button calls `useAuth().logout()` and redirects to `/login`
- [ ] On mobile (`< md` breakpoint), the sidebar is replaced by a hamburger button that opens a shadcn/ui `Sheet` drawer containing the same nav links
- [ ] `app/layout.tsx` wraps all protected route segments in `AppShell`; the `(auth)` route group is excluded

---

### T-26 · Build shared UI components (cards, badges, tables, alerts, toasts)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-02 |

**Description:**
Install and configure all required shadcn/ui components. Create a `components/ui/` directory with re-exported shadcn components. Build the project-specific wrappers: `RegimeBadge`, `SignalBadge`, `MetricCard`, `DataTable`, `ConfirmDialog`, and a global `Sonner` toast provider.

**Acceptance Criteria:**
- [ ] All required shadcn/ui components are installed: `Form`, `Input`, `Button`, `Label`, `Card`, `Table`, `Tabs`, `Dialog`, `Alert`, `Badge`, `ScrollArea`, `Sheet`, `Drawer`, `Sonner`
- [ ] `RegimeBadge` renders a shadcn `Badge` with green for `"bull"`, red for `"bear"`, gray for `"uncertain"`
- [ ] `SignalBadge` renders green for `"buy"`, red for `"sell"`, muted for `"hold"`
- [ ] `MetricCard` wraps `Card`/`CardHeader`/`CardContent` with a title, value, and optional subtitle prop
- [ ] `ConfirmDialog` wraps shadcn `Dialog` with configurable title, description, confirm label, and `onConfirm` callback — used for all destructive actions
- [ ] `Sonner` toast provider is initialized in `app/layout.tsx`; `toast.success()` and `toast.error()` are accessible via `import { toast } from 'sonner'`

---

### T-27 · Build typed API client (`lib/api.ts`) and TypeScript types

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-06, T-09 |

**Description:**
Implement `frontend/lib/api.ts` — a typed fetch abstraction that adds `credentials: 'include'`, base URL prefixing, 401 refresh handling, and typed response parsing. Define all TypeScript types in `frontend/types/` to match the Pydantic response schemas from T-06.

**Acceptance Criteria:**
- [ ] `apiFetch<T>(path, options)` prepends `NEXT_PUBLIC_API_BASE_URL`, includes `credentials: 'include'`, and returns `T`
- [ ] On a 401 response, `apiFetch` calls `POST /auth/refresh` once; if refresh succeeds, the original request is retried; if refresh fails, `router.push('/login')` is called
- [ ] TypeScript types exist for: `User`, `UserProfile`, `BrokerCredential`, `StrategyRun`, `BacktestTrade`, `VariantBacktestResult`, `WinningStrategyArtifact`, `BrokerOrder`, `TradeDecision`, `LiveStatus`, `ChartBar`, `EquityPoint`, `OptimizationVariant`
- [ ] All types use `readonly` fields for response objects
- [ ] `tsc --noEmit` passes with no errors on the types and api files

---

### T-28 · Build TanStack Query hooks for all API domains

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-27 |

**Description:**
Create `frontend/hooks/` with custom TanStack Query hooks for each API domain. These hooks are the data-fetching layer consumed by all page components.

**Acceptance Criteria:**
- [ ] `useProfile()` — `GET /profile`
- [ ] `useBrokerCredentials()` — `GET /broker/credentials`
- [ ] `useBacktests(limit?)` — `GET /backtests`
- [ ] `useBacktest(id)` — `GET /backtests/{id}`
- [ ] `useBacktestTrades(id)` — `GET /backtests/{id}/trades`
- [ ] `useBacktestLeaderboard(id)` — `GET /backtests/{id}/leaderboard`
- [ ] `useBacktestChartData(id)` — `GET /backtests/{id}/chart-data`
- [ ] `useStrategyRuns(limit?)` — `GET /strategies/runs`
- [ ] `useStrategyRun(id)` — `GET /strategies/runs/{id}`
- [ ] `useOptimizationChart(id)` — `GET /strategies/runs/{id}/optimization-chart`
- [ ] `useLiveStatus()`, `useLiveOrders()`, `useLivePositions()` — respective live endpoints
- [ ] `useArtifacts()`, `useArtifact(id)`, `useArtifactPineScript(id)` — respective artifact endpoints
- [ ] All query hooks include `enabled` guards (e.g., `useBacktest(id)` only fetches when `id` is defined)
- [ ] Mutation hooks for `runBacktest`, `runAiPick`, `runBlsh`, `runSignalCheck`, `executeOrder`, `saveProfile`, `saveBrokerCredential`, `deleteBrokerCredential`, `testBrokerCredential` use `useMutation` and call `toast.success` / `toast.error` on settlement

---

### T-29 · Build auth pages (login and register)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-09, T-26, T-27 |

**Description:**
Implement `frontend/app/(auth)/login/page.tsx` and `frontend/app/(auth)/register/page.tsx` using React Hook Form + Zod for validation and shadcn/ui components for the UI.

**Acceptance Criteria:**
- [ ] Login form has `email` and `password` fields; Zod schema validates email format and non-empty password
- [ ] On successful login, `router.push('/dashboard')` is called; `useAuth()` user context is updated
- [ ] On failed login (401/422), a `toast.error()` message is shown with the backend's error message
- [ ] Register form has `email`, `password`, `confirmPassword` fields; Zod validates email format, password minimum 8 characters, and `confirmPassword === password`
- [ ] On successful registration, user is redirected to `/login` with a `toast.success("Account created — please log in")`
- [ ] Both pages use `Card` layout centered on the page; links between `/login` and `/register` are present
- [ ] Financial risk disclaimer ("educational software; live trading carries real financial risk") is displayed as a small `Alert` below the login form (NFR-18, OQ-07)

---

### T-30 · Build `PriceChart` component (Lightweight Charts)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-02 |

**Description:**
Implement `frontend/components/charts/PriceChart.tsx` exactly as specified in the PRD charting section. This component handles candlestick display, volume histogram, buy/sell signal markers, and responsive resizing.

**Acceptance Criteria:**
- [ ] Component signature matches `PriceChart({ data: Bar[], symbol: string, signals?: Marker[] })`; all types are defined in `frontend/types/`
- [ ] Candlestick series uses green `#22c55e` / red `#ef4444` color scheme
- [ ] Volume histogram is rendered on a separate price scale (`priceScaleId: "volume"`) with `scaleMargins: { top: 0.8, bottom: 0 }` to avoid overlap with candles
- [ ] `ResizeObserver` is used to keep the chart responsive; observer is disconnected in the cleanup function
- [ ] `candles.setMarkers(signals)` overlays buy/sell arrows on the chart when signals are provided
- [ ] The component renders correctly in a `"use client"` context; no SSR errors
- [ ] Empty `data` array renders the container without errors (no crash on initial load state)

---

### T-31 · Build `EquityCurve` and `LeaderboardBarChart` components (Recharts)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-02 |

**Description:**
Implement `frontend/components/charts/EquityCurve.tsx` and `frontend/components/charts/LeaderboardBarChart.tsx` using Recharts. Also implement `DashboardSparkline.tsx` for KPI trend cards.

**Acceptance Criteria:**
- [ ] `EquityCurve({ trades: BacktestTrade[] })` computes a running equity series starting at 100 and renders it as an `AreaChart` with green fill `#22c55e22`; includes a `ReferenceLine` at y=100
- [ ] `LeaderboardBarChart({ variants: VariantBacktestResult[] })` renders a horizontal `BarChart` sorted by `validation_score` descending; the winning variant bar is highlighted in green
- [ ] `DashboardSparkline({ data: EquityPoint[] })` renders a compact `LineChart` (height 60px) with no axes and no tooltip — purely visual KPI trend
- [ ] All three components are wrapped in `<ResponsiveContainer width="100%" height={...}>`
- [ ] Components render correctly server-side (Recharts supports SSR; no `dynamic` import needed)

---

### T-32 · Build `OptimizationScatter` component (Plotly.js)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T-02 |

**Description:**
Implement `frontend/components/charts/OptimizationScatter.tsx` using `react-plotly.js` loaded via `dynamic(..., { ssr: false })`. Also implement a `RegimeHeatmap.tsx` placeholder for future use.

**Acceptance Criteria:**
- [ ] `OptimizationScatter({ variants: OptimizationVariant[] })` renders a scatter plot with `max_drawdown` on the x-axis and `validation_return` on the y-axis
- [ ] The winning variant marker is rendered in green `#22c55e` at size 14; non-winners are blue `#378ADD` at size 8
- [ ] Component is imported via `dynamic(() => import("react-plotly.js"), { ssr: false })` — no SSR import
- [ ] `paper_bgcolor` and `plot_bgcolor` are set to `"transparent"` to blend with the dark app theme
- [ ] `config={{ displayModeBar: false, responsive: true }}` is set so no Plotly toolbar appears
- [ ] Component renders gracefully with an empty `variants` array (renders an empty chart, no crash)

---

### T-33 · Build Dashboard page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-25, T-26, T-27, T-28, T-31 |

**Description:**
Implement `frontend/app/dashboard/page.tsx`. This is the main landing page after login, showing the user's current trading status at a glance.

**Acceptance Criteria:**
- [ ] Page renders four `MetricCard` components: current regime (with `RegimeBadge`), current signal (with `SignalBadge`), confirmation count, most recent run summary
- [ ] Broker connection status is shown as a green/red indicator dot + provider name, sourced from `useLiveStatus()`
- [ ] Recent runs table (`Table`) shows the last 10 `StrategyRun` records: symbol, mode, signal, created_at; sourced from `useStrategyRuns(10)`
- [ ] KPI sparkline (`DashboardSparkline`) shows recent PnL trend for the last completed backtest
- [ ] Page shows a loading skeleton (shadcn/ui `Skeleton`) during data fetch
- [ ] If no runs exist, an empty state card reads "No strategy runs yet — go to Strategies to get started"

---

### T-34 · Build Strategies page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | L |
| **Blocked by** | T-25, T-26, T-27, T-28, T-30, T-31, T-32 |

**Description:**
Implement `frontend/app/strategies/page.tsx` with four mode tabs. Each tab has a run form, loading state, and results display. AI Pick and BLSH tabs include the leaderboard table and Plotly scatter chart.

Note: Rated L because four distinct mode tabs each have their own form, loading state, and results panel. All four must work correctly and consistently before the page is considered done.

**Acceptance Criteria:**
- [ ] `Tabs` component with four tabs: "Conservative", "Aggressive", "AI Pick", "Buy Low / Sell High"
- [ ] Each tab's form includes: symbol text input (placeholder: `AAPL, BTC-USD, SPY`), timeframe dropdown (`1d`, `1h`, `4h`, `1wk`), leverage override (optional), dry-run toggle (default on), submit button with `isLoading` spinner
- [ ] On submit, the correct mutation hook is called; `toast.success` is shown on completion; `toast.error` is shown on API error (including the 422 invalid symbol message)
- [ ] After a successful Conservative or Aggressive run: `PriceChart` with signal markers + `MetricCard` grid showing signal/regime/confirmations
- [ ] After a successful AI Pick or BLSH run: leaderboard `Table` ranked by `validation_score`, `OptimizationScatter` chart, winner highlighted, and a "View Pine Script" link to `/artifacts/{id}`
- [ ] Symbol input validation: if the symbol field is empty, the submit button is disabled
- [ ] All four modes respond within their respective time NFRs; the submit button shows a loading state for the full duration

---

### T-35 · Build Backtests page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | L |
| **Blocked by** | T-25, T-26, T-27, T-28, T-30, T-31 |

**Description:**
Implement `frontend/app/backtests/page.tsx` with a run list, "Run New Backtest" form, and a drill-down detail view showing the full backtest results.

Note: Rated L because the drill-down detail view (equity curve + price chart + trades table + leaderboard) is substantial UI work that requires all chart components and the full data pipeline to be functional.

**Acceptance Criteria:**
- [ ] Top-level view shows a `Table` of past backtest runs: symbol, mode, timeframe, trade count, best variant score, created_at — sourced from `useBacktests()`
- [ ] "Run New Backtest" button opens a `Dialog` with the run form (symbol, timeframe, mode, leverage, dry-run toggle)
- [ ] Clicking a row navigates to `/backtests/[id]` (or expands inline) and shows the full detail view
- [ ] Detail view includes: summary `MetricCard` grid (total return, max drawdown, Sharpe-like, trade count), `EquityCurve` chart, `PriceChart` with entry/exit signal markers, `BacktestTrades` table with all `BacktestTrade` fields
- [ ] For AI Pick / BLSH runs: variant leaderboard `Table` and `LeaderboardBarChart` are shown, with the winning row highlighted in green
- [ ] Empty state when no backtests exist

---

### T-36 · Build Live Trading page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | L |
| **Blocked by** | T-25, T-26, T-27, T-28, T-30 |

**Description:**
Implement `frontend/app/live-trading/page.tsx`. This page has the highest risk UX requirements: dry-run default, confirmation dialogs, live mode warning banner, and financial risk disclaimer.

Note: Rated L because of the mandatory safety UX requirements (confirmation dialogs, warning banners, disclaimer) that must all be correct before the page is considered production-ready.

**Acceptance Criteria:**
- [ ] Persistent financial risk `Alert` banner is always visible ("Educational software — live trading carries real financial risk") regardless of dry-run state (FR-47 + NFR-18 + OQ-07)
- [ ] Dry-run toggle defaults to `on`; switching it to `off` triggers a `ConfirmDialog` ("You are switching to LIVE mode. Real money will be used. Are you sure?") — trade execution is blocked until the user confirms
- [ ] When dry-run is `off`, a red `Alert` warning banner reads "LIVE MODE — Real money at risk"
- [ ] Broker selector dropdown lists all active credentials with `provider` badge (green "Alpaca - Stocks & ETFs" or amber "Robinhood - Crypto only") — sourced from `useBrokerCredentials()`
- [ ] "Check Signal" button calls the `runSignalCheck` mutation and displays result in a signal card with `RegimeBadge` and `SignalBadge`
- [ ] "Execute Order" button calls the `executeOrder` mutation; disabled when no credential is selected
- [ ] Positions table sourced from `useLivePositions()` with a manual "Refresh" button
- [ ] Orders table sourced from `useLiveOrders()` with a manual "Refresh" button
- [ ] `PriceChart` displays OHLCV data for the selected symbol sourced from `useLiveChartData(symbol, interval)`

---

### T-37 · Build Artifacts page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-25, T-26, T-27, T-28 |

**Description:**
Implement `frontend/app/artifacts/page.tsx` to list and display Pine Script artifacts.

**Acceptance Criteria:**
- [ ] Top-level view shows a list/table of all artifacts: mode name, variant name, symbol, created_at — sourced from `useArtifacts()`
- [ ] Clicking an artifact shows a detail panel with: metadata (strategy run link, mode, variant, symbol, timeframe, date), Pine Script v5 code in a shadcn/ui `ScrollArea`
- [ ] A one-click "Copy" button copies the Pine Script code to the clipboard and shows `toast.success("Copied to clipboard")`
- [ ] "View originating run" link navigates to `/strategies?runId={strategy_run_id}` or `/backtests/{strategy_run_id}` depending on `run_type` (FR-57)
- [ ] Empty state when no artifacts exist: "No artifacts yet — run AI Pick or Buy Low / Sell High to generate Pine Script artifacts"
- [ ] Pine Script code block uses a monospace font; `ScrollArea` constrains the height to 400px with overflow scroll

---

### T-38 · Build Profile page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-25, T-26, T-27, T-28 |

**Description:**
Implement `frontend/app/profile/page.tsx` with the user profile form and the full broker credential management UI.

**Acceptance Criteria:**
- [ ] Profile form pre-populates `display_name`, `timezone`, `default_symbol`, `default_mode` from `useProfile()`; saving calls `PATCH /profile` and shows `toast.success("Profile saved")`
- [ ] Broker credentials section lists all saved credentials with masked key summary, provider badge (green for Alpaca, amber for Robinhood), and "Edit / Test / Delete" action buttons
- [ ] "Add Credential" opens a `Dialog` with the adaptive form: provider dropdown defaults to Alpaca; selecting Alpaca shows API Key, Secret Key, Paper Trading toggle; selecting Robinhood shows API Key, Private Key, and a warning `Alert` ("Robinhood credentials only support crypto. For stocks and ETFs, add an Alpaca account.")
- [ ] "Test Connection" button in the credential form calls the `testBrokerCredential` mutation and shows `toast.success("Connection successful")` or `toast.error("Connection failed")`
- [ ] "Delete" credential button triggers `ConfirmDialog` before calling the delete mutation (FR-24)
- [ ] All credential key inputs use `type="password"` masking; no raw or decrypted values are ever rendered in the DOM
- [ ] Profile name input field character limit is 50; timezone is a searchable select backed by a hardcoded IANA timezone list

---

### T-39 · End-to-end integration test: auth flow

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-08, T-09, T-10, T-29 |

**Description:**
Write an automated test suite (using `pytest` + `httpx.AsyncClient` for the backend, and optionally Playwright for the frontend) that validates the complete auth lifecycle end-to-end against a real test database.

**Acceptance Criteria:**
- [ ] Register → Login → GET /auth/me → Refresh → Logout flow passes in a single test, validating HTTP status codes and cookie presence at each step
- [ ] Accessing a protected endpoint without a cookie returns HTTP 401
- [ ] Accessing another user's resource (by ID) returns HTTP 403
- [ ] A tampered JWT returns HTTP 401
- [ ] After logout, the old refresh token is rejected (HTTP 401 on `/auth/refresh`)
- [ ] Password is confirmed not to appear in any log output captured during the test run

---

### T-40 · End-to-end integration test: strategy run + backtest + artifact pipeline

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-20, T-21, T-22, T-24 |

**Description:**
Write a full pipeline integration test that registers a user, runs each of the four strategy modes, retrieves backtest results, and verifies artifact generation — all via the HTTP API layer against a test database.

**Acceptance Criteria:**
- [ ] Conservative run on `SPY` completes within 30 seconds and returns a `StrategyRun` record with valid `current_signal`, `current_regime`
- [ ] Aggressive run on `NVDA` completes within 30 seconds with `trailing_stop_pct=0.05`
- [ ] AI Pick run on `BTC-USD` completes within 120 seconds and produces a `WinningStrategyArtifact` with non-empty `pine_script_code`
- [ ] BLSH run on `ETH-USD` completes within 120 seconds and produces a leaderboard with exactly one `selected_winner=True` record
- [ ] An invalid symbol (`FAKEXYZ999`) returns HTTP 422 with the exact error message `"Symbol 'FAKEXYZ999' not found or returned no data"`
- [ ] User A cannot access User B's strategy run ID (returns 403)
- [ ] `GET /artifacts/{id}/pine-script` returns a string containing `// @version=5`

---

### T-41 · Deployment configuration: backend (Render + Docker)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-01, T-04 |

**Description:**
Create the Docker configuration and Render deployment files for the FastAPI backend. Configure Alembic to run migrations on deploy. Document all environment variable values needed in the Render dashboard.

**Acceptance Criteria:**
- [ ] `backend/Dockerfile` uses a multi-stage build: `python:3.11-slim` base, installs dependencies from `requirements.txt`, copies app code, exposes port 8000, and runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- [ ] `backend/render.yaml` (or equivalent Render service config) defines the web service with `startCommand: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000` to run migrations on every deploy
- [ ] `render.yaml` documents all required environment variable names (without values) as a reference for the Render dashboard setup
- [ ] `docker build -t nextgenstock-backend .` succeeds locally from the `backend/` directory
- [ ] `docker run --env-file .env -p 8000:8000 nextgenstock-backend` starts and `GET /healthz` returns 200
- [ ] `COOKIE_SECURE=true` and `COOKIE_SAMESITE=lax` are set in the production environment config

---

### T-42 · Deployment configuration: frontend (Vercel)

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T-02 |

**Description:**
Configure the Next.js frontend for Vercel deployment. Add `vercel.json` if any non-default configuration is needed. Document the required environment variable (`NEXT_PUBLIC_API_BASE_URL`) for the Vercel project settings.

**Acceptance Criteria:**
- [ ] `next build` completes without errors or warnings in CI
- [ ] `NEXT_PUBLIC_API_BASE_URL` is documented in `.env.local.example` with the Render backend URL as the production value
- [ ] `middleware.ts` is compatible with Vercel Edge Runtime (no Node.js-only APIs used)
- [ ] All Plotly.js `dynamic` imports avoid SSR and do not cause `next build` to fail
- [ ] A `vercel.json` (if needed) sets any required headers, e.g. `Cache-Control` for API proxy routes
- [ ] The deployed Vercel URL is tested: login → dashboard navigation works with the production Render backend

---

### T-43 · Security hardening and checklist audit

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-39, T-40, T-41, T-42 |

**Description:**
Systematically audit the implementation against the full security checklist in PRD section 16. Fix any gaps. This task exists to ensure no security requirement is accidentally omitted during incremental development.

**Acceptance Criteria:**
- [ ] Passwords: `bcrypt` hashing confirmed; a test attempts to retrieve a `User` from the DB and confirms `password_hash` does not equal the plaintext password
- [ ] JWTs: `SECRET_KEY` is a strong random value (minimum 32 bytes); access tokens expire in exactly 15 minutes; verified by decoding an issued token
- [ ] Refresh tokens: only `SHA-256` or `bcrypt` hash is stored in `UserSession`; raw token never appears in DB or logs
- [ ] All protected endpoints: `grep -r "get_current_user"` coverage check confirms every non-auth endpoint uses the dependency
- [ ] All DB queries: `grep -r "user_id"` confirms every user-owned query has a `user_id` filter
- [ ] Broker keys: a DB inspection confirms `api_key` and `encrypted_secret_key` columns contain Fernet ciphertext, not plaintext
- [ ] CORS: a test confirms a request from an unlisted origin is rejected
- [ ] `dry_run=True`: confirmed as the default in `POST /live/execute` schema definition
- [ ] No `NEXT_PUBLIC_` env vars contain secrets; confirmed by grepping `frontend/.env.local.example`

---

### T-44 · Write README and add financial disclaimer

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-43 |

**Description:**
Write `README.md` at the project root covering all topics listed in the PRD Final Deliverable Checklist. Add the mandatory financial risk disclaimer to both the README and the login page `Alert`.

**Acceptance Criteria:**
- [ ] `README.md` covers: project overview, local setup steps (Python env, npm install, `.env` configuration, Alembic migrations, `next dev` + `uvicorn` startup), all 14 backend env vars and their purpose, strategy mode descriptions (all four modes), auth design and token flow, per-user data isolation enforcement, broker credential encryption approach, security notes, and the financial risk disclaimer
- [ ] README includes a "Disclaimer" section that reads: "NextGenStock is educational and research software. Live trading carries real financial risk. Past strategy performance does not guarantee future results. Use at your own risk."
- [ ] The same disclaimer text appears as an `Alert` component on the `/login` page (confirmed from T-29) and as a persistent banner on `/live-trading` (confirmed from T-36)
- [ ] README deployment section documents the three-service architecture: Vercel (frontend) + Render (backend) + Supabase (PostgreSQL)
- [ ] README includes a "Known Limitations" section noting: no WebSocket real-time feeds, no scheduled signal workers (v1), no MFA, Robinhood crypto-only restriction

---

## Requirement Traceability

| Requirement | Task(s) |
|-------------|---------|
| FR-01 (register) | T-08 |
| FR-02 (login + cookies) | T-07, T-08 |
| FR-03 (GET /auth/me) | T-08 |
| FR-04 (refresh + rotation) | T-07, T-08 |
| FR-05 (logout + revoke) | T-08 |
| FR-06 (frontend middleware) | T-10 |
| FR-07 (silent 401 refresh) | T-09, T-27 |
| FR-08 (no localStorage) | T-09 |
| FR-09 (user_id FK on all tables) | T-05 |
| FR-10 (queries scoped by user_id) | T-07, T-08, T-11, T-12, T-20, T-21, T-22, T-23, T-24 |
| FR-11 (user ID from JWT only) | T-07 |
| FR-12 (assert_ownership) | T-07, T-11, T-12, T-20, T-21, T-24 |
| FR-13 (GET /profile) | T-12 |
| FR-14 (PATCH /profile) | T-12 |
| FR-15 (profile form) | T-38 |
| FR-16 (GET /broker/credentials) | T-11 |
| FR-17 (POST /broker/credentials, encrypt) | T-11 |
| FR-18 (PATCH /broker/credentials) | T-11 |
| FR-19 (DELETE /broker/credentials) | T-11 |
| FR-20 (credential test endpoint) | T-11 |
| FR-21 (adaptive credential form) | T-38 |
| FR-22 (provider badge) | T-38 |
| FR-23 (Alpaca default) | T-38 |
| FR-24 (delete confirmation dialog) | T-38 |
| FR-25 (symbol + timeframe input) | T-13, T-14, T-17, T-18 |
| FR-26 (symbol validation + 422) | T-13 |
| FR-27 (Conservative mode params) | T-14, T-22 |
| FR-28 (Aggressive mode params) | T-14, T-22 |
| FR-29 (AI Pick mode) | T-17 |
| FR-30 (BLSH mode) | T-18 |
| FR-31 (StrategyRun persistence) | T-14, T-17, T-18, T-20, T-21, T-22 |
| FR-32 (symbol uppercase normalization) | T-06 |
| FR-33 (Robinhood stock symbol 422) | T-11, T-19 |
| FR-34 (leverage override) | T-06, T-22 |
| FR-35 (POST /backtests/run) | T-20 |
| FR-36 (GET /backtests) | T-20 |
| FR-37 (GET /backtests/{id}) | T-20 |
| FR-38 (GET /backtests/{id}/trades) | T-20 |
| FR-39 (GET /backtests/{id}/leaderboard) | T-20 |
| FR-40 (GET /backtests/{id}/chart-data) | T-20 |
| FR-41 (train/val/test split metrics) | T-15 |
| FR-42 (POST /live/run-signal-check) | T-23 |
| FR-43 (POST /live/execute, dry_run default) | T-19, T-23 |
| FR-44 (GET /live/orders) | T-23 |
| FR-45 (GET /live/positions) | T-23 |
| FR-46 (GET /live/status) | T-23 |
| FR-47 (live mode warning banner) | T-36 |
| FR-48 (live mode confirmation dialog) | T-36 |
| FR-49 (provider badge on live page) | T-36 |
| FR-50 (GET /live/chart-data) | T-23 |
| FR-51 (Pine Script v5 generation) | T-16 |
| FR-52 (WinningStrategyArtifact storage) | T-17, T-18 |
| FR-53 (GET /artifacts) | T-24 |
| FR-54 (GET /artifacts/{id}) | T-24 |
| FR-55 (GET /artifacts/{id}/pine-script) | T-24 |
| FR-56 (ScrollArea + copy button) | T-37 |
| FR-57 (artifact → run deep link) | T-37 |
| FR-58 (APPROXIMATION: comments) | T-16 |
| FR-59 (load_ohlcv, no hardcoded symbols) | T-13 |
| FR-60 (load_ohlcv validation) | T-13 |
| FR-61 (HMM interval: 1h, 730d) | T-14 |
| FR-62 (AI Pick / BLSH interval from user) | T-17, T-18 |
| NFR-01 (bcrypt) | T-07, T-08 |
| NFR-02 (token expiry) | T-07 |
| NFR-03 (refresh token hash only) | T-07, T-08 |
| NFR-04 (Fernet encryption) | T-11 |
| NFR-05 (no decrypted keys in API) | T-11 |
| NFR-06 (CORS restriction) | T-04 |
| NFR-07 (all protected routes) | T-07, T-43 |
| NFR-08 (no secrets in frontend) | T-02, T-43 |
| NFR-09 (user_id scoping) | T-05, T-43 |
| NFR-10 (30s p95 conservative/aggressive) | T-14, T-40 |
| NFR-11 (120s p95 AI Pick / BLSH) | T-17, T-18, T-40 |
| NFR-12 (1.5s dashboard page load) | T-33 |
| NFR-13 (Render paid plan) | T-41 |
| NFR-14 (Alembic migrations) | T-03, T-05 |
| NFR-15 (Supabase connection pooling) | T-03, T-41 |
| NFR-16 (models in models/, schemas in schemas/) | T-05, T-06 |
| NFR-17 (AbstractBrokerClient) | T-11 |
| NFR-18 (financial disclaimer) | T-29, T-36, T-44 |
| NFR-19 (no credentials in logs) | T-08, T-11, T-43 |
| NFR-20 (testable acceptance criteria) | T-39, T-40 |

## Part 2: Buy Zone, Alerts, Auto-Buy & Ideas (V2)

> Generated from: PRD2.md + prompt-feature.md
> Generated on: 2026-03-24
> Total tasks: 47

---

## Assumptions & Clarifications

**OQ-01 resolved:** Alpaca paper routing is handled at client instantiation time — `AlpacaClient(paper=True)` points at `paper-api.alpaca.markets`. The `place_order()` method already accepts `dry_run: bool`. Paper mode in auto-buy therefore instantiates the client with `paper=True`; no protocol change is needed.

**OQ-02 resolved:** The `not_near_earnings` safeguard is implemented as a manual boolean flag (`near_earnings: bool`) on `WatchlistIdeaTicker` in v2. The scheduler does not query a live earnings calendar. A live earnings calendar API is deferred to v3.

**OQ-03 resolved:** APScheduler `AsyncIOScheduler` runs in-process inside the FastAPI lifespan context on the Render web dyno. If Render kills the dyno on restart, the scheduler restarts on the next cold start. A separate Render Background Worker is deferred to v3 if in-process proves unstable.

**OQ-04 resolved:** v2 ships only the `InAppNotification` channel as a concrete implementation. `EmailNotification` and `WebhookNotification` classes are wired (inherit the abstract base, read env vars, stub the `send()` body with a log line) but will not dispatch real messages unless the corresponding env vars are set and the feature flag is enabled. This satisfies FR-B09.

**OQ-05 resolved:** The `/opportunities` endpoint caps the response to the top 100 ranked tickers across all of a user's ideas. The scheduler processes them in batches to stay within the 60-minute window.

**OQ-06 resolved:** `/opportunities` aggregates across all of a user's ideas (all linked tickers from all `WatchlistIdea` rows belonging to `current_user.id`), capped at 100 results sorted by composite rank score descending. This is consistent with FR-E03.

**bitcoin.md noted:** This file describes the original single-file Streamlit prototype (HMM logic, backtester, data_loader). It is not a source of requirements for v2 — the NextGenStock platform already fully supersedes it. It is reviewed and considered out of scope.

**Earnings near-flag column:** A `near_earnings` boolean column is added to `watchlist_idea_tickers` to support OQ-02 resolution. This is an additive column; no existing column is changed.

**Existing scheduler infrastructure:** `main.py` has a lifespan context manager (`async with lifespan(app)`) that currently only manages the DB engine. APScheduler startup/shutdown is added to this same lifespan function — not a new file or new lifespan wrapper.

**`services/market_data.py` reuse:** The existing `services/market_data.py` module (confirmed present in the backend glob) is the canonical OHLCV loader. Buy zone service reads OHLCV from this module, not from a fresh `yfinance` import.

**No new charting libraries:** The `/opportunities` page uses Recharts for metric sparklines (consistent with dashboard KPI pattern). The buy zone analysis panel uses no chart — it is a card-based display. Plotly is not used for any new page; it remains exclusive to AI Pick / BLSH optimization views.

---

## Parallel Work Waves

**Wave 1 (no blockers — shared foundation):**
T-01, T-02, T-03

**Wave 2 (ORM models — blocked by T-01):**
T-04, T-05, T-06, T-07, T-08

**Wave 3 (Pydantic schemas — blocked by T-04 through T-08):**
T-09, T-10, T-11, T-12, T-13

**Wave 4 (core computation services — blocked by T-03, T-09):**
T-14, T-15, T-16

**Wave 5 (alert + notification services — blocked by T-10, T-14):**
T-17, T-18

**Wave 6 (auto-buy engine — blocked by T-11, T-14, T-17):**
T-19

**Wave 7 (API routers — blocked by T-09 through T-13, T-14 through T-19):**
T-20, T-21, T-22, T-23, T-24, T-25

**Wave 8 (scheduler — blocked by T-14, T-15, T-17, T-19, T-26):**
T-26, T-27

**Wave 9 (frontend shared components — blocked by T-20 through T-25):**
T-28, T-29, T-30, T-31

**Wave 10 (frontend pages — blocked by T-28 through T-31):**
T-32, T-33, T-34, T-35

**Wave 11 (stock detail enhancement — blocked by T-28, T-29):**
T-36

**Wave 12 (backend unit tests — blocked by T-14 through T-19):**
T-37, T-38, T-39, T-40, T-41

**Wave 13 (backend integration tests — blocked by T-37 through T-41):**
T-42

**Wave 14 (E2E + regression + linting — blocked by T-32 through T-36, T-42):**
T-43, T-44, T-45

**Wave 15 (environment config + deployment — blocked by T-26, T-27):**
T-46, T-47

---

## Tasks

---

### T-01 · Add seven Alembic migrations for all new v2 tables

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | none |

**Context:** Seven new tables must be added to the existing 14-table schema. Each migration is a separate file chained from the current Alembic head. Every migration must have a working `downgrade()`. The `watchlist_idea_tickers` table needs an extra `near_earnings bool default False` column (OQ-02 resolution).

**Acceptance Criteria:**
- [ ] Seven migration files exist under `alembic/versions/`, each with a unique revision ID chained from the previous
- [ ] Tables created: `stock_buy_zone_snapshots`, `stock_theme_scores`, `watchlist_ideas`, `watchlist_idea_tickers`, `price_alert_rules`, `auto_buy_settings`, `auto_buy_decision_logs`
- [ ] `watchlist_idea_tickers` includes `near_earnings bool default False` (earnings safeguard flag per OQ-02)
- [ ] `auto_buy_settings` has a unique constraint on `user_id` (one row per user)
- [ ] `stock_buy_zone_snapshots.user_id` is nullable with an FK to `users`; `stock_theme_scores` has no `user_id` column
- [ ] `alembic upgrade head` runs cleanly against a fresh schema; `alembic downgrade -1` (applied seven times) restores the original 14-table schema without error
- [ ] All column types, defaults, and nullability match the data model in PRD2.md Section 9 exactly

---

### T-02 · Add APScheduler dependency and wire into FastAPI lifespan

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | none |

**Context:** APScheduler is not currently in `requirements.txt`. The `lifespan` function in `main.py` currently only manages the DB engine. This task installs APScheduler and adds scheduler start/stop to the existing lifespan without restructuring the file. New env vars (`SCHEDULER_ENABLE`, `BUY_ZONE_REFRESH_MINUTES`, `THEME_SCORE_REFRESH_MINUTES`, `ALERT_EVAL_MINUTES`, `AUTO_BUY_EVAL_MINUTES`) are added to `core/config.py` and `.env.example`.

**Acceptance Criteria:**
- [ ] `apscheduler>=3.10` added to `backend/requirements.txt`
- [ ] `core/config.py` exposes `scheduler_enable: bool = True`, `buy_zone_refresh_minutes: int = 60`, `theme_score_refresh_minutes: int = 360`, `alert_eval_minutes: int = 5`, `auto_buy_eval_minutes: int = 5`
- [ ] `SCHEDULER_ENABLE`, `BUY_ZONE_REFRESH_MINUTES`, `THEME_SCORE_REFRESH_MINUTES`, `ALERT_EVAL_MINUTES`, `AUTO_BUY_EVAL_MINUTES`, `NOTIFICATION_EMAIL_ENABLED`, `NOTIFICATION_WEBHOOK_ENABLED` documented in `.env.example`
- [ ] `lifespan()` in `main.py` starts the `AsyncIOScheduler` on startup and calls `scheduler.shutdown()` on teardown, guarded by `settings.scheduler_enable`
- [ ] `uvicorn` starts without errors with `SCHEDULER_ENABLE=false`; scheduler logs "Scheduler disabled" in that case

---

### T-03 · Create `scheduler/` package with job registry stub

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | none |

**Context:** The scheduler task files will be filled in later (T-27), but the package structure and job registration stubs must exist early so other tasks can import from them without circular-import errors. All four task functions are stubs that log "job not yet implemented" and return immediately.

**Acceptance Criteria:**
- [ ] `backend/app/scheduler/__init__.py`, `backend/app/scheduler/jobs.py`, and `backend/app/scheduler/tasks/__init__.py` exist
- [ ] `backend/app/scheduler/tasks/refresh_buy_zones.py`, `refresh_theme_scores.py`, `evaluate_alerts.py`, `evaluate_auto_buy.py` exist — each exports one async function with the correct name and signature matching what T-27 will fill
- [ ] `scheduler/jobs.py` imports all four task functions and registers them via `scheduler.add_job(...)` with the correct interval params read from `settings`; intervals are configurable
- [ ] `jobs.py` is importable from `main.py` without raising an `ImportError`; verified by running `python -c "from app.scheduler.jobs import register_jobs"`

---

### T-04 · Implement `models/buy_zone.py` — StockBuyZoneSnapshot ORM model

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-01 |

**Context:** Follow the existing `Mapped[]` / `mapped_column()` SQLAlchemy 2.x pattern from other model files. All JSON columns use `MappedColumn(JSON)`. Register the model in `models/__init__.py`.

**Acceptance Criteria:**
- [ ] `StockBuyZoneSnapshot` class is in `backend/app/models/buy_zone.py` with all columns from PRD2 Section 9: `id`, `user_id` (nullable FK), `ticker`, `current_price`, `buy_zone_low`, `buy_zone_high`, `confidence_score`, `entry_quality_score`, `expected_return_30d`, `expected_return_90d`, `expected_drawdown`, `positive_outcome_rate_30d`, `positive_outcome_rate_90d`, `invalidation_price`, `horizon_days`, `explanation_json`, `feature_payload_json`, `model_version`, `created_at`
- [ ] Model is imported in `models/__init__.py` so Alembic autogenerate can detect it
- [ ] `__tablename__ = "stock_buy_zone_snapshots"` matches the migration table name exactly

---

### T-05 · Implement `models/theme_score.py` — StockThemeScore ORM model

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-01 |

**Acceptance Criteria:**
- [ ] `StockThemeScore` class in `backend/app/models/theme_score.py` with columns: `id`, `ticker`, `theme_score_total`, `theme_scores_json`, `narrative_momentum_score`, `sector_tailwind_score`, `macro_alignment_score`, `created_at`, `updated_at` — no `user_id` column
- [ ] `__tablename__ = "stock_theme_scores"`
- [ ] Model imported in `models/__init__.py`

---

### T-06 · Implement `models/idea.py` — WatchlistIdea and WatchlistIdeaTicker ORM models

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-01 |

**Acceptance Criteria:**
- [ ] `WatchlistIdea` in `backend/app/models/idea.py` with: `id`, `user_id` (FK → users), `title`, `thesis`, `conviction_score` (int), `watch_only` (bool, default False), `tradable` (bool, default True), `tags_json`, `metadata_json`, `created_at`, `updated_at`
- [ ] `WatchlistIdeaTicker` in the same file with: `id`, `idea_id` (FK → `watchlist_ideas.id`), `ticker`, `is_primary` (bool), `near_earnings` (bool, default False)
- [ ] Both models imported in `models/__init__.py`

---

### T-07 · Implement `models/alert.py` — PriceAlertRule ORM model

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-01 |

**Acceptance Criteria:**
- [ ] `PriceAlertRule` in `backend/app/models/alert.py` with: `id`, `user_id` (FK → users), `ticker`, `alert_type`, `threshold_json`, `cooldown_minutes` (int, default 60), `market_hours_only` (bool, default True), `enabled` (bool, default True), `last_triggered_at` (nullable datetime), `created_at`, `updated_at`
- [ ] `__tablename__ = "price_alert_rules"`
- [ ] Model imported in `models/__init__.py`

---

### T-08 · Implement `models/auto_buy.py` — AutoBuySettings and AutoBuyDecisionLog ORM models

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-01 |

**Acceptance Criteria:**
- [ ] `AutoBuySettings` in `backend/app/models/auto_buy.py` with: `id`, `user_id` (FK → users, unique constraint), `enabled` (bool, default False), `paper_mode` (bool, default True), `confidence_threshold` (float, default 0.70), `max_trade_amount`, `max_position_percent`, `max_expected_drawdown`, `allow_near_earnings` (bool, default False), `allowed_account_ids_json`, `created_at`, `updated_at`
- [ ] `AutoBuyDecisionLog` in same file with: `id`, `user_id` (FK → users), `ticker`, `decision_state`, `reason_codes_json`, `signal_payload_json`, `order_payload_json` (nullable), `dry_run`, `created_at`
- [ ] Both models imported in `models/__init__.py`

---

### T-09 · Write Pydantic schemas for buy zone and opportunities

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-04 |

**Context:** Create `backend/app/schemas/buy_zone.py`. Follow the existing Pydantic v2 style from `schemas/strategy.py` or `schemas/backtest.py`. `feature_payload_json` must never appear in any response schema.

**Acceptance Criteria:**
- [ ] `BuyZoneOut` response schema includes all public fields of `StockBuyZoneSnapshot` except `feature_payload_json`
- [ ] `OpportunityRow` schema: `ticker`, `current_price`, `buy_zone_low`, `buy_zone_high`, `distance_to_zone_pct`, `confidence_score`, `theme_score_total`, `alert_active`, `auto_buy_eligible`, `last_updated` — for `/opportunities` table rows
- [ ] All schemas use `model_config = ConfigDict(from_attributes=True)` for ORM serialisation

---

### T-10 · Write Pydantic schemas for alerts

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-07 |

**Acceptance Criteria:**
- [ ] `schemas/alert.py` contains `AlertRuleCreate`, `AlertRuleUpdate`, `AlertRuleOut`
- [ ] `AlertRuleCreate` requires `ticker`, `alert_type` (enum validated against the six types from FR-B02), `threshold_json` (dict), optional `cooldown_minutes`, `market_hours_only`
- [ ] `AlertRuleOut` includes `id`, `user_id`, `ticker`, `alert_type`, `threshold_json`, `cooldown_minutes`, `market_hours_only`, `enabled`, `last_triggered_at`, `created_at`, `updated_at`
- [ ] `alert_type` enum validation raises HTTP 422 for unknown values

---

### T-11 · Write Pydantic schemas for ideas

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-06 |

**Acceptance Criteria:**
- [ ] `schemas/idea.py` contains `IdeaCreate`, `IdeaUpdate`, `IdeaTickerIn`, `IdeaOut`
- [ ] `IdeaCreate` requires `title`, `thesis`, `conviction_score` (int, ge=1, le=10), `tickers` (list of `IdeaTickerIn`); optional `watch_only`, `tradable`, `tags_json`
- [ ] `IdeaOut` includes all `WatchlistIdea` fields plus `tickers` (list of `IdeaTickerIn`) and a computed `rank_score: float` (computed at query time, not persisted)
- [ ] `conviction_score` outside 1–10 raises HTTP 422

---

### T-12 · Write Pydantic schemas for auto-buy

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-08 |

**Acceptance Criteria:**
- [ ] `schemas/auto_buy.py` contains `AutoBuySettingsOut`, `AutoBuySettingsPatch`, `AutoBuyDecisionLogOut`, `AutoBuyDryRunResult`
- [ ] `AutoBuyDryRunResult` includes `ticker`, `decision_state`, `reason_codes` (list of strings: "PASSED" or "FAILED: <reason>" per safeguard), `dry_run: true`, `signal_payload` (the buy zone snapshot used)
- [ ] `AutoBuySettingsPatch` uses all-optional fields so a PATCH can update a single setting without resending the full object
- [ ] Broker `api_key` and `encrypted_secret_key` fields are never present in any auto-buy schema

---

### T-13 · Write Pydantic schemas for theme score

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | XS |
| **Blocked by** | T-05 |

**Acceptance Criteria:**
- [ ] `schemas/theme_score.py` contains `ThemeScoreOut` with: `ticker`, `theme_score_total`, `theme_scores_by_category` (dict), `narrative_momentum_score`, `sector_tailwind_score`, `macro_alignment_score`, `user_conviction_score`, `explanation` (list[str]), `created_at`, `updated_at`
- [ ] `user_conviction_score` is a query-time computed field (from the caller's idea tags), not stored — schema field must be optional with default 0.0

---

### T-14 · Implement `services/buy_zone_service.py` and `services/analog_scoring_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T-03, T-09 |

**Context:** This is the heaviest computation task. The buy zone service orchestrates a seven-layer scoring pipeline. The analog scoring service is a separate module because it has independent test coverage requirements. Both reuse the OHLCV loader from `services/market_data.py` — no direct `yfinance` calls in these files.

**Why L and not split further:** The seven scoring layers are tightly coupled by the `BuyZoneResult` dataclass — splitting into separate tasks would produce non-running intermediate states (NFR-03 equivalent). The analog scorer is a separate file but is tested and used only through the buy zone service, so they ship together.

**Acceptance Criteria:**
- [ ] `BuyZoneResult` dataclass is defined as specified in `prompt-feature.md` Feature A, with all 13+ fields including `explanation: list[str]` and `model_version: str`
- [ ] `calculate_buy_zone(ticker, db)` runs all seven layers: trend quality (0.20), pullback quality (0.20), support proximity (0.20), volatility normalization (0.10), historical analog win rate (0.20), drawdown penalty (0.05), theme alignment bonus (0.05)
- [ ] Each layer returns a sub-score (float 0.0–1.0) and one explanation string; all explanation strings are appended to `BuyZoneResult.explanation`
- [ ] Analog scoring: finds historical windows with similar RSI band, ATR ratio, trend slope, and pullback depth; computes forward returns at 5, 20, 60, and 120 trading days; if fewer than 5 analogs found, `confidence_score` is capped at 0.40
- [ ] `calculate_buy_zone` persists a new `StockBuyZoneSnapshot` row via the provided `AsyncSession` before returning
- [ ] All probabilistic language in explanation strings uses approved vocabulary (see PRD2 Section 20 appendix); a comment at the top of `buy_zone_service.py` lists the banned phrases
- [ ] OHLCV data is fetched via `services/market_data.py`; no direct `yfinance` import in either service file
- [ ] Function raises a descriptive `ValueError` if the ticker returns no OHLCV data (mirrors existing `load_ohlcv` error handling)

---

### T-15 · Implement `services/theme_scoring_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-03, T-13 |

**Context:** Theme score blends sector/industry mapping from yfinance metadata, the curated `SUPPORTED_THEMES` ticker-to-theme map (hardcoded starting point), and user-assigned tags from `watchlist_ideas`. The `user_conviction_score` sub-component is computed at query time from the calling user's ideas for the ticker.

**Acceptance Criteria:**
- [ ] `SUPPORTED_THEMES` constant list of 10 themes is defined in this module (or in a shared constants file imported here)
- [ ] `compute_theme_score(ticker, user_id, db)` returns a `ThemeScoreResult` dataclass with all fields from FR-D03
- [ ] Sector/industry data is loaded from `yfinance.Ticker(ticker).info`; if no sector data, `sector_tailwind_score = 0.0` with an explanation string noting the fallback
- [ ] `user_conviction_score` is computed from tags on all `WatchlistIdea` rows belonging to `user_id` that have `ticker` as a linked ticker
- [ ] Function persists or upserts a `StockThemeScore` row (system-wide, no user_id) before returning
- [ ] `POST /api/stocks/{ticker}/theme-score/recompute` forces a fresh calculation regardless of `updated_at`
- [ ] `GET /api/stocks/{ticker}/theme-score` returns the latest `StockThemeScore` row, augmented with the caller's `user_conviction_score` computed at query time

---

### T-16 · Implement `services/notification_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-03 |

**Context:** Abstraction layer for alert delivery. v2 ships `InAppNotification` as a concrete implementation (writes to application log + returns a structured dict). `EmailNotification` and `WebhookNotification` are stubbed: they read env vars and log "channel not configured" if the env var is not set, rather than raising an exception.

**Acceptance Criteria:**
- [ ] `NotificationChannel` ABC with abstract async `send(user_id, subject, body, metadata)` method
- [ ] `InAppNotification.send()` writes a structured INFO log entry and returns successfully; no external call is made
- [ ] `EmailNotification.send()` checks `settings.notification_email_enabled`; if False, logs "email channel disabled" and returns; if True, the method body is a `NotImplementedError` with a clear message to wire a provider
- [ ] `WebhookNotification.send()` follows the same pattern for `settings.notification_webhook_enabled`
- [ ] `get_notification_channels()` factory function returns a list of enabled channel instances; callers iterate and call `send()` on each

---

### T-17 · Implement `services/alert_engine_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-10, T-14, T-16 |

**Context:** Evaluates all enabled `PriceAlertRule` records for the current user(s). Called by the scheduler every 5 minutes. Must be idempotent — running twice in the same minute must not fire duplicate notifications.

**Acceptance Criteria:**
- [ ] `evaluate_all_alerts(db)` fetches all enabled `PriceAlertRule` rows and evaluates each against the latest `StockBuyZoneSnapshot` for the rule's ticker
- [ ] All six alert types are implemented: `entered_buy_zone`, `near_buy_zone` (uses `proximity_pct` from `threshold_json`), `below_invalidation`, `confidence_improved` (delta >= 0.10 vs previous snapshot), `theme_score_increased` (delta >= 0.15), `macro_deterioration`
- [ ] Market hours filter: if `market_hours_only=True`, evaluation is skipped outside NYSE hours (09:30–16:00 ET, weekdays); use `pytz` or `zoneinfo` for timezone handling
- [ ] Cooldown filter: if `last_triggered_at` is within `cooldown_minutes` of `now()`, evaluation is skipped for that rule
- [ ] When an alert fires: update `last_triggered_at` on the rule, call `get_notification_channels()` and `send()` on each, log the trigger at INFO level with `ticker`, `user_id`, and `alert_type`
- [ ] Evaluation result per rule (triggered / skipped / cooldown) is logged at DEBUG level
- [ ] Function is safe to call concurrently; no external state mutation beyond the DB update to `last_triggered_at`

---

### T-18 · Implement `services/auto_buy_engine.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T-11, T-12, T-14, T-17 |

**Context:** Nine-safeguard decision engine. Auto-buy is disabled by default. Paper mode routes to `AlpacaClient(paper=True)`. The decision log must be written before any broker call is made (NFR-11).

**Why L:** All nine safeguards must be implemented and wired together before any single path through the engine is testable. Splitting into separate tasks would leave the engine in a non-callable state.

**Acceptance Criteria:**
- [ ] `AutoBuyDecision` dataclass matches the spec in `prompt-feature.md` Feature C
- [ ] Eight decision states are defined as string constants: `candidate`, `ready_to_alert`, `ready_to_buy`, `blocked_by_risk`, `order_submitted`, `order_filled`, `order_rejected`, `cancelled`
- [ ] All nine safeguards are implemented as private functions: `_check_price_inside_buy_zone`, `_check_confidence_above_threshold`, `_check_drawdown_within_limit`, `_check_liquidity_filter`, `_check_spread_filter`, `_check_not_near_earnings` (reads `near_earnings` flag on `WatchlistIdeaTicker`), `_check_position_size_limit`, `_check_daily_risk_budget`, `_check_no_duplicate_order`
- [ ] `run_decision(ticker, user_id, db, dry_run=True)` evaluates all nine safeguards in order; any single failure sets `decision_state = "blocked_by_risk"` and records `"FAILED: <reason>"` in `reason_codes`; all nine are evaluated even after the first failure to produce a full breakdown
- [ ] `AutoBuyDecisionLog` row is written to DB before any broker `place_order()` call; if the broker call raises, the log row already exists with `decision_state = "order_submitted"`
- [ ] High theme score does not affect safeguard evaluation — `_check_price_inside_buy_zone` and `_check_confidence_above_threshold` run unconditionally (FR-C11)
- [ ] When `paper_mode=True`, broker client is instantiated via `get_broker_client(credential, paper=True)`
- [ ] `dry_run=True` skips the broker call entirely; `order_payload_json` is populated with the hypothetical order but `decision_state` returns `ready_to_buy` (not `order_submitted`)

---

### T-19 · Implement `services/ideas_service.py` — idea CRUD and ranking

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-11, T-15 |

**Context:** Ideas are the entry point for the auto-buy candidate universe. The composite ranking formula is `(theme_score_total * 0.35) + (entry_quality_score * 0.35) + (conviction_score / 10 * 0.20) + (alert_readiness_bonus * 0.10)`. `alert_readiness_bonus` is 1.0 if any enabled `PriceAlertRule` exists for any linked ticker, else 0.0.

**Acceptance Criteria:**
- [ ] `list_ideas(user_id, db)` returns all `WatchlistIdea` rows for the user, each augmented with `rank_score` computed via the composite formula; sorted descending by `rank_score`
- [ ] `create_idea(user_id, payload, db)` creates the `WatchlistIdea` and associated `WatchlistIdeaTicker` rows in a single transaction; returns the created idea with `rank_score`
- [ ] `update_idea(idea_id, user_id, payload, db)` calls `assert_ownership(idea, current_user)` before modifying; returns 403 on mismatch
- [ ] `delete_idea(idea_id, user_id, db)` deletes the idea and cascades to `WatchlistIdeaTicker` rows; returns 404 if not found, 403 if wrong owner
- [ ] `rank_score` is computed at query time — it is never stored as a column; the formula matches FR-E03 exactly
- [ ] Ideas with `watch_only=True` or `tradable=False` are correctly excluded from auto-buy candidate evaluation in `auto_buy_engine.py`

---

### T-20 · Implement `api/buy_zone.py` router and register in `main.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-09, T-14 |

**Acceptance Criteria:**
- [ ] `GET /api/stocks/{ticker}/buy-zone` returns the latest `StockBuyZoneSnapshot` for the ticker if it is less than 1 hour old; otherwise triggers `calculate_buy_zone()` synchronously, persists the result, and returns it
- [ ] `POST /api/stocks/{ticker}/recalculate-buy-zone` always runs the full pipeline regardless of snapshot age; persists a new user-scoped row (`user_id = current_user.id`)
- [ ] Both endpoints require `Depends(get_current_user)`; return 401 without a valid cookie
- [ ] `feature_payload_json` is excluded from both responses (serialised via `BuyZoneOut`)
- [ ] Router registered in `main.py` with prefix `/api`

---

### T-21 · Implement `api/theme_score.py` router and register in `main.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-13, T-15 |

**Acceptance Criteria:**
- [ ] `GET /api/stocks/{ticker}/theme-score` returns the current `StockThemeScore` row augmented with `user_conviction_score` for the calling user; if no row exists, triggers `compute_theme_score()` and returns the result
- [ ] `POST /api/stocks/{ticker}/theme-score/recompute` forces a fresh calculation; returns the updated `ThemeScoreOut`
- [ ] Both endpoints require `Depends(get_current_user)`
- [ ] Router registered in `main.py`

---

### T-22 · Implement `api/alerts.py` router and register in `main.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-10, T-17 |

**Acceptance Criteria:**
- [ ] `GET /api/alerts` returns all `PriceAlertRule` rows for `current_user.id`
- [ ] `POST /api/alerts` creates a new rule scoped to `current_user.id`; returns 422 if `alert_type` is not one of the six valid types
- [ ] `PATCH /api/alerts/{id}` updates the rule; returns 403 if `rule.user_id != current_user.id`
- [ ] `DELETE /api/alerts/{id}` deletes the rule; returns 403 on ownership mismatch, 404 if not found
- [ ] All four endpoints require `Depends(get_current_user)`
- [ ] Router registered in `main.py`

---

### T-23 · Implement `api/ideas.py` router and register in `main.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-11, T-19 |

**Acceptance Criteria:**
- [ ] `GET /api/ideas` returns ideas sorted by `rank_score` descending; each item includes `rank_score`
- [ ] `POST /api/ideas` creates an idea and linked tickers in a transaction; returns 422 if `conviction_score` is outside 1–10
- [ ] `PATCH /api/ideas/{id}` updates the idea; ownership check enforced
- [ ] `DELETE /api/ideas/{id}` deletes the idea and cascades to tickers; ownership check enforced
- [ ] All endpoints require `Depends(get_current_user)`
- [ ] Router registered in `main.py`

---

### T-24 · Implement `api/auto_buy.py` router and register in `main.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-12, T-18 |

**Acceptance Criteria:**
- [ ] `GET /api/auto-buy/settings` returns the user's `AutoBuySettings`; if no row exists, creates a default row (all defaults per the ORM model) and returns it
- [ ] `PATCH /api/auto-buy/settings` updates one or more settings fields; `enabled` and `paper_mode` changes are logged at INFO level with the previous and new values
- [ ] `GET /api/auto-buy/decision-log` returns a paginated list of `AutoBuyDecisionLog` rows for the user (default page size 50); sorted by `created_at` descending
- [ ] `POST /api/auto-buy/dry-run/{ticker}` calls `run_decision(ticker, user_id, db, dry_run=True)`; returns `AutoBuyDryRunResult`; never submits an order regardless of settings
- [ ] All endpoints require `Depends(get_current_user)`
- [ ] Broker credentials are never returned in any response from this router
- [ ] Router registered in `main.py`

---

### T-25 · Implement `api/opportunities.py` router and register in `main.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-09, T-15, T-19 |

**Context:** Aggregates buy zone, theme score, alert status, and auto-buy eligibility for all tickers linked to the user's ideas. Returns up to 100 rows ranked by composite score. Supports sorting and filtering via query parameters.

**Acceptance Criteria:**
- [ ] `GET /api/opportunities` returns up to 100 `OpportunityRow` items
- [ ] Each row computes `distance_to_zone_pct = ((current_price - buy_zone_low) / buy_zone_low) * 100` (negative = price is below zone, i.e. in or past the zone)
- [ ] Query params supported: `sort_by` (enum: `confidence`, `distance`, `theme_score`, default `confidence`), `theme` (filter by theme tag), `alert_active` (bool filter), `auto_buy_eligible` (bool filter)
- [ ] Tickers with no existing buy zone snapshot are excluded from the response (not auto-calculated here — user must call recalculate first)
- [ ] Endpoint requires `Depends(get_current_user)`
- [ ] Router registered in `main.py`

---

### T-26 · Implement config additions for notification channels

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | XS |
| **Blocked by** | T-02 |

**Acceptance Criteria:**
- [ ] `core/config.py` exposes `notification_email_enabled: bool = False` and `notification_webhook_enabled: bool = False`
- [ ] Both variables are read from env and documented in `.env.example`
- [ ] `notification_service.py` (T-16) reads these flags from `settings` — no hard-coded values

---

### T-27 · Implement scheduler task functions (fill in stubs from T-03)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-14, T-15, T-17, T-18, T-26 |

**Context:** The four task files were created as stubs in T-03. This task replaces the stub bodies with real implementations that use the services from T-14, T-15, T-17, and T-18. Each job must log start, completion, and any per-ticker errors without stopping the overall job run.

**Acceptance Criteria:**
- [ ] `refresh_buy_zones.py`: queries all distinct tickers from `WatchlistIdeaTicker`; for each ticker, fetches the latest `StockBuyZoneSnapshot`; if snapshot is older than `BUY_ZONE_REFRESH_MINUTES` or missing, calls `calculate_buy_zone(ticker, db)` with `user_id=None` (system-wide); exceptions per ticker are caught and logged; the job continues to the next ticker
- [ ] `refresh_theme_scores.py`: queries all distinct tickers from `WatchlistIdeaTicker`; for each ticker, calls `compute_theme_score(ticker, user_id=None, db)` if the `StockThemeScore` row is older than `THEME_SCORE_REFRESH_MINUTES`; per-ticker errors are caught and logged
- [ ] `evaluate_alerts.py`: calls `evaluate_all_alerts(db)` once per run; logs total rules evaluated, triggered, skipped, cooldown
- [ ] `evaluate_auto_buy.py`: fetches all users who have `AutoBuySettings.enabled=True`; for each user, fetches their tradable, non-watch-only idea tickers; calls `run_decision(ticker, user_id, db)` for each; logs outcomes
- [ ] All four jobs log "JOB START: <job_name>" and "JOB COMPLETE: <job_name> in <elapsed>ms" at INFO level
- [ ] Running any job twice in the same window is idempotent (no duplicate rows created)

---

### T-28 · Build `components/buy-zone/BuyZoneCard.tsx` and `HistoricalOutcomePanel.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-20 |

**Context:** These components appear on both the stock detail enhancement (T-36) and potentially on the opportunities page row expansion. They must use only approved probabilistic vocabulary in all display strings — no banned phrases.

**Acceptance Criteria:**
- [ ] `BuyZoneCard` displays: buy zone range (`$low – $high`), confidence score as a percentage progress bar (shadcn/ui `Progress`), invalidation price, expected 30-day return, expected drawdown
- [ ] All displayed values use approved vocabulary: "confidence score of X%", "historically favorable buy zone", "expected drawdown of X%", "invalidation level at $X", "positive outcome rate of X%"
- [ ] `HistoricalOutcomePanel` displays: `positive_outcome_rate_30d`, `positive_outcome_rate_90d`, `expected_return_30d`, `expected_return_90d` as labeled stat blocks
- [ ] Expandable `explanation` list uses shadcn/ui `Accordion` or `Collapsible`; each explanation string is rendered as a bullet
- [ ] Components accept typed props derived from `BuyZoneOut` response schema
- [ ] Components use existing shadcn/ui primitives (`Card`, `CardHeader`, `CardContent`, `Progress`, `Badge`); no new UI library imports

---

### T-29 · Build `components/buy-zone/ThemeScoreBadge.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T-21 |

**Acceptance Criteria:**
- [ ] `ThemeScoreBadge` renders one `Badge` per scored theme category from `theme_scores_by_category`; badge color scales by score: gray (< 0.3), amber (0.3–0.6), green (> 0.6)
- [ ] Badge label is the theme name formatted for display (e.g. `"renewable_energy"` → `"Renewable Energy"`)
- [ ] Component accepts `theme_scores_by_category: Record<string, number>` as a prop
- [ ] Zero-score themes are omitted from display

---

### T-30 · Build `components/alerts/AlertConfigForm.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T-22 |

**Acceptance Criteria:**
- [ ] Form fields: ticker input, alert type dropdown (six options with human-readable labels), proximity threshold input (shown only for `near_buy_zone` type), cooldown window input, market hours only toggle (`Switch`), enable/disable toggle
- [ ] Uses React Hook Form + Zod schema; `alert_type` validates against the six known values
- [ ] On submit, calls `POST /api/alerts`; on success, shows a shadcn/ui `Toast` "Alert created"
- [ ] Controlled by a parent page or `Dialog`; emits `onSuccess` callback

---

### T-31 · Build `components/ideas/IdeaForm.tsx` and `IdeaList.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-23 |

**Acceptance Criteria:**
- [ ] `IdeaForm` includes: title input, thesis textarea, conviction slider (1–10, shadcn/ui `Slider`), theme tag multi-select (from the ten supported themes), linked tickers input (comma-separated or tag input), watch-only toggle with tooltip "Watch-only ideas are tracked but never sent to a broker", tradable toggle
- [ ] `IdeaForm` uses React Hook Form + Zod; `conviction_score` validates 1–10
- [ ] `IdeaList` renders idea cards sorted by `rank_score` descending; each card shows title, thesis (truncated), conviction score, `rank_score` formatted to 2 decimal places, theme tags as `ThemeScoreBadge` components, and linked tickers
- [ ] Edit and delete actions on each card call `PATCH /api/ideas/{id}` and `DELETE /api/ideas/{id}` respectively; delete shows a shadcn/ui `Dialog` confirmation
- [ ] TanStack Query is used for data fetching and cache invalidation on mutations

---

### T-32 · Build `/opportunities` page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-28, T-29, T-25 |

**Acceptance Criteria:**
- [ ] Page fetches `GET /api/opportunities` via TanStack Query; renders a shadcn/ui `Table` with columns: ticker, current price, buy zone range, distance to zone (%), confidence score, theme score, alert status badge, auto-buy readiness badge, last updated
- [ ] Sort controls: four sort options (confidence desc, distance to zone asc, theme score desc, risk/reward); active sort is highlighted
- [ ] Filter bar: theme tag multi-select dropdown, alert active filter, auto-buy eligible filter
- [ ] Each row links to the relevant stock detail page (or triggers a drawer with buy zone detail if no dedicated stock detail page exists)
- [ ] Empty state: "Add ideas with linked tickers to populate the opportunities list"
- [ ] Page is protected by `middleware.ts`; unauthenticated users are redirected to `/login`
- [ ] Sidebar nav includes a link to `/opportunities` (added to the existing sidebar component)

---

### T-33 · Build `/ideas` page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-31, T-29 |

**Acceptance Criteria:**
- [ ] Page renders `IdeaList` sorted by `rank_score` descending
- [ ] "New Idea" button opens `IdeaForm` in a `Dialog`
- [ ] Edit action on a card opens `IdeaForm` in a `Dialog` pre-populated with existing values
- [ ] Delete action shows a confirmation `Dialog`; on confirm, calls `DELETE /api/ideas/{id}`; TanStack Query cache is invalidated
- [ ] Page title "Ideas" rendered in `<h1 data-testid="page-title">`
- [ ] Page is protected by `middleware.ts`
- [ ] Sidebar nav link added

---

### T-34 · Build `/alerts` page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-30 |

**Acceptance Criteria:**
- [ ] Page fetches `GET /api/alerts` and renders a list of alert rule cards
- [ ] Each card shows: ticker, alert type (human-readable label), threshold summary, cooldown, market hours only flag, last triggered timestamp (or "Never"), enable/disable `Switch`
- [ ] Toggling the `Switch` calls `PATCH /api/alerts/{id}` with `{ enabled: bool }`
- [ ] "New Alert" button opens `AlertConfigForm` in a `Dialog`
- [ ] Delete button on each card calls `DELETE /api/alerts/{id}` after confirmation
- [ ] Page title "Alerts" in `<h1 data-testid="page-title">`
- [ ] Page is protected by `middleware.ts`
- [ ] Sidebar nav link added

---

### T-35 · Build `/auto-buy` page

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | L |
| **Blocked by** | T-24 |

**Context:** This page has the most complex UX requirements in v2 — two confirmation dialogs, a settings panel with multiple interdependent controls, and a paginated decision log table with color-coded state badges.

**Why L:** The two-confirmation-dialog flow for `enabled` and `paper_mode` must be implemented precisely as specified (FR-C01, FR-C02). The safeguard breakdown display and state badge logic add significant front-end complexity. Splitting the settings panel and log table into separate tasks would leave the page non-functional.

**Acceptance Criteria:**
- [ ] Settings panel: master enable `Switch` triggers a shadcn/ui `Dialog` with text "Enabling auto-buy may result in real orders being placed. Confirm you understand the risks." — the PATCH to `enabled=true` is only sent after user clicks "Confirm"
- [ ] Paper/Live mode toggle: switching from paper to live triggers a second `Dialog`: "You are switching to live trading mode. Real orders may be placed immediately." — PATCH to `paper_mode=false` is only sent after confirmation
- [ ] Settings fields: per-trade max amount `Input`, confidence threshold `Slider` (0.5–1.0, step 0.01), max expected drawdown `Slider` (−0.20 to −0.01), earnings blackout `Switch`, allowed broker accounts multi-select (populated from `GET /broker/credentials`)
- [ ] Decision log table columns: timestamp, ticker, decision state badge (green=`order_filled`, amber=`ready_to_buy`, red=`blocked_by_risk`, gray=`candidate`/`ready_to_alert`), reason codes (collapsed by default, expandable `Collapsible`), dry-run flag badge
- [ ] "Dry Run" button per tracked ticker (or a global one with a ticker input): calls `POST /api/auto-buy/dry-run/{ticker}` and opens a results `Dialog` showing the full safeguard breakdown
- [ ] Page title "Auto-Buy" in `<h1 data-testid="page-title">`
- [ ] Page protected by `middleware.ts`; sidebar nav link added

---

### T-36 · Add Buy Zone Analysis panel to existing stock detail view

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-28, T-29, T-30 |

**Context:** There is no dedicated `/stocks/{ticker}` page in v1 — the opportunities table rows will link to the strategies or live-trading pages filtered by ticker. This task adds a collapsible buy zone panel reusable wherever a ticker context exists. It is wired into the `/opportunities` row expansion (drawer or accordion) as the primary display surface.

**Acceptance Criteria:**
- [ ] `BuyZoneAnalysisPanel` component accepts `ticker: string` as a prop; fetches `GET /api/stocks/{ticker}/buy-zone` via TanStack Query
- [ ] Panel renders: `BuyZoneCard`, `HistoricalOutcomePanel`, `ThemeScoreBadge` per category, alert toggle (creates a `near_buy_zone` rule for the ticker via `POST /api/alerts`), auto-buy eligibility badge (reads `decision_state` from the most recent log entry via `GET /api/auto-buy/decision-log?ticker={ticker}`)
- [ ] Panel is collapsible using shadcn/ui `Collapsible` with a "Buy Zone Analysis" header
- [ ] "Recalculate" button calls `POST /api/stocks/{ticker}/recalculate-buy-zone`; shows a loading spinner during the request (p95 is 8 seconds per NFR-01)
- [ ] If no buy zone data exists, shows "No buy zone data — click Recalculate to compute" placeholder
- [ ] Panel is integrated into the `/opportunities` page row expansion and exported for reuse on future stock detail pages

---

### T-37 · Write unit tests for `buy_zone_service.py` and `analog_scoring_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-14 |

**Acceptance Criteria:**
- [ ] `tests/test_buy_zone_service.py` exists with tests for: each of the seven scoring layers independently (verify sub-score is between 0.0 and 1.0 and explanation string is non-empty), full pipeline happy path, edge case with no OHLCV data (raises `ValueError`), edge case with single bar (does not crash; confidence capped at 0.40)
- [ ] `tests/test_analog_scoring.py` tests: window matching returns at least 5 analogs for a 2-year dataset, forward return computation at 5/20/60/120 days, `confidence_score` is capped at 0.40 when fewer than 5 analogs are found
- [ ] `yfinance` is mocked using `pytest-mock` or `unittest.mock`; no real network calls
- [ ] All tests pass with `pytest tests/test_buy_zone_service.py tests/test_analog_scoring.py`

---

### T-38 · Write unit tests for `theme_scoring_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-15 |

**Acceptance Criteria:**
- [ ] `tests/test_theme_scoring.py` tests: theme tag mapping for at least 3 tickers in each of the 10 themes, score blending formula produces a value between 0.0 and 1.0, zero-sector-data fallback sets `sector_tailwind_score = 0.0` and adds an explanation string, `user_conviction_score` reflects user idea tags correctly
- [ ] `yfinance.Ticker.info` is mocked
- [ ] All tests pass with `pytest tests/test_theme_scoring.py`

---

### T-39 · Write unit tests for `alert_engine_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-17 |

**Acceptance Criteria:**
- [ ] `tests/test_alert_engine.py` tests each of the six alert types with a condition that triggers and one that does not
- [ ] Cooldown logic test: rule with `last_triggered_at = now() - 30 min` and `cooldown_minutes = 60` must be skipped
- [ ] Market hours filter test: evaluation during off-hours with `market_hours_only=True` must be skipped; same rule during market hours must evaluate
- [ ] Notification channel is mocked; `send()` call count is asserted per test
- [ ] All tests pass with `pytest tests/test_alert_engine.py`

---

### T-40 · Write unit tests for `auto_buy_engine.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-18 |

**Acceptance Criteria:**
- [ ] `tests/test_auto_buy_engine.py` tests each of the nine safeguards independently: one test that causes the specific safeguard to fail, verifying `reason_codes` contains `"FAILED: <expected reason>"`
- [ ] Full pipeline pass test: all nine safeguards pass; `decision_state == "ready_to_buy"` when `dry_run=True`
- [ ] Full pipeline block test: `price_inside_buy_zone` fails; all other checks still run and their results appear in `reason_codes`
- [ ] `not_near_earnings` fail test: `WatchlistIdeaTicker.near_earnings = True` causes the check to fail with `"FAILED: earnings within 3 days"`
- [ ] Broker client is mocked; `place_order()` is never called when `dry_run=True`
- [ ] All tests pass with `pytest tests/test_auto_buy_engine.py`

---

### T-41 · Write unit tests for `api/auto_buy.py` (endpoint tests)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-24 |

**Acceptance Criteria:**
- [ ] `tests/test_auto_buy_api.py` uses FastAPI `TestClient` with an authenticated user fixture
- [ ] `PATCH /api/auto-buy/settings` test: update `confidence_threshold`; verify response reflects the new value
- [ ] `GET /api/auto-buy/decision-log` test: seed two decision log rows for user A and one for user B; verify user A's response contains exactly two rows
- [ ] `POST /api/auto-buy/dry-run/{ticker}` test: verify response always has `dry_run=true` and `reason_codes` is a non-empty list
- [ ] Ownership enforcement test: attempt to read another user's data; verify 403 response

---

### T-42 · Write backend integration tests for v2 flows

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T-37, T-38, T-39, T-40, T-41 |

**Acceptance Criteria:**
- [ ] Integration test 1 — Price → zone → alert end-to-end: insert a `StockBuyZoneSnapshot` with `current_price` inside `buy_zone_low`..`buy_zone_high`; create a `PriceAlertRule` for `entered_buy_zone` on the same ticker; call `evaluate_all_alerts(db)`; assert `last_triggered_at` is set on the rule and notification channel `send()` was called
- [ ] Integration test 2 — Dry-run auto-buy, all safeguards pass: seed a buy zone snapshot where all numeric safeguards would pass; call `run_decision(ticker, user_id, db, dry_run=True)`; assert `decision_state == "ready_to_buy"` and all nine entries in `reason_codes` start with "PASSED"
- [ ] Integration test 3 — Dry-run blocked by earnings: set `WatchlistIdeaTicker.near_earnings = True`; call `run_decision`; assert `decision_state == "blocked_by_risk"` and `reason_codes` contains one entry starting with "FAILED: earnings"
- [ ] Integration test 4 — Idea creation → theme score → ranking: create an idea with `tags_json=["ai"]` and a linked ticker; call `compute_theme_score` for the ticker; assert returned `ThemeScoreResult.user_conviction_score > 0`; call `list_ideas`; assert `rank_score > 0`
- [ ] All tests mock `yfinance`, broker clients, and notification channels; no live network calls

---

### T-43 · Run pre-release banned language linting scan

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | XS |
| **Blocked by** | T-32, T-33, T-34, T-35, T-36, T-42 |

**Context:** NFR-10 and FR-A12 require a linting scan before any v2 feature is marked complete. This task runs the scan and fixes any instances found.

**Acceptance Criteria:**
- [ ] A shell command or script searches all `.py`, `.tsx`, `.ts`, `.json` files under `backend/` and `frontend/` for the seven banned phrases from PRD2 Section 13: "guaranteed profit", "no chance of loss", "safe entry", "certain to go up", "buy now" (as a command), "guaranteed winner", "safe forever"
- [ ] Zero matches are found at the time this task is marked complete
- [ ] The scan command is documented in the project README so it can be re-run before future releases

---

### T-44 · Playwright E2E smoke tests for new v2 pages

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T-32, T-33, T-34, T-35 |

**Context:** The existing Playwright suite has 421/789 tests passing. New v2 pages need smoke-level coverage. Full E2E coverage is not required — happy path per page plus the auto-buy confirmation dialog flows.

**Acceptance Criteria:**
- [ ] Smoke test for `/opportunities`: authenticated user sees the table with column headers; unauthenticated user is redirected to `/login`
- [ ] Smoke test for `/ideas`: "New Idea" button opens a dialog; form submits successfully with valid data; created idea appears in the list
- [ ] Smoke test for `/alerts`: "New Alert" button opens a dialog; created alert appears in the list with an enabled toggle
- [ ] Smoke test for `/auto-buy`: master enable switch triggers the confirmation dialog; clicking "Cancel" leaves `enabled=false`; clicking "Confirm" sends the PATCH request
- [ ] All four smoke tests are added to `tests/e2e/` and run with `npx playwright test --config=e2e/playwright.config.ts`
- [ ] No existing passing tests regress (run the full suite; pass count does not decrease)

---

### T-45 · Verify v1 E2E regression suite still passes

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T-20, T-21, T-22, T-23, T-24, T-25, T-27 |

**Context:** PRD2 Section 18 acceptance criterion: "All existing v1 E2E tests continue to pass (no regressions)." This task is a verification checkpoint, not new development.

**Acceptance Criteria:**
- [ ] Full Playwright suite runs against the v2 backend and frontend
- [ ] The number of passing tests is equal to or greater than the pre-v2 baseline (421 tests)
- [ ] Any newly failing v1 tests are investigated and fixed before this task is marked complete
- [ ] Results are recorded in a short comment: total tests, passing, failing, new failures introduced by v2 (expected: 0)

---

### T-46 · Update `backend/.env.example` and deployment documentation

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | XS |
| **Blocked by** | T-26, T-27 |

**Acceptance Criteria:**
- [ ] `.env.example` includes all seven new env vars: `SCHEDULER_ENABLE`, `BUY_ZONE_REFRESH_MINUTES`, `THEME_SCORE_REFRESH_MINUTES`, `ALERT_EVAL_MINUTES`, `AUTO_BUY_EVAL_MINUTES`, `NOTIFICATION_EMAIL_ENABLED`, `NOTIFICATION_WEBHOOK_ENABLED`
- [ ] Each var has a comment explaining its purpose and default value
- [ ] `README.md` (or `CLAUDE.md` implementation status table) updated to reflect v2 features as implemented

---

### T-47 · Add sidebar navigation links for all four new pages

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | XS |
| **Blocked by** | T-32, T-33, T-34, T-35 |

**Context:** The existing `AppShell.tsx` or sidebar component contains the nav link list. This task adds the four new entries so all pages are reachable via navigation rather than direct URL.

**Acceptance Criteria:**
- [ ] Sidebar contains links: "Opportunities" → `/opportunities`, "Ideas" → `/ideas`, "Alerts" → `/alerts`, "Auto-Buy" → `/auto-buy`
- [ ] Active link is highlighted using the existing active-link style (consistent with current nav behavior)
- [ ] Links appear in a logical grouping — after existing strategy/backtest links, before profile
- [ ] No existing sidebar links are removed or reordered unintentionally

---

## Requirement Traceability

| Requirement ID | Description (abbreviated) | Task(s) |
|---|---|---|
| FR-A01 | Buy zone on-demand endpoint | T-20 |
| FR-A02 | Force-recalculate endpoint | T-20 |
| FR-A03 | Seven-layer scoring pipeline | T-14 |
| FR-A04 | Buy zone range from ATR-adjusted bands | T-14 |
| FR-A05 | All result fields persisted to snapshot table | T-01, T-04, T-14 |
| FR-A06 | Explanation array in result | T-14, T-28 |
| FR-A07 | `feature_payload_json` backend-only | T-09, T-20 |
| FR-A08 | Nullable `user_id` on snapshots | T-01, T-04 |
| FR-A09 | OHLCV loaded via existing backtesting loader | T-14 |
| FR-A10 | Analog scoring with minimum 5 analogs | T-14 |
| FR-A11 | Scheduler refreshes buy zones every 60 min | T-02, T-03, T-27 |
| FR-A12 | No banned language in results | T-43 |
| FR-B01 | Alert CRUD endpoints | T-22 |
| FR-B02 | Six alert types | T-17 |
| FR-B03 | `near_buy_zone` proximity threshold | T-07, T-10, T-17 |
| FR-B04 | `confidence_improved` delta trigger | T-17 |
| FR-B05 | `theme_score_increased` delta trigger | T-17 |
| FR-B06 | Cooldown window per rule | T-07, T-17 |
| FR-B07 | Market hours filter | T-17 |
| FR-B08 | Scheduler evaluates alerts every 5 min | T-02, T-03, T-27 |
| FR-B09 | `NotificationChannel` abstraction | T-16 |
| FR-B10 | Alert evaluation logged | T-17 |
| FR-B11 | `/alerts` UI page | T-30, T-34 |
| FR-C01 | `AutoBuySettings.enabled` defaults False; requires confirmation dialog | T-08, T-35 |
| FR-C02 | `paper_mode` defaults True; live mode requires second confirmation | T-08, T-35 |
| FR-C03 | Nine safeguard checks all required | T-18 |
| FR-C04 | Every decision persisted to log | T-18, T-24 |
| FR-C05 | Dry-run endpoint | T-24 |
| FR-C06 | Reuse `broker/factory.py` | T-18 |
| FR-C07 | Paper mode routes to `AlpacaClient(paper=True)` | T-18 |
| FR-C08 | Decision states defined | T-18 |
| FR-C09 | Scheduler evaluates auto-buy every 5 min | T-02, T-03, T-27 |
| FR-C10 | Paginated decision log endpoint | T-24 |
| FR-C11 | High theme score never overrides risk controls | T-18, T-40 |
| FR-C12 | `/auto-buy` UI shows safeguard states | T-35 |
| FR-D01 | Ten supported themes constant | T-15 |
| FR-D02 | Theme score blending from sector + tags + thesis | T-15 |
| FR-D03 | `ThemeScoreResult` fields | T-13, T-15 |
| FR-D04 | Theme score endpoints | T-21 |
| FR-D05 | Scheduler refreshes theme scores every 360 min | T-02, T-03, T-27 |
| FR-D06 | Theme score feeds buy zone confidence and idea ranking | T-14, T-19 |
| FR-D07 | User idea tags update `user_conviction_score` | T-15, T-19 |
| FR-D08 | `StockThemeScore` has no `user_id` | T-05 |
| FR-E01 | Ideas CRUD endpoints | T-23 |
| FR-E02 | Idea fields including linked tickers | T-06, T-11 |
| FR-E03 | Composite rank score formula | T-19 |
| FR-E04 | `watch_only=True` excluded from broker actions | T-18, T-19 |
| FR-E05 | `tradable=False` excluded from auto-buy | T-18, T-19 |
| FR-E06 | `/ideas` UI page | T-31, T-33 |
| FR-E07 | `rank_score` in `GET /api/ideas` response | T-19, T-23 |
| NFR-01 | Buy zone response < 8s p95 | T-14 (async pipeline) |
| NFR-02 | Dry-run decision < 3s p95 | T-18 |
| NFR-03 | Alert cycle < 60s for 500 rules | T-17, T-27 |
| NFR-04 | Scheduler idempotent, single worker safe | T-27 |
| NFR-05 | All new endpoints require auth | T-20, T-21, T-22, T-23, T-24, T-25 |
| NFR-06 | All data scoped by `user_id` | T-17, T-18, T-19, T-20, T-22, T-23, T-24, T-25 |
| NFR-07 | Broker keys never in auto-buy responses | T-12, T-24 |
| NFR-08 | Scheduler jobs log start/completion/errors | T-27 |
| NFR-09 | Migrations have working `downgrade()` | T-01 |
| NFR-10 | No banned language anywhere | T-43 |
| NFR-11 | Decision log written before broker call | T-18 |
| NFR-12 | Structured logs at INFO level | T-14, T-15, T-17, T-18, T-27 |

---

## Quality Checks

- [x] **Coverage** — all FR-A01 through FR-E07 and NFR-01 through NFR-12 map to at least one task
- [x] **Dependencies** — no circular dependencies; all `blocked-by` IDs have lower numbers
- [x] **Owners** — every task has exactly one valid owner (`backend-architect` or `frontend-developer`)
- [x] **Effort** — two L tasks (T-14, T-18, T-35); each has an inline justification for why splitting would produce a non-runnable intermediate state
- [x] **Criteria** — every task has at least two acceptance criteria
- [x] **Order** — task numbers respect topological order throughout

## Part 3: Watchlist Scanner, Buy Signals & Idea Engine (V3)

> Generated from: PRD3.md + prompt-watchlist-scanner.md
> Generated on: 2026-03-24
> Last reviewed: 2026-03-24 (gap-fill pass)
> Total tasks: 49

---

## Assumptions & Clarifications

**OQ-01 resolved:** `POST /api/watchlist` and `DELETE /api/watchlist/{ticker}` are placed in a new `backend/app/api/watchlist.py` router (Option B). This keeps the existing `api/opportunities.py` focused on read/display and avoids growing that file with mutation logic. The new router is registered in `main.py` under the `/api` prefix.

**OQ-02 resolved:** `GET /api/ideas/generated/last-scan` returns `MAX(generated_ideas.generated_at)` from the `generated_ideas` table (Option c). Zero infrastructure overhead; acceptable because the idea generator job always inserts at least one row per run during market hours. If the table is empty, the endpoint returns `null` for `last_scan_at`.

**OQ-03 resolved:** For tickers added via `UserWatchlist` directly (not through an idea), the `not_near_earnings` condition defaults to `False` (passes the gate). This is the optimistic assumption — the conservative approach of suppressing is too aggressive given the V2 manual-flag limitation. The UI tooltip must note: "Earnings check: manual flag only (live lookup in V4)."

**OQ-04 resolved:** `buy_now_signals` rows older than 30 days are pruned by a new `prune_old_signals` scheduler task registered in `jobs.py` alongside the two new V3 jobs. This is a simple `DELETE WHERE created_at < now() - interval '30 days'` run daily.

**OQ-05 confirmed:** `GET /api/scanner/ideas` (V2) continues returning `composite_score`-ranked results from the in-process cache — no change. `GET /api/ideas/generated` (V3) returns `idea_score`-ranked results from the `generated_ideas` DB table. These are two entirely separate scoring paths. Do not merge them.

**Existing scan_watchlist.py note:** The existing `scan_watchlist.py` scheduler task scans tickers sourced from `WatchlistIdea`/`WatchlistIdeaTicker` using `scanner_service.scan_watchlist()`. The new V3 `run_live_scanner.py` task sources tickers from the new `user_watchlist` table and uses `buy_signal_service.evaluate_buy_signal()`. Both tasks run independently — they are not merged.

**httpx dependency:** `news_scanner_service.py` requires `httpx` for async RSS fetching. Add `httpx` to `requirements.txt` if not already present (it is used by httpx-based Alpaca client patterns elsewhere; confirm before adding a duplicate).

**`feedparser` library:** RSS XML parsing uses `feedparser` (pure Python, no API key). Add to `requirements.txt`. Alternatively, use `lxml` + `xml.etree` to avoid a new dependency — but `feedparser` handles malformed feeds more gracefully. Use `feedparser`.

**Ideal entry price calculation:** `ideal_entry_price` in `BuyNowSignal` is computed as the weighted midpoint within `[buy_zone_low, buy_zone_high]` refined by the analog win-rate distribution. As a baseline fallback, use `(buy_zone_low + buy_zone_high) / 2`. If `analog_scoring_service` returns a distribution, use the price level with the highest 90d win rate within the zone.

**Frontend type extensions:** The TypeScript type `OpportunityRow` in `frontend/types/index.ts` must be extended with the new signal-status fields before the frontend components are built. This is T3-22.

**Three sub-services for idea quality scoring (added in gap-fill pass):** PRD3.md Section 17 explicitly lists `moat_scoring_service.py`, `financial_quality_service.py`, and `entry_priority_service.py` as new files to be created. The prompt implementation order lists them as steps 5b, 5c, 5d. These were missing from the original TASKS3.md; they are now T3-11b, T3-11c, T3-11d, inserted in Wave 5. Their corresponding unit tests (`test_moat_scoring.py`, `test_financial_quality.py`, `test_entry_priority.py`, `test_megatrend_filter.py`) are also added as T3-35b through T3-35e in Wave 14.

**Idea score formula in T3-13 corrected:** The canonical 6-component `idea_score` formula from PRD3.md Section 8 is the authoritative one: `confidence_score (0.25) + megatrend_fit_score (0.20) + moat_score (0.15) + financial_quality_score (0.15) + technical_setup_score (0.15) + news_relevance_score (0.10)` + entry priority boosts. The 4-component formula previously noted in T3-13 was incomplete. T3-13 now correctly depends on T3-11b, T3-11c, and T3-11d.

**Alert toggle PATCH endpoint (added in gap-fill pass):** T3-25 (WatchlistTable) references a "PATCH endpoint" to persist the per-ticker alert toggle, but no backend task created this endpoint. T3-18b is added in Wave 9 to implement `PATCH /api/watchlist/{ticker}/alert`.

**T3-03 migration dependency corrected:** T3-03 (`user_watchlist` migration) was previously marked `Blocked by T3-01` (market_hours utility), but a DB migration has no code dependency on `utils/market_hours.py`. T3-03 is now `Blocked by: none` — it is the first migration in the chain.

**T3-41 now also blocked by T3-40:** `prune_old_signals.py` reads `settings.signal_prune_days`, which is defined in T3-40 (environment config). T3-41 is updated accordingly.

---

## Parallel Work Waves

**Wave 1 (no blockers — pure foundations):**
T3-01, T3-02, T3-03

**Wave 2 (chained migrations — T3-04 blocked by T3-03, T3-05 blocked by T3-04):**
T3-04, T3-05

**Wave 3 (ORM models — blocked by their respective migrations):**
T3-06, T3-07, T3-08

**Wave 4 (Pydantic schemas — blocked by T3-06, T3-07, T3-08):**
T3-09, T3-10

**Wave 5 (core services — parallel; each has its own blocker set):**
T3-11, T3-11b, T3-11c, T3-11d, T3-12

**Wave 6 (idea generator extension — blocked by T3-08, T3-09, T3-11b, T3-11c, T3-11d):**
T3-13

**Wave 7 (live scanner service — blocked by T3-12):**
T3-14

**Wave 8 (scheduler tasks — blocked by T3-11, T3-13, T3-14):**
T3-15, T3-16, T3-17

**Wave 9 (API layer — blocked by T3-06, T3-09, T3-10, T3-12, T3-13, T3-14):**
T3-18, T3-18b, T3-19, T3-20, T3-21

**Wave 10 (frontend types + shared infra — blocked by T3-19, T3-20, T3-21):**
T3-22

**Wave 11 (frontend Opportunities components — blocked by T3-22):**
T3-23, T3-24, T3-25

**Wave 12 (frontend Ideas components — blocked by T3-22):**
T3-26, T3-27, T3-28

**Wave 13 (frontend page integration — blocked by T3-23, T3-24, T3-25, T3-26, T3-27, T3-28):**
T3-29, T3-30

**Wave 14 (backend unit tests — blocked by their respective service tasks):**
T3-31, T3-32, T3-33, T3-34, T3-35, T3-35b, T3-35c, T3-35d, T3-35e

**Wave 15 (integration tests — blocked by T3-18, T3-19, T3-20, T3-21, T3-31 through T3-35e):**
T3-36, T3-37

**Wave 16 (E2E tests — blocked by T3-29, T3-30, T3-36, T3-37):**
T3-38, T3-39

**Wave 17 (environment config + deployment — blocked by T3-15, T3-16, T3-17):**
T3-40

**Wave 18 (signal pruning job — blocked by T3-17, T3-40):**
T3-41

**Wave 19 (documentation — blocked by all):**
T3-42

---

## Tasks

---

### T3-01 · Create `utils/market_hours.py` utility

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | none |
| **Action** | CREATE new file |

**Files:**
- `backend/app/utils/__init__.py` (create if missing)
- `backend/app/utils/market_hours.py` (create)

**Description:** Create the canonical `is_market_hours()` function using `pytz.timezone("America/New_York")`. All new V3 scheduler tasks import from this module; the existing V2 jobs use inline UTC checks and are not modified.

**Acceptance Criteria:**
- [ ] `is_market_hours()` returns `False` on Saturday and Sunday regardless of time.
- [ ] Returns `False` before 9:30 AM ET on a weekday.
- [ ] Returns `True` at 9:30 AM ET on a weekday.
- [ ] Returns `True` at 3:59 PM ET on a weekday.
- [ ] Returns `False` at 4:00 PM ET on a weekday.
- [ ] Handles both EST (UTC-5) and EDT (UTC-4) via `pytz` DST-awareness; test at a known DST boundary date.
- [ ] `pytz` is confirmed present in `requirements.txt` (it is a V2 dependency).

---

### T3-02 · Add `feedparser` and `httpx` to requirements

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | XS |
| **Blocked by** | none |
| **Action** | EXTEND existing file |

**Files:**
- `backend/requirements.txt`

**Description:** Add `feedparser` and confirm `httpx` is present. `feedparser` handles malformed RSS XML gracefully. `httpx` is needed for async RSS fetching in `news_scanner_service.py`.

**Acceptance Criteria:**
- [ ] `feedparser` is listed in `requirements.txt` with a pinned or minimum version.
- [ ] `httpx` is present in `requirements.txt` (add if missing, do not duplicate if already present).
- [ ] `pip install -r requirements.txt` completes without conflict.

---

### T3-03 · Alembic migration: `user_watchlist` table

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | none |
| **Action** | CREATE new migration file |

**Files:**
- `backend/alembic/versions/xxxx_add_user_watchlist.py` (create; replace xxxx with generated hash)

**Description:** Add the `user_watchlist` table with columns `id`, `user_id` (FK → users.id CASCADE), `ticker`, `alert_enabled` (default True), `created_at`. Unique constraint on `(user_id, ticker)`. Implements `downgrade()`. This is the first in the V3 migration chain — it has no dependency on any V3 code files, only on the V2 Alembic head.

**Acceptance Criteria:**
- [ ] `alembic upgrade head` runs without error from a clean V2 head.
- [ ] Table has `UNIQUE(user_id, ticker)` constraint.
- [ ] `alert_enabled` defaults to `True`.
- [ ] `user_id` has `ON DELETE CASCADE`.
- [ ] `alembic downgrade -1` drops the table cleanly.

---

### T3-04 · Alembic migration: `buy_now_signals` table

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-03 |
| **Action** | CREATE new migration file |

**Files:**
- `backend/alembic/versions/xxxx_add_buy_now_signals.py` (create)

**Description:** Add the `buy_now_signals` table with all columns from PRD3.md Section 6.2: backtest layer, live technical layer, final decision fields, risk metadata, and `created_at`. Chained from the `user_watchlist` migration.

**Acceptance Criteria:**
- [ ] All columns match the ORM spec: 9 boolean condition columns, 5 Numeric backtest/live columns, `signal_strength` String(20), `suppressed_reason` String(100) nullable.
- [ ] `all_conditions_pass` and `created_at` are indexed.
- [ ] `user_id` FK with `ON DELETE CASCADE`.
- [ ] `alembic upgrade head` succeeds; `alembic downgrade -1` drops cleanly.

---

### T3-05 · Alembic migration: `generated_ideas` table

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-04 |
| **Action** | CREATE new migration file |

**Files:**
- `backend/alembic/versions/xxxx_add_generated_ideas.py` (create)

**Description:** Add the `generated_ideas` table with all columns from PRD3.md Section 6.3. Chained from the `buy_now_signals` migration.

**Acceptance Criteria:**
- [ ] `source` String(20), `reason_summary` Text, `news_headline` Text nullable, `catalyst_type` String(30) nullable.
- [ ] `theme_tags` JSON column with default `[]`.
- [ ] `expires_at`, `generated_at`, and `idea_score` columns are indexed.
- [ ] `added_to_watchlist` defaults to `False`.
- [ ] `alembic upgrade head` succeeds; `alembic downgrade -1` drops cleanly.

---

### T3-06 · ORM model: `UserWatchlist`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-03 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/models/user_watchlist.py` (create)
- `backend/app/models/__init__.py` (EXTEND — add import)

**Description:** Implement the `UserWatchlist` ORM model matching the migration schema. Import into `models/__init__.py` so Alembic autogenerate detects it.

**Acceptance Criteria:**
- [ ] `__tablename__ = "user_watchlist"`.
- [ ] `UniqueConstraint("user_id", "ticker")` declared in `__table_args__`.
- [ ] `alert_enabled: Mapped[bool]` defaults to `True`.
- [ ] Model is importable from `app.models.user_watchlist`.
- [ ] `from app.models import UserWatchlist` works without error.

---

### T3-07 · ORM model: `BuyNowSignal`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-04 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/models/buy_signal.py` (create)
- `backend/app/models/__init__.py` (EXTEND — add import)

**Description:** Implement the `BuyNowSignal` ORM model from PRD3.md Section 6.2 with all backtest, live technical, decision, and metadata columns.

**Acceptance Criteria:**
- [ ] `__tablename__ = "buy_now_signals"`.
- [ ] All 9 boolean condition columns declared (`price_in_zone`, `above_50d_ma`, `above_200d_ma`, `rsi_confirms`, `volume_confirms`, `near_support`, `trend_regime_bullish`, `all_conditions_pass`, plus the implicit `not_near_earnings` and cooldown — handled in service logic, not as DB columns).
- [ ] `signal_strength` String(20): values are `"STRONG_BUY"` or `"SUPPRESSED"`.
- [ ] `suppressed_reason` String(100) nullable.
- [ ] `created_at` has `index=True`.
- [ ] Model importable from `app.models.buy_signal`.

---

### T3-08 · ORM model: `GeneratedIdea`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-05 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/models/generated_idea.py` (create)
- `backend/app/models/__init__.py` (EXTEND — add import)

**Description:** Implement the `GeneratedIdea` ORM model from PRD3.md Section 6.3 including `expires_at`, `added_to_watchlist`, `theme_tags` (JSON), `megatrend_tags` (JSON), `moat_score`, `financial_quality_score`, `near_52w_low`, `at_weekly_support`, `entry_priority`, and all scoring columns.

**Acceptance Criteria:**
- [ ] `__tablename__ = "generated_ideas"`.
- [ ] `source` accepts values: `"news"`, `"theme"`, `"technical"`, `"merged"`.
- [ ] `theme_tags` and `megatrend_tags` are `Mapped[list]` with `JSON` column type, default `[]`.
- [ ] `expires_at`, `generated_at`, and `idea_score` have `index=True`.
- [ ] `added_to_watchlist` defaults to `False`.
- [ ] `entry_priority` defaults to `"STANDARD"`; accepted values are `"52W_LOW"`, `"WEEKLY_SUPPORT"`, `"BOTH"`, `"STANDARD"`.
- [ ] Model importable from `app.models.generated_idea`.

---

### T3-09 · Pydantic schemas: watchlist + buy signal

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-06, T3-07 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/schemas/watchlist.py` (create)
- `backend/app/schemas/scanner.py` (EXTEND — add `BuyNowSignalOut`, `ScannerStatusOut`, `RunNowOut`)

**Description:** Define request/response Pydantic schemas for the watchlist endpoints and new scanner endpoints. Extend `OpportunityOut` in `schemas/auto_buy.py` with signal-status fields.

**Schemas to create:**
- `WatchlistAddRequest` (`ticker: str`)
- `WatchlistEntryOut` (`ticker`, `user_id`, `alert_enabled`, `created_at`)
- `ConditionDetail` (`key: str`, `pass_: bool`)
- `BuyNowSignalOut` (full read model for API responses)
- `ScannerStatusOut` (`last_scan_at`, `next_scan_at`, `tickers_in_queue`, `market_hours_active`)
- `RunNowOut` (`tickers_scanned: int`, `strong_buy_signals: int`, `results: list[ScanResultOut]`)

**Acceptance Criteria:**
- [ ] `WatchlistAddRequest` validates ticker format: 1–10 uppercase alphanumeric characters; raises 422 on invalid.
- [ ] `BuyNowSignalOut` includes `condition_details: list[ConditionDetail]` for the tooltip.
- [ ] Extended `OpportunityOut` fields: `ideal_entry_price`, `backtest_confidence`, `backtest_win_rate_90d`, `signal_status`, `all_conditions_pass`, `condition_details`, `suppressed_reason`, `invalidation_price`, `expected_drawdown`, `alert_enabled`.
- [ ] All new schemas have `model_config = ConfigDict(from_attributes=True)`.

---

### T3-10 · Pydantic schemas: generated ideas

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-08 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/schemas/generated_idea.py` (create)

**Description:** Define Pydantic schemas for the generated idea endpoints: `GeneratedIdeaDBOut` (full DB read model), `AddToWatchlistOut`, and `LastScanOut`.

**Schemas to create:**
- `GeneratedIdeaDBOut` — mirrors all `GeneratedIdea` ORM columns as a response model.
- `AddToWatchlistOut` (`ticker`, `watchlist_entry_created: bool`, `alert_rule_created: bool`, `idea_id: int`).
- `LastScanOut` (`last_scan_at: datetime | None`, `ideas_generated: int`, `next_scan_at: datetime | None`).

**Acceptance Criteria:**
- [ ] `GeneratedIdeaDBOut` serialises `theme_tags` and `megatrend_tags` as `list[str]`.
- [ ] `expires_at` is included and serialisable as ISO datetime string.
- [ ] `AddToWatchlistOut.watchlist_entry_created` is `False` (not an error) when ticker already present — idempotent behavior.
- [ ] All schemas have `model_config = ConfigDict(from_attributes=True)`.

---

### T3-11 · `news_scanner_service.py` — RSS fetch and ticker extraction

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-02, T3-09 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/services/news_scanner_service.py` (create)

**Description:** Implement `scan_news()` which fetches the five RSS feeds from PRD3.md Section 10 using `httpx.AsyncClient` (timeout=10s per feed), parses with `feedparser`, extracts ticker symbols and company names via keyword matching, and returns scored `NewsItem` dataclass instances. Each feed is fetched independently; failures are logged at WARNING and silently skipped.

**Acceptance Criteria:**
- [ ] `scan_news()` is an `async` function returning `list[NewsItem]`.
- [ ] `NewsItem` dataclass includes: `headline`, `source`, `published_at`, `url`, `text_snippet`, `tickers_mentioned: list[str]`, `theme_tags: list[str]`, `relevance_score: float`.
- [ ] A single feed timing out does not abort the other four feeds.
- [ ] If all five feeds fail, `scan_news()` returns `[]` (not raises).
- [ ] Ticker extraction matches uppercase 1–5 character symbols found in headlines against a known ticker set (at minimum `SCAN_UNIVERSE` + top 200 S&P symbols).
- [ ] `relevance_score` is computed as `(theme_keyword_count * 0.6 + ticker_mention_count * 0.4)`, normalised to 0–1.
- [ ] No API keys are required or referenced.

---

### T3-11b · `moat_scoring_service.py` — competitive moat scoring

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-02 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/services/moat_scoring_service.py` (create)

**Description:** Implement `get_moat_score(ticker: str) -> tuple[float, str | None]` which returns `(moat_score, moat_description)`. Looks up the ticker in `HIGH_MOAT_TICKERS` first; falls back to a yfinance `marketCap` + competitor count heuristic. All ten `HIGH_MOAT_TICKERS` entries are seeded here as a module-level constant. This service is called by `idea_generator_service.scan_by_theme()` and `scan_technical_universe()`.

**Acceptance Criteria:**
- [ ] `HIGH_MOAT_TICKERS` dict is a module-level constant with all 10 entries from PRD3.md Section 11: NVDA (0.85), ISRG (0.90), ASML (0.95), ILMN (0.80), MSFT (0.80), TSM (0.85), V (0.80), MA (0.80), LLY (0.75), NVO (0.75).
- [ ] `get_moat_score("NVDA")` returns `(0.85, "Dominant GPU share for AI training")` without calling yfinance.
- [ ] For a ticker not in `HIGH_MOAT_TICKERS`, falls back to a yfinance `.info` heuristic (marketCap-based proxy); returns a score in [0.0, 1.0].
- [ ] yfinance errors are caught; fallback returns `(0.5, None)` — neutral score with no description.
- [ ] `get_moat_score()` is importable from `app.services.moat_scoring_service`.

---

### T3-11c · `financial_quality_service.py` — yfinance financial quality scoring

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-02 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/services/financial_quality_service.py` (create)

**Description:** Implement `get_financial_quality(ticker: str) -> tuple[float, list[str]]` which returns `(financial_quality_score, financial_flags)`. Reads `revenueGrowth`, `grossMargins`, `earningsGrowth`, and `operatingMargins` from yfinance `.info`. Each positive/improving field contributes to the score. If no fields are available, returns `(0.0, ["financials_unavailable"])`.

**Acceptance Criteria:**
- [ ] Returns `(float, list[str])` where score is in [0.0, 1.0].
- [ ] `financial_flags` may contain: `"revenue_growth_positive"`, `"earnings_growth_positive"`, `"margins_improving"`, `"financials_unavailable"`.
- [ ] If all four fields are positive/improving, score is 1.0.
- [ ] If zero fields are available, score is 0.0 and flags is `["financials_unavailable"]`.
- [ ] yfinance errors caught; returns `(0.0, ["financials_unavailable"])`.
- [ ] Importable from `app.services.financial_quality_service`.

---

### T3-11d · `entry_priority_service.py` — 52-week low and weekly support detection

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-02 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/services/entry_priority_service.py` (create)

**Description:** Implement two detection functions: `is_near_52w_low(ticker: str) -> bool` (True when `current_price <= fiftyTwoWeekLow * 1.10`) and `is_at_weekly_support(ticker: str) -> bool` (True when price is within 2x ATR of the most recent weekly swing low, using 1W interval OHLCV over past 52 weekly bars). Also implement `get_entry_priority(ticker: str) -> str` returning `"52W_LOW"`, `"WEEKLY_SUPPORT"`, `"BOTH"`, or `"STANDARD"`.

**Acceptance Criteria:**
- [ ] `is_near_52w_low()` uses `yfinance.info["fiftyTwoWeekLow"]` and `yfinance.info["currentPrice"]`; returns `True` when `current_price <= 52w_low * 1.10`.
- [ ] `is_at_weekly_support()` fetches 1W interval OHLCV (52 bars), detects pivot lows (local minima over ±2 bar window), computes ATR on the 1W timeframe, returns `True` when `abs(current_price - nearest_pivot_low) <= 2 * atr`.
- [ ] `get_entry_priority()` returns `"BOTH"` when both conditions are True; `"52W_LOW"` when only first; `"WEEKLY_SUPPORT"` when only second; `"STANDARD"` when neither.
- [ ] yfinance errors caught in all functions; all return safe defaults (`False` / `"STANDARD"`).
- [ ] Importable from `app.services.entry_priority_service`.

---

### T3-12 · `buy_signal_service.py` — 10-condition gate

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | L |
| **Blocked by** | T3-07, T3-09, T3-11d |
| **Action** | CREATE new file |

**Files:**
- `backend/app/services/buy_signal_service.py` (create)

**Description:** Implement `evaluate_buy_signal(ticker, user_id, db)` which evaluates all 10 conditions from PRD3.md Section 7, persists a `BuyNowSignal` row regardless of outcome (audit trail), and dispatches notification via `notification_service.dispatch_notification()` when all conditions pass and `alert_enabled=True`. Reuses `buy_zone_service.calculate_buy_zone()` and `analog_scoring_service` for backtest data; fetches live quote data via `yfinance`. Uses `entry_priority_service` to compute `ideal_entry_price` fallback.

**The 10 conditions (evaluated in this order, short-circuit on first failure):**
1. `price_inside_backtest_buy_zone`
2. `above_50d_moving_average`
3. `above_200d_moving_average`
4. `rsi_not_overbought` (RSI 30–55)
5. `volume_declining_on_pullback`
6. `near_proven_support_level` (within 1.5x ATR)
7. `trend_regime_not_bearish` (reuse HMM from `conservative.py`)
8. `backtest_confidence_above_threshold` (>= 0.65)
9. `not_near_earnings` (defaults to pass for `UserWatchlist` tickers per OQ-03)
10. `no_duplicate_signal_in_cooldown` (no STRONG_BUY for this user+ticker in last 4 hours)

**Acceptance Criteria:**
- [ ] `evaluate_buy_signal()` returns a persisted `BuyNowSignal` ORM instance.
- [ ] `all_conditions_pass=True` only when all 10 conditions return True.
- [ ] `suppressed_reason` is set to the string key of the first failing condition when any fails.
- [ ] `signal_strength="STRONG_BUY"` when all pass; `"SUPPRESSED"` otherwise.
- [ ] `BuyNowSignal` row is written to DB regardless of pass/fail.
- [ ] `notification_service.dispatch_notification()` is called only when `all_conditions_pass=True` AND the user's `alert_enabled=True` on the `UserWatchlist` row.
- [ ] Notification body matches the template in PRD3.md Section 15 exactly (no prohibited words).
- [ ] `ideal_entry_price` computed as `(buy_zone_low + buy_zone_high) / 2` as baseline; refined by analog scoring if distribution is available.
- [ ] Stale buy zone (> 1 hour old) triggers `calculate_buy_zone()` before evaluation.
- [ ] yfinance calls are wrapped in try/except; a yfinance failure results in `all_conditions_pass=False` with `suppressed_reason="data_fetch_error"`.

---

### T3-13 · Extend `idea_generator_service.py` — `scan_by_theme()` and `scan_technical_universe()`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-08, T3-09, T3-11b, T3-11c, T3-11d |
| **Action** | EXTEND existing file |

**Files:**
- `backend/app/services/idea_generator_service.py` (extend)

**Description:** Add three new items to the existing service: (1) `SCAN_UNIVERSE` constant (37 tickers from PRD3.md Section 11 — no crypto) and `UNIVERSE_CONTEXT_ONLY` (ETFs excluded from idea output); (2) `scan_by_theme(db: AsyncSession)` async method that loads tickers from `StockThemeScore` and applies all four quality filters (megatrend, moat, financial, entry priority); (3) `scan_technical_universe()` async method that checks 4 technical conditions per ticker and returns candidates where 3+ pass. Adds `compute_idea_score(candidate)` implementing the full 6-component PRD3.md Section 8 formula. The existing `generate_ideas()` function and `STOCK_UNIVERSE` constant are NOT modified (backward compat with V2 `GET /api/scanner/ideas`).

**Idea score formula (canonical — PRD3.md Section 8):**
```python
idea_score = (confidence_score         * 0.25)
           + (megatrend_fit_score      * 0.20)   # 1.0=AI/Robotics/Longevity, 0.5=other, 0.0=none
           + (moat_score              * 0.15)
           + (financial_quality_score * 0.15)
           + (technical_setup_score   * 0.15)
           + (news_relevance_score    * 0.10)
if near_52w_low:      idea_score += 0.15
if at_weekly_support: idea_score += 0.10
idea_score = min(idea_score, 1.0)
```

**Acceptance Criteria:**
- [ ] `SCAN_UNIVERSE` is a module-level constant with 35+ tickers; no crypto symbols; ETFs listed separately in `UNIVERSE_CONTEXT_ONLY`.
- [ ] `scan_by_theme(db)` returns `list[IdeaCandidate]` where `IdeaCandidate` is a new dataclass with: `ticker`, `source`, `reason_summary`, `confidence_score`, `theme_score`, `technical_setup_score`, `news_relevance_score`, `news_headline`, `news_url`, `current_price`, `buy_zone_low`, `buy_zone_high`, `theme_tags`, `megatrend_tags`, `moat_score`, `moat_description`, `financial_quality_score`, `financial_flags`, `near_52w_low`, `at_weekly_support`, `entry_priority`.
- [ ] `scan_by_theme()` filters to `theme_score_total >= 0.60` and `entry_quality_score >= 0.55` and `confidence_score >= 0.60`.
- [ ] `scan_by_theme()` calls `moat_scoring_service.get_moat_score()`, `financial_quality_service.get_financial_quality()`, and `entry_priority_service.get_entry_priority()` for each candidate.
- [ ] `scan_technical_universe()` checks: above 50d MA, above 200d MA, RSI 35–55, volume declining on pullback; returns tickers where 3 or 4 pass; excludes `UNIVERSE_CONTEXT_ONLY` tickers from output.
- [ ] `technical_setup_score` is `conditions_passed / 4` (0–1).
- [ ] `compute_idea_score(candidate)` implements the full 6-component formula with entry priority boosts, capped at 1.0.
- [ ] `megatrend_fit_score` is 1.0 for AI/Robotics/Longevity tags, 0.5 for other SUPPORTED_THEMES, 0.0 for no theme.
- [ ] Neither method modifies `_cache`, `_cache_expires_at`, or `generate_ideas()`.

---

### T3-14 · `live_scanner_service.py` — batch watchlist evaluator

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-12 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/services/live_scanner_service.py` (create)

**Description:** Implement `run_live_scan(db: AsyncSession)` which queries all `(user_id, ticker)` pairs from `user_watchlist` where `alert_enabled=True`, calls `buy_signal_service.evaluate_buy_signal()` for each pair, and returns a summary. Handles per-user isolation: one user's exception does not abort other users' scans.

**Acceptance Criteria:**
- [ ] `run_live_scan(db)` is an `async` function.
- [ ] Queries only `UserWatchlist` rows where `alert_enabled=True`.
- [ ] Per-user error is caught and logged; scan continues to next user.
- [ ] Returns `LiveScanSummary` dataclass: `tickers_scanned: int`, `strong_buy_signals: int`, `errors: int`.
- [ ] Does NOT call `is_market_hours()` — that check is the scheduler task's responsibility.
- [ ] Does NOT source tickers from `WatchlistIdea`/`WatchlistIdeaTicker` — that is the existing `scan_watchlist.py` job's domain.

---

### T3-15 · Scheduler task: `run_live_scanner.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-01, T3-14 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/scheduler/tasks/run_live_scanner.py` (create)

**Description:** Implement the `run_live_scanner()` async job function. Checks `is_market_hours()` first; returns immediately if outside hours. Opens an `AsyncSessionLocal()` context, calls `live_scanner_service.run_live_scan(db)`, logs the summary.

**Acceptance Criteria:**
- [ ] `run_live_scanner()` is importable and callable by APScheduler.
- [ ] Returns immediately (no DB query) when `is_market_hours()` is False.
- [ ] Logs `"run_live_scanner: outside market hours — skipping"` at DEBUG when suppressed.
- [ ] Logs `"run_live_scanner complete: tickers=%d signals=%d errors=%d"` at INFO on completion.
- [ ] Exception in `run_live_scan` is caught and logged; job does not crash the scheduler.

---

### T3-16 · Scheduler task: `run_idea_generator.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-01, T3-08, T3-11, T3-13 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/scheduler/tasks/run_idea_generator.py` (create)

**Description:** Implement `run_idea_generator()` async job. Checks `is_market_hours()`. Runs all three scanners (`scan_news()`, `scan_by_theme()`, `scan_technical_universe()`), deduplicates by ticker (same ticker from multiple sources → merged record with combined `reason_summary` and highest `idea_score`), computes `idea_score` for all candidates, then in a DB transaction: deletes non-`added_to_watchlist` rows and expired rows, inserts top 50 new `GeneratedIdea` rows with `expires_at = now() + 24h`.

**Acceptance Criteria:**
- [ ] Returns immediately when `is_market_hours()` is False.
- [ ] Deduplication: if ticker appears in 2+ sources, merges into one row with `source="merged"`.
- [ ] `reason_summary` for merged records concatenates unique sentences from each source.
- [ ] Rows with `added_to_watchlist=True` from previous batches are never deleted.
- [ ] Rows with `expires_at < now()` are deleted regardless of `added_to_watchlist`.
- [ ] Non-actioned rows (`added_to_watchlist=False`) from the previous batch are replaced.
- [ ] Inserts at most 50 rows per run.
- [ ] `expires_at = generated_at + 24 hours` set at insert time.
- [ ] If `scan_news()` fails entirely, job continues with theme + technical sources.
- [ ] Logs: count of ideas from each source, total after dedup, total inserted.

---

### T3-17 · Register V3 jobs and pruning in `scheduler/jobs.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-15, T3-16 |
| **Action** | EXTEND existing file |

**Files:**
- `backend/app/scheduler/jobs.py` (extend)
- `backend/app/core/config.py` (extend — add `live_scanner_interval_minutes`, `idea_generator_interval_minutes`, `signal_prune_days`)

**Description:** Add three new `scheduler.add_job()` calls: (1) `run_live_scanner` every 5 minutes Mon–Fri, (2) `run_idea_generator` every 60 minutes Mon–Fri, (3) `prune_old_signals` daily. All use `coalesce=True, max_instances=1`. Interval values read from `settings`.

**Acceptance Criteria:**
- [ ] `run_live_scanner` registered with `"cron"`, `day_of_week="mon-fri"`, `hour="9-15"`, `minute="*/5"`, `id="live_scanner"`, `replace_existing=True`.
- [ ] `run_idea_generator` registered with `"cron"`, `day_of_week="mon-fri"`, `hour="9-15"`, `minute="0"`, `id="idea_generator"`, `replace_existing=True`.
- [ ] `prune_old_signals` registered with `"interval"`, `hours=24`, `id="prune_old_signals"`.
- [ ] All existing V2 jobs (`refresh_buy_zones`, `refresh_theme_scores`, `evaluate_alerts`, `evaluate_auto_buy`, `scan_all_watchlists`) are preserved unchanged.
- [ ] Log line in `register_jobs()` updated to include new jobs.

---

### T3-18 · API: `api/watchlist.py` — POST and DELETE endpoints

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-06, T3-09 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/api/watchlist.py` (create)
- `backend/app/main.py` (EXTEND — register new router)

**Description:** Implement two endpoints: `POST /api/watchlist` (add ticker, fire background `calculate_buy_zone`, return 201) and `DELETE /api/watchlist/{ticker}` (remove ticker, return 204). Both require `get_current_user`. Register router in `main.py`.

**Acceptance Criteria:**
- [ ] `POST /api/watchlist` returns 201 `WatchlistEntryOut` on success.
- [ ] Returns 409 with `{"detail": "Ticker already in watchlist."}` if `UNIQUE` constraint fires.
- [ ] Returns 422 with Pydantic validation error if ticker format is invalid.
- [ ] Fires `BackgroundTasks.add_task(calculate_buy_zone, ticker)` after DB commit.
- [ ] `DELETE /api/watchlist/{ticker}` returns 204 on success.
- [ ] Returns 404 if ticker not found in user's watchlist.
- [ ] Both endpoints are scoped to `current_user.id` — no cross-user access.
- [ ] Router prefix is `/watchlist` and registered in `main.py` under `/api`.

---

### T3-18b · API: `PATCH /api/watchlist/{ticker}/alert` — alert toggle endpoint

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-18 |
| **Action** | EXTEND existing file |

**Files:**
- `backend/app/api/watchlist.py` (extend)

**Description:** Add `PATCH /api/watchlist/{ticker}/alert` endpoint to toggle `alert_enabled` on a `UserWatchlist` row. This endpoint is required by `WatchlistTable.tsx` (T3-25) which exposes an alert toggle per row. The toggle persists to the DB and affects whether `buy_signal_service` dispatches notifications for that ticker.

**Acceptance Criteria:**
- [ ] `PATCH /api/watchlist/{ticker}/alert` accepts `{ "alert_enabled": bool }` in the request body.
- [ ] Returns 200 `WatchlistEntryOut` with the updated `alert_enabled` value.
- [ ] Returns 404 if ticker not found in the user's watchlist.
- [ ] Scoped to `current_user.id`; no cross-user access.
- [ ] Setting `alert_enabled=False` is reflected immediately — the next `run_live_scanner` run will skip this row.

---

### T3-19 · API: Extend `GET /api/opportunities` with signal status fields

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-07, T3-09 |
| **Action** | EXTEND existing file |

**Files:**
- `backend/app/api/opportunities.py` (extend)
- `backend/app/schemas/auto_buy.py` (extend `OpportunityOut`)

**Description:** Extend `GET /api/opportunities` to join the latest `BuyNowSignal` row for each ticker and include all signal-status fields in the response. Add `signal_status` query parameter filter. The existing `OpportunityOut` schema is extended (not replaced) with the new fields from PRD3.md Section 12.1.

**New response fields per ticker:**
- `ideal_entry_price`, `backtest_confidence`, `backtest_win_rate_90d`
- `signal_status` (`"STRONG_BUY"` / `"WATCHING"` / `"NOT_READY"` / `"PENDING"`)
- `all_conditions_pass`, `condition_details: list[ConditionDetail]`
- `suppressed_reason`, `invalidation_price`, `expected_drawdown`
- `alert_enabled` (from `UserWatchlist.alert_enabled`)

**Acceptance Criteria:**
- [ ] Response includes `ideal_entry_price` when a `BuyNowSignal` row exists; `null` when pending.
- [ ] `signal_status="PENDING"` when no `BuyNowSignal` row exists yet for the ticker.
- [ ] `condition_details` is a list of 10 `ConditionDetail` objects (key + pass/fail) from the latest signal.
- [ ] `?signal_status=strong_buy` filter returns only rows where `all_conditions_pass=True`.
- [ ] Default sort: `STRONG_BUY` rows first, then by `backtest_confidence` descending.
- [ ] Existing fields (`buy_zone_low`, `buy_zone_high`, `confidence_score`, etc.) are unchanged.
- [ ] All queries scoped to `current_user.id`.

---

### T3-20 · API: Extend `api/scanner.py` with `/status` and `/run-now`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-09, T3-14 |
| **Action** | EXTEND existing file |

**Files:**
- `backend/app/api/scanner.py` (extend)

**Description:** Add two new endpoints to the existing scanner router: `GET /api/scanner/status` returns scan metadata (last scan time, next scheduled time, queue depth, market hours flag); `POST /api/scanner/run-now` triggers an immediate `live_scanner_service.run_live_scan()` and returns `RunNowOut`.

**Acceptance Criteria:**
- [ ] `GET /api/scanner/status` returns `ScannerStatusOut` with `last_scan_at`, `next_scan_at`, `tickers_in_queue`, `market_hours_active`.
- [ ] `tickers_in_queue` is the count of `UserWatchlist` rows for the current user where `alert_enabled=True`.
- [ ] `POST /api/scanner/run-now` calls `live_scanner_service.run_live_scan(db)` synchronously and returns `RunNowOut`.
- [ ] Both endpoints require `Depends(get_current_user)`.
- [ ] Existing endpoints (`/run`, `/estimate-buy-prices`, `/ideas`, `/ideas/{ticker}/save`) are unchanged.

---

### T3-21 · API: Add generated idea endpoints to `api/ideas.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-08, T3-10 |
| **Action** | EXTEND existing file |

**Files:**
- `backend/app/api/ideas.py` (extend)

**Description:** Add three new sub-routes to the existing ideas router: `GET /api/ideas/generated`, `POST /api/ideas/generated/{id}/add-to-watchlist`, and `GET /api/ideas/generated/last-scan`. The add-to-watchlist endpoint creates a `UserWatchlist` entry AND a `PriceAlertRule` with `alert_type="entered_buy_zone"` and sets `generated_idea.added_to_watchlist=True`.

**Acceptance Criteria:**
- [ ] `GET /api/ideas/generated` returns paginated `list[GeneratedIdeaDBOut]` sorted by `idea_score` desc, with `limit` (1–50, default 50), `source`, and `theme` query params.
- [ ] `?source=news` filters to rows where `source IN ("news", "merged")`.
- [ ] `?theme=ai` filters to rows where `"ai"` is in `theme_tags`.
- [ ] `POST /api/ideas/generated/{id}/add-to-watchlist` returns `AddToWatchlistOut`.
- [ ] Returns `watchlist_entry_created=false` (not 409) if ticker already in watchlist (idempotent).
- [ ] Creates `PriceAlertRule(alert_type="entered_buy_zone", enabled=True)`.
- [ ] Sets `generated_idea.added_to_watchlist=True` in the same transaction.
- [ ] `GET /api/ideas/generated/last-scan` returns `LastScanOut` with `MAX(generated_at)` from the table.
- [ ] All three endpoints require `Depends(get_current_user)`.
- [ ] Existing CRUD endpoints (`GET /`, `POST /`, `PATCH /{id}`, `DELETE /{id}`) are unchanged.

---

### T3-22 · Frontend: extend TypeScript types for V3 API shapes

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T3-19, T3-20, T3-21 |
| **Action** | EXTEND existing file |

**Files:**
- `frontend/types/index.ts` (extend)
- `frontend/lib/api.ts` (extend — add `watchlistApi`, extend `opportunitiesApi`, extend `scannerApi`, extend `ideasApi`)

**Description:** Add TypeScript interfaces and API client functions for all V3 endpoints. Extend `OpportunityRow` with signal-status fields. Add `GeneratedIdeaRow`, `WatchlistEntry`, `BuyNowSignalOut`, `ConditionDetail`, `ScannerStatus`, `RunNowResult`, `AddToWatchlistResult`, `LastScanResult` types.

**Acceptance Criteria:**
- [ ] `OpportunityRow` extended with: `ideal_entry_price`, `backtest_confidence`, `backtest_win_rate_90d`, `signal_status`, `all_conditions_pass`, `condition_details`, `suppressed_reason`, `invalidation_price`, `expected_drawdown`, `alert_enabled`.
- [ ] `GeneratedIdeaRow` type matches `GeneratedIdeaDBOut` schema including `added_to_watchlist`, `expires_at`, `theme_tags`, `megatrend_tags`, `moat_score`, `moat_description`, `financial_quality_score`, `financial_flags`, `near_52w_low`, `at_weekly_support`, `entry_priority`.
- [ ] `watchlistApi.add(ticker)`, `watchlistApi.remove(ticker)`, `watchlistApi.toggleAlert(ticker, enabled)` functions added to `api.ts`.
- [ ] `ideasApi.listGenerated(params)`, `ideasApi.addToWatchlist(id)`, `ideasApi.lastScan()` added.
- [ ] `scannerApi.status()`, `scannerApi.runNow()` added.
- [ ] All new functions are typed — no `any`.

---

### T3-23 · Frontend component: `BuyNowBadge.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T3-22 |
| **Action** | CREATE new file |

**Files:**
- `frontend/components/opportunities/BuyNowBadge.tsx` (create)

**Description:** Reusable badge component with four states: STRONG BUY (green, pulsing dot), Watching (gray), Checking (amber + spinner), Not Ready (gray). Hover tooltip renders all 10 conditions from `condition_details` with green checkmark or red X per condition.

**Acceptance Criteria:**
- [ ] Renders correct visual state based on `signal_status` prop.
- [ ] `"STRONG_BUY"` state has a pulsing animated green dot (CSS `animate-pulse`).
- [ ] `"PENDING"` / `null` state shows amber background with a spinner icon.
- [ ] Tooltip renders all 10 `ConditionDetail` items with their `key` label and pass/fail icon.
- [ ] Tooltip is accessible via keyboard focus (not mouse-only).
- [ ] No prohibited wording in any rendered text or tooltip label.
- [ ] Component is exported and importable from `@/components/opportunities/BuyNowBadge`.

---

### T3-24 · Frontend component: `EstimatedEntryPanel.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T3-22 |
| **Action** | CREATE new file |

**Files:**
- `frontend/components/opportunities/EstimatedEntryPanel.tsx` (create)

**Description:** Expanded-row detail panel showing the entry zone, ideal price, setup count, 90-day win rate, worst drawdown, and invalidation level. All monetary values use `Intl.NumberFormat` (USD, 2 decimal places). All copy must comply with approved language constraints.

**Acceptance Criteria:**
- [ ] Renders `"Estimated entry zone (historically favorable): $[low] – $[high]"`.
- [ ] Renders `"Ideal entry based on backtest: $[ideal]"`.
- [ ] Renders disclaimer: `"This is not a guaranteed price."` (literal text required).
- [ ] Renders `"90-day positive outcome rate: [win_rate]% | Worst drawdown: -[drawdown]%"`.
- [ ] Renders `"Invalidation level: $[invalidation]"`.
- [ ] Shows `"Calculating…"` placeholder when `ideal_entry_price` is null (pending state).
- [ ] All dollar values formatted via `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`.
- [ ] No prohibited words ("guaranteed profit", "safe", "certain to go up", "can't lose").

---

### T3-25 · Frontend component: `WatchlistTable.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | L |
| **Blocked by** | T3-23, T3-24 |
| **Action** | CREATE new file |

**Files:**
- `frontend/components/opportunities/WatchlistTable.tsx` (create)

**Description:** Full watchlist table with all 10 columns from PRD3.md Section 4.3. Expandable rows reveal `EstimatedEntryPanel`. Each row has inline trash-icon Remove button and alert toggle. Ticker-add input at top (text + Add button). Default sort: STRONG BUY first, then confidence desc. Filter controls: "Ready only" toggle and theme chips. Alert toggle calls `watchlistApi.toggleAlert()` (T3-18b backend).

**Acceptance Criteria:**
- [ ] Renders all 10 columns: Ticker, Current Price, Buy Zone, Ideal Entry, Distance to Zone, Confidence, 90d Win Rate, Signal Status (BuyNowBadge), Alert toggle, Last Updated.
- [ ] Distance to Zone is green when price is below zone (entry opportunity), red when above.
- [ ] Clicking a row toggles an inline expanded panel showing `EstimatedEntryPanel`.
- [ ] "Add" button POSTs to `watchlistApi.add(ticker)` and shows the new row in "Checking…" state immediately (optimistic UI).
- [ ] Inline error shown on 409 (already in watchlist) or 422 (invalid ticker).
- [ ] Trash icon calls `watchlistApi.remove(ticker)`; row removed from UI on success.
- [ ] Alert toggle calls `watchlistApi.toggleAlert(ticker, enabled)` and persists the updated value.
- [ ] "Ready only" filter hides rows where `signal_status` is not `"STRONG_BUY"`.
- [ ] Theme filter chips filter rows by `theme_tags` intersection.
- [ ] Loading skeleton shown per row while buy zone is calculating (`signal_status="PENDING"`).

---

### T3-26 · Frontend component: `AddToWatchlistButton.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | S |
| **Blocked by** | T3-22 |
| **Action** | CREATE new file |

**Files:**
- `frontend/components/ideas/AddToWatchlistButton.tsx` (create)

**Description:** Button with three states: default (`"+ Add to Watchlist"`), loading (spinner, disabled), and added (`"Added ✓"`, green, permanently disabled). On success, fires a toast notification.

**Acceptance Criteria:**
- [ ] Default state is clickable; loading state is disabled with spinner icon.
- [ ] Added state is green, disabled, and shows a checkmark.
- [ ] State persists within the session (does not revert on re-render if `added_to_watchlist=true`).
- [ ] On success: calls `ideasApi.addToWatchlist(id)`, then fires `toast("[TICKER] added to watchlist. Alert created for buy zone entry.")`.
- [ ] On API error: reverts to default state and shows `toast.error(message)`.
- [ ] `added_to_watchlist` prop (from initial API data) initialises button in "Added ✓" state.

---

### T3-27 · Frontend component: `GeneratedIdeaCard.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T3-26 |
| **Action** | CREATE new file |

**Files:**
- `frontend/components/ideas/GeneratedIdeaCard.tsx` (create)

**Description:** Idea card using `shadcn/ui Card`. Renders all fields from PRD3.md Section 5.3: ticker + company name, theme tag badges (with megatrend tags highlighted), entry priority amber badges (`near_52w_low`, `at_weekly_support`), reason summary with optional news headline link, price + entry zone data, competitive moat block (moat score badge green >= 0.70 / red < 0.30 + moat description), financial quality block (shows "Financials unavailable" when score data missing), confidence + win rate badges, `AddToWatchlistButton`, "View Chart" link, and "Generated X minutes ago" footer badge.

**Acceptance Criteria:**
- [ ] Renders ticker and `company_name` in the card header.
- [ ] Theme tag badges rendered from `theme_tags` array using `Badge` component; megatrend tags visually distinguished.
- [ ] Entry priority amber badge "Near 52-week low — historically attractive entry area" shown when `near_52w_low=true`.
- [ ] Entry priority amber badge "At weekly support — historically favorable entry zone" shown when `at_weekly_support=true`.
- [ ] Both badges shown simultaneously when `entry_priority="BOTH"`.
- [ ] `reason_summary` displayed; if `news_headline` and `news_url` are present, news headline is an `<a>` link.
- [ ] Entry zone shown as `"$[low] – $[high]"` or `"Calculating…"` when null.
- [ ] Moat badge: green "Strong moat" when `moat_score >= 0.70`; red "Low competitive moat — higher risk" when `moat_score < 0.30`; `moat_description` shown below badge.
- [ ] Financial quality block shows score label + `financial_flags` summary; shows "Financials unavailable" when `financial_flags` contains `"financials_unavailable"`.
- [ ] Confidence badge: green when >= 0.70, amber when 0.55–0.69, gray otherwise.
- [ ] "Generated X minutes ago" computed from `generated_at` using `date-fns` or equivalent.
- [ ] "View Chart" navigates to `/dashboard?ticker=[ticker]`.
- [ ] `AddToWatchlistButton` receives `idea.id`, `idea.ticker`, and `added_to_watchlist` prop.
- [ ] No prohibited words in any rendered text.

---

### T3-28 · Frontend component: `IdeaFeed.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T3-27 |
| **Action** | CREATE new file |

**Files:**
- `frontend/components/ideas/IdeaFeed.tsx` (create)

**Description:** Scrollable feed container with filter bar (All / News / Theme / Technical tabs), theme filter chips (AI, Energy, Defense, Space, Semiconductors), "Last updated X minutes ago" banner from `ideasApi.lastScan()`, manual refresh button, and a sorted list of `GeneratedIdeaCard` components.

**Acceptance Criteria:**
- [ ] Filter tabs map to `?source=` API param: "All" omits the param, others pass the lowercase value.
- [ ] Theme chips filter by `?theme=` param; multiple chips can be active simultaneously (OR logic).
- [ ] "Last updated" banner shows relative time from `LastScanResult.last_scan_at`; shows `"Not yet scanned"` when null.
- [ ] Refresh button calls `POST /api/scanner/run-now` equivalent, shows spinner during fetch, re-fetches `ideasApi.listGenerated()` on completion.
- [ ] Cards sorted by `idea_score` descending in the rendered list.
- [ ] Empty state: shows `"No ideas generated yet. The next scan runs during market hours."` when list is empty.
- [ ] Uses TanStack Query (`useQuery`) for data fetching with a 5-minute `staleTime`.

---

### T3-29 · Frontend: Integrate V3 components into `opportunities/page.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T3-25 |
| **Action** | EXTEND existing file |

**Files:**
- `frontend/app/opportunities/page.tsx` (extend)

**Description:** Replace the existing watchlist sidebar panel in `opportunities/page.tsx` with `WatchlistTable` as the primary page content. The existing opportunities table (showing `OpportunityOut` data from the API) is integrated as the backing data source for `WatchlistTable`. TanStack Query polls `/api/opportunities` every 5 minutes to refresh signal status.

**Acceptance Criteria:**
- [ ] `WatchlistTable` is the dominant UI element on the page.
- [ ] Page polls `GET /api/opportunities` every 5 minutes (`refetchInterval: 5 * 60 * 1000`).
- [ ] `POST /api/scanner/run-now` is wired to the manual scan trigger (if exposed in `WatchlistTable`).
- [ ] Auth guard preserved: unauthenticated users are redirected to `/login`.
- [ ] Existing `BuyZoneAnalysisPanel` and scanner result display are either preserved as a secondary panel or gracefully removed if superseded.
- [ ] Page title `<h1 data-testid="page-title">` reads `"Opportunities"`.
- [ ] No `console.error` or TypeScript errors on load.

---

### T3-30 · Frontend: Integrate V3 components into `ideas/page.tsx`

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T3-28 |
| **Action** | EXTEND existing file |

**Files:**
- `frontend/app/ideas/page.tsx` (extend)

**Description:** Add the `IdeaFeed` component alongside the existing manual ideas section. The "Suggested" tab now renders `IdeaFeed` (auto-generated ideas from the V3 DB feed) and the "My Ideas" tab renders the existing `IdeaList`.

**Acceptance Criteria:**
- [ ] `IdeaFeed` renders in the "Suggested" tab; existing `IdeaList` in the "My Ideas" tab.
- [ ] Tabs preserved: `activeTab` state drives which section is shown.
- [ ] `IdeaFeed` uses `GET /api/ideas/generated` (not the old `GET /api/scanner/ideas` V2 endpoint).
- [ ] Auth guard preserved.
- [ ] `"New Idea"` button and `IdeaForm` dialog remain functional and unchanged.
- [ ] No TypeScript errors or `console.error` on load.

---

### T3-31 · Unit tests: `test_buy_signal_service.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-12 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_buy_signal_service.py` (create)

**Description:** Unit tests for `buy_signal_service.evaluate_buy_signal()`. Mock `yfinance`, `buy_zone_service.calculate_buy_zone()`, `notification_service.dispatch_notification()`, and the DB session.

**Acceptance Criteria:**
- [ ] Test: all 10 conditions pass → `all_conditions_pass=True`, `signal_strength="STRONG_BUY"`.
- [ ] Test: exactly one failing condition per test case (10 tests total, one per condition) → `suppressed_reason` matches the failing condition key.
- [ ] Test: 4-hour cooldown — when a `STRONG_BUY` row already exists for `(user_id, ticker)` within 4 hours → `all_conditions_pass=False`, `suppressed_reason="no_duplicate_signal_in_cooldown"`.
- [ ] Test: notification dispatched exactly once when all pass AND `alert_enabled=True`.
- [ ] Test: notification NOT dispatched when `alert_enabled=False`.
- [ ] Test: yfinance fetch failure → `suppressed_reason="data_fetch_error"`.
- [ ] All tests use mocks — no real yfinance calls or DB writes.

---

### T3-32 · Unit tests: `test_live_scanner.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-01, T3-15 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_live_scanner.py` (create)

**Description:** Unit tests for `is_market_hours()` and `run_live_scanner()`.

**Acceptance Criteria:**
- [ ] Test: `is_market_hours()` returns `False` for Saturday 10:00 AM ET.
- [ ] Test: `is_market_hours()` returns `False` for Sunday 12:00 PM ET.
- [ ] Test: `is_market_hours()` returns `False` for Monday 9:29 AM ET.
- [ ] Test: `is_market_hours()` returns `True` for Monday 9:30 AM ET.
- [ ] Test: `is_market_hours()` returns `True` for Friday 3:59 PM ET.
- [ ] Test: `is_market_hours()` returns `False` for Friday 4:00 PM ET.
- [ ] Test: DST boundary — `is_market_hours()` returns correct result on second Sunday of March (spring-forward) at 9:30 AM ET.
- [ ] Test: `run_live_scanner()` returns immediately without DB call when `is_market_hours()` is False.

---

### T3-33 · Unit tests: `test_news_scanner.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-11 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_news_scanner.py` (create)
- `backend/tests/fixtures/sample_rss.xml` (create — minimal valid RSS fixture)

**Description:** Unit tests for `news_scanner_service.scan_news()`. Use `httpx` mock (via `respx` or `unittest.mock`) to simulate RSS feed responses.

**Acceptance Criteria:**
- [ ] Test: valid RSS fixture XML → `NewsItem` list returned with populated `headline`, `url`, `published_at`.
- [ ] Test: ticker extraction — headline `"NVIDIA wins $2B contract"` → `tickers_mentioned` contains `"NVDA"`.
- [ ] Test: theme extraction — headline containing `"semiconductor"` → `theme_tags` contains `"semiconductors"`.
- [ ] Test: single feed returns HTTP 500 → that feed skipped, other feeds still processed, no exception raised.
- [ ] Test: all five feeds time out → `scan_news()` returns `[]` without raising.
- [ ] Test: `relevance_score` is between 0 and 1 for a valid news item.

---

### T3-34 · Unit tests: `test_idea_generator.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-13, T3-16 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_idea_generator.py` (create)

**Description:** Unit tests for `scan_by_theme()`, `scan_technical_universe()`, `compute_idea_score()`, deduplication logic in `run_idea_generator`, and idea expiry handling.

**Acceptance Criteria:**
- [ ] Test: same ticker from two sources → merged to one `IdeaCandidate` with `source="merged"`, combined `reason_summary`, highest `idea_score`.
- [ ] Test: `compute_idea_score()` formula — given fixed inputs for all 6 components + both entry boosts, output matches expected float (capped at 1.0).
- [ ] Test: `scan_technical_universe()` — ticker passing 3 of 4 checks is included; ticker passing 2 is excluded.
- [ ] Test: expiry logic — rows with `expires_at < now()` included in the delete set; rows with `added_to_watchlist=True` excluded from the delete set.
- [ ] Test: batch replace — after a job run, non-actioned previous rows are deleted and new rows inserted.
- [ ] Test: ETFs in `UNIVERSE_CONTEXT_ONLY` not present in `scan_technical_universe()` output.
- [ ] All tests mock yfinance and DB.

---

### T3-35 · Unit tests: `test_technical_scanner.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-13 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_technical_scanner.py` (create)

**Description:** Focused unit tests for the four technical condition checks within `scan_technical_universe()`: uptrend filter, RSI range, support proximity, and volume decline.

**Acceptance Criteria:**
- [ ] Test: ticker above 50d MA and 200d MA → uptrend check passes.
- [ ] Test: ticker below 200d MA → uptrend check fails.
- [ ] Test: RSI = 40 → `rsi_not_overbought` passes.
- [ ] Test: RSI = 60 → `rsi_not_overbought` fails (above 55 threshold).
- [ ] Test: RSI = 28 → `rsi_not_overbought` fails (below 35 threshold).
- [ ] Test: price within 1.5x ATR of support → `near_proven_support_level` passes.
- [ ] Test: volume on last bar lower than 20-bar average → `volume_declining_on_pullback` passes.
- [ ] All tests use synthetic OHLCV DataFrames; no yfinance calls.

---

### T3-35b · Unit tests: `test_megatrend_filter.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-13 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_megatrend_filter.py` (create)

**Description:** Unit tests for megatrend tag assignment and `megatrend_fit_score` computation within `compute_idea_score()`. Verifies the three scoring tiers (1.0 / 0.5 / 0.0) and that non-megatrend stocks are deprioritized but not hard-blocked.

**Acceptance Criteria:**
- [ ] Test: ticker with `megatrend_tags=["ai"]` → `megatrend_fit_score = 1.0`.
- [ ] Test: ticker with `megatrend_tags=["robotics"]` → `megatrend_fit_score = 1.0`.
- [ ] Test: ticker with `megatrend_tags=["longevity"]` → `megatrend_fit_score = 1.0`.
- [ ] Test: ticker with `theme_tags=["defense"]` but `megatrend_tags=[]` → `megatrend_fit_score = 0.5`.
- [ ] Test: ticker with no theme tags → `megatrend_fit_score = 0.0`.
- [ ] Test: non-megatrend ticker appears in `scan_technical_universe()` output (not hard-blocked); its `idea_score` is lower than an equivalent megatrend ticker.

---

### T3-35c · Unit tests: `test_moat_scoring.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-11b |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_moat_scoring.py` (create)

**Description:** Unit tests for `moat_scoring_service.get_moat_score()`. Verifies seed lookup, yfinance fallback, and graceful error handling.

**Acceptance Criteria:**
- [ ] Test: `get_moat_score("NVDA")` returns `(0.85, ...)` without calling yfinance.
- [ ] Test: `get_moat_score("ASML")` returns `(0.95, ...)` without calling yfinance.
- [ ] Test: `get_moat_score("ISRG")` returns `(0.90, ...)` without calling yfinance.
- [ ] Test: ticker not in `HIGH_MOAT_TICKERS` → yfinance fallback is called; returns a score in [0.0, 1.0].
- [ ] Test: yfinance throws an exception for an unknown ticker → returns `(0.5, None)` without raising.
- [ ] All tests mock yfinance; no real HTTP calls.

---

### T3-35d · Unit tests: `test_financial_quality.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-11c |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_financial_quality.py` (create)

**Description:** Unit tests for `financial_quality_service.get_financial_quality()`. Verifies field parsing, missing data handling, and score range.

**Acceptance Criteria:**
- [ ] Test: all four yfinance fields positive → score is 1.0; `financial_flags` contains all positive indicators.
- [ ] Test: two out of four fields positive → score is 0.5.
- [ ] Test: all four fields None/missing → score is 0.0; `financial_flags = ["financials_unavailable"]`.
- [ ] Test: yfinance throws an exception → returns `(0.0, ["financials_unavailable"])` without raising.
- [ ] Test: score is always in [0.0, 1.0] across multiple input configurations.
- [ ] All tests mock yfinance; no real HTTP calls.

---

### T3-35e · Unit tests: `test_entry_priority.py`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-11d |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/test_entry_priority.py` (create)

**Description:** Unit tests for `entry_priority_service`: 52-week low detection, weekly support detection, and additive boost logic.

**Acceptance Criteria:**
- [ ] Test: `current_price = 52w_low * 1.05` → `is_near_52w_low()` returns `True`.
- [ ] Test: `current_price = 52w_low * 1.15` → `is_near_52w_low()` returns `False`.
- [ ] Test: price within 2x ATR of most recent 1W pivot low → `is_at_weekly_support()` returns `True`.
- [ ] Test: price more than 2x ATR above nearest pivot → `is_at_weekly_support()` returns `False`.
- [ ] Test: both conditions True → `get_entry_priority()` returns `"BOTH"`.
- [ ] Test: only 52w-low True → `get_entry_priority()` returns `"52W_LOW"`.
- [ ] Test: only weekly support True → `get_entry_priority()` returns `"WEEKLY_SUPPORT"`.
- [ ] Test: neither True → `get_entry_priority()` returns `"STANDARD"`.
- [ ] Test: `idea_score` boost: both True → additive +0.25, capped at 1.0 in `compute_idea_score()`.
- [ ] All tests use synthetic yfinance mocks and synthetic OHLCV DataFrames.

---

### T3-36 · Integration test: watchlist → buy zone → signal → notification

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-18, T3-19, T3-31 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/integration/test_watchlist_signal_flow.py` (create)

**Description:** Integration test covering the full flow: add ticker to watchlist via API → buy zone background task runs → `evaluate_buy_signal()` called → when all conditions pass, notification is dispatched. Uses an in-memory SQLite test DB (or test Postgres via `asyncpg`) and mocks only the external services (yfinance, notification channel).

**Acceptance Criteria:**
- [ ] `POST /api/watchlist` creates a `UserWatchlist` row.
- [ ] Buy zone background task is awaited; a `StockBuyZoneSnapshot` row exists after.
- [ ] `evaluate_buy_signal()` returns a `BuyNowSignal` row with `all_conditions_pass=True` given mocked passing data.
- [ ] `dispatch_notification` mock is called exactly once with the correct subject template.
- [ ] Second call within 4 hours → `all_conditions_pass=False`, `suppressed_reason="no_duplicate_signal_in_cooldown"`, notification not called again.

---

### T3-37 · Integration test: idea add-to-watchlist flow

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | M |
| **Blocked by** | T3-21, T3-34 |
| **Action** | CREATE new file |

**Files:**
- `backend/tests/integration/test_idea_add_to_watchlist_flow.py` (create)

**Description:** Integration test for the idea add-to-watchlist flow: seed a `GeneratedIdea` row → `POST /api/ideas/generated/{id}/add-to-watchlist` → assert `UserWatchlist` entry created + `PriceAlertRule` created + `added_to_watchlist=True`. Also tests the news-to-idea pipeline: mock RSS response → `scan_news()` → `GeneratedIdea` row with `source="news"` and populated `news_headline`.

**Acceptance Criteria:**
- [ ] `POST /api/ideas/generated/{id}/add-to-watchlist` creates `UserWatchlist` row with correct `user_id` and `ticker`.
- [ ] `PriceAlertRule` is created with `alert_type="entered_buy_zone"` and `enabled=True`.
- [ ] `GeneratedIdea.added_to_watchlist` is `True` after the call.
- [ ] Idempotent: second call returns `watchlist_entry_created=false` without error.
- [ ] RSS mock fixture → `scan_news()` → `GeneratedIdea` with `source="news"`, `news_headline` populated.

---

### T3-38 · E2E tests: Opportunities page V3 interactions

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T3-29, T3-36 |
| **Action** | CREATE new file |

**Files:**
- `tests/e2e/specs/opportunities-v3.spec.ts` (create)

**Description:** Playwright E2E tests for the V3 Opportunities page: add a ticker, see Checking state, remove a ticker, verify STRONG BUY badge renders, verify tooltip shows condition checklist, verify alert toggle.

**Acceptance Criteria:**
- [ ] Test: type ticker symbol in add input → click Add → new row visible with `"Checking…"` signal status.
- [ ] Test: click trash icon → row removed from table.
- [ ] Test: mock API response with `signal_status="STRONG_BUY"` → `BuyNowBadge` renders green text and pulsing dot.
- [ ] Test: hover badge → tooltip renders at least 10 condition labels.
- [ ] Test: click row → `EstimatedEntryPanel` expands and shows zone data.
- [ ] Test: duplicate add → inline error message shown.
- [ ] Tests run against the dev server (`http://localhost:3000`) using Playwright `workers:1` config.

---

### T3-39 · E2E tests: Ideas page V3 generated feed

| Field | Value |
|---|---|
| **Owner** | frontend-developer |
| **Effort** | M |
| **Blocked by** | T3-30, T3-37 |
| **Action** | CREATE new file |

**Files:**
- `tests/e2e/specs/ideas-v3.spec.ts` (create)

**Description:** Playwright E2E tests for the V3 Ideas page: verify generated idea cards render, source filter tabs work, add-to-watchlist button state transitions, theme chip filtering.

**Acceptance Criteria:**
- [ ] Test: "Suggested" tab is active by default and shows generated idea cards from `GET /api/ideas/generated`.
- [ ] Test: click "News" filter tab → only cards with `source="news"` or `"merged"` shown.
- [ ] Test: click "AI" theme chip → only cards with `"ai"` in theme tags shown.
- [ ] Test: click "Add to Watchlist" on a card → button transitions to "Added ✓" and toast appears.
- [ ] Test: refresh button → shows spinner → re-fetches idea list.
- [ ] Test: "Last updated X minutes ago" banner visible when ideas exist.
- [ ] Tests run against the dev server using Playwright `workers:1` config.

---

### T3-40 · Environment config: add V3 settings to `config.py` and `.env`

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-17 |
| **Action** | EXTEND existing files |

**Files:**
- `backend/app/core/config.py` (extend)
- `backend/.env` (extend — local dev values only; never commit secrets)

**Description:** Add new settings for the three V3 scheduler jobs and the signal pruning retention window. All settings have sensible defaults so the app runs without explicitly setting them.

**New settings:**
- `live_scanner_interval_minutes: int = 5`
- `idea_generator_interval_minutes: int = 60`
- `signal_prune_days: int = 30`

**Acceptance Criteria:**
- [ ] All three new settings are declared in `Settings` class in `config.py`.
- [ ] Settings have defaults so no `.env` entry is required for local dev.
- [ ] `settings.live_scanner_interval_minutes` is readable from anywhere that imports `settings`.
- [ ] `backend/.env` has commented example entries for documentation but no hardcoded secrets.

---

### T3-41 · Scheduler task: `prune_old_signals.py` (30-day retention)

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-17, T3-40 |
| **Action** | CREATE new file |

**Files:**
- `backend/app/scheduler/tasks/prune_old_signals.py` (create)

**Description:** Implement `prune_old_signals()` async job that deletes `BuyNowSignal` rows older than `settings.signal_prune_days` days. Runs daily (registered in T3-17). Logs count of deleted rows.

**Acceptance Criteria:**
- [ ] Deletes rows where `created_at < now() - timedelta(days=settings.signal_prune_days)`.
- [ ] Logs `"prune_old_signals: deleted N rows older than X days"` at INFO.
- [ ] Exception is caught and logged; job does not crash the scheduler.
- [ ] Importable and callable by APScheduler.

---

### T3-42 · Documentation: update CLAUDE.md and BACKEND3.md

| Field | Value |
|---|---|
| **Owner** | backend-architect |
| **Effort** | S |
| **Blocked by** | T3-17, T3-29, T3-30 |
| **Action** | EXTEND/CREATE |

**Files:**
- `CLAUDE.md` (extend — add V3 implementation status row to the status table)
- `BACKEND3.md` (create — V3 backend handoff: new endpoints, models, services, scheduler jobs)

**Description:** Update the project-level `CLAUDE.md` status table to reflect V3 completion. Create `BACKEND3.md` documenting all new endpoints, models, services, and scheduler jobs added in V3 for developer handoff.

**Acceptance Criteria:**
- [ ] `CLAUDE.md` status table has a V3 row: `V3 Backend (new models, services, jobs)` and `V3 Frontend (V3 pages)`.
- [ ] `BACKEND3.md` lists all new API endpoints with method, path, auth requirement, request/response shape.
- [ ] `BACKEND3.md` lists all three new DB tables with column summaries.
- [ ] `BACKEND3.md` lists all new scheduler jobs with interval and market-hours behavior.
- [ ] No secrets or environment-specific values included in documentation.

---

## Requirement Traceability

| PRD3 Section / User Story | Task(s) |
|---|---|
| US-01 Add ticker to watchlist | T3-18, T3-22, T3-25, T3-29 |
| US-02 See buy zone + ideal entry per ticker | T3-12, T3-19, T3-24, T3-25 |
| US-03 Live signal status badge every 5 min | T3-14, T3-15, T3-17, T3-23, T3-25, T3-29 |
| US-04 In-app notification on STRONG BUY | T3-12, T3-15 |
| US-05 Email notification on STRONG BUY | T3-12, T3-15 |
| US-06 Tooltip with all 10 condition pass/fail | T3-09, T3-19, T3-23 |
| US-07 Remove ticker from watchlist | T3-18, T3-22, T3-25 |
| US-08 Alert toggle per ticker | T3-18b, T3-22, T3-25 |
| US-09 4-hour cooldown on duplicate signals | T3-12, T3-31 |
| US-10 Auto-generated ideas on Ideas page | T3-13, T3-16, T3-21, T3-28, T3-30 |
| US-11 Filter ideas by source and theme | T3-21, T3-28 |
| US-12 Ideas expire after 24 hours | T3-16, T3-34 |
| US-13 One-click Add to Watchlist from idea card | T3-21, T3-26, T3-27 |
| US-14 Added idea card shows checkmark + disabled button | T3-26, T3-27 |
| US-15 Last scan timestamp | T3-21, T3-28 |
| US-16 Manual scan trigger | T3-20, T3-28, T3-29 |
| Section 4.3 Opportunities table columns | T3-19, T3-25 |
| Section 5.3 Idea card UI spec | T3-27 |
| Section 6.1 UserWatchlist model | T3-03, T3-06 |
| Section 6.2 BuyNowSignal model | T3-04, T3-07 |
| Section 6.3 GeneratedIdea model | T3-05, T3-08 |
| Section 7 ALL CONDITIONS gate (10 conditions) | T3-12, T3-31 |
| Section 8 Idea score formula (6 components) | T3-11b, T3-11c, T3-11d, T3-13 |
| Section 9.1 Megatrend filter | T3-13, T3-35b |
| Section 9.2 Competitive moat filter | T3-11b, T3-13, T3-35c |
| Section 9.3 Financial quality filter | T3-11c, T3-13, T3-35d |
| Section 9.4 Entry priority (52w low + weekly support) | T3-11d, T3-13, T3-35e |
| Section 10 RSS news sources | T3-11, T3-33 |
| Section 11 SCAN_UNIVERSE + HIGH_MOAT_TICKERS | T3-11b, T3-13 |
| Section 12.1 Watchlist + Opportunities endpoints | T3-18, T3-18b, T3-19 |
| Section 12.2 Scanner endpoints | T3-20 |
| Section 12.3 Generated ideas endpoints | T3-21 |
| Section 13 Scheduler jobs | T3-15, T3-16, T3-17 |
| Section 14 Frontend components | T3-23, T3-24, T3-25, T3-26, T3-27, T3-28, T3-29, T3-30 |
| Section 15 Notification templates | T3-12 |
| Section 16 Approved wording constraints | T3-12, T3-24, T3-27, T3-28 |
| Section 18 DB migrations | T3-03, T3-04, T3-05 |
| Section 20 Backend unit tests | T3-31, T3-32, T3-33, T3-34, T3-35, T3-35b, T3-35c, T3-35d, T3-35e |
| Section 20 Integration tests | T3-36, T3-37 |
| OQ-01 Watchlist router placement | T3-18 |
| OQ-02 last_scan_at storage | T3-21 |
| OQ-03 not_near_earnings default | T3-12 |
| OQ-04 Signal pruning | T3-41 |
| OQ-05 V2/V3 scoring separation | T3-13 |
