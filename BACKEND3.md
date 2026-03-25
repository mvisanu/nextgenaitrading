# BACKEND3.md — NextGenStock V3 Backend Handoff

**Version:** 3.0
**Date:** 2026-03-24
**Depends on:** V1 (auth, strategies, backtests, live trading) + V2 (buy zone, alerts, auto-buy, themes, ideas, scheduler)
**Status:** Complete — 127 unit tests passing

---

## Overview

V3 adds three connected capabilities to NextGenStock:

1. **Watchlist Scanner** — users maintain a personal ticker list on the Opportunities page. Each ticker gets a persistent estimated buy zone and a live 5-minute technical scan. When all 10 conditions pass simultaneously, a "STRONG BUY" signal fires and dispatches an immediate in-app + email notification.

2. **Auto-Idea Engine** — the Ideas page is upgraded to a fully automated feed. Three background scanners run every 60 minutes during market hours: a news RSS scanner, a theme scanner, and a technical universe scanner. Results are merged, scored, and surfaced as ranked idea cards with one-click "Add to Watchlist."

3. **Buy Signal Audit Trail** — every scanner evaluation (pass or fail) is written to `buy_now_signals`, giving users a transparent record of which conditions passed and which caused suppression.

**LANGUAGE RULE:** No backend text implies guaranteed profits. Always use "historically favorable", "high-probability entry zone", "confidence score", "positive outcome rate".

---

## Stack and Dependencies Added

| Dependency | Purpose | Version |
|---|---|---|
| `feedparser` | RSS XML parsing for news scanner | >= 6.0.10 |
| `httpx` | Async RSS feed fetching (already present) | >= 0.27.0 |
| `pytz` | DST-aware ET timezone for market hours | >= 2024.1 |

All other V3 code reuses V1/V2 dependencies.

---

## New Database Tables

### `user_watchlist`

Per-user direct ticker list for the V3 Opportunities page watchlist.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK → users.id CASCADE | Indexed |
| `ticker` | VARCHAR(20) | Indexed |
| `alert_enabled` | BOOLEAN | Default True; controls notification dispatch |
| `created_at` | TIMESTAMPTZ | Server default now() |

Unique constraint: `(user_id, ticker)`.

---

### `buy_now_signals`

Persistent audit trail of every 10-condition gate evaluation.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK → users.id CASCADE | Indexed |
| `ticker` | VARCHAR(20) | Indexed |
| `buy_zone_low` | NUMERIC(12,4) | From StockBuyZoneSnapshot |
| `buy_zone_high` | NUMERIC(12,4) | |
| `ideal_entry_price` | NUMERIC(12,4) | (buy_zone_low + buy_zone_high) / 2 baseline |
| `backtest_confidence` | NUMERIC(6,4) | |
| `backtest_win_rate_90d` | NUMERIC(6,4) | |
| `current_price` | NUMERIC(12,4) | Live price at evaluation time |
| `price_in_zone` | BOOLEAN | Condition 1 |
| `above_50d_ma` | BOOLEAN | Condition 2 |
| `above_200d_ma` | BOOLEAN | Condition 3 |
| `rsi_value` | NUMERIC(6,2) | |
| `rsi_confirms` | BOOLEAN | Condition 4 (RSI 30–55) |
| `volume_confirms` | BOOLEAN | Condition 5 |
| `near_support` | BOOLEAN | Condition 6 (within 1.5x ATR of EMA-200) |
| `trend_regime_bullish` | BOOLEAN | Condition 7 |
| `not_near_earnings` | BOOLEAN | Condition 8 (defaults True per OQ-03) |
| `no_duplicate_in_cooldown` | BOOLEAN | Condition 9 |
| `all_conditions_pass` | BOOLEAN | Indexed; True = STRONG BUY |
| `signal_strength` | VARCHAR(20) | "STRONG_BUY" or "SUPPRESSED" |
| `suppressed_reason` | VARCHAR(100) NULLABLE | First failing condition name |
| `invalidation_price` | NUMERIC(12,4) | |
| `expected_drawdown` | NUMERIC(6,4) | |
| `created_at` | TIMESTAMPTZ | Indexed |

