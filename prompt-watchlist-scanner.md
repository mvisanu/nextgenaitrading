# NextGenStock — Watchlist Scanner, Buy Alerts, and Auto-Idea Engine
# Prompt for Claude Code

You are a senior full-stack engineer, quantitative trading systems engineer, FastAPI backend architect, and Next.js frontend architect working in Claude Code on the **NextGenStock** platform.

## Before Writing Any Code

1. Inspect the existing codebase end-to-end: current Opportunities page, Ideas page, alert infrastructure, buy zone service, scheduler jobs, notification service, and existing watchlist models.
2. Write a short execution plan (no more than 20 bullet points).
3. Execute incrementally — one logical unit at a time.
4. Validate locally after each unit: lint, type checks, existing tests.
5. Extend existing modules — do not rebuild what already exists.

---

## What We Are Building

Three connected features that work together:

```
OPPORTUNITIES PAGE
  User adds tickers manually to watchlist
  System runs automated backtest per ticker → estimated buy zone
  System runs live market scan every 5 min during market hours
  When BOTH backtest zone AND live technicals agree → fire alert
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

## Critical Rules — Read First

### Alert quality over quantity
The live scanner must only fire a "buy this now" alert when **ALL** of the following pass. If even one fails, the alert is suppressed entirely — no partial alerts, no "most conditions passed" messages.

### Conservative scanner definition
Conservative means all three of:
- Stock is in an established uptrend (price above both 50-day AND 200-day MA)
- Multiple confirmation signals agree: RSI + volume + trend regime all aligned
- Entry is near a proven support level — never chasing a breakout

### Megatrend filter — ideas and scan candidates must align with at least one
Prioritize stocks that fit one or more long-term megatrends:
- **AI** — artificial intelligence, machine learning, GPU compute, data infrastructure
- **Robotics / Humanoids / Autopilot** — industrial robots, humanoid robots, autonomous vehicles, drones
- **Longevity** — biotech, genomics, anti-aging therapeutics, diagnostics, precision medicine

Stocks with no megatrend connection are deprioritized in ranking but never hard-blocked.
Manually added watchlist tickers are never filtered out regardless of megatrend fit.

### Competitive moat filter — applied during idea generation
Prefer companies that meet at least one of:
- Market share >= 50% within their primary industry or product category
- Difficult to replicate: proprietary IP, switching costs, network effects, regulatory moat
- Very few direct competitors (oligopoly or near-monopoly position)

A `moat_score` (0.0–1.0) is stored per ticker. Score >= 0.70 ranks higher.
Score < 0.30 shows a red badge: "Low competitive moat — higher risk."

### Financial quality filter — applied during idea generation
Prefer companies that meet the majority of:
- Revenue growth year-over-year (positive)
- Profit growth year-over-year OR strong demand + clear path to profitability
- Improving or stable gross margins
- Good cost control (improving operating leverage)
- If not yet profitable: strong and accelerating revenue growth as a substitute

Source from yfinance `.info`: `revenueGrowth`, `grossMargins`, `operatingMargins`, `earningsGrowth`.
If data unavailable, skip the filter and show "Financials unavailable" on the card.

### Chart-based entry priority rules — buy price identification
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

### Approved wording
Never say "guaranteed", "safe", "certain to go up", or "can't lose."
Always say "historically favorable", "high-probability entry zone", "confidence score", "positive outcome rate."

---

## Integration Points — Check Before Building

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

## New Directory Structure

Add only these files — do not move or rename existing ones:

```
backend/app/
  services/
    live_scanner_service.py      # real-time technical confirmation engine
    news_scanner_service.py      # hourly news + macro fetch and parse
    idea_generator_service.py    # orchestrates all 3 idea sources
    buy_signal_service.py        # combines backtest zone + live scan → BUY NOW decision
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

## Feature 1 — Opportunities Page: Watchlist + Buy Zone + Live Scanner

### How the watchlist works

- User manually adds tickers (text input + Add button, no auto-population on this page)
- Each ticker is persisted to existing `watchlist_ideas` or a new `user_watchlist` table
- On add: immediately trigger `calculate_buy_zone(ticker)` in background
- Display a loading state on the row while buy zone calculates

### Estimated buy price display

Show both:
- **Buy zone range**: `$140.20 – $144.80` (from backtest analog scoring)
- **Ideal entry price**: `$141.50` (ATR midpoint of zone where historical reward/risk is strongest)

UI wording:
```
Estimated entry zone (historically favorable): $140.20 – $144.80
Ideal entry based on backtest: $141.50
This is not a guaranteed price. Based on X similar historical setups.
```

### The BuyNowSignal model

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

### The ALL CONDITIONS gate — buy signal fires only when every one of these is True

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

### Live scanner job

```python
# scheduler/tasks/run_live_scanner.py

async def run_live_scanner():
    """
    Runs every 5 minutes, market hours only (9:30 AM - 4:00 PM ET, weekdays).
    For each ticker in each user's watchlist:
      1. Call evaluate_buy_signal(ticker, user_id)
      2. If all_conditions_pass=True AND no signal fired in last 4 hours:
         → dispatch in-app notification + email
    Idempotent: cooldown check prevents duplicate alerts.
    """
    if not is_market_hours():
        return
    ...
```

