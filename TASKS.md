# TASKS.md

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
