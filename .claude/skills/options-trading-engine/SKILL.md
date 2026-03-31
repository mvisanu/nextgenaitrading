---
name: options-trading-engine
description: Use this skill whenever the user wants to build, extend, research, or automate options trading features inside NextGenStock or any FastAPI + Next.js full-stack trading platform. Triggers include any mention of options chains, covered calls, cash-secured puts, vertical spreads, iron condors, butterflies, naked options, directional plays, IV rank, IV percentile, Greeks (delta, theta, gamma, vega), options screeners, options P&L modeling, options execution automation, multi-broker options abstraction (Alpaca, Tastytrade, TDAmeritrade/Schwab), or any request to generate Claude Code prompt files for options features. Also trigger for phrases like "add options to NextGenStock", "build an options scanner", "automate options trades", "options signal engine", or "options dashboard".
---

# Options Trading Engine Skill

## Purpose

This skill governs how Claude builds and extends a fully automated options trading engine inside a FastAPI + Next.js full-stack platform (NextGenStock). It covers:

- Generating production-ready Claude Code prompt files for each engine component
- Designing backend (FastAPI/Python) and frontend (Next.js) implementations
- Multi-broker abstraction (Alpaca, Tastytrade, TDAmeritrade/Schwab) mirroring the existing stock engine pattern
- Options chain scanning, Greeks computation, IV analysis, P&L/risk modeling, and signal-driven automated execution

---

## Core principles

- Follow the same abstract base + broker implementation pattern already established in NextGenStock's stock buy engine
- Never hardcode broker-specific logic into shared modules — always route through the abstraction layer
- Options data is more complex than equities: always validate expiration, strike, bid/ask spread, and open interest before acting
- Greeks are live values — always recalculate from real-time data, never cache stale Greeks for execution decisions
- IV rank and IV percentile are primary signal drivers — always compute from rolling 52-week IV history
- Earnings and events calendar must act as a gate, not just a label — block or flag trades within configurable windows
- P&L and risk modeling must happen before any order is submitted, not after
- Multi-leg strategies (spreads, condors, butterflies) must be submitted as a single combo order where the broker supports it
- This skill covers engineering and automation only — not financial advice

---

## Architecture overview

```
NextGenStock Options Engine
│
├── Backend (FastAPI / Python)
│   ├── options/
│   │   ├── broker/
│   │   │   ├── base.py               ← Abstract broker interface
│   │   │   ├── alpaca.py             ← Alpaca options impl
│   │   │   ├── tastytrade.py         ← Tastytrade impl
│   │   │   └── tdameritrade.py       ← TDA/Schwab impl
│   │   ├── scanner.py                ← Options chain screener
│   │   ├── greeks.py                 ← Greeks computation (py_vollib / mibian)
│   │   ├── iv.py                     ← IV rank / IV percentile engine
│   │   ├── signals.py                ← Entry/exit signal logic
│   │   ├── risk.py                   ← P&L and risk modeling
│   │   ├── calendar.py               ← Earnings / events gate
│   │   ├── executor.py               ← Order execution orchestrator
│   │   └── router.py                 ← FastAPI route definitions
│
└── Frontend (Next.js)
    ├── app/options/
    │   ├── scanner/page.tsx           ← Options chain scanner UI
    │   ├── greeks/page.tsx            ← Greeks dashboard
    │   ├── risk/page.tsx              ← P&L / risk modeling UI
    │   └── signals/page.tsx           ← Live signal feed + approval queue
    └── components/options/
        ├── OptionsChainTable.tsx
        ├── GreeksDashboard.tsx
        ├── PLChart.tsx
        └── SignalCard.tsx
```

---

## Workflow: generating Claude Code prompt files

When the user asks to build any options feature, follow this workflow:

### Step 1 — Identify the component
Map the user request to one or more components:
- Options chain scanner/screener
- Greeks dashboard
- IV rank / IV percentile engine
- Entry/exit signal logic
- P&L and risk modeling
- Earnings/events calendar gate
- Automated execution engine
- Multi-broker abstraction layer
- Frontend dashboard (any of the above)