### Notification content

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

### Opportunities page table columns

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

### API endpoints

```
GET  /api/opportunities
     → list user's watchlist with latest buy zone + signal status per ticker

POST /api/watchlist
     → add ticker to user's watchlist, trigger background buy zone calculation

DELETE /api/watchlist/{ticker}
     → remove ticker from watchlist

POST /api/scanner/run-now
     → manually trigger live scan for all user's watchlist tickers immediately

GET  /api/scanner/status
     → last scan time, next scheduled scan, how many tickers in queue
```

---

## Feature 2 — Ideas Page: Auto-Generated Idea Feed

### Three idea sources running automatically every hour during market hours

#### Source 1: News scanner

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

#### Source 2: Theme scanner

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

#### Source 3: Technical setup scanner

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

### GeneratedIdea model

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

### Idea card UI

Each auto-generated card shows:

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
│  Why flagged: RSI pullback to support near 50d MA.
│               News: "NVIDIA wins $2B data center contract"
│
│  Current price: $487.20
│  Estimated entry zone: $472.00 – $485.00
│  Ideal entry: $476.50
│
│  Confidence: 71%    Historical 90d win rate: 66%
│
│  [ + Add to Watchlist ]                [View Chart]
└─────────────────────────────────────────────────────┘
```

Cards are sorted by `idea_score` descending. Newest ideas appear at the top within each score tier.

Cards expire and are removed from the feed after 24 hours. A badge shows "Generated X minutes ago."

### Idea generator job

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

### Idea score formula

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

### Add to Watchlist behavior

When user clicks "Add to Watchlist" on an idea card:
1. Add ticker to `user_watchlist`
2. Trigger `calculate_buy_zone(ticker)` in background
3. Create `PriceAlertRule` with type `entered_buy_zone` and `enabled=True` by default
4. Show toast: "NVDA added to watchlist. Alert created for buy zone entry."
5. Mark `generated_idea.added_to_watchlist = True` (card shows a checkmark)

### API endpoints

```
GET  /api/ideas/generated
     → list current generated ideas, sorted by idea_score desc
     → supports filter: ?source=news|theme|technical&theme=ai

POST /api/ideas/generated/{id}/add-to-watchlist
     → add ticker to watchlist + create alert rule

GET  /api/ideas/generated/last-scan
     → timestamp of last scan run + count of ideas generated
```

---

## Scheduler Jobs Summary

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

## Database Migrations

Add one Alembic migration per table, chained from current head. Every migration implements `downgrade()`.

1. `user_watchlist` — if not already covered by `watchlist_ideas`
2. `buy_now_signals`
3. `generated_ideas`

---

## Frontend — Opportunities Page Changes

### New components needed

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

## Frontend — Ideas Page Changes

### New components needed

**`IdeaFeed.tsx`** — scrollable list of `GeneratedIdeaCard` components. Shows:
- Filter bar: All / News / Theme / Technical tabs
- Theme filter chips: AI, Energy, Defense, Space, Semiconductors
- Last scan timestamp: "Last updated 14 minutes ago"
- Refresh button (triggers `POST /api/scanner/run-now` equivalent for ideas)

**`GeneratedIdeaCard.tsx`** — the card described above. Uses shadcn/ui `Card` component.

**`AddToWatchlistButton.tsx`** — shows "Added ✓" state after click, disabled to prevent double-add.

---

## Testing Requirements

### Backend unit tests
- `test_buy_signal_service.py` — each of the 10 conditions independently, all-pass scenario, single-fail suppression
- `test_live_scanner.py` — market hours check, cooldown logic, duplicate prevention
- `test_news_scanner.py` — RSS feed parsing, ticker extraction, graceful failure on bad feed
- `test_idea_generator.py` — deduplication logic, idea scoring, expiry logic
- `test_technical_scanner.py` — uptrend filter, RSI check, support proximity check
- `test_megatrend_filter.py` — megatrend tag assignment, fit score (1.0 / 0.5 / 0.0)
- `test_moat_scoring.py` — HIGH_MOAT_TICKERS seed lookup, fallback heuristic
- `test_financial_quality.py` — yfinance field parsing, missing data handling, score output
- `test_entry_priority.py` — 52-week low detection, weekly support detection, additive boost

### Integration tests
- ticker added to watchlist → buy zone calculated → signal evaluated → alert dispatched
- idea card "Add to Watchlist" → watchlist entry created → alert rule created → toast shown
- news scan returns result → ticker extracted → idea card generated with news headline

Mock `yfinance`, RSS feeds, notification service, and Alpaca data API in all tests.

---

## Acceptance Criteria

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
- [ ] All scanner jobs only run during market hours (9:30 AM – 4:00 PM ET, weekdays)
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

## Implementation Order

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
13. Notification wiring: connect buy signal → `notification_service.py` in-app + email
14. Tests
15. README update