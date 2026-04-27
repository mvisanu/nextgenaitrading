# NextGenStock — Feature Specifications

---

## V1: Core Trading Platform

You are a senior full-stack engineer, Python quant engineer, FastAPI backend architect, Next.js frontend architect, database-oriented backend developer, and authentication/security engineer.

### Before Writing Any Code

1. Inspect the existing project structure end-to-end: backend services, strategy logic, broker integration, persistence models, and any existing frontend.
2. Write a short execution plan (bullet points, no more than 20 lines).
3. Execute the plan incrementally — one logical unit at a time.
4. After each major unit, validate locally: run lint, type checks, and any existing tests.

---

### Project Goal

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

### Stack

#### Frontend (`frontend/`)
- Next.js 14+ with App Router and TypeScript
- Tailwind CSS
- shadcn/ui components throughout
- React Hook Form + Zod for all forms
- TanStack Query for server state
- **Lightweight Charts** (TradingView) for candlestick/OHLCV price charts
- **Recharts** for backtest metrics, equity curves, PnL, drawdown charts
- **Plotly.js** for research/optimization analysis, indicator subplots, heatmaps
- No secrets in frontend code

#### Backend (`backend/`)
- FastAPI with Pydantic v2
- SQLAlchemy 2.x async ORM
- Alembic for migrations
- PostgreSQL
- `passlib` or `pwdlib` for password hashing
- `python-jose` for JWT
- `cryptography` for broker credential encryption
- `yfinance`, `pandas`, `numpy`, `hmmlearn`, `scikit-learn`, `ta` or `pandas_ta`

---

### Directory Structure

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

### Authentication — JWT + HTTP-only Cookies

#### Flow
1. `POST /auth/register` — hash password, create user, return 201
2. `POST /auth/login` — validate credentials, issue access + refresh JWT in HTTP-only cookies
3. `GET /auth/me` — validate access token, return current user
4. `POST /auth/refresh` — validate refresh token, issue new access token
5. `POST /auth/logout` — clear cookies, revoke refresh token record

#### Token Specs
- Access token: 15-minute expiry, claims: `sub` (user_id), `email`, `type: "access"`
- Refresh token: 7-day expiry, claims: `sub`, `type: "refresh"`
- Both stored in HTTP-only, Secure, SameSite=Lax cookies
- Never expose raw tokens to JavaScript

#### UserSession Table (refresh token persistence)
```
id, user_id, refresh_token_hash, user_agent, ip_address,
created_at, expires_at, revoked_at, last_used_at
```
- Store only the **hash** of the refresh token (bcrypt or SHA-256)
- On logout: set `revoked_at`, clear cookies
- On refresh: verify hash, check not revoked, check expiry, rotate token

#### Backend Dependency
Create `get_current_user` FastAPI dependency that:
- reads access token from cookie
- validates signature and expiry
- returns the authenticated User ORM object
- raises HTTP 401 on failure

All protected routes must use `Depends(get_current_user)`.
Never trust user IDs from the request body. Always derive from the validated token.

---

### Multi-Tenant Data Isolation

This is non-negotiable:

- Every table linked to users has a `user_id` foreign key
- Every query is scoped: `WHERE user_id = current_user.id`
- Never use frontend-supplied user IDs for ownership checks
- Backend returns 403 if a user tries to access another user's record by ID
- Add an `assert_ownership(record, current_user)` utility used in all service methods

---

### Database Models (PostgreSQL / SQLAlchemy)

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

### Backend API Endpoints

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

### Strategy Modes

Preserve all existing logic. Route each mode through backend API calls.

**All four modes accept a user-supplied `symbol` and `timeframe` from the frontend.** No symbol is hardcoded. The backend validates the symbol against yfinance before running any strategy.

#### Symbol Input Rules
- User enters any valid yfinance ticker (e.g. `AAPL`, `TSLA`, `BTC-USD`, `ETH-USD`, `SPY`, `NVDA`)
- Backend validates the symbol by attempting a small yfinance fetch before accepting the run request
- If the symbol returns no data or an error, return HTTP 422 with a clear message: `"Symbol 'XYZ' not found or returned no data"`
- Frontend shows a symbol search input with examples: stocks (`AAPL`, `TSLA`, `NVDA`), crypto (`BTC-USD`, `ETH-USD`), ETFs (`SPY`, `QQQ`)
- Store the resolved symbol on every `StrategyRun`, `BacktestTrade`, and `WinningStrategyArtifact` record

#### Timeframe Input Rules
- User selects timeframe from a dropdown: `1d` (default), `1h`, `4h`, `1wk`
- Backend maps timeframe to yfinance `interval` parameter
- AI Pick and Buy Low / Sell High modes default to `1d` but allow override
- Conservative and Aggressive modes support `1h` and `1d`
- Store selected timeframe on the `StrategyRun` record

#### Conservative Mode
- Leverage: 2.5x
- Min confirmations: 7/8
- Trailing stop: disabled unless already present
- Accepts: any user-supplied symbol + timeframe

#### Aggressive Mode
- Leverage: 4.0x
- Min confirmations: 5/8
- Trailing stop: 5%
- Accepts: any user-supplied symbol + timeframe

#### AI Pick Mode
- Accepts: any user-supplied symbol (default `BTC-USD`) + timeframe (default `1d`)
- Indicator search: MACD + RSI + EMA variants
- Run multiple variants → backtest each → rank by risk-adjusted score
- Report train/validation/test split results
- Select best winner → generate Pine Script v5 artifact tied to the chosen symbol

#### Buy Low / Sell High Mode
- Accepts: any user-supplied symbol (default `BTC-USD`) + timeframe (default `1d`)
- New dip/cycle strategy variants built from scratch
- Run multiple versions → backtest → rank
- Select best risk-adjusted winner → generate Pine Script v5 artifact tied to the chosen symbol

#### API Request Shape (all modes)
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

### Market Data Loader

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

### Supported Brokers

NextGenStock supports two brokers. Users pick one per credential profile from a dropdown in `/profile`.

| Provider | Asset types | Use case | API style |
|---|---|---|---|
| **Alpaca** | Stocks, ETFs, crypto | Default broker for all stock/ETF strategies | REST + WebSocket, `alpaca-py` SDK |
| **Robinhood** | Crypto only | Legacy/crypto users who prefer Robinhood | REST, official crypto API |

#### Provider routing rules
- Alpaca is the **default** -- pre-selected when a user adds their first broker credential
- Robinhood is available but labelled: **"Crypto only"**
- If a user runs a stock strategy (e.g. `AAPL`) with a Robinhood credential selected, return HTTP 422: `"Robinhood only supports crypto symbols. Switch to Alpaca for stock trading."`
- Live trading page shows the active credential provider as a badge next to the broker selector

#### Abstract broker interface

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

#### Alpaca client

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

#### Broker factory

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

#### Alpaca installation

```bash
pip install alpaca-py
```

#### Broker Credential Security

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

#### Frontend -- broker credential form

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

### Pine Script Export

For AI Pick and Buy Low / Sell High winning strategies:
- Generate complete Pine Script v5 code mirroring the winning variant's logic
- Save as `WinningStrategyArtifact` tied to `user_id` and `strategy_run_id`
- Frontend displays in a copyable `<code>` block (shadcn/ui `ScrollArea` + copy button)
- Include inline comments explaining any Python-to-Pine approximation differences

---

### Frontend Pages (Next.js App Router)

#### Public
- `/login` — email/password form, calls `POST /auth/login`, stores cookie via backend
- `/register` — email/password + confirm form, calls `POST /auth/register`

#### Protected (redirect to `/login` if no valid session)
- `/dashboard` — current signal, regime, state, confirmations, recent runs, broker status, metrics cards
- `/backtests` — run new backtest, list past runs, drill into trades and leaderboard
- `/strategies` — mode selector (Conservative / Aggressive / AI Pick / Buy Low Sell High), run, view results
- `/live-trading` — enable/disable, dry-run toggle, broker profile selector, positions, orders, warning banner
- `/artifacts` — list Pine Script artifacts, view/copy code, link to originating strategy run
- `/profile` — display name, timezone, defaults, manage broker credentials (masked summaries, add/edit/delete with confirmation dialog)

#### Middleware (`middleware.ts`)
- Read auth cookie
- Redirect to `/login` if missing or expired
- Protect all `/dashboard`, `/strategies`, `/backtests`, `/live-trading`, `/artifacts`, `/profile` routes

---

### Frontend Auth Behavior

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

### UI Requirements (shadcn/ui)

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

### Environment Variables

#### Backend (`.env`)
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

#### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

### Security Checklist

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

### Acceptance Criteria

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

### Final Deliverable Checklist

When implementation is complete, produce a summary covering:

1. Files and folders created or changed
2. Architecture overview (frontend <-> backend <-> DB)
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

### Charting Technology

Use three complementary libraries — each assigned to a specific job. Do not swap them arbitrarily.

#### Library assignments

| Library | Use for | Pages |
|---|---|---|
| **Lightweight Charts** (TradingView OSS) | Candlestick price charts, OHLCV bars, volume, EMA/MACD overlays drawn on price | `/strategies`, `/live-trading`, `/backtests` |
| **Recharts** | Equity curve, cumulative PnL, drawdown, return histogram, leaderboard bar chart, dashboard KPI sparklines | `/dashboard`, `/backtests`, `/strategies` |
| **Plotly.js** | AI Pick / Buy Low Sell High optimization results, scatter plots of variant scores, regime heatmaps, candlestick + indicator subplots for research | `/strategies` (AI Pick, BLSH modes) |

#### Installation

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

#### Lightweight Charts — price chart setup

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

#### Signal markers on price chart

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

#### Recharts — equity curve and backtest metrics

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

#### Plotly.js — optimization and research charts

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

#### Chart data flow

Backend endpoints should return chart-ready arrays — no client-side transformation of raw DB rows:

```
GET /backtests/{id}/chart-data
-> { candles: Bar[], signals: Marker[], equity: EquityPoint[] }

GET /strategies/runs/{id}/optimization-chart
-> { variants: VariantScatterPoint[] }

GET /live/chart-data?symbol=AAPL&interval=1d
-> { candles: Bar[] }
```

Keep chart data endpoints separate from trade/order list endpoints. Charts need aggregated, time-sorted arrays; tables need paginated records.

---

### Recommended Hosting Setup

| Layer | Service | Notes |
|---|---|---|
| Next.js frontend | **Vercel** (free tier) | Built by the Next.js team — App Router, middleware, and server components all work natively. Zero-config deploys from Git. |
| FastAPI backend | **Render** (existing subscription) | Runs Dockerized Python with persistent processes, env var management, and auto-deploy from Git. No cold-start issues on paid plans. |
| PostgreSQL | **Supabase** (free tier) | Managed Postgres with connection pooling, a dashboard for table inspection, and generous free limits. Render's built-in PostgreSQL addon is a simpler alternative if you want everything in one place. |
| Background workers | **Render** (Background Worker service) | Only needed if signal checks are scheduled (e.g. hourly BTC check). If signals are purely request-driven, skip this entirely. |

**Do not host FastAPI on Vercel.** Vercel is serverless — no persistent processes, no long-running connections, and a 10-second execution timeout on the hobby plan. The quant logic, HMM models, and broker execution require a real Python runtime.

**Your setup:** Vercel (free, Next.js frontend) + Render (existing subscription, FastAPI backend + optional background worker) + Supabase free tier (PostgreSQL). Since you already have a Render subscription, your marginal cost is $0 extra.

---

## V2: Buy Zone, Alerts, Auto-Buy, Themes & Ideas

You are a senior full-stack engineer, quantitative trading systems engineer, FastAPI backend architect, Next.js frontend architect, and product-minded AI engineer working in Claude Code on the **NextGenStock** platform.

### Before Writing Any Code

1. Inspect the existing codebase end-to-end: current architecture, data models, broker integrations (`alpaca_client.py`, `robinhood_client.py`, `factory.py`), alert infrastructure, background jobs, backtesting modules, existing watchlist or strategy features, and the existing Alembic migration chain.
2. Write a short execution plan (bullet points, no more than 20 lines).
3. Execute the plan incrementally — one logical unit at a time.
4. After each major unit, validate locally: run lint, type checks, and any existing tests.
5. Preserve existing architecture, naming conventions, file structure, and auth patterns (`get_current_user` dependency, HTTP-only JWT cookies, per-user data isolation).

---

### Critical Constraints — Read Before Any Implementation

#### No guaranteed profit language
Never use wording such as "guaranteed winner", "no chance of loss", "safe forever", or "certain to go up".

Always use wording such as:
- "historically favorable buy zone"
- "high-probability entry area"
- "confidence score"
- "expected drawdown"
- "scenario-based estimate"
- "positive outcome rate"

Every recommendation must expose: confidence score, expected upside, expected downside, time horizon, major assumptions, and invalidation level.

#### Conservative automation
Auto-buy is optional, disabled by default, and protected by multiple independent risk checks. It must never execute without passing every safeguard listed in Feature C.

#### Extend, don't replace
If any part of this feature already exists in the codebase, inspect it first and extend it rather than rebuilding it. Preserve backwards compatibility.

---

### Integration Points with Existing NextGenStock Code

Before building anything new, check these existing modules for reuse:

| Existing module | What to check | Feature that reuses it |
|---|---|---|
| `broker/factory.py` | `get_broker_client()` | Auto-buy order execution |
| `broker/base.py` | `AbstractBrokerClient.place_order()` | Auto-buy |
| `services/execution_service.py` | Order submission logic | Auto-buy adapter |
| `backtesting/engine.py` | Historical OHLCV access | Buy zone analog scoring |
| `strategies/` | Regime/signal logic | Buy zone trend layer |
| `models/` | Existing ORM base, user_id patterns | All new models |
| `auth/dependencies.py` | `get_current_user` | All new protected endpoints |
| `db/session.py` | Async session | All new services |
| `alembic/` | Migration chain head | All new table migrations |
| `api/` | Router registration in `main.py` | All new API routers |

---

### New Directory Structure

Extend the existing backend structure with these additions only:

```
backend/app/
  api/
    buy_zone.py          # GET /api/stocks/{ticker}/buy-zone etc.
    theme_score.py       # GET /api/stocks/{ticker}/theme-score etc.
    alerts.py            # CRUD for price_alert_rules
    ideas.py             # CRUD for watchlist_ideas
    auto_buy.py          # settings, decision log, dry-run
    opportunities.py     # GET /api/opportunities
  services/
    buy_zone_service.py        # zone calculation orchestrator
    analog_scoring_service.py  # historical pattern matching
    theme_scoring_service.py   # theme alignment scoring
    alert_engine_service.py    # alert evaluation and dispatch
    auto_buy_engine.py         # decision engine + safeguards
    notification_service.py    # abstraction: in-app / email / webhook
  scheduler/
    jobs.py              # APScheduler or existing scheduler jobs
    tasks/
      refresh_buy_zones.py
      refresh_theme_scores.py
      evaluate_alerts.py
      evaluate_auto_buy.py
  models/
    buy_zone.py          # StockBuyZoneSnapshot ORM model
    theme_score.py       # StockThemeScore ORM model
    idea.py              # WatchlistIdea + WatchlistIdeaTicker ORM models
    alert.py             # PriceAlertRule ORM model
    auto_buy.py          # AutoBuySettings + AutoBuyDecisionLog ORM models

frontend/app/
  opportunities/page.tsx       # watchlist + buy zone dashboard
  ideas/page.tsx               # idea / thesis management
  alerts/page.tsx              # alert configuration
  auto-buy/page.tsx            # auto-buy controls and logs
frontend/components/
  buy-zone/
    BuyZoneCard.tsx            # zone range, confidence meter, invalidation
    HistoricalOutcomePanel.tsx # win rate, return distribution
    ThemeScoreBadge.tsx        # theme alignment display
  ideas/
    IdeaForm.tsx
    IdeaList.tsx
  alerts/
    AlertConfigForm.tsx
  auto-buy/
    AutoBuySettings.tsx
    AutoBuyDecisionLog.tsx
```

---

### Feature A — Intelligent Buy Zone Estimator

#### Service: `buy_zone_service.py`

Orchestrates the layered scoring pipeline. Keep it modular so each layer can be replaced independently.

```python
# services/buy_zone_service.py
from dataclasses import dataclass

@dataclass
class BuyZoneResult:
    ticker: str
    current_price: float
    buy_zone_low: float
    buy_zone_high: float
    confidence_score: float          # 0.0 - 1.0
    entry_quality_score: float       # 0.0 - 1.0
    expected_return_30d: float       # percent
    expected_return_90d: float       # percent
    expected_drawdown: float         # percent, negative
    positive_outcome_rate_30d: float # 0.0 - 1.0
    positive_outcome_rate_90d: float # 0.0 - 1.0
    invalidation_price: float
    time_horizon_days: int
    explanation: list[str]           # human-readable reasoning steps
    model_version: str

async def calculate_buy_zone(ticker: str, db: AsyncSession) -> BuyZoneResult:
    """
    Layered pipeline:
    1. Load OHLCV via yfinance (reuse data loader from backtesting/engine.py)
    2. Technical layer: trend, support, ATR bands, RSI, pullback depth
    3. Analog layer: find historical windows with similar feature state
    4. Score forward outcomes: 5 / 20 / 60 / 120 trading day returns
    5. Compute weighted zone and confidence
    6. Persist snapshot to stock_buy_zone_snapshots
    """
    ...
```

#### Calculation pipeline (transparent, testable, no black box)

Use a weighted score built from these layers. Each layer returns a sub-score (0.0–1.0) and one explanation string:

| Layer | Weight | What it measures |
|---|---|---|
| Trend quality | 0.20 | Is the long-term trend intact? |
| Pullback quality | 0.20 | Is the pullback shallow and orderly? |
| Support proximity | 0.20 | How close is price to a key support level? |
| Volatility normalization | 0.10 | Is volatility manageable vs ATR baseline? |
| Historical analog win rate | 0.20 | What did similar past setups produce forward? |
| Expected drawdown penalty | 0.05 | Penalize setups with high historical MAE |
| Theme alignment bonus | 0.05 | Bonus if theme score is elevated |

The buy zone range is derived from ATR-adjusted support bands where the analog scoring shows the best historical reward/risk.

#### Required output fields (persisted per snapshot)

```python
class StockBuyZoneSnapshot(Base):
    __tablename__ = "stock_buy_zone_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None]          # nullable = system-wide snapshot
    ticker: Mapped[str]
    current_price: Mapped[float]
    buy_zone_low: Mapped[float]
    buy_zone_high: Mapped[float]
    confidence_score: Mapped[float]
    entry_quality_score: Mapped[float]
    expected_return_30d: Mapped[float]
    expected_return_90d: Mapped[float]
    expected_drawdown: Mapped[float]
    positive_outcome_rate_30d: Mapped[float]
    positive_outcome_rate_90d: Mapped[float]
    invalidation_price: Mapped[float]
    horizon_days: Mapped[int]
    explanation_json: Mapped[dict]       # list of reasoning strings
    feature_payload_json: Mapped[dict]   # raw inputs for auditability
    model_version: Mapped[str]
    created_at: Mapped[datetime]
```

#### API endpoints

```
GET  /api/stocks/{ticker}/buy-zone
     -> returns latest snapshot or triggers calculation if stale (>1hr)

POST /api/stocks/{ticker}/recalculate-buy-zone
     -> force recalculate, persist new snapshot, return result
```

Both require `Depends(get_current_user)`.

---

### Feature B — Smart Price Alert Engine

#### Service: `alert_engine_service.py`

Evaluates all active `PriceAlertRule` records against current prices. Called by the scheduler every N minutes.

#### Alert types

| Alert type | Trigger condition |
|---|---|
| `entered_buy_zone` | current price moved inside buy_zone_low..buy_zone_high |
| `near_buy_zone` | current price within `proximity_pct` of buy_zone_low |
| `below_invalidation` | current price dropped below invalidation_price |
| `confidence_improved` | confidence_score increased by >= 0.10 since last snapshot |
| `theme_score_increased` | theme_score_total increased by >= 0.15 |
| `macro_deterioration` | theme score dropped sharply or sector tailwind reversed |

#### Notification abstraction

```python
# services/notification_service.py
class NotificationChannel(ABC):
    @abstractmethod
    async def send(self, user_id: int, subject: str, body: str, metadata: dict) -> None: ...

class InAppNotification(NotificationChannel): ...
class EmailNotification(NotificationChannel): ...
class WebhookNotification(NotificationChannel): ...
```

Route notifications through this abstraction so channels can be added without changing alert logic.

#### ORM model

```python
class PriceAlertRule(Base):
    __tablename__ = "price_alert_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int]
    ticker: Mapped[str]
    alert_type: Mapped[str]
    threshold_json: Mapped[dict]         # e.g. {"proximity_pct": 2.0}
    cooldown_minutes: Mapped[int]        # default 60
    market_hours_only: Mapped[bool]      # default True
    enabled: Mapped[bool]               # default True
    last_triggered_at: Mapped[datetime | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

#### API endpoints

```
GET    /api/alerts              -> list user's alert rules
POST   /api/alerts              -> create new alert rule
PATCH  /api/alerts/{id}         -> update rule (enable/disable, threshold)
DELETE /api/alerts/{id}         -> remove rule
```

All scoped by `current_user.id`. Return 403 if rule belongs to another user.

---

### Feature C — Optional Auto-Buy Execution

#### All of the following must pass before any order is submitted

```python
# services/auto_buy_engine.py

SAFEGUARD_CHECKS = [
    "price_inside_buy_zone",
    "confidence_above_threshold",
    "drawdown_within_limit",
    "liquidity_filter",
    "spread_filter",
    "not_near_earnings",        # unless user explicitly allows
    "position_size_limit",
    "daily_risk_budget",
    "no_duplicate_order",
]

@dataclass
class AutoBuyDecision:
    ticker: str
    decision_state: str         # see states below
    reason_codes: list[str]     # which checks passed/failed
    signal_payload: dict        # buy zone snapshot used
    order_payload: dict | None  # filled only if ready_to_buy
    dry_run: bool
```

#### Decision states

```
candidate           -> ticker is tracked, evaluation pending
ready_to_alert      -> in buy zone but auto-buy not enabled
ready_to_buy        -> all safeguards passed, order can be submitted
blocked_by_risk     -> one or more safeguards failed (log which ones)
order_submitted     -> order sent to broker
order_filled        -> confirmed fill received
order_rejected      -> broker rejected
cancelled           -> user cancelled or rule changed
```

#### Settings model

```python
class AutoBuySettings(Base):
    __tablename__ = "auto_buy_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int]
    enabled: Mapped[bool]               # default False — must be explicitly turned on
    paper_mode: Mapped[bool]            # default True
    confidence_threshold: Mapped[float] # default 0.70
    max_trade_amount: Mapped[float]     # hard dollar cap per trade
    max_position_percent: Mapped[float] # max % of portfolio per position
    max_expected_drawdown: Mapped[float]# e.g. -0.10 = block if >10% drawdown expected
    allow_near_earnings: Mapped[bool]   # default False
    allowed_account_ids_json: Mapped[list] # which broker accounts may execute
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

#### Decision log model

```python
class AutoBuyDecisionLog(Base):
    __tablename__ = "auto_buy_decision_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int]
    ticker: Mapped[str]
    decision_state: Mapped[str]
    reason_codes_json: Mapped[list]
    signal_payload_json: Mapped[dict]
    order_payload_json: Mapped[dict | None]
    dry_run: Mapped[bool]
    created_at: Mapped[datetime]
```

#### Broker integration

Reuse `broker/factory.py` -> `get_broker_client(credential)` -> `client.place_order(...)`.
If `paper_mode=True`, call `AlpacaClient(paper=True)` or log a simulated order without hitting the broker.

#### API endpoints

```
GET    /api/auto-buy/settings           -> get user's auto-buy settings
PATCH  /api/auto-buy/settings           -> update settings
GET    /api/auto-buy/decision-log       -> paginated log of all decisions
POST   /api/auto-buy/dry-run/{ticker}   -> simulate full decision pipeline, return result without executing
```

---

### Feature D — Theme / World Trend Scoring Engine

#### Supported themes (initial set)

```python
SUPPORTED_THEMES = [
    "ai",
    "renewable_energy",
    "power_infrastructure",
    "data_centers",
    "space_economy",
    "aerospace",
    "defense",
    "robotics",
    "semiconductors",
    "cybersecurity",
]
```

#### Service: `theme_scoring_service.py`

```python
@dataclass
class ThemeScoreResult:
    ticker: str
    theme_score_total: float            # 0.0 - 1.0
    theme_scores_by_category: dict      # {"ai": 0.85, "semiconductors": 0.60, ...}
    narrative_momentum_score: float
    sector_tailwind_score: float
    macro_alignment_score: float
    user_conviction_score: float        # from idea conviction input
    explanation: list[str]

async def compute_theme_score(ticker: str, user_id: int, db: AsyncSession) -> ThemeScoreResult:
    """
    Blend of:
    1. Sector/industry mapping (SIC or yfinance sector field)
    2. Curated ticker-to-theme tag map (hardcoded starting point, user-editable)
    3. User-assigned themes from watchlist_ideas
    4. News/topic classification if a news pipeline exists
    5. Earnings or guidance keywords if available
    6. Manual analyst notes from idea thesis field
    """
    ...
```

#### ORM model

```python
class StockThemeScore(Base):
    __tablename__ = "stock_theme_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str]
    theme_score_total: Mapped[float]
    theme_scores_json: Mapped[dict]
    narrative_momentum_score: Mapped[float]
    sector_tailwind_score: Mapped[float]
    macro_alignment_score: Mapped[float]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

#### Important behavior
Theme score improves ranking and prioritization but never overrides price/risk controls. A high theme score on a poor technical setup must still block auto-buy.

#### API endpoints

```
GET  /api/stocks/{ticker}/theme-score
POST /api/stocks/{ticker}/theme-score/recompute
```

---

### Feature E — Idea Pipeline and Conviction Watchlist

#### ORM models

```python
class WatchlistIdea(Base):
    __tablename__ = "watchlist_ideas"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int]
    title: Mapped[str]
    thesis: Mapped[str]                 # free-form text
    conviction_score: Mapped[int]       # 1-10 user input
    watch_only: Mapped[bool]           # True = no broker actions allowed
    tradable: Mapped[bool]
    tags_json: Mapped[list]            # list of theme strings
    metadata_json: Mapped[dict]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

class WatchlistIdeaTicker(Base):
    __tablename__ = "watchlist_idea_tickers"

    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int]               # FK -> watchlist_ideas.id
    ticker: Mapped[str]
    is_primary: Mapped[bool]
```

Non-tradable tickers (e.g. "SpaceX when public") can be stored with `tradable=False` and `watch_only=True`. The system skips broker actions for these entries entirely.

#### Auto-ranking logic

Ideas are ranked by a composite:
```
rank_score = (theme_score_total * 0.35)
           + (entry_quality_score * 0.35)
           + (conviction_score / 10 * 0.20)
           + (alert_readiness_bonus * 0.10)
```

#### API endpoints

```
GET    /api/ideas              -> list user's ideas, sorted by rank_score desc
POST   /api/ideas              -> create new idea
PATCH  /api/ideas/{id}         -> update idea
DELETE /api/ideas/{id}         -> delete idea
```

---

### New Database Migrations

Create one Alembic migration file per table. Chain them from the current migration head.

Tables to add:
1. `stock_buy_zone_snapshots`
2. `stock_theme_scores`
3. `watchlist_ideas`
4. `watchlist_idea_tickers`
5. `price_alert_rules`
6. `auto_buy_settings`
7. `auto_buy_decision_logs`

Follow the existing migration style in `alembic/versions/`. Every migration must be reversible (`downgrade` implemented).

---

### Background Scheduler Jobs

If the project already uses APScheduler or Celery, plug into it. Otherwise create `scheduler/jobs.py` with APScheduler.

```python
# scheduler/jobs.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

scheduler.add_job(refresh_buy_zones,    "interval", minutes=60,  id="refresh_buy_zones")
scheduler.add_job(refresh_theme_scores, "interval", minutes=360, id="refresh_theme_scores")
scheduler.add_job(evaluate_alerts,      "interval", minutes=5,   id="evaluate_alerts")
scheduler.add_job(evaluate_auto_buy,    "interval", minutes=5,   id="evaluate_auto_buy")
```

All jobs must be idempotent. Log start, completion, and any errors per run.

---

### New Frontend Pages

Use existing shadcn/ui components. Follow the established layout with fixed left sidebar.

#### `/opportunities` — Watchlist + Buy Zone Dashboard

Table columns: ticker, current price, buy zone range, distance to zone (%), confidence score, theme score, alert status, auto-buy readiness, last updated.

Sorting: highest confidence, closest to zone, highest theme score, best risk/reward.
Filtering: by theme, sector, alert status, auto-buy eligibility.

#### `/ideas` — Idea / Thesis Manager

- Add / edit / delete idea cards
- Thesis text area
- Theme tag multi-select (from `SUPPORTED_THEMES`)
- Linked tickers input
- Watch-only toggle with tooltip: "Watch-only ideas are tracked but never sent to a broker"
- Conviction slider 1-10
- Auto-ranked list sorted by composite rank score

#### `/alerts` — Alert Configuration

Per-ticker and global controls. shadcn/ui `Switch` for enable/disable per rule. Form fields: alert type dropdown, proximity threshold, cooldown window, market hours only toggle.

#### `/auto-buy` — Auto-Buy Controls

Two sections:

**Settings panel:**
- Master enable/disable `Switch` with confirmation `Dialog`: "Enabling auto-buy may result in real orders being placed. Confirm you understand the risks."
- Paper / Live mode toggle
- Per-trade max amount input
- Confidence threshold slider
- Max expected drawdown slider
- Earnings blackout toggle
- Allowed broker accounts multi-select

**Decision log table:**
- Columns: timestamp, ticker, decision state, reason codes, dry run flag
- Badge color per state: green=filled, amber=ready, red=blocked, gray=candidate

#### Stock Detail Page Enhancements

Add a new collapsible section on the existing stock detail page:

```
[ Buy Zone Analysis ]
  Buy Zone: $18.80 – $20.10      Confidence: 74%
  Expected 30d return: +6.2%     Expected drawdown: -8.4%
  90-day positive rate: 68%      Invalidation: $17.40
  Reasoning: [expandable list of explanation strings]

  Theme Alignment: [ThemeScoreBadge per category]
  Alert: [toggle]   Auto-buy eligible: [badge]
```

---

### Explainability Requirements

Every buy zone result must include a human-readable `explanation` array. Examples:

```python
explanation = [
    "Price is within 2.1% of the 200-day moving average support band",
    "RSI at 38 indicates momentum exhaustion without oversold extreme",
    "17 analog setups over 5 years produced +6.8% median 60-day return",
    "Historical max adverse excursion from similar setups: -8.4%",
    "Theme score elevated by AI infrastructure and semiconductor exposure",
    "Auto-buy blocked: earnings date within 3 days",
]
```

Every auto-buy decision log must include `reason_codes` for each safeguard: `PASSED` or `FAILED: <reason>`.

---

### Audit Logging

Log every significant event to `auto_buy_decision_logs` and application logs:
- buy zone calculation trigger and result
- alert evaluation results (triggered / skipped / cooldown)
- auto-buy decision with full safeguard breakdown
- order submission attempt (success or failure)
- dry-run preview results

---

### V2 Testing Requirements

#### Backend unit tests
- `test_buy_zone_service.py` — layer scoring, zone calculation, edge cases (no data, single bar, etc.)
- `test_analog_scoring.py` — historical window matching, forward return computation
- `test_theme_scoring.py` — theme tag mapping, score blending
- `test_alert_engine.py` — each alert type trigger condition, cooldown logic, market hours filter
- `test_auto_buy_engine.py` — each safeguard independently, full pipeline pass, full pipeline block
- `test_auto_buy_api.py` — dry-run endpoint, settings CRUD, log retrieval

#### Integration tests
- price update -> buy zone entry -> alert trigger end-to-end
- dry-run auto-buy with all safeguards passing
- dry-run auto-buy blocked by earnings window
- idea creation -> theme score -> ranking update

Mock `yfinance`, broker clients, and notification channels in all tests.

---

### Language Rules — Enforced Throughout

Search the entire codebase and UI for these banned phrases before marking any feature complete:

| Banned | Replace with |
|---|---|
| "guaranteed profit" | "historically favorable outcome" |
| "no chance of loss" | "lower-risk area based on past data" |
| "safe entry" | "high-probability entry zone" |
| "certain to go up" | "positive outcome rate of X%" |
| "buy now" (as a command) | "entered buy zone" |

Add a linting note or comment in the buy zone service reminding future developers of this constraint.

---

### V2 Acceptance Criteria

The implementation is complete when:

- [ ] User can view a computed buy zone with confidence, upside, downside, and invalidation for any tracked ticker
- [ ] Buy zone explanation strings are displayed in the UI
- [ ] User can create, enable, and disable price alerts per ticker
- [ ] Alert engine evaluates rules on schedule and dispatches notifications
- [ ] User can save idea/thesis entries with theme tags and linked tickers
- [ ] Ideas are auto-ranked by theme + entry quality + conviction
- [ ] Theme scores are computed and displayed per ticker
- [ ] Auto-buy settings can be configured with all safeguards visible
- [ ] Auto-buy dry-run returns full decision breakdown with reason codes
- [ ] Auto-buy is disabled by default and requires explicit user confirmation to enable
- [ ] All new tables have Alembic migrations chained from current head
- [ ] All new endpoints require authentication via `Depends(get_current_user)`
- [ ] All data is scoped by `user_id` — no cross-user access
- [ ] No UI or backend text implies guaranteed profits
- [ ] Unit tests cover buy zone calculation, alert triggers, and all auto-buy safeguards
- [ ] Integration test covers price -> zone -> alert end-to-end

---

### V2 Implementation Order

Follow this sequence to minimize merge conflicts with the existing codebase:

1. Database migrations (all 7 tables)
2. ORM models (all 5 files in `models/`)
3. Pydantic schemas for request/response
4. `buy_zone_service.py` + `analog_scoring_service.py`
5. `theme_scoring_service.py`
6. `alert_engine_service.py` + `notification_service.py`
7. `auto_buy_engine.py`
8. API routers (register in `main.py`)
9. Scheduler jobs
10. Frontend pages and components
11. Tests
12. README update

---

## V3: Watchlist Scanner, Buy Signals & Idea Engine

You are a senior full-stack engineer, quantitative trading systems engineer, FastAPI backend architect, and Next.js frontend architect working in Claude Code on the **NextGenStock** platform.

### Before Writing Any Code

1. Inspect the existing codebase end-to-end: current Opportunities page, Ideas page, alert infrastructure, buy zone service, scheduler jobs, notification service, and existing watchlist models.
2. Write a short execution plan (no more than 20 bullet points).
3. Execute incrementally — one logical unit at a time.
4. Validate locally after each unit: lint, type checks, existing tests.
5. Extend existing modules — do not rebuild what already exists.

---

### What We Are Building

Three connected features that work together:

```
OPPORTUNITIES PAGE
  User adds tickers manually to watchlist
  System runs automated backtest per ticker -> estimated buy zone
  System runs live market scan every 5 min during market hours
  When BOTH backtest zone AND live technicals agree -> fire alert
  Alert shows: buy zone range + single ideal entry price
  Notification: in-app + email, real-time the moment conditions pass

