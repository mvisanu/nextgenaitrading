# NextGenStock — Claude Code Prompt

You are a senior full-stack engineer, Python quant engineer, FastAPI backend architect, Next.js frontend architect, database-oriented backend developer, and authentication/security engineer.

## Before Writing Any Code

1. Inspect the existing project structure end-to-end: backend services, strategy logic, broker integration, persistence models, and any existing frontend.
2. Write a short execution plan (bullet points, no more than 20 lines).
3. Execute the plan incrementally — one logical unit at a time.
4. After each major unit, validate locally: run lint, type checks, and any existing tests.

---

## Project Goal

Refactor or build the existing trading app into a **production-grade multi-user web platform** with:

- **Next.js 14+ (App Router)** frontend
- **FastAPI** backend
- **PostgreSQL** via SQLAlchemy 2.x + Alembic
- **shadcn/ui** + Tailwind CSS UI
- **JWT auth** (HTTP-only cookies, access + refresh tokens)
- **Strict per-user data isolation**
- **Multi-broker support**: Alpaca (stocks/ETFs, default) + Robinhood (crypto, optional)
- **Encrypted broker credentials per user**, stored per-provider
- All existing trading, backtesting, optimization, and Pine Script features preserved

---

## Stack

### Frontend (`frontend/`)
- Next.js 14+ with App Router and TypeScript
- Tailwind CSS
- shadcn/ui components throughout
- React Hook Form + Zod for all forms
- TanStack Query for server state
- **Lightweight Charts** (TradingView) for candlestick/OHLCV price charts
- **Recharts** for backtest metrics, equity curves, PnL, drawdown charts
- **Plotly.js** for research/optimization analysis, indicator subplots, heatmaps
- No secrets in frontend code

### Backend (`backend/`)
- FastAPI with Pydantic v2
- SQLAlchemy 2.x async ORM
- Alembic for migrations
- PostgreSQL
- `passlib` or `pwdlib` for password hashing
- `python-jose` for JWT
- `cryptography` for broker credential encryption
- `yfinance`, `pandas`, `numpy`, `hmmlearn`, `scikit-learn`, `ta` or `pandas_ta`

---

## Directory Structure

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
    ui/           # shadcn/ui components
    layout/       # sidebar, nav, shell
    charts/       # price, equity curve
    strategy/     # mode-specific panels
  hooks/
  lib/
    api.ts        # typed fetch abstraction
    auth.ts       # session helpers
  types/
  middleware.ts   # route protection

backend/
  app/
    main.py
    core/
      config.py
      security.py       # JWT signing, cookie helpers
    auth/
      router.py
      service.py
      dependencies.py   # get_current_user
    api/
      profile.py
      broker.py
      backtests.py
      strategies.py
      live.py
      artifacts.py
    models/             # SQLAlchemy ORM models
    schemas/            # Pydantic request/response schemas
    db/
      session.py
      base.py
    broker/
      base.py              # AbstractBrokerClient interface
      alpaca_client.py     # Alpaca REST API (stocks/ETFs default)
      robinhood_client.py  # Robinhood crypto (legacy/optional)
      factory.py           # get_broker_client(credential) -> correct client
    services/
      credential_service.py
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

---

## Authentication — JWT + HTTP-only Cookies

### Flow
1. `POST /auth/register` — hash password, create user, return 201
2. `POST /auth/login` — validate credentials, issue access + refresh JWT in HTTP-only cookies
3. `GET /auth/me` — validate access token, return current user
4. `POST /auth/refresh` — validate refresh token, issue new access token
5. `POST /auth/logout` — clear cookies, revoke refresh token record

### Token Specs
- Access token: 15-minute expiry, claims: `sub` (user_id), `email`, `type: "access"`
- Refresh token: 7-day expiry, claims: `sub`, `type: "refresh"`
- Both stored in HTTP-only, Secure, SameSite=Lax cookies
- Never expose raw tokens to JavaScript

### UserSession Table (refresh token persistence)
```
id, user_id, refresh_token_hash, user_agent, ip_address,
created_at, expires_at, revoked_at, last_used_at
```
- Store only the **hash** of the refresh token (bcrypt or SHA-256)
- On logout: set `revoked_at`, clear cookies
- On refresh: verify hash, check not revoked, check expiry, rotate token

