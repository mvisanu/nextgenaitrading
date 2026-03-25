# NextGenStock — Feature Addition Prompt
# Intelligent Buy Zone, Smart Alerts, Auto-Buy, and Theme Engine

You are a senior full-stack engineer, quantitative trading systems engineer, FastAPI backend architect, Next.js frontend architect, and product-minded AI engineer working in Claude Code on the **NextGenStock** platform.

## Before Writing Any Code

1. Inspect the existing codebase end-to-end: current architecture, data models, broker integrations (`alpaca_client.py`, `robinhood_client.py`, `factory.py`), alert infrastructure, background jobs, backtesting modules, existing watchlist or strategy features, and the existing Alembic migration chain.
2. Write a short execution plan (bullet points, no more than 20 lines).
3. Execute the plan incrementally — one logical unit at a time.
4. After each major unit, validate locally: run lint, type checks, and any existing tests.
5. Preserve existing architecture, naming conventions, file structure, and auth patterns (`get_current_user` dependency, HTTP-only JWT cookies, per-user data isolation).

---

## Critical Constraints — Read Before Any Implementation

### No guaranteed profit language
Never use wording such as "guaranteed winner", "no chance of loss", "safe forever", or "certain to go up".

Always use wording such as:
- "historically favorable buy zone"
- "high-probability entry area"
- "confidence score"
- "expected drawdown"
- "scenario-based estimate"
- "positive outcome rate"

Every recommendation must expose: confidence score, expected upside, expected downside, time horizon, major assumptions, and invalidation level.

### Conservative automation
Auto-buy is optional, disabled by default, and protected by multiple independent risk checks. It must never execute without passing every safeguard listed in Feature C.

### Extend, don't replace
If any part of this feature already exists in the codebase, inspect it first and extend it rather than rebuilding it. Preserve backwards compatibility.

---

## Integration Points with Existing NextGenStock Code

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

## New Directory Structure

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

## Feature A — Intelligent Buy Zone Estimator

### Service: `buy_zone_service.py`

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

### Calculation pipeline (transparent, testable, no black box)

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

### Required output fields (persisted per snapshot)

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

### API endpoints

```
GET  /api/stocks/{ticker}/buy-zone
     → returns latest snapshot or triggers calculation if stale (>1hr)

POST /api/stocks/{ticker}/recalculate-buy-zone
     → force recalculate, persist new snapshot, return result
```

Both require `Depends(get_current_user)`.

---

## Feature B — Smart Price Alert Engine

### Service: `alert_engine_service.py`

Evaluates all active `PriceAlertRule` records against current prices. Called by the scheduler every N minutes.

### Alert types

| Alert type | Trigger condition |
|---|---|
| `entered_buy_zone` | current price moved inside buy_zone_low..buy_zone_high |
| `near_buy_zone` | current price within `proximity_pct` of buy_zone_low |
| `below_invalidation` | current price dropped below invalidation_price |
| `confidence_improved` | confidence_score increased by >= 0.10 since last snapshot |
| `theme_score_increased` | theme_score_total increased by >= 0.15 |
| `macro_deterioration` | theme score dropped sharply or sector tailwind reversed |

### Notification abstraction

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

### ORM model

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

### API endpoints

```
GET    /api/alerts              → list user's alert rules
POST   /api/alerts              → create new alert rule
PATCH  /api/alerts/{id}         → update rule (enable/disable, threshold)
DELETE /api/alerts/{id}         → remove rule
```

All scoped by `current_user.id`. Return 403 if rule belongs to another user.

---

## Feature C — Optional Auto-Buy Execution

### All of the following must pass before any order is submitted

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

### Decision states

```
candidate           → ticker is tracked, evaluation pending
ready_to_alert      → in buy zone but auto-buy not enabled
ready_to_buy        → all safeguards passed, order can be submitted
blocked_by_risk     → one or more safeguards failed (log which ones)
order_submitted     → order sent to broker
order_filled        → confirmed fill received
order_rejected      → broker rejected
cancelled           → user cancelled or rule changed
```

### Settings model

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

### Decision log model

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

### Broker integration

Reuse `broker/factory.py` → `get_broker_client(credential)` → `client.place_order(...)`.
If `paper_mode=True`, call `AlpacaClient(paper=True)` or log a simulated order without hitting the broker.