IDEAS PAGE
  System auto-scans news hourly during market hours (no user trigger)
  Sources: Yahoo Finance RSS, free financial news APIs, macro/policy feeds
  System also scans for hot themes (AI, energy, defense, space, semiconductors)
  System also scans broad universe for technically strong setups
  All three run automatically in background
  Output: auto-generated idea cards, ranked by signal strength
  Each card shows: ticker + reason flagged + buy zone + news catalyst +
                   confidence score + historical win rate
  One-click "Add to Watchlist" on every card
```

---

### Critical Rules — Read First

#### Alert quality over quantity
The live scanner must only fire a "buy this now" alert when **ALL** of the following pass. If even one fails, the alert is suppressed entirely — no partial alerts, no "most conditions passed" messages.

#### Conservative scanner definition
Conservative means all three of:
- Stock is in an established uptrend (price above both 50-day AND 200-day MA)
- Multiple confirmation signals agree: RSI + volume + trend regime all aligned
- Entry is near a proven support level — never chasing a breakout

#### Megatrend filter — ideas and scan candidates must align with at least one
Prioritize stocks that fit one or more long-term megatrends:
- **AI** — artificial intelligence, machine learning, GPU compute, data infrastructure
- **Robotics / Humanoids / Autopilot** — industrial robots, humanoid robots, autonomous vehicles, drones
- **Longevity** — biotech, genomics, anti-aging therapeutics, diagnostics, precision medicine

Stocks with no megatrend connection are deprioritized in ranking but never hard-blocked.
Manually added watchlist tickers are never filtered out regardless of megatrend fit.

#### Competitive moat filter — applied during idea generation
Prefer companies that meet at least one of:
- Market share >= 50% within their primary industry or product category
- Difficult to replicate: proprietary IP, switching costs, network effects, regulatory moat
- Very few direct competitors (oligopoly or near-monopoly position)

A `moat_score` (0.0-1.0) is stored per ticker. Score >= 0.70 ranks higher.
Score < 0.30 shows a red badge: "Low competitive moat — higher risk."

#### Financial quality filter — applied during idea generation
Prefer companies that meet the majority of:
- Revenue growth year-over-year (positive)
- Profit growth year-over-year OR strong demand + clear path to profitability
- Improving or stable gross margins
- Good cost control (improving operating leverage)
- If not yet profitable: strong and accelerating revenue growth as a substitute

Source from yfinance `.info`: `revenueGrowth`, `grossMargins`, `operatingMargins`, `earningsGrowth`.
If data unavailable, skip the filter and show "Financials unavailable" on the card.

#### Chart-based entry priority rules — buy price identification
Two chart conditions qualify as high-priority entries and boost the idea score:

**Priority Entry 1: Near 52-week low**
- Trigger: current price is within 10% of the stock's 52-week low
- Badge: amber "Near 52-week low — historically attractive entry area"
- Score boost: +0.15 to `entry_quality_score`
- Only when long-term fundamental thesis (megatrend + moat) is still intact

**Priority Entry 2: Weekly chart support**
- Trigger: price has pulled back to a significant support level on the weekly (1W) chart
- Detection: identify swing lows on weekly timeframe over past 52 weeks;
  flag when current price is within 2x ATR of the most recent weekly support pivot
- Badge: amber "At weekly support — historically favorable entry zone"
- Score boost: +0.10 to `entry_quality_score`

Both can be true simultaneously — boosts are additive (max +0.25 total), capped at 1.0.

#### Approved wording
Never say "guaranteed", "safe", "certain to go up", or "can't lose."
Always say "historically favorable", "high-probability entry zone", "confidence score", "positive outcome rate."

---

### Integration Points — Check Before Building

| Existing module | What to reuse |
|---|---|
| `services/buy_zone_service.py` | `calculate_buy_zone()` — reuse for backtest zone per ticker |
| `services/analog_scoring_service.py` | historical outcome data per ticker |
| `services/theme_scoring_service.py` | theme tags per ticker for idea ranking |
| `services/alert_engine_service.py` | extend with new `BUY_NOW` alert type |
| `services/notification_service.py` | in-app + email channels already abstracted |
| `scheduler/jobs.py` | add new jobs here, don't create a second scheduler |
| `models/alert.py` | extend `PriceAlertRule` or add `BuyNowSignal` model |
| `api/opportunities.py` | extend existing opportunities endpoint |
| `api/ideas.py` | extend existing ideas endpoint |
| `auth/dependencies.py` | `get_current_user` on all new endpoints |

---

### New Directory Structure

Add only these files — do not move or rename existing ones:

```
backend/app/
  services/
    live_scanner_service.py      # real-time technical confirmation engine
    news_scanner_service.py      # hourly news + macro fetch and parse
    idea_generator_service.py    # orchestrates all 3 idea sources
    buy_signal_service.py        # combines backtest zone + live scan -> BUY NOW decision
  scheduler/
    tasks/
      run_live_scanner.py        # every 5 min during market hours
      run_news_scanner.py        # every 60 min during market hours
      run_idea_generator.py      # every 60 min during market hours
  models/
    buy_signal.py                # BuyNowSignal ORM model
    generated_idea.py            # GeneratedIdea ORM model
  api/
    scanner.py                   # GET /api/scanner/status, POST /api/scanner/run-now

frontend/app/
  opportunities/page.tsx         # extend existing page
  ideas/page.tsx                 # extend existing page
frontend/components/
  opportunities/
    WatchlistTable.tsx           # ticker list with buy zone + signal status
    BuyNowBadge.tsx              # green badge when all conditions pass
    EstimatedEntryPanel.tsx      # zone range + ideal entry price display
  ideas/
    GeneratedIdeaCard.tsx        # auto-generated idea card component
    IdeaFeed.tsx                 # scrollable feed of ranked idea cards
    AddToWatchlistButton.tsx     # one-click add from idea card
```

---

### Feature 1 — Opportunities Page: Watchlist + Buy Zone + Live Scanner

#### How the watchlist works

- User manually adds tickers (text input + Add button, no auto-population on this page)
- Each ticker is persisted to existing `watchlist_ideas` or a new `user_watchlist` table
- On add: immediately trigger `calculate_buy_zone(ticker)` in background
- Display a loading state on the row while buy zone calculates

#### Estimated buy price display

Show both:
- **Buy zone range**: `$140.20 – $144.80` (from backtest analog scoring)
- **Ideal entry price**: `$141.50` (ATR midpoint of zone where historical reward/risk is strongest)

UI wording:
```
Estimated entry zone (historically favorable): $140.20 – $144.80
Ideal entry based on backtest: $141.50
This is not a guaranteed price. Based on X similar historical setups.
```

#### The BuyNowSignal model

```python
# models/buy_signal.py
class BuyNowSignal(Base):
    __tablename__ = "buy_now_signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int]
    ticker: Mapped[str]

    # Backtest layer
    buy_zone_low: Mapped[float]
    buy_zone_high: Mapped[float]
    ideal_entry_price: Mapped[float]
    backtest_confidence: Mapped[float]
    backtest_win_rate_90d: Mapped[float]

    # Live technical layer
    current_price: Mapped[float]
    price_in_zone: Mapped[bool]
    above_50d_ma: Mapped[bool]
    above_200d_ma: Mapped[bool]
    rsi_value: Mapped[float]
    rsi_confirms: Mapped[bool]          # RSI between 35-55 (not overbought)
    volume_confirms: Mapped[bool]        # volume declining on pullback
    near_support: Mapped[bool]           # within 1.5x ATR of support level
    trend_regime_bullish: Mapped[bool]   # reuse HMM regime from strategies/

    # Final decision
    all_conditions_pass: Mapped[bool]
    signal_strength: Mapped[str]         # "STRONG_BUY" only when all pass
    suppressed_reason: Mapped[str | None] # which check failed if not firing

    # Metadata
    invalidation_price: Mapped[float]
    expected_drawdown: Mapped[float]
    created_at: Mapped[datetime]
```

#### The ALL CONDITIONS gate — buy signal fires only when every one of these is True

```python
# services/buy_signal_service.py

ALL_CONDITIONS = [
    "price_inside_backtest_buy_zone",       # current price within buy_zone_low..high
    "above_50d_moving_average",             # uptrend condition 1
    "above_200d_moving_average",            # uptrend condition 2
    "rsi_not_overbought",                   # RSI between 30-55 (momentum not exhausted high)
    "volume_declining_on_pullback",         # healthy pullback, not panic selling
    "near_proven_support_level",            # within 1.5x ATR of key support
    "trend_regime_not_bearish",             # HMM regime check from strategies/
    "backtest_confidence_above_threshold",  # confidence_score >= 0.65
    "not_near_earnings",                    # no earnings within 5 trading days
    "no_duplicate_signal_in_cooldown",      # no signal fired for this ticker in last 4 hours
]