### Backend Dependency
Create `get_current_user` FastAPI dependency that:
- reads access token from cookie
- validates signature and expiry
- returns the authenticated User ORM object
- raises HTTP 401 on failure

All protected routes must use `Depends(get_current_user)`.  
Never trust user IDs from the request body. Always derive from the validated token.

---

## Multi-Tenant Data Isolation

This is non-negotiable:

- Every table linked to users has a `user_id` foreign key
- Every query is scoped: `WHERE user_id = current_user.id`
- Never use frontend-supplied user IDs for ownership checks
- Backend returns 403 if a user tries to access another user's record by ID
- Add an `assert_ownership(record, current_user)` utility used in all service methods

---

## Database Models (PostgreSQL / SQLAlchemy)

Define all models in `backend/app/models/`. Required tables:

| Model | Key Fields |
|---|---|
| User | id, email, password_hash, is_active, created_at, updated_at |
| UserProfile | id, user_id, display_name, timezone, default_symbol, default_mode |
| UserSession | id, user_id, refresh_token_hash, user_agent, ip_address, created_at, expires_at, revoked_at, last_used_at |
| BrokerCredential | id, user_id, **provider** (`alpaca` or `robinhood`), profile_name, api_key, encrypted_secret_key, base_url, is_active, created_at, updated_at -- provider field drives which client class is used at execution time |
| StrategyRun | id, user_id, created_at, run_type, mode_name, strategy_family, symbol, timeframe, leverage, min_confirmations, trailing_stop_pct, bull_state_id, bear_state_id, current_state_id, current_regime, current_signal, confirmation_count, selected_variant_name, selected_variant_score, selected_variant_reason, notes, error_message |
| TradeDecision | id, user_id, strategy_run_id, created_at, symbol, timeframe, timestamp_of_bar, regime, state_id, signal, confirmation_count, entry_eligible, cooldown_active, reason_summary |
| BrokerOrder | id, user_id, strategy_run_id, created_at, symbol, side, order_type, quantity, notional_usd, broker_order_id, status, submitted_price_estimate, filled_price, filled_quantity, mode_name, dry_run, error_message, raw_response_json |
| PositionSnapshot | id, user_id, created_at, symbol, position_side, quantity, avg_entry_price, mark_price, unrealized_pnl, realized_pnl, is_open, strategy_mode |
| CooldownState | id, user_id, symbol, cooldown_until, last_exit_time, last_exit_reason, updated_at |
| TrailingStopState | id, user_id, symbol, is_active, entry_time, entry_price, highest_price_seen, trailing_stop_pct, trailing_stop_price, updated_at |
| VariantBacktestResult | id, user_id, strategy_run_id, created_at, mode_name, variant_name, family_name, symbol, timeframe, parameter_json, train_return, validation_return, test_return, validation_score, max_drawdown, sharpe_like, trade_count, selected_winner |
| WinningStrategyArtifact | id, user_id, strategy_run_id, created_at, mode_name, variant_name, pine_script_version, pine_script_code, notes, selected_winner |
| BacktestTrade | id, user_id, strategy_run_id, entry_time, exit_time, entry_price, exit_price, return_pct, leveraged_return_pct, pnl, holding_hours, exit_reason, mode_name |

---

## Backend API Endpoints

All endpoints below (except `/auth/register` and `/auth/login`) require `Depends(get_current_user)`.

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /profile
PATCH  /profile

GET    /broker/credentials
POST   /broker/credentials
PATCH  /broker/credentials/{id}
DELETE /broker/credentials/{id}
POST   /broker/credentials/{id}/test

POST   /backtests/run
GET    /backtests
GET    /backtests/{id}
GET    /backtests/{id}/trades
GET    /backtests/{id}/leaderboard

POST   /strategies/ai-pick/run
POST   /strategies/buy-low-sell-high/run
GET    /strategies/runs
GET    /strategies/runs/{id}

POST   /live/run-signal-check
POST   /live/execute
GET    /live/orders
GET    /live/positions
GET    /live/status