### Step 2 — Confirm scope before writing
State exactly what the Claude Code prompt file will cover, what files it will create or modify, and what it assumes already exists. Get confirmation if scope is ambiguous.

### Step 3 — Generate the Claude Code prompt file
Follow the Claude Code prompt file format (see section below). Always include:
- Context block (what already exists in NextGenStock)
- Objective
- File list with paths
- Implementation requirements per file
- Acceptance criteria
- Test cases

### Step 4 — Validate the prompt file
Before delivering, check:
- No broker logic bleeds into shared modules
- Greeks are computed from live data
- IV rank uses 52-week rolling window
- Multi-leg orders use combo order submission
- Earnings gate is applied before signal generation
- P&L model runs before execution

---

## Multi-broker abstraction layer

Mirror the pattern from NextGenStock's stock buy engine exactly.

### Abstract base interface (`options/broker/base.py`)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from datetime import date

@dataclass
class OptionContract:
    symbol: str
    expiration: date
    strike: float
    option_type: str          # "call" or "put"
    bid: float
    ask: float
    mid: float
    volume: int
    open_interest: int
    implied_volatility: float
    delta: float
    gamma: float
    theta: float
    vega: float

@dataclass
class OptionsOrderRequest:
    strategy: str             # "covered_call", "csp", "bull_put", "bear_call", "iron_condor", "butterfly", "naked_call", "naked_put"
    underlying: str
    legs: list[dict]          # each leg: {contract, action, quantity}
    order_type: str           # "limit", "market"
    limit_credit: Optional[float]
    limit_debit: Optional[float]

@dataclass
class OptionsOrderResult:
    order_id: str
    status: str
    fill_price: Optional[float]
    broker: str

class OptionsbrokerBase(ABC):

    @abstractmethod
    async def get_options_chain(self, symbol: str, expiration: date) -> list[OptionContract]:
        ...

    @abstractmethod
    async def get_expirations(self, symbol: str) -> list[date]:
        ...

    @abstractmethod
    async def submit_order(self, request: OptionsOrderRequest) -> OptionsOrderResult:
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        ...

    @abstractmethod
    async def get_order_status(self, order_id: str) -> OptionsOrderResult:
        ...

    @abstractmethod
    async def get_positions(self) -> list[dict]:
        ...
```

### Broker registry pattern

```python
# options/broker/__init__.py
from .alpaca import AlpacaOptionsBroker
from .tastytrade import TastytradeOptionsBroker
from .tdameritrade import TDAOptionsbroker

BROKER_REGISTRY = {
    "alpaca": AlpacaOptionsBroker,
    "tastytrade": TastytradeOptionsBroker,
    "tdameritrade": TDAOptionsbroker,
}

def get_options_broker(name: str) -> OptionsbrokerBase:
    cls = BROKER_REGISTRY.get(name)
    if not cls:
        raise ValueError(f"Unknown options broker: {name}")
    return cls()
```

---

## Greeks computation

Use `py_vollib` as primary library, `mibian` as fallback.

### Required Greeks fields

| Greek | Symbol | Meaning | Execution use |
|---|---|---|---|
| Delta | Δ | Price sensitivity to underlying move | Entry targeting (e.g. 0.30 delta CSP) |
| Gamma | Γ | Rate of delta change | Risk management — avoid high gamma near expiry |
| Theta | Θ | Time decay per day | Income strategy core metric |
| Vega | ν | Sensitivity to IV change | IV crush plays, earnings strategies |
| IV | σ | Implied volatility | IV rank / percentile gate |

### Greeks calculation rules
- Always compute from live bid/ask mid price, not last price
- Use risk-free rate from current T-bill yield (fetch from FRED or hardcode refreshable config)
- Recalculate Greeks on every scanner run — never persist stale Greeks to the execution path
- Flag contracts where bid/ask spread > 10% of mid as illiquid — do not auto-execute these

---

## IV rank and IV percentile engine

```python
# options/iv.py

def compute_iv_rank(current_iv: float, iv_history_52w: list[float]) -> float:
    """
    IV Rank = (current_iv - 52w_low) / (52w_high - 52w_low) * 100
    Range: 0–100. >50 = elevated IV, good for premium selling.
    """
    low = min(iv_history_52w)
    high = max(iv_history_52w)
    if high == low:
        return 0.0
    return round((current_iv - low) / (high - low) * 100, 2)