### API endpoints

```
GET    /api/auto-buy/settings           → get user's auto-buy settings
PATCH  /api/auto-buy/settings           → update settings
GET    /api/auto-buy/decision-log       → paginated log of all decisions
POST   /api/auto-buy/dry-run/{ticker}   → simulate full decision pipeline, return result without executing
```

---

## Feature D — Theme / World Trend Scoring Engine

### Supported themes (initial set)

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

### Service: `theme_scoring_service.py`

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

### ORM model

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

### Important behavior
Theme score improves ranking and prioritization but never overrides price/risk controls. A high theme score on a poor technical setup must still block auto-buy.

### API endpoints

```
GET  /api/stocks/{ticker}/theme-score
POST /api/stocks/{ticker}/theme-score/recompute
```

---

## Feature E — Idea Pipeline and Conviction Watchlist

### ORM models

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
    idea_id: Mapped[int]               # FK → watchlist_ideas.id
    ticker: Mapped[str]
    is_primary: Mapped[bool]
```

Non-tradable tickers (e.g. "SpaceX when public") can be stored with `tradable=False` and `watch_only=True`. The system skips broker actions for these entries entirely.

### Auto-ranking logic

Ideas are ranked by a composite:
```
rank_score = (theme_score_total * 0.35)
           + (entry_quality_score * 0.35)
           + (conviction_score / 10 * 0.20)
           + (alert_readiness_bonus * 0.10)
```

### API endpoints

```
GET    /api/ideas              → list user's ideas, sorted by rank_score desc
POST   /api/ideas              → create new idea
PATCH  /api/ideas/{id}         → update idea
DELETE /api/ideas/{id}         → delete idea
```

---

## New Database Migrations

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

## Background Scheduler Jobs

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

## New Frontend Pages

Use existing shadcn/ui components. Follow the established layout with fixed left sidebar.

### `/opportunities` — Watchlist + Buy Zone Dashboard

Table columns: ticker, current price, buy zone range, distance to zone (%), confidence score, theme score, alert status, auto-buy readiness, last updated.

Sorting: highest confidence, closest to zone, highest theme score, best risk/reward.
Filtering: by theme, sector, alert status, auto-buy eligibility.

### `/ideas` — Idea / Thesis Manager

- Add / edit / delete idea cards
- Thesis text area
- Theme tag multi-select (from `SUPPORTED_THEMES`)
- Linked tickers input
- Watch-only toggle with tooltip: "Watch-only ideas are tracked but never sent to a broker"
- Conviction slider 1–10
- Auto-ranked list sorted by composite rank score

### `/alerts` — Alert Configuration

Per-ticker and global controls. shadcn/ui `Switch` for enable/disable per rule. Form fields: alert type dropdown, proximity threshold, cooldown window, market hours only toggle.

### `/auto-buy` — Auto-Buy Controls

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

### Stock Detail Page Enhancements

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

## Explainability Requirements

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

## Audit Logging

Log every significant event to `auto_buy_decision_logs` and application logs:
- buy zone calculation trigger and result
- alert evaluation results (triggered / skipped / cooldown)
- auto-buy decision with full safeguard breakdown
- order submission attempt (success or failure)
- dry-run preview results

---

## Testing Requirements

### Backend unit tests
- `test_buy_zone_service.py` — layer scoring, zone calculation, edge cases (no data, single bar, etc.)
- `test_analog_scoring.py` — historical window matching, forward return computation
- `test_theme_scoring.py` — theme tag mapping, score blending
- `test_alert_engine.py` — each alert type trigger condition, cooldown logic, market hours filter
- `test_auto_buy_engine.py` — each safeguard independently, full pipeline pass, full pipeline block
- `test_auto_buy_api.py` — dry-run endpoint, settings CRUD, log retrieval

### Integration tests
- price update → buy zone entry → alert trigger end-to-end
- dry-run auto-buy with all safeguards passing
- dry-run auto-buy blocked by earnings window
- idea creation → theme score → ranking update

Mock `yfinance`, broker clients, and notification channels in all tests.

---

## Language Rules — Enforced Throughout

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

## Acceptance Criteria

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
- [ ] Integration test covers price → zone → alert end-to-end

---

## Implementation Order

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