Rows pruned after `settings.signal_prune_days` days (default 30).

---

### `generated_ideas`

System-wide auto-generated idea cards (no user_id).

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `ticker` | VARCHAR(20) | Indexed |
| `company_name` | VARCHAR(200) | |
| `source` | VARCHAR(20) | "news" \| "theme" \| "technical"; Indexed |
| `reason_summary` | VARCHAR(500) | Why flagged |
| `news_headline` | VARCHAR(500) NULLABLE | |
| `news_url` | VARCHAR(1000) NULLABLE | |
| `news_source` | VARCHAR(100) NULLABLE | |
| `catalyst_type` | VARCHAR(50) NULLABLE | "earnings" \| "policy" \| "sector_rotation" \| "technical" |
| `current_price` | NUMERIC(12,4) | |
| `buy_zone_low` | NUMERIC(12,4) NULLABLE | |
| `buy_zone_high` | NUMERIC(12,4) NULLABLE | |
| `ideal_entry_price` | NUMERIC(12,4) NULLABLE | |
| `confidence_score` | NUMERIC(6,4) | |
| `historical_win_rate_90d` | NUMERIC(6,4) NULLABLE | |
| `theme_tags` | JSON | e.g. ["ai", "semiconductors"] |
| `megatrend_tags` | JSON | Subset: ["ai", "robotics", "longevity"] |
| `moat_score` | NUMERIC(6,4) | 0.0–1.0 |
| `moat_description` | VARCHAR(300) NULLABLE | |
| `financial_quality_score` | NUMERIC(6,4) | 0.0–1.0 |
| `financial_flags` | JSON | Quality observations |
| `near_52w_low` | BOOLEAN | |
| `at_weekly_support` | BOOLEAN | |
| `entry_priority` | VARCHAR(20) | "52W_LOW" \| "WEEKLY_SUPPORT" \| "BOTH" \| "STANDARD" |
| `idea_score` | NUMERIC(6,4) | Indexed; composite rank score |
| `generated_at` | TIMESTAMPTZ | Indexed; used for MAX() last-scan query |
| `expires_at` | TIMESTAMPTZ | Indexed; ideas expire after 24h |
| `added_to_watchlist` | BOOLEAN | Flipped to True on "Add to Watchlist" click |

Rows replaced on each generator run. Expired rows pruned at start of each run.

---

## Alembic Migrations

| File | Revision ID | Table Added |
|---|---|---|
| `b1c2d3e4f5a6_v3_user_watchlist.py` | b1c2d3e4f5a6 | `user_watchlist` |
| `c2d3e4f5a6b1_v3_buy_now_signals.py` | c2d3e4f5a6b1 | `buy_now_signals` |
| `d3e4f5a6b1c2_v3_generated_ideas.py` | d3e4f5a6b1c2 | `generated_ideas` |

Chain: `a1b2c3d4e5f6` (V2 head) → `b1c2d3e4f5a6` → `c2d3e4f5a6b1` → `d3e4f5a6b1c2`

```bash
alembic upgrade head
```

All migrations implement `downgrade()`.

---

## New API Endpoints

All V3 endpoints require `Depends(get_current_user)` and are scoped to the authenticated user.

### Watchlist API (`/api/watchlist`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/watchlist` | List user's V3 watchlist items |
| POST | `/api/watchlist` | Add ticker; triggers background buy zone calc |
| DELETE | `/api/watchlist/{ticker}` | Remove ticker (signals retained for audit) |
| PATCH | `/api/watchlist/{ticker}/alert` | Toggle alert on/off |

**POST /api/watchlist request:**
```json
{ "ticker": "NVDA" }
```

**POST /api/watchlist response (201):**
```json
{ "id": 1, "ticker": "NVDA", "alert_enabled": true, "created_at": "..." }
```

**PATCH /api/watchlist/{ticker}/alert request:**
```json
{ "enabled": false }
```

---

### Opportunities Watchlist View (`/api/opportunities/watchlist`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/opportunities/watchlist` | V3 enriched watchlist with signal status |

Returns `list[WatchlistOpportunityOut]` — each row includes all 10 condition flags, buy zone, ideal entry, distance to zone, confidence, win rate, and signal status.

Sorted: STRONG_BUY first, then by `backtest_confidence` descending.

---

### Generated Ideas API (`/api/ideas/generated`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/ideas/generated` | List current idea cards (sorted by idea_score) |
| GET | `/api/ideas/generated/last-scan` | Timestamp + count of last generator run |
| POST | `/api/ideas/generated/{id}/add-to-watchlist` | One-click add to watchlist + create alert rule |

**GET /api/ideas/generated query params:**
- `source`: "news" | "theme" | "technical"
- `theme`: tag string (e.g. "ai", "defense")
- `limit`: 1–100 (default 50)

**POST /api/ideas/generated/{id}/add-to-watchlist response (201):**
```json
{
  "ticker": "NVDA",
  "watchlist_item_id": 42,
  "alert_rule_id": 17,
  "message": "NVDA added to watchlist. Alert created for buy zone entry."
}
```

Returns 410 Gone if the idea has expired.

---

### Scanner API Extensions (`/api/scanner`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/scanner/status` | Last scan time, ticker count, next interval |
| POST | `/api/scanner/run-now` | Manually trigger V3 live scan synchronously |

**GET /api/scanner/status response:**
```json
{
  "last_scan_at": "2026-03-24T14:35:00Z",
  "ticker_count": 5,
  "next_scan_interval_minutes": 5
}
```

**POST /api/scanner/run-now response:**
```json
{
  "scanned": 5,
  "strong_buy_tickers": ["NVDA"],
  "error_tickers": []
}
```

Manual trigger bypasses the market hours guard.

---

## New Services

### `utils/market_hours.py`

```python
def is_market_hours(now: datetime | None = None) -> bool
```

DST-aware US/Eastern timezone check. Returns True 9:30 AM–3:59 PM ET, Mon–Fri. All V3 scheduler tasks use this as their market hours guard.

---

### `services/megatrend_filter_service.py`

```python
def get_megatrend_tags(ticker: str) -> list[str]
def compute_megatrend_fit_score(tags: list[str]) -> float  # 1.0 | 0.5 | 0.0
def get_priority_megatrend_tags(tags: list[str]) -> list[str]
```

Pre-seeded ticker → tag map. Priority megatrends: `ai`, `robotics`, `longevity` → score 1.0. Other themes → 0.5. No match → 0.0.

---

### `services/moat_scoring_service.py`

```python
def score_moat(ticker: str) -> MoatResult
def get_moat_badge(score: float) -> str  # "Strong" | "Moderate" | "Low"
```

`HIGH_MOAT_TICKERS` seed dict covers: NVDA (0.85), ISRG (0.90), ASML (0.95), ILMN (0.80), MSFT (0.80), TSM (0.85), V (0.80), MA (0.80), LLY (0.75), NVO (0.75), AAPL (0.85), GOOGL (0.80), AMZN (0.80), META (0.75). Falls back to yfinance market-cap heuristic for unknown tickers.

---

### `services/financial_quality_service.py`

```python
def score_financial_quality(ticker: str) -> FinancialQualityResult
def get_financial_quality_label(score: float, available: bool) -> str
```

Reads `revenueGrowth`, `earningsGrowth`, `grossMargins`, `operatingMargins` from yfinance `.info`. Each positive criterion adds 0.25. Returns 0.5 + `financials_unavailable` flag when fewer than 2 fields are available.

---

### `services/entry_priority_service.py`

```python
def check_entry_priority(ticker: str) -> EntryPriorityResult
```

Checks two conditions:
- **Near 52-week low**: `current_price <= fiftyTwoWeekLow * 1.10` → +0.15 boost
- **At weekly support**: `abs(current_price - swing_low) <= 2 * weekly_ATR` on 1W chart → +0.10 boost

Both can be true simultaneously (max +0.25 total).

---

### `services/news_scanner_service.py`

```python
async def scan_news() -> list[NewsItem]
```

Fetches 5 free RSS feeds (Yahoo Finance, WSJ, CNN, Federal Reserve, EIA). For each feed: extracts headlines, runs ticker extraction via `$TICKER` pattern + company-name map + "TICKER stock" pattern, maps to theme tags. Returns items sorted by `relevance_score` descending. Fails gracefully — any feed error skipped silently.

---

### `services/buy_signal_service.py`

```python
async def evaluate_buy_signal(
    ticker: str, user_id: int, db: AsyncSession, alert_enabled: bool = True
) -> BuyNowSignal
```

Evaluates the 10-condition gate. Every evaluation is persisted to `buy_now_signals`. Dispatches notification if all_conditions_pass=True and alert_enabled=True.

**The 10 conditions (ALL must pass for STRONG_BUY):**

1. `price_inside_backtest_buy_zone` — current price within `[buy_zone_low, buy_zone_high]`
2. `above_50d_moving_average` — price > 50-day SMA
3. `above_200d_moving_average` — price > 200-day SMA
4. `rsi_not_overbought` — RSI between 30 and 55
5. `volume_declining_on_pullback` — recent vol avg < prior vol avg on a down-move
6. `near_proven_support_level` — within 1.5× ATR of EMA-200
7. `trend_regime_not_bearish` — buy zone confidence_score >= 0.50
8. `backtest_confidence_above_threshold` — confidence_score >= 0.65
9. `not_near_earnings` — defaults True (live lookup deferred to V4; tooltip notes this)
10. `no_duplicate_signal_in_cooldown` — no STRONG_BUY in last 4 hours for this user+ticker

---

### `services/v3_idea_generator_service.py`

```python
async def run_idea_generator(db: AsyncSession) -> list[GeneratedIdea]
def compute_idea_score(c: IdeaCandidate) -> float
```

Orchestrates all three idea sources. Deduplicates by ticker (merges source labels and takes best scores). Persists top 50 ideas to `generated_ideas` (replaces previous batch). Purges expired rows.

**idea_score formula:**
```
confidence_score        * 0.25
megatrend_fit_score     * 0.20
moat_score              * 0.15
financial_quality_score * 0.15
technical_setup_score   * 0.15
news_relevance_score    * 0.10
+ near_52w_low boost    +0.15
+ at_weekly_support     +0.10
capped at 1.0
```

**Scan universe (IDEA_UNIVERSE — ETFs excluded):**
AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA, JPM, BAC, GS, V, MA, ETN, NEE, XOM, CVX, LMT, RTX, NOC, GD, AMD, INTC, AVGO, TSM, AMAT, ASML, ASTS, RKLB, LLY, NVO, REGN, CRSP, ILMN, PLTR, ISRG

---

### `services/live_scanner_service.py`

```python
async def scan_user_watchlist(user_id: int, db: AsyncSession) -> list[LiveScanResult]
```

Batch wrapper for `evaluate_buy_signal()`. Processes every ticker in the user's `user_watchlist`. Per-ticker failures are captured and returned as `LiveScanResult(error=...)` without aborting the rest.

---

## Scheduler Tasks

All V3 jobs are registered in `scheduler/jobs.py` on the shared APScheduler instance.

| Job ID | Task | Interval | Guard |
|---|---|---|---|
| `run_live_scanner` | `run_live_scanner()` | Every 5 min | `is_market_hours()` |
| `run_idea_generator` | `run_idea_generator_job()` | Every 60 min | `is_market_hours()` |
| `run_news_scanner` | `run_news_scanner()` | Every 60 min | `is_market_hours()` |
| `prune_old_signals` | `prune_old_signals()` | Daily at 02:00 UTC | None |

All jobs use `coalesce=True, max_instances=1`.

---

## Config Settings Added

| Env Variable | Default | Description |
|---|---|---|
| `LIVE_SCANNER_MINUTES` | `5` | V3 live scanner interval (minutes) |
| `IDEA_GENERATOR_MINUTES` | `60` | V3 idea generator interval (minutes) |
| `SIGNAL_PRUNE_DAYS` | `30` | Days to retain buy_now_signals rows |

These extend `app/core/config.py`'s `Settings` class.

---

## Integration Points with V1/V2

| V1/V2 Module | How V3 Uses It |
|---|---|
| `buy_zone_service.calculate_buy_zone()` | Powers buy zone on watchlist add and background enrichment |
| `buy_zone_service.get_or_calculate_buy_zone()` | Used by buy_signal_service and idea generator with 60-min/240-min stale check |
| `analog_scoring_service` | 90-day win rate via buy zone snapshot (`positive_outcome_rate_90d`) |
| `theme_scoring_service` | Theme tags in DB used by _scan_theme_source() |
| `notification_service.dispatch_notification()` | Called by buy_signal_service when all_conditions_pass=True |
| `models/alert.py PriceAlertRule` | Created on "Add to Watchlist" (type: entered_buy_zone) |
| `scheduler/jobs.py` | V3 jobs added to shared scheduler instance — no second scheduler |
| `api/opportunities.py` | Extended with GET /api/opportunities/watchlist V3 endpoint |
| `api/scanner.py` | Extended with GET /api/scanner/status and POST /api/scanner/run-now |

---

## File Map — New V3 Files

```
backend/app/
  utils/
    __init__.py
    market_hours.py

  models/
    user_watchlist.py       # UserWatchlist ORM
    buy_signal.py           # BuyNowSignal ORM
    generated_idea.py       # GeneratedIdea ORM

  schemas/
    watchlist.py            # WatchlistAddRequest, WatchlistItemOut, WatchlistOpportunityOut, etc.
    generated_idea.py       # GeneratedIdeaOut, LastScanOut, AddToWatchlistResponse

  services/
    megatrend_filter_service.py
    moat_scoring_service.py
    financial_quality_service.py
    entry_priority_service.py
    news_scanner_service.py
    buy_signal_service.py
    live_scanner_service.py
    v3_idea_generator_service.py   # V3 DB-backed orchestrator (distinct from V2 idea_generator_service.py)

  api/
    watchlist.py            # POST/DELETE/PATCH /api/watchlist
    generated_ideas.py      # GET/POST /api/ideas/generated

  scheduler/tasks/
    run_live_scanner.py
    run_news_scanner.py
    run_idea_generator.py
    prune_old_signals.py

alembic/versions/
  b1c2d3e4f5a6_v3_user_watchlist.py
  c2d3e4f5a6b1_v3_buy_now_signals.py
  d3e4f5a6b1c2_v3_generated_ideas.py

tests/v3/
  __init__.py
  test_market_hours.py
  test_megatrend_filter.py
  test_moat_scoring.py
  test_financial_quality.py
  test_entry_priority.py
  test_news_scanner.py
  test_buy_signal_service.py
  test_idea_score.py
  test_technical_scanner.py
```

---

## Modified V2/V1 Files

| File | Change |
|---|---|
| `backend/requirements.txt` | Added `feedparser>=6.0.10`, `pytz>=2024.1` |
| `backend/app/core/config.py` | Added `live_scanner_minutes`, `idea_generator_minutes`, `signal_prune_days` |
| `backend/app/db/base.py` | Added imports for `user_watchlist`, `buy_signal`, `generated_idea` |
| `backend/app/models/__init__.py` | Added `UserWatchlist`, `BuyNowSignal`, `GeneratedIdea` exports |
| `backend/app/api/opportunities.py` | Added `GET /api/opportunities/watchlist` endpoint |
| `backend/app/api/scanner.py` | Added `GET /api/scanner/status`, `POST /api/scanner/run-now` |
| `backend/app/scheduler/jobs.py` | Registered 4 new V3 jobs |
| `backend/app/main.py` | Registered `watchlist_router` and `generated_ideas_router` |

---

## Setup and Migration

```bash
# 1. Install new dependencies
cd backend
pip install -r requirements.txt

# 2. Run V3 migrations (requires Docker Postgres running)
alembic upgrade head

# 3. Start backend
uvicorn app.main:app --reload

# 4. Run V3 unit tests
pytest tests/v3/ -v
```

---

## Testing

```bash
# V3 unit tests only (127 tests, no DB or network required)
cd backend
pytest tests/v3/ -v

# All tests (V1 + V2 + V3)
pytest tests/ -v
```

**Test coverage per module:**

| Test File | Service Covered | Tests |
|---|---|---|
| `test_market_hours.py` | `utils/market_hours.py` | 12 |
| `test_megatrend_filter.py` | `megatrend_filter_service.py` | 19 |
| `test_moat_scoring.py` | `moat_scoring_service.py` | 15 |
| `test_financial_quality.py` | `financial_quality_service.py` | 13 |
| `test_entry_priority.py` | `entry_priority_service.py` | 13 |
| `test_news_scanner.py` | `news_scanner_service.py` | 18 |
| `test_buy_signal_service.py` | `buy_signal_service.py` | 19 |
| `test_idea_score.py` | `v3_idea_generator_service.compute_idea_score` | 13 |
| `test_technical_scanner.py` | `v3_idea_generator_service._compute_technical_setup_score` | 6 |

All yfinance, httpx, feedparser, and DB calls are mocked — tests run without network.

---

## Known Limitations and Stubs

1. **`not_near_earnings` condition** defaults to `True` (passes gate) per OQ-03. Live earnings calendar lookup is deferred to V4. The signal tooltip notes: "Earnings check: manual flag only (live lookup in V4)."

2. **News RSS feeds** may have availability issues. Any feed that fails to load is skipped silently. If all feeds fail on a given run, the news source produces zero candidates (idea gen continues with theme and technical sources).

3. **`InAppNotification`** in `notification_service.py` writes to the structured log (V2 behavior). V3 spec mentions persisting to an `in_app_notifications` table — this is not yet implemented. The notification content is correct and present in logs. Upgrade to a WebSocket/DB channel in V4.

4. **V2 `idea_generator_service.py` is not modified.** The V2 `GET /api/scanner/ideas` endpoint (in-process cache, `composite_score` formula) continues to work unchanged. V3's `GET /api/ideas/generated` uses a separate DB table and `idea_score` formula. These are two distinct scoring paths — do not merge.

5. **`moat_scoring_service.py` yfinance heuristic** is a rough proxy based on market cap. It is not a fundamental analysis and should be flagged as such in the UI ("Moat estimate based on market cap — not a fundamental assessment").

6. **`financial_quality_service.py`** skips quarters where yfinance returns `None` for individual fields. If fewer than 2 fields are available, `financials_available=False` and the UI should show "Financials unavailable."

7. **Scan universe** (`IDEA_UNIVERSE`) contains 35 stocks. Expand by modifying `SCAN_UNIVERSE` in `v3_idea_generator_service.py` — no schema changes required.

---

## Open Questions for Frontend

1. **BuyNowBadge tooltip**: The `WatchlistOpportunityOut` schema exposes all 10 condition boolean flags. The frontend should render a per-condition pass/fail tooltip on hover. Condition display names are:
   - `price_in_zone` → "Price inside buy zone"
   - `above_50d_ma` → "Above 50-day MA"
   - `above_200d_ma` → "Above 200-day MA"
   - `rsi_confirms` → "RSI 30–55 (pullback zone)"
   - `volume_confirms` → "Volume declining on pullback"
   - `near_support` → "Near proven support level"
   - `trend_regime_bullish` → "Trend regime not bearish"
   - `not_near_earnings` → "No earnings within 5 days (manual flag only — V4)"
   - `no_duplicate_in_cooldown` → "No duplicate signal in 4-hour cooldown"
   - `backtest_confidence` (from `backtest_confidence >= 0.65`) → "Backtest confidence ≥ 65%"

2. **Distance to zone color coding**: `distance_to_zone_pct` is positive when price is above zone (not yet in — show in red/amber) and negative when in or below zone (show in green).

3. **Idea card "Added" state**: When `added_to_watchlist=True` on a `GeneratedIdeaOut`, disable the "Add to Watchlist" button and show a checkmark.

4. **Last scan relative timestamp**: `GET /api/ideas/generated/last-scan` returns an ISO datetime. Calculate "X minutes ago" on the frontend.

5. **Toast on Add to Watchlist**: The API returns `message` field — display it as a success toast. Display 410 Gone responses as an "Idea expired" toast.

6. **Manual scan trigger**: `POST /api/scanner/run-now` bypasses market hours — safe to expose in the UI at any time. Show a loading spinner during execution; display `strong_buy_tickers` in the toast on completion.