def compute_iv_percentile(current_iv: float, iv_history_52w: list[float]) -> float:
    """
    IV Percentile = % of days in past year where IV was BELOW current IV.
    Range: 0–100. >50 = IV higher than usual.
    """
    below = sum(1 for iv in iv_history_52w if iv < current_iv)
    return round(below / len(iv_history_52w) * 100, 2)
```

### IV signal thresholds (configurable defaults)

| Signal | IV Rank | IV Percentile | Strategy bias |
|---|---|---|---|
| High IV — sell premium | > 50 | > 50 | CSP, covered call, iron condor |
| Low IV — buy premium | < 30 | < 30 | Long calls/puts, debit spreads |
| Neutral | 30–50 | 30–50 | Defined risk spreads |

---

## Entry/exit signal logic

### Signal input matrix

All four inputs must be evaluated before any signal is generated:

| Input | Source | Gate type |
|---|---|---|
| IV rank / IV percentile | `iv.py` | Threshold filter |
| Underlying price action | TA library (same as stock engine) | Trend/momentum confirmation |
| Earnings / events calendar | `calendar.py` | Hard block or flag |
| Delta / theta thresholds | `greeks.py` | Contract selection filter |

### Signal generation rules

```python
# options/signals.py

@dataclass
class OptionsSignal:
    symbol: str
    strategy: str
    contract_legs: list[OptionContract]
    confidence: float           # 0.0–1.0
    iv_rank: float
    iv_percentile: float
    underlying_trend: str       # "bullish", "bearish", "neutral"
    days_to_earnings: Optional[int]
    signal_time: datetime
    blocked: bool
    block_reason: Optional[str]

def evaluate_signal(
    symbol: str,
    chain: list[OptionContract],
    iv_rank: float,
    iv_pct: float,
    underlying_trend: str,
    days_to_earnings: Optional[int],
    config: SignalConfig,
) -> OptionsSignal:
    # 1. Check earnings gate first — hard block if within window
    if days_to_earnings is not None and days_to_earnings <= config.earnings_block_days:
        return blocked_signal(symbol, f"Earnings in {days_to_earnings} days")

    # 2. Check IV gate
    if iv_rank < config.min_iv_rank:
        return blocked_signal(symbol, f"IV rank {iv_rank} below threshold {config.min_iv_rank}")

    # 3. Select strategy based on IV + trend
    strategy = select_strategy(iv_rank, iv_pct, underlying_trend, config)

    # 4. Select contracts matching delta/theta thresholds
    legs = select_contracts(chain, strategy, config)
    if not legs:
        return blocked_signal(symbol, "No contracts matched delta/theta thresholds")

    return OptionsSignal(
        symbol=symbol,
        strategy=strategy,
        contract_legs=legs,
        confidence=compute_confidence(iv_rank, iv_pct, underlying_trend),
        iv_rank=iv_rank,
        iv_percentile=iv_pct,
        underlying_trend=underlying_trend,
        days_to_earnings=days_to_earnings,
        signal_time=datetime.utcnow(),
        blocked=False,
        block_reason=None,
    )
```

### Strategy selection matrix

| Underlying trend | IV rank | Strategy |
|---|---|---|
| Bullish | High (>50) | Cash-secured put or bull put spread |
| Bearish | High (>50) | Covered call or bear call spread |
| Neutral | High (>50) | Iron condor or iron butterfly |
| Bullish | Low (<30) | Long call or bull call debit spread |
| Bearish | Low (<30) | Long put or bear put debit spread |
| Neutral | Low (<30) | Long straddle / strangle |

---

## P&L and risk modeling

Run before every order submission.

### Required model outputs

```python
@dataclass
class OptionsRiskModel:
    max_profit: float
    max_loss: float
    breakeven_prices: list[float]
    profit_at_expiry: dict[float, float]   # underlying price → P&L
    probability_of_profit: float            # derived from delta
    risk_reward_ratio: float
    theta_per_day: float
    days_to_expiry: int
    margin_required: float
    passes_risk_gate: bool
    risk_gate_failures: list[str]
```

### Risk gate rules (configurable defaults)

- `max_loss` must not exceed `config.max_single_trade_loss` (default: $500)
- `risk_reward_ratio` must be >= `config.min_risk_reward` (default: 1:2 for debit, 1:3 for credit)
- `probability_of_profit` must be >= `config.min_pop` (default: 60%)
- `margin_required` must not exceed `config.max_margin_per_trade` (default: 20% of account)
- If any gate fails: block execution, log failure reasons, surface in frontend signal queue

---

## Earnings / events calendar gate

```python
# options/calendar.py

async def get_days_to_earnings(symbol: str) -> Optional[int]:
    """
    Returns number of calendar days until next earnings event.
    Returns None if no upcoming earnings found within 60 days.
    Data source priority: broker API → financial data API → internal cache.
    """
    ...

# Default blocking rules
EARNINGS_BLOCK_DAYS = 5       # block new entries within 5 days of earnings
EARNINGS_EXIT_DAYS = 3        # flag existing positions within 3 days of earnings
```

---

## Automated execution engine

Mirrors the stock buy engine pattern exactly.

```python
# options/executor.py

class OptionsExecutor:
    def __init__(self, broker: OptionsbrokerBase, risk_engine, signal_engine):
        self.broker = broker
        self.risk = risk_engine
        self.signals = signal_engine

    async def run_cycle(self, symbols: list[str]) -> list[ExecutionResult]:
        results = []
        for symbol in symbols:
            signal = await self.signals.evaluate(symbol)
            if signal.blocked:
                results.append(ExecutionResult.skipped(symbol, signal.block_reason))
                continue

            risk = self.risk.model(signal)
            if not risk.passes_risk_gate:
                results.append(ExecutionResult.blocked(symbol, risk.risk_gate_failures))
                continue

            order = build_order(signal)
            result = await self.broker.submit_order(order)
            results.append(ExecutionResult.from_order(result))

        return results
```

### Execution cycle scheduling

- Run scanner every N minutes (configurable, default: 5 min during market hours)
- Execution cycle runs only during regular market hours (9:30–16:00 ET)
- No new positions 30 minutes before market close
- Post-execution: log all results to Supabase `options_executions` table

---

## Claude Code prompt file format

When generating Claude Code prompt files for options features, always use this structure:

```markdown
# Claude Code Prompt: [Component Name]

## Context
- Project: NextGenStock (FastAPI + Next.js + Supabase)
- Existing: [list what already exists that this builds on]
- Broker pattern: abstract base + broker impls (same as stock engine)

## Objective
[One paragraph describing exactly what this prompt file builds]

## Files to create or modify

### New files
- `backend/options/[file].py` — [purpose]
- `frontend/app/options/[page]/page.tsx` — [purpose]

### Modified files
- `[existing file]` — [what changes]

## Implementation requirements

### [filename]
- [requirement 1]
- [requirement 2]
- ...

## Supabase schema changes
[Any new tables or columns needed]

## Environment variables required
[Any new env vars]

## Acceptance criteria
- [ ] [criterion 1]
- [ ] [criterion 2]

## Test cases
- [test case 1]
- [test case 2]
```

---

## Frontend component patterns

### Options chain table (`OptionsChainTable.tsx`)
- Display calls and puts side by side (standard chain layout)
- Highlight ITM contracts with distinct background
- Color-code delta: green (bullish), red (bearish), gray (neutral)
- IV column shows both raw IV% and IV rank badge
- Sortable by strike, volume, OI, IV, delta
- Filter controls: expiration picker, strike range, delta range, min OI

### Greeks dashboard (`GreeksDashboard.tsx`)
- Position-level Greeks: aggregate delta, gamma, theta, vega for entire portfolio
- Per-position Greeks breakdown table
- Theta decay chart: P&L vs days remaining to expiry
- Vega exposure chart: P&L vs ±10% IV move
- Color thresholds: theta > $50/day = green, < $10/day = yellow, negative = red

### P&L chart (`PLChart.tsx`)
- Expiry P&L diagram (standard options payoff diagram)
- X-axis: underlying price range (±20% of current price)
- Y-axis: P&L in dollars
- Breakeven lines as vertical dashed markers
- Current underlying price marker
- Show max profit and max loss as labeled horizontal lines

### Signal card (`SignalCard.tsx`)
- Shows: symbol, strategy, IV rank, IV percentile, underlying trend, days to earnings, confidence score
- Action buttons: Approve (execute now), Skip, View chain
- Blocked signals shown in gray with block reason badge
- Risk model summary: max profit / max loss / POP / breakeven(s)

---

## Supported strategies — implementation specs

### Covered call
- Long 100 shares + short 1 OTM call
- Target delta: 0.20–0.35 on the short call
- Exit: buy back call at 50% max profit or roll at 21 DTE

### Cash-secured put (CSP)
- Short 1 OTM put, cash secured
- Target delta: 0.20–0.30 on the short put
- IV rank gate: > 30 minimum
- Exit: buy back at 50% max profit or roll at 21 DTE

### Bull put spread
- Sell higher strike put, buy lower strike put (same expiration)
- Net credit strategy
- Width: 5–10 points depending on underlying price
- Max loss = width - credit received

### Bear call spread
- Sell lower strike call, buy higher strike call (same expiration)
- Net credit strategy
- Same width rules as bull put

### Iron condor
- Bull put spread + bear call spread simultaneously
- Short strikes: 1 SD OTM (approx delta 0.16)
- Target IV rank > 50
- Exit: 50% max profit or 200% max loss

### Iron butterfly
- Short ATM call + short ATM put + long OTM wings
- Higher credit than condor, narrower profit zone
- Best in very high IV environments (IV rank > 60)

### Naked call / naked put
- Single short option, no hedge
- Requires elevated margin — check `margin_required` against account limit
- Restricted to high-probability setups: delta ≤ 0.15
- Only available if broker account level permits

---

## Supabase schema

```sql
-- Options positions
create table options_positions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  strategy text not null,
  legs jsonb not null,
  broker text not null,
  order_id text,
  status text default 'open',
  entry_credit float,
  entry_debit float,
  max_profit float,
  max_loss float,
  breakeven_prices float[],
  probability_of_profit float,
  iv_rank_at_entry float,
  days_to_expiry_at_entry int,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  realized_pnl float,
  notes text
);

-- Options executions log
create table options_executions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  signal jsonb not null,
  risk_model jsonb not null,
  order_request jsonb not null,
  order_result jsonb,
  executed_at timestamptz default now(),
  status text,
  block_reason text
);

-- IV history (for IV rank / percentile computation)
create table iv_history (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  date date not null,
  iv float not null,
  unique(symbol, date)
);
```

---

## Environment variables

```env
# Broker credentials
ALPACA_OPTIONS_KEY=
ALPACA_OPTIONS_SECRET=
ALPACA_OPTIONS_BASE_URL=https://paper-api.alpaca.markets  # or live

TASTYTRADE_USERNAME=
TASTYTRADE_PASSWORD=
TASTYTRADE_BASE_URL=https://api.tastyworks.com

TDAMERITRADE_CLIENT_ID=
TDAMERITRADE_REDIRECT_URI=
TDAMERITRADE_REFRESH_TOKEN=

# Options engine config
OPTIONS_SCANNER_INTERVAL_SECONDS=300
OPTIONS_EARNINGS_BLOCK_DAYS=5
OPTIONS_MIN_IV_RANK=30
OPTIONS_MAX_SINGLE_TRADE_LOSS=500
OPTIONS_MIN_POP=0.60
OPTIONS_ACTIVE_BROKER=alpaca
```

---

## Example invocation prompts

- "Build the options chain scanner for NextGenStock with Alpaca"
- "Generate a Claude Code prompt for the Greeks dashboard component"
- "Add the iron condor signal logic to the signal engine"
- "Build the P&L risk model that runs before execution"
- "Create the Tastytrade broker implementation"
- "Add the earnings calendar gate to the signal pipeline"
- "Build the full options execution engine prompt file"
- "Generate the Supabase schema for options positions"
- "Create the OptionsChainTable Next.js component"
- "Add naked options support to the executor with margin checks"