async def evaluate_buy_signal(ticker: str, user_id: int, db: AsyncSession) -> BuyNowSignal:
    """
    1. Load latest BuyZoneResult from buy_zone_service (recalculate if >1hr stale)
    2. Fetch live quote: current price, volume, RSI, MAs via yfinance or Alpaca data API
    3. Evaluate each condition independently
    4. If ALL pass: set all_conditions_pass=True, signal_strength="STRONG_BUY"
    5. If any fail: set all_conditions_pass=False, suppressed_reason=<first failed check>
    6. Persist BuyNowSignal regardless of pass/fail (for audit trail)
    7. If all_conditions_pass=True: dispatch notification via notification_service
    """
```

#### Live scanner job

```python
# scheduler/tasks/run_live_scanner.py

async def run_live_scanner():
    """
    Runs every 5 minutes, market hours only (9:30 AM - 4:00 PM ET, weekdays).
    For each ticker in each user's watchlist:
      1. Call evaluate_buy_signal(ticker, user_id)
      2. If all_conditions_pass=True AND no signal fired in last 4 hours:
         -> dispatch in-app notification + email
    Idempotent: cooldown check prevents duplicate alerts.
    """
    if not is_market_hours():
        return
    ...
```

#### Notification content

**In-app notification:**
```
STRONG BUY SIGNAL — AAPL
All conditions confirmed. Historically favorable entry zone: $140.20 – $144.80
Ideal entry: $141.50 | Confidence: 74% | 90-day win rate: 68%
Worst historical drawdown: -8.4% | Invalidation: $136.00
This is based on historical data, not a guarantee.
```

**Email subject:** `NextGenStock: Buy signal triggered for AAPL`
**Email body:** Same content as in-app, plus a link to the Opportunities page.

#### Opportunities page table columns

| Column | Content |
|---|---|
| Ticker | Symbol + company name |
| Current Price | Live quote |
| Buy Zone | `$140.20 – $144.80` |
| Ideal Entry | `$141.50` |
| Distance to Zone | `+2.3%` above / `-1.1%` below (color coded) |
| Confidence | `74%` badge |
| 90d Win Rate | `68%` |
| Signal Status | `STRONG BUY` (green) / `Watching` (gray) / `Not Ready` (conditions that failed) |
| Alert | Toggle on/off per ticker |
| Last Updated | Timestamp |

Sorting: signal status first (STRONG BUY at top), then confidence desc.
Filtering: show only "ready" signals, filter by theme.

#### API endpoints

```
GET  /api/opportunities
     -> list user's watchlist with latest buy zone + signal status per ticker

POST /api/watchlist
     -> add ticker to user's watchlist, trigger background buy zone calculation

DELETE /api/watchlist/{ticker}
     -> remove ticker from watchlist

POST /api/scanner/run-now
     -> manually trigger live scan for all user's watchlist tickers immediately

GET  /api/scanner/status
     -> last scan time, next scheduled scan, how many tickers in queue
```

---

### Feature 2 — Ideas Page: Auto-Generated Idea Feed

#### Three idea sources running automatically every hour during market hours

##### Source 1: News scanner

```python
# services/news_scanner_service.py

NEWS_SOURCES = [
    # Free RSS feeds — no API key required
    "https://feeds.finance.yahoo.com/rss/2.0/headline",   # Yahoo Finance
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",      # WSJ Markets (free)
    "https://rss.cnn.com/rss/money_markets.rss",          # CNN Markets
    # Macro / policy
    "https://feeds.federalreserve.gov/feeds/press_all.xml", # Fed announcements
    "https://www.eia.gov/rss/news.xml",                    # Energy policy
]

async def scan_news() -> list[NewsItem]:
    """
    1. Fetch RSS feeds (use httpx with timeout, fail gracefully per source)
    2. Extract: headline, source, published_at, url, full_text_snippet
    3. Run keyword extraction: find ticker symbols, company names, sector keywords
    4. Match keywords against SUPPORTED_THEMES and known ticker list
    5. Score each item: how many theme keywords + how many tickers mentioned
    6. Return top items sorted by relevance score
    """
```

Fallback: if all RSS feeds fail, skip news source silently and log the error. Do not crash the job.

##### Source 2: Theme scanner

```python
# services/idea_generator_service.py — theme scan

async def scan_by_theme() -> list[IdeaCandidate]:
    """
    For each theme in SUPPORTED_THEMES:
      1. Load tickers tagged with that theme from stock_theme_scores
      2. Filter: theme_score_total >= 0.60
      3. Run buy zone calculation if stale (>4hr)
      4. Filter: entry_quality_score >= 0.55 AND confidence_score >= 0.60
      5. Compute moat_score: use HIGH_MOAT_TICKERS map first,
         fallback to yfinance marketCap + competitor count heuristic
      6. Compute financial_quality_score from yfinance revenueGrowth,
         grossMargins, earningsGrowth, operatingMargins
      7. Check near_52w_low: current_price <= (fiftyTwoWeekLow * 1.10)
      8. Check at_weekly_support: price within 2x ATR of most recent weekly swing low
         (use 1W interval OHLCV, detect pivot lows over past 52 weekly bars)
      9. Return candidates sorted by full idea_score formula
    """
```

##### Source 3: Technical setup scanner

```python
async def scan_technical_universe() -> list[IdeaCandidate]:
    """
    Scan a curated universe of ~200 liquid US stocks (S&P 500 subset + popular ETFs).
    For each:
      1. Check: above 50d AND 200d MA (uptrend filter)
      2. Check: RSI between 35-55 (pullback zone, not overbought)
      3. Check: price within 3% of a support level
      4. Check: volume declining on the pullback (healthy)
    Return tickers where 3 or 4 of the 4 checks pass, sorted by score.
    """

# Curated universe (starting point — expand over time)
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
    # ETFs -- market context only, excluded from idea generation
    "SPY", "QQQ", "IWM", "XLE", "XLK", "XLF",
]

# Excluded from idea generation -- used only for market context
UNIVERSE_CONTEXT_ONLY = ["SPY", "QQQ", "IWM", "XLE", "XLK", "XLF"]

# Pre-seeded moat scores for well-known names
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

#### GeneratedIdea model

```python
# models/generated_idea.py

class GeneratedIdea(Base):
    __tablename__ = "generated_ideas"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str]
    company_name: Mapped[str]

    # Why it was flagged
    source: Mapped[str]             # "news" | "theme" | "technical"
    reason_summary: Mapped[str]     # one sentence: why this was flagged
    news_headline: Mapped[str | None]
    news_url: Mapped[str | None]
    news_source: Mapped[str | None]
    catalyst_type: Mapped[str | None] # "earnings" | "policy" | "sector_rotation" | "technical"

    # Price + zone
    current_price: Mapped[float]
    buy_zone_low: Mapped[float | None]
    buy_zone_high: Mapped[float | None]
    ideal_entry_price: Mapped[float | None]

    # Scores
    confidence_score: Mapped[float]
    historical_win_rate_90d: Mapped[float | None]
    theme_tags: Mapped[list]            # e.g. ["ai", "robotics", "longevity"]
    megatrend_tags: Mapped[list]        # which of AI/Robotics/Longevity apply
    moat_score: Mapped[float]           # 0.0-1.0 competitive moat strength
    moat_description: Mapped[str | None] # e.g. "~80% surgical robot market share"
    financial_quality_score: Mapped[float]   # 0.0-1.0
    financial_flags: Mapped[list]       # ["revenue_growth_positive", "margins_improving"]
    near_52w_low: Mapped[bool]          # within 10% of 52-week low
    at_weekly_support: Mapped[bool]     # at weekly chart support level
    entry_priority: Mapped[str]         # "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD"
    idea_score: Mapped[float]           # composite rank score

    # Lifecycle
    generated_at: Mapped[datetime]
    expires_at: Mapped[datetime]        # ideas expire after 24 hours
    added_to_watchlist: Mapped[bool]    # True once user clicks Add
```

#### Idea card UI

Each auto-generated card shows:

```
+-----------------------------------------------------+
|  NVDA  NVIDIA Corporation
|  [AI] [Semiconductors] [Robotics]       Megatrend fit
|
|  Why flagged: RSI pullback to support near 50d MA.
|               News: "NVIDIA wins $2B data center contract"
|
|  [! Near 52-week low]  or  [! At weekly support]   <- entry priority badge
|
|  Current price: $487.20
|  Estimated entry zone: $472.00 – $485.00
|  Ideal entry: $476.50
|
|  Competitive moat: Strong (85%)
|    "Dominant GPU share for AI training"
|
|  Financial quality: Strong
|    Revenue +122% YoY  |  Margins: improving
|
|  Confidence: 71%    Historical 90d win rate: 66%
|
|  Why flagged: RSI pullback to support near 50d MA.
|               News: "NVIDIA wins $2B data center contract"
|
|  Current price: $487.20
|  Estimated entry zone: $472.00 – $485.00
|  Ideal entry: $476.50
|
|  Confidence: 71%    Historical 90d win rate: 66%
|
|  [ + Add to Watchlist ]                [View Chart]
+-----------------------------------------------------+
```

Cards are sorted by `idea_score` descending. Newest ideas appear at the top within each score tier.

Cards expire and are removed from the feed after 24 hours. A badge shows "Generated X minutes ago."

#### Idea generator job

```python
# scheduler/tasks/run_idea_generator.py

async def run_idea_generator():
    """
    Runs every 60 minutes during market hours (9:30 AM - 4:00 PM ET).
    Steps:
      1. Run news_scanner_service.scan_news()
      2. Run idea_generator_service.scan_by_theme()
      3. Run idea_generator_service.scan_technical_universe()
      4. Deduplicate: if same ticker appears in multiple sources, merge into one card
         with combined reason_summary and highest score
      5. Compute idea_score for each candidate
      6. Persist top 50 ideas to generated_ideas table (replace previous batch)
      7. Expire ideas older than 24 hours
    Idempotent: always replaces the previous batch, never accumulates stale ideas.
    """
```

#### Idea score formula

```python
# Base score
idea_score = (confidence_score          * 0.25)   # backtest + technical confidence
           + (megatrend_fit_score       * 0.20)   # 1.0=AI/Robotics/Longevity, 0.5=other theme, 0.0=none
           + (moat_score               * 0.15)   # competitive moat strength
           + (financial_quality_score  * 0.15)   # revenue/margin/growth quality
           + (technical_setup_score    * 0.15)   # Layer 1 technical score
           + (news_relevance_score     * 0.10)   # news catalyst freshness

# Entry priority boosts (additive, capped at 1.0)
if near_52w_low:        idea_score += 0.15
if at_weekly_support:   idea_score += 0.10
idea_score = min(idea_score, 1.0)
```

#### Add to Watchlist behavior

When user clicks "Add to Watchlist" on an idea card:
1. Add ticker to `user_watchlist`
2. Trigger `calculate_buy_zone(ticker)` in background
3. Create `PriceAlertRule` with type `entered_buy_zone` and `enabled=True` by default
4. Show toast: "NVDA added to watchlist. Alert created for buy zone entry."
5. Mark `generated_idea.added_to_watchlist = True` (card shows a checkmark)

#### API endpoints

```
GET  /api/ideas/generated
     -> list current generated ideas, sorted by idea_score desc
     -> supports filter: ?source=news|theme|technical&theme=ai

POST /api/ideas/generated/{id}/add-to-watchlist
     -> add ticker to watchlist + create alert rule

GET  /api/ideas/generated/last-scan
     -> timestamp of last scan run + count of ideas generated
```

---

### Scheduler Jobs Summary

Add these to `scheduler/jobs.py`. All jobs check `is_market_hours()` before executing:

```python
# Run live scanner every 5 minutes during market hours
scheduler.add_job(
    run_live_scanner,
    "cron",
    day_of_week="mon-fri",
    hour="9-15",
    minute="*/5",
    id="live_scanner"
)

# Run idea generator every 60 minutes during market hours
scheduler.add_job(
    run_idea_generator,
    "cron",
    day_of_week="mon-fri",
    hour="9-15",
    minute="0",
    id="idea_generator"
)
```

```python
# utils/market_hours.py
from datetime import datetime
import pytz

def is_market_hours() -> bool:
    """Returns True if current time is between 9:30 AM and 4:00 PM ET on a weekday."""
    et = pytz.timezone("America/New_York")
    now = datetime.now(et)
    if now.weekday() >= 5:          # Saturday=5, Sunday=6
        return False
    market_open  = now.replace(hour=9,  minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0,  second=0, microsecond=0)
    return market_open <= now <= market_close
```

---

### V3 Database Migrations

Add one Alembic migration per table, chained from current head. Every migration implements `downgrade()`.

1. `user_watchlist` — if not already covered by `watchlist_ideas`
2. `buy_now_signals`
3. `generated_ideas`

---

### Frontend — Opportunities Page Changes

#### New components needed

**`WatchlistTable.tsx`** — main table with all columns listed above. Each row has:
- Inline "Remove" button (trash icon)
- Signal status badge: green `STRONG BUY`, gray `Watching`, amber `Checking...` while scanning
- Expandable row: click to show full explanation strings from `BuyNowSignal`

**`EstimatedEntryPanel.tsx`** — shown in expanded row:
```
Estimated entry zone: $140.20 – $144.80
Ideal entry price:    $141.50
Based on 17 similar historical setups over 5 years.
90-day positive outcome rate: 68%  |  Worst drawdown: -8.4%
Invalidation level: $136.00
```

**`BuyNowBadge.tsx`** — reusable badge:
- Green pulsing dot + "STRONG BUY" when `all_conditions_pass=True`
- Gray "Watching" when signal not ready
- Tooltip on hover: lists all 10 conditions + pass/fail status for each

**Add ticker input** — simple text input + "Add" button at the top of the page. On submit: POST to `/api/watchlist`, show loading spinner on new row.

---

### Frontend — Ideas Page Changes

#### New components needed

**`IdeaFeed.tsx`** — scrollable list of `GeneratedIdeaCard` components. Shows:
- Filter bar: All / News / Theme / Technical tabs
- Theme filter chips: AI, Energy, Defense, Space, Semiconductors
- Last scan timestamp: "Last updated 14 minutes ago"
- Refresh button (triggers `POST /api/scanner/run-now` equivalent for ideas)

**`GeneratedIdeaCard.tsx`** — the card described above. Uses shadcn/ui `Card` component.

**`AddToWatchlistButton.tsx`** — shows "Added" state after click, disabled to prevent double-add.

---

### V3 Testing Requirements

#### Backend unit tests
- `test_buy_signal_service.py` — each of the 10 conditions independently, all-pass scenario, single-fail suppression
- `test_live_scanner.py` — market hours check, cooldown logic, duplicate prevention
- `test_news_scanner.py` — RSS feed parsing, ticker extraction, graceful failure on bad feed
- `test_idea_generator.py` — deduplication logic, idea scoring, expiry logic
- `test_technical_scanner.py` — uptrend filter, RSI check, support proximity check
- `test_megatrend_filter.py` — megatrend tag assignment, fit score (1.0 / 0.5 / 0.0)
- `test_moat_scoring.py` — HIGH_MOAT_TICKERS seed lookup, fallback heuristic
- `test_financial_quality.py` — yfinance field parsing, missing data handling, score output
- `test_entry_priority.py` — 52-week low detection, weekly support detection, additive boost

#### Integration tests
- ticker added to watchlist -> buy zone calculated -> signal evaluated -> alert dispatched
- idea card "Add to Watchlist" -> watchlist entry created -> alert rule created -> toast shown
- news scan returns result -> ticker extracted -> idea card generated with news headline

Mock `yfinance`, RSS feeds, notification service, and Alpaca data API in all tests.

---

### V3 Acceptance Criteria

- [ ] User can manually add tickers to watchlist on Opportunities page
- [ ] Each watchlist ticker shows estimated buy zone range + ideal entry price
- [ ] Live scanner runs every 5 minutes during market hours
- [ ] "STRONG BUY" signal fires only when ALL 10 conditions pass — never partial
- [ ] In-app notification dispatched immediately when signal fires
- [ ] Email notification dispatched with ticker, zone, confidence, and link
- [ ] 4-hour cooldown prevents duplicate alerts for the same ticker
- [ ] Ideas page auto-generates cards every 60 minutes during market hours
- [ ] Cards show: ticker, reason flagged, buy zone, news headline, confidence, win rate
- [ ] One-click "Add to Watchlist" from idea card creates watchlist entry + alert rule
- [ ] News scan uses free RSS feeds only — no paid API keys required
- [ ] Ideas expire after 24 hours and are removed from the feed
- [ ] All scanner jobs only run during market hours (9:30 AM - 4:00 PM ET, weekdays)
- [ ] All endpoints require `Depends(get_current_user)` and are scoped by `user_id`
- [ ] No UI or backend text implies guaranteed profits
- [ ] Ideas ranked by megatrend fit -- AI/Robotics/Longevity score 1.0, other themes 0.5
- [ ] Moat score on every idea card with green/gray/red badge
- [ ] Financial quality badge shown; "Financials unavailable" when yfinance data missing
- [ ] Stocks within 10% of 52-week low show amber "Near 52-week low" badge + +0.15 boost
- [ ] Stocks at weekly chart support show amber "At weekly support" badge + +0.10 boost
- [ ] Both entry priority badges apply simultaneously when both conditions are true
- [ ] HIGH_MOAT_TICKERS seeds moat scores for NVDA, ISRG, ASML, ILMN, TSM, LLY, NVO, V, MA
- [ ] SCAN_UNIVERSE includes LLY, NVO, CRSP, ILMN (longevity) and ISRG, TSLA, RKLB (robotics)
- [ ] ETFs excluded from idea generation (context-only list)

---

### V3 Implementation Order

1. `utils/market_hours.py`
2. Alembic migrations: `buy_now_signals`, `generated_ideas`
3. ORM models: `buy_signal.py`, `generated_idea.py`
4. Pydantic schemas for all new models
5. `news_scanner_service.py` (RSS fetch + ticker extraction)
5b. `moat_scoring_service.py` (HIGH_MOAT_TICKERS seed + yfinance fallback heuristic)
5c. `financial_quality_service.py` (yfinance .info field parsing + quality score)
5d. `entry_priority_service.py` (52-week low check + weekly support on 1W OHLCV)
6. `buy_signal_service.py` (10-condition gate, reusing existing buy zone service)
7. `idea_generator_service.py` (orchestrates all 3 sources + deduplication)
8. `live_scanner_service.py` (wraps buy_signal_service for batch watchlist evaluation)
9. Scheduler jobs: `run_live_scanner`, `run_idea_generator` (register in `scheduler/jobs.py`)
10. API endpoints: extend `opportunities.py`, extend `ideas.py`, add `scanner.py`
11. Frontend: `WatchlistTable`, `EstimatedEntryPanel`, `BuyNowBadge` on Opportunities page
12. Frontend: `GeneratedIdeaCard`, `IdeaFeed`, `AddToWatchlistButton` on Ideas page
13. Notification wiring: connect buy signal -> `notification_service.py` in-app + email
14. Tests
15. README update

---

## Screener & Technical Analysis

You are a senior full-stack engineer, frontend architect, and trading app product engineer working in Claude Code.

Before making any code changes:
1. Inspect the existing project/codebase and understand:
   - frontend stack
   - routing structure
   - component library
   - API/data layer
   - current trading/investing pages
   - styling patterns
   - how MCP tools are already configured or accessed
2. Create a short execution plan.
3. Then execute the plan.
4. Validate the implementation locally as much as possible.

### Objective

Create a dedicated page in the application for:

- **TradingView Screener** = find interesting assets
- **TradingView TA** = analyze a selected asset technically

This page should help a user:
1. scan for promising assets using screener results
2. click/select an asset
3. immediately view technical analysis for that asset
4. review the setup in a clean, decision-friendly UI

---

### Core Requirements

Build **one dedicated page** focused only on these two MCP integrations.

#### Primary workflow
1. User opens the page
2. User selects a market/universe and screener inputs
3. App uses **TradingView Screener MCP** to fetch interesting assets
4. Results are shown in a sortable/filterable list
5. User clicks one asset
6. App uses **TradingView TA MCP** to analyze that asset
7. TA results are shown in a detailed analysis panel

---

### MCP Tools

#### 1. TradingView Screener MCP
Use this to:
- find interesting assets
- fetch screener results
- support filters such as:
  - market or exchange
  - asset type
  - sector if available
  - price range
  - volume
  - relative strength / momentum signals if available
  - change %
  - 52-week position if available

Goal:
Return a useful shortlist of opportunities rather than dumping raw data.

#### 2. TradingView TA MCP
Use this to:
- analyze a selected symbol
- fetch technical summary / recommendation
- fetch indicator values if available
- support timeframe analysis such as:
  - 1D
  - 4H
  - 1H
  - 15m

Goal:
Show an easy-to-read technical view for the selected asset.

---

### Page Requirements

Create a page with the following layout:

#### A. Header section
- Page title
- Short description:
  - Screener finds candidates
  - TA analyzes the selected candidate
- Refresh button
- Last updated timestamp

#### B. Screener controls panel
Include controls for:
- market / asset universe
- exchange if applicable
- search text
- minimum price
- maximum price
- minimum volume
- top N results
- optional sort field
- optional sort direction

If the MCP server supports additional screener filters discovered during inspection, expose them cleanly.

#### C. Screener results section
Display results in a clean table or card list with columns like:
- symbol
- name
- exchange
- price
- change %
- volume
- any other useful available screener metrics

Requirements:
- sortable where practical
- selectable row/card
- selected asset visibly highlighted
- loading state
- empty state
- error state

#### D. Technical analysis panel
When an asset is selected, show:
- symbol / name
- timeframe selector
- overall recommendation
- buy / neutral / sell breakdown if available
- indicator summary if available
- key indicators such as RSI, MACD, moving averages, etc. if provided by the MCP
- trend summary in plain language

#### E. Analyst summary section
Add a small computed summary block that explains:
- why the asset appeared in screener results
- what the TA currently suggests
- whether the setup looks bullish, bearish, or mixed

This summary must be conservative and descriptive.
Do not make guarantees.
Do not present this as financial advice.

---

### UX Requirements

- Follow the existing app design system exactly
- Reuse existing layout/components where possible
- Keep the page responsive and desktop-first but mobile-friendly
- Prefer a two-column layout on desktop:
  - left = screener results
  - right = TA detail
- On smaller screens, stack sections vertically
- Make loading and error states polished and readable

---

### Technical Requirements

- Use the existing project stack and patterns
- Do not introduce unnecessary new libraries
- Keep code modular and production-ready
- Separate:
  - page container
  - screener controls
  - screener results list/table
  - technical analysis panel
  - summary panel
- Add strong typing if the project uses TypeScript
- Create helper types/interfaces for screener results and TA results
- Normalize inconsistent MCP responses into frontend-friendly models
- Handle missing/null fields safely

---

### Data / Integration Requirements

#### Screener integration
- Connect the page to the **TradingView Screener MCP**
- Inspect the available MCP methods first
- Use the most appropriate method(s) for listing/filtering assets
- Transform raw results into a normalized UI model

#### TA integration
- Connect the page to the **TradingView TA MCP**
- Inspect the available MCP methods first
- Use the most appropriate method(s) for symbol technical analysis
- Support at least one default timeframe and allow switching if supported

#### Important
Do not invent MCP method names.
First inspect how the MCP servers are exposed in this environment, then wire the implementation to the actual available methods.

---

### Safety / Product Guardrails

- This page is for research and decision support
- Add a visible disclaimer such as:
  - "Technical analysis is informational only and not financial advice."
- Avoid language like:
  - guaranteed winner
  - best stock to buy now
  - certain profit
- If data is unavailable, explain that clearly instead of guessing

---

### Deliverables

Implement all needed code for:
1. the page
2. supporting components
3. any required hooks/services/helpers
4. routing integration
5. basic loading/error/empty states

Also provide:
- a short summary of what was added
- where the files were created/updated
- how the page works
- any assumptions made about the MCP tool responses

---

### Suggested Page Behavior

#### Default behavior
On first load:
- show screener controls with sensible defaults
- optionally auto-run one default screener query
- no TA panel until a symbol is selected, or auto-select the first result if that fits the current UX

#### On result click
- load TA for that symbol
- show spinner in TA panel
- preserve selected row state

#### On timeframe change
- reload TA for the selected symbol
- update recommendation and indicators

---

### Optional Nice-to-Have Improvements
Only do these if they fit naturally into the existing project:
- save last used screener filters in local storage
- favorite/watchlist toggle if the app already has that concept
- quick action buttons like:
  - analyze first result
  - refresh analysis
- compare 2-3 timeframes in a compact view

Do not add large new platform features outside the scope of this page.

---

### Implementation Notes

- Prefer clarity over overengineering
- Keep the code easy to extend later
- Match the project's current naming/style conventions exactly
- Reuse any shared table, card, badge, tabs, or form components that already exist

---

### Final Output Format

At the end, provide:
1. execution plan
2. files changed
3. implementation summary
4. assumptions
5. validation notes

---

## Bitcoin & Crypto Theme

1. The Core Engine (HMM Logic):
Use hmmlearn.GaussianHMM with 7 components to detect market regimes.
Train on 3 features: Returns, Range (High-Low/Close), and Volume Volatility.
Crucial: Automatically identify the 'Bull Run' state (highest positive return) and the 'Bear/Crash' state (lowest return).

2. The Strategy Logic: Implement a voting system with 8 Confirmations. We only enter a trade if the HMM Regime is Bullish AND at least 7 out of 8 of these conditions are met:
RSI < 90
Momentum > 1%
Volatility < 6%
Volume > 20-period SMA
ADX > 25
Price > EMA 50
Price > EMA 200
MACD > Signal Line

3. Risk Management Rules:
Cooldown: Enforce a hard 48-hour cooldown after ANY exit. The bot cannot re-enter for 48 hours to avoid chop.
Exit Rule: Close position immediately if the Regime flips to 'Bear' or 'Crash'
Leverage: Simulate 2.5x Leverage on the PnL calculation

4. The Architecture:
data_loader.py: Fetch 'BTC-USD' or any other stocks specify hourly data (last 730 days) using yfinance.
backtester.py: Run the simulation with $10k starting capital. Log every trade.
app.py: A Streamlit Dashboard.
Top Section: Show Current Signal (Long/Cash) and Detected Regime.
Chart: An interactive Plotly candlestick chart where the background color changes based on the detected Regime (Green for Bull, Red for Bear).
Metrics: Display Total Return, Alpha vs Buy & Hold, Win Rate, and Max Drawdown