GET    /artifacts
GET    /artifacts/{id}
GET    /artifacts/{id}/pine-script
```

---

## Strategy Modes

Preserve all existing logic. Route each mode through backend API calls.

**All four modes accept a user-supplied `symbol` and `timeframe` from the frontend.** No symbol is hardcoded. The backend validates the symbol against yfinance before running any strategy.

### Symbol Input Rules
- User enters any valid yfinance ticker (e.g. `AAPL`, `TSLA`, `BTC-USD`, `ETH-USD`, `SPY`, `NVDA`)
- Backend validates the symbol by attempting a small yfinance fetch before accepting the run request
- If the symbol returns no data or an error, return HTTP 422 with a clear message: `"Symbol 'XYZ' not found or returned no data"`
- Frontend shows a symbol search input with examples: stocks (`AAPL`, `TSLA`, `NVDA`), crypto (`BTC-USD`, `ETH-USD`), ETFs (`SPY`, `QQQ`)
- Store the resolved symbol on every `StrategyRun`, `BacktestTrade`, and `WinningStrategyArtifact` record

### Timeframe Input Rules
- User selects timeframe from a dropdown: `1d` (default), `1h`, `4h`, `1wk`
- Backend maps timeframe to yfinance `interval` parameter
- AI Pick and Buy Low / Sell High modes default to `1d` but allow override
- Conservative and Aggressive modes support `1h` and `1d`
- Store selected timeframe on the `StrategyRun` record

### Conservative Mode
- Leverage: 2.5x
- Min confirmations: 7/8
- Trailing stop: disabled unless already present
- Accepts: any user-supplied symbol + timeframe

### Aggressive Mode
- Leverage: 4.0x
- Min confirmations: 5/8
- Trailing stop: 5%
- Accepts: any user-supplied symbol + timeframe

### AI Pick Mode
- Accepts: any user-supplied symbol (default `BTC-USD`) + timeframe (default `1d`)
- Indicator search: MACD + RSI + EMA variants
- Run multiple variants → backtest each → rank by risk-adjusted score
- Report train/validation/test split results
- Select best winner → generate Pine Script v5 artifact tied to the chosen symbol

### Buy Low / Sell High Mode
- Accepts: any user-supplied symbol (default `BTC-USD`) + timeframe (default `1d`)
- New dip/cycle strategy variants built from scratch
- Run multiple versions → backtest → rank
- Select best risk-adjusted winner → generate Pine Script v5 artifact tied to the chosen symbol

### API Request Shape (all modes)
All strategy run endpoints accept this base payload:

```json
{
  "symbol": "AAPL",
  "timeframe": "1d",
  "mode": "conservative | aggressive | ai-pick | buy-low-sell-high",
  "leverage": 2.5,
  "dry_run": true
}
```

Backend schema (`RunStrategyRequest`):
```python
class RunStrategyRequest(BaseModel):
    symbol: str
    timeframe: Literal["1d", "1h", "4h", "1wk"] = "1d"
    mode: Literal["conservative", "aggressive", "ai-pick", "buy-low-sell-high"]
    leverage: float | None = None       # override; defaults to mode default
    dry_run: bool = True

    @field_validator("symbol")
    def symbol_uppercase(cls, v):
        return v.strip().upper()
```

---

## Market Data Loader

Use `yfinance` with:
- `period="730d"`, `interval="1h"` for HMM-based intraday modes
- `period="730d"`, `interval=timeframe` for AI Pick and Buy Low / Sell High (user-supplied)

The loader must accept `symbol` and `interval` as parameters — never hardcode either:

```python
def load_ohlcv(symbol: str, interval: str = "1d", period: str = "730d") -> pd.DataFrame:
    df = yf.download(symbol, period=period, interval=interval, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    required = {"Open", "High", "Low", "Close", "Volume"}
    missing = required - set(df.columns)
    if missing or df.empty:
        raise ValueError(f"Symbol '{symbol}' returned no usable data (missing: {missing})")
    return df[list(required)]
```

Ensure final columns: `Open`, `High`, `Low`, `Close`, `Volume`. Raise a clear error if any are missing.

---

## Supported Brokers

NextGenStock supports two brokers. Users pick one per credential profile from a dropdown in `/profile`.

| Provider | Asset types | Use case | API style |
|---|---|---|---|
| **Alpaca** | Stocks, ETFs, crypto | Default broker for all stock/ETF strategies | REST + WebSocket, `alpaca-py` SDK |
| **Robinhood** | Crypto only | Legacy/crypto users who prefer Robinhood | REST, official crypto API |

### Provider routing rules
- Alpaca is the **default** -- pre-selected when a user adds their first broker credential
- Robinhood is available but labelled: **"Crypto only"**
- If a user runs a stock strategy (e.g. `AAPL`) with a Robinhood credential selected, return HTTP 422: `"Robinhood only supports crypto symbols. Switch to Alpaca for stock trading."`
- Live trading page shows the active credential provider as a badge next to the broker selector

### Abstract broker interface

All broker clients implement the same interface so strategy execution code is broker-agnostic:

```python
# broker/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class OrderResult:
    broker_order_id: str
    status: str
    filled_price: float | None
    filled_quantity: float | None
    raw_response: dict

class AbstractBrokerClient(ABC):
    @abstractmethod
    def get_account(self) -> dict: ...

    @abstractmethod
    def place_order(self, symbol: str, side: str, quantity: float,
                    order_type: str = "market", dry_run: bool = True) -> OrderResult: ...

    @abstractmethod
    def get_positions(self) -> list[dict]: ...

    @abstractmethod
    def get_orders(self, limit: int = 50) -> list[dict]: ...

    @abstractmethod
    def ping(self) -> bool: ...
```

### Alpaca client

```python
# broker/alpaca_client.py
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from .base import AbstractBrokerClient, OrderResult

class AlpacaClient(AbstractBrokerClient):
    def __init__(self, api_key: str, secret_key: str, paper: bool = False):
        base_url = "https://paper-api.alpaca.markets" if paper else "https://api.alpaca.markets"
        self.client = TradingClient(api_key, secret_key, url_override=base_url)

    def ping(self) -> bool:
        try:
            self.client.get_account()
            return True
        except Exception:
            return False

    def place_order(self, symbol, side, quantity, order_type="market", dry_run=True) -> OrderResult:
        if dry_run:
            return OrderResult(broker_order_id="dry-run", status="simulated",
                               filled_price=None, filled_quantity=quantity, raw_response={})
        req = MarketOrderRequest(
            symbol=symbol,
            qty=quantity,
            side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
            time_in_force=TimeInForce.DAY,
        )
        order = self.client.submit_order(req)
        return OrderResult(
            broker_order_id=str(order.id),
            status=str(order.status),
            filled_price=float(order.filled_avg_price) if order.filled_avg_price else None,
            filled_quantity=float(order.filled_qty) if order.filled_qty else None,
            raw_response=order.model_dump(),
        )
```

### Broker factory

```python
# broker/factory.py
from .alpaca_client import AlpacaClient
from .robinhood_client import RobinhoodClient
from .base import AbstractBrokerClient
from app.models import BrokerCredential
from app.services.credential_service import decrypt

def get_broker_client(credential: BrokerCredential, paper: bool = False) -> AbstractBrokerClient:
    api_key = decrypt(credential.api_key)
    secret_key = decrypt(credential.encrypted_secret_key)

    if credential.provider == "alpaca":
        return AlpacaClient(api_key=api_key, secret_key=secret_key, paper=paper)
    elif credential.provider == "robinhood":
        return RobinhoodClient(api_key=api_key, private_key=secret_key)
    else:
        raise ValueError(f"Unsupported broker provider: {credential.provider}")
```

### Alpaca installation

```bash
pip install alpaca-py
```

### Broker Credential Security

- Encrypt both `api_key` and `secret_key` using Fernet before storing
- Use `ENCRYPTION_KEY` env var (32-byte base64 URL-safe key)
- Decrypt only inside `get_broker_client()` at execution time, in-memory, never logged
- Never return decrypted values via any API response
- `POST /broker/credentials/{id}/test` calls `client.ping()`, returns only `{ "ok": true/false }`

```python
# credential_service.py
from cryptography.fernet import Fernet

def encrypt(value: str, key: str) -> str: ...
def decrypt(value: str, key: str) -> str: ...
```

### Frontend -- broker credential form

The add/edit credential form in `/profile` adapts its fields based on the selected provider:

```
Provider dropdown:  [ Alpaca (default) ]  or  [ Robinhood (crypto only) ]

If Alpaca selected:
  API Key ID      [ ________________ ]
  Secret Key      [ **************** ]   (masked input)
  Paper trading   [ toggle on/off   ]

If Robinhood selected:
  API Key         [ ________________ ]
  Private Key     [ **************** ]   (masked input)

Profile name      [ My Alpaca account ]
[ Save ]  [ Test connection ]
```

- Show a `Badge` next to each saved credential: green "Alpaca - Stocks & ETFs" or amber "Robinhood - Crypto only"
- Show a warning `Alert` on the Robinhood form: "Robinhood credentials only support crypto. For stocks and ETFs, add an Alpaca account."
- Live trading broker selector dropdown lists all active credentials with their provider badge
---

## Pine Script Export

For AI Pick and Buy Low / Sell High winning strategies:
- Generate complete Pine Script v5 code mirroring the winning variant's logic
- Save as `WinningStrategyArtifact` tied to `user_id` and `strategy_run_id`
- Frontend displays in a copyable `<code>` block (shadcn/ui `ScrollArea` + copy button)
- Include inline comments explaining any Python-to-Pine approximation differences

---

## Frontend Pages (Next.js App Router)

### Public
- `/login` — email/password form, calls `POST /auth/login`, stores cookie via backend
- `/register` — email/password + confirm form, calls `POST /auth/register`

### Protected (redirect to `/login` if no valid session)
- `/dashboard` — current signal, regime, state, confirmations, recent runs, broker status, metrics cards
- `/backtests` — run new backtest, list past runs, drill into trades and leaderboard
- `/strategies` — mode selector (Conservative / Aggressive / AI Pick / Buy Low Sell High), run, view results
- `/live-trading` — enable/disable, dry-run toggle, broker profile selector, positions, orders, warning banner
- `/artifacts` — list Pine Script artifacts, view/copy code, link to originating strategy run
- `/profile` — display name, timezone, defaults, manage broker credentials (masked summaries, add/edit/delete with confirmation dialog)

### Middleware (`middleware.ts`)
- Read auth cookie
- Redirect to `/login` if missing or expired
- Protect all `/dashboard`, `/strategies`, `/backtests`, `/live-trading`, `/artifacts`, `/profile` routes

---

## Frontend Auth Behavior

```typescript
// lib/auth.ts
export async function getCurrentUser() {
  const res = await fetch('/api-proxy/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}
```

- On page load: call `/auth/me`, populate user context
- On 401: attempt `/auth/refresh`, retry once, then redirect to login
- On logout: call `POST /auth/logout`, clear local state, redirect to `/login`
- Never store tokens in `localStorage`

---

## UI Requirements (shadcn/ui)

Use shadcn/ui components throughout:
- `Form`, `Input`, `Button`, `Label` for all forms
- `Card`, `CardHeader`, `CardContent` for metric panels
- `Table`, `TableRow`, `TableCell` for runs, orders, trades
- `Tabs` for strategy mode selection
- `Dialog` with confirmation for dangerous actions (enable live trading, delete credential)
- `Toast` / `Sonner` for success and error notifications
- `Badge` for regime/signal status
- `ScrollArea` + copy button for Pine Script code blocks
- `Sheet` or `Drawer` for mobile nav if applicable
- `Alert` for warnings on live trading page

Dashboard layout:
- Fixed left sidebar with nav links and user avatar/email
- Main content area with page-specific content
- Consistent header with page title and actions

---

## Environment Variables

### Backend (`.env`)
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/nextgenstock
SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENCRYPTION_KEY=<fernet-key>
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
# Alpaca (default broker -- stocks/ETFs)
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_DATA_URL=https://data.alpaca.markets
ALPACA_PAPER_URL=https://paper-api.alpaca.markets

# Robinhood (crypto only -- optional)
ROBINHOOD_BASE_URL=https://trading.robinhood.com
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Security Checklist

Before marking any feature complete, verify:

- [ ] Passwords are hashed (bcrypt), never stored plaintext
- [ ] JWTs signed with `SECRET_KEY`, short expiry on access tokens
- [ ] Refresh tokens stored as hash only
- [ ] All protected routes use `Depends(get_current_user)`
- [ ] All DB queries scoped by `user_id` from validated token
- [ ] Ownership check before returning/modifying any user-owned record
- [ ] Broker private keys encrypted at rest with Fernet
- [ ] Decrypted keys never returned in API responses
- [ ] No secrets in frontend code or logs
- [ ] CORS restricted to `CORS_ORIGINS`
- [ ] Confirmation dialog before enabling live trading
- [ ] Dry-run default for live execution

---

## Acceptance Criteria

The implementation is complete only when all of the following pass:

1. Users can register with email + password
2. Users can log in and receive JWT cookies
3. Sessions persist across page refresh via `/auth/me`
4. Refresh flow renews access token without re-login
5. Logout clears cookies and revokes refresh token
6. All protected frontend routes redirect unauthenticated users
7. All protected backend routes return 401/403 without valid JWT
8. User A cannot access User B's runs, orders, credentials, or artifacts
9. Broker credentials are encrypted in DB; decrypted keys never returned by API
10. Conservative, Aggressive, AI Pick, and Buy Low / Sell High modes work end-to-end via API
11. Optimized modes produce leaderboard + selected winner + Pine Script artifact
12. Pine Script artifacts are displayed in copyable code block on `/artifacts`
13. Dashboard shows accurate per-user data
14. All shadcn/ui components used consistently; pages look production-ready

---

## Final Deliverable Checklist

When implementation is complete, produce a summary covering:

1. Files and folders created or changed
2. Architecture overview (frontend ↔ backend ↔ DB)
3. Auth/session design and token flow
4. How per-user data isolation is enforced
5. How broker credentials are encrypted and used
6. What is stored in each database table
7. How each strategy mode works through the API
8. How Pine Script artifacts are generated and surfaced in the UI
9. Assumptions made
10. Known limitations and recommended next improvements
11. Updated `README.md` covering: setup, migrations, env vars, strategy modes, auth design, security notes, and disclaimer that this is educational software and live trading carries real financial risk

---

## Charting Technology

Use three complementary libraries — each assigned to a specific job. Do not swap them arbitrarily.

### Library assignments

| Library | Use for | Pages |
|---|---|---|
| **Lightweight Charts** (TradingView OSS) | Candlestick price charts, OHLCV bars, volume, EMA/MACD overlays drawn on price | `/strategies`, `/live-trading`, `/backtests` |
| **Recharts** | Equity curve, cumulative PnL, drawdown, return histogram, leaderboard bar chart, dashboard KPI sparklines | `/dashboard`, `/backtests`, `/strategies` |
| **Plotly.js** | AI Pick / Buy Low Sell High optimization results, scatter plots of variant scores, regime heatmaps, candlestick + indicator subplots for research | `/strategies` (AI Pick, BLSH modes) |

### Installation

```bash
# Lightweight Charts
npm install lightweight-charts

# Recharts (likely already in project)
npm install recharts

# Plotly
npm install react-plotly.js plotly.js
# or lighter build:
npm install react-plotly.js plotly.js-dist-min
```

### Lightweight Charts — price chart setup

Use for every candlestick/OHLCV price view. Wrap in a React component with `useEffect` to init and `useRef` for the container:

```tsx
// components/charts/PriceChart.tsx
"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries } from "lightweight-charts";

interface Bar {
  time: string;   // "2024-01-15"
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface Props {
  data: Bar[];
  symbol: string;
  signals?: { time: string; position: "aboveBar" | "belowBar"; color: string; shape: "arrowUp" | "arrowDown"; text: string }[];
}

export function PriceChart({ data, symbol, signals = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#888" },
      grid: { vertLines: { color: "#2a2a2a" }, horzLines: { color: "#2a2a2a" } },
      width: containerRef.current.clientWidth,
      height: 400,
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444",
      borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    candles.setData(data);
    if (signals.length) candles.setMarkers(signals);

    const volume = chart.addSeries(HistogramSeries, {
      color: "#378ADD", priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volume.setData(data.map(d => ({ time: d.time, value: d.volume ?? 0, color: d.close >= d.open ? "#22c55e44" : "#ef444444" })));

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }));
    ro.observe(containerRef.current);
    return () => { chart.remove(); ro.disconnect(); };
  }, [data, signals]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />;
}
```

### Signal markers on price chart

When a strategy run produces entry/exit signals, convert them to Lightweight Charts markers and pass as `signals` prop:

```tsx
const signals = tradeDecisions
  .filter(d => d.signal !== "hold")
  .map(d => ({
    time: d.timestamp_of_bar.split("T")[0],
    position: d.signal === "buy" ? "belowBar" : "aboveBar",
    color: d.signal === "buy" ? "#22c55e" : "#ef4444",
    shape: d.signal === "buy" ? "arrowUp" : "arrowDown",
    text: `${d.signal.toUpperCase()} · ${d.regime}`,
  }));
```

### Recharts — equity curve and backtest metrics

Use `<AreaChart>` for equity curve and `<BarChart>` for return distribution and leaderboard. Always wrap in a `<ResponsiveContainer>`:

```tsx
// components/charts/EquityCurve.tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function EquityCurve({ trades }: { trades: BacktestTrade[] }) {
  const data = trades.reduce<{ date: string; equity: number }[]>((acc, t) => {
    const prev = acc.at(-1)?.equity ?? 100;
    acc.push({ date: t.exit_time.split("T")[0], equity: +(prev * (1 + t.return_pct / 100)).toFixed(2) });
    return acc;
  }, []);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <ReferenceLine y={100} stroke="#555" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="#22c55e22" strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Plotly.js — optimization and research charts

Use for the AI Pick and Buy Low / Sell High results pages where you need candlestick + indicator subplots, or variant score scatter plots:

```tsx
// components/charts/OptimizationScatter.tsx
"use client";
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function OptimizationScatter({ variants }: { variants: VariantBacktestResult[] }) {
  return (
    <Plot
      data={[{
        type: "scatter",
        mode: "markers",
        x: variants.map(v => v.max_drawdown),
        y: variants.map(v => v.validation_return),
        text: variants.map(v => v.variant_name),
        marker: {
          color: variants.map(v => v.selected_winner ? "#22c55e" : "#378ADD"),
          size: variants.map(v => v.selected_winner ? 14 : 8),
        },
      }]}
      layout={{
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        xaxis: { title: "Max drawdown (%)", color: "#888" },
        yaxis: { title: "Validation return (%)", color: "#888" },
        margin: { t: 20, r: 20, b: 50, l: 60 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%", height: 320 }}
    />
  );
}
```

Note: always import `react-plotly.js` with `dynamic(..., { ssr: false })` in Next.js App Router — Plotly uses browser APIs and will throw on the server.

### Chart data flow

Backend endpoints should return chart-ready arrays — no client-side transformation of raw DB rows:

```
GET /backtests/{id}/chart-data
→ { candles: Bar[], signals: Marker[], equity: EquityPoint[] }

GET /strategies/runs/{id}/optimization-chart
→ { variants: VariantScatterPoint[] }

GET /live/chart-data?symbol=AAPL&interval=1d
→ { candles: Bar[] }
```

Keep chart data endpoints separate from trade/order list endpoints. Charts need aggregated, time-sorted arrays; tables need paginated records.

---

## Recommended Hosting Setup

| Layer | Service | Notes |
|---|---|---|
| Next.js frontend | **Vercel** (free tier) | Built by the Next.js team — App Router, middleware, and server components all work natively. Zero-config deploys from Git. |
| FastAPI backend | **Render** (existing subscription) | Runs Dockerized Python with persistent processes, env var management, and auto-deploy from Git. No cold-start issues on paid plans. |
| PostgreSQL | **Supabase** (free tier) | Managed Postgres with connection pooling, a dashboard for table inspection, and generous free limits. Render's built-in PostgreSQL addon is a simpler alternative if you want everything in one place. |
| Background workers | **Render** (Background Worker service) | Only needed if signal checks are scheduled (e.g. hourly BTC check). If signals are purely request-driven, skip this entirely. |

**Do not host FastAPI on Vercel.** Vercel is serverless — no persistent processes, no long-running connections, and a 10-second execution timeout on the hobby plan. The quant logic, HMM models, and broker execution require a real Python runtime.

**Your setup:** Vercel (free, Next.js frontend) + Render (existing subscription, FastAPI backend + optional background worker) + Supabase free tier (PostgreSQL). Since you already have a Render subscription, your marginal cost is $0 extra.