# Product Requirements Document: NextGenStock V3
## Watchlist Scanner, Buy Alerts, and Auto-Idea Engine

**Version:** 1.0
**Date:** 2026-03-24
**Status:** Draft
**Depends on:** V1 (auth, strategies, backtests, live trading) + V2 (buy zone, alerts, auto-buy, themes, ideas, scheduler)

---

## 1. Overview

V3 adds three connected capabilities to NextGenStock:

1. **Watchlist Scanner** — the Opportunities page gains a first-class per-ticker watchlist. Each ticker gets a persistent estimated buy zone (from the V2 buy zone pipeline) and a live 5-minute technical scan. When all 10 conditions pass simultaneously, a "STRONG BUY" signal fires and dispatches an immediate in-app + email notification.

2. **Auto-Idea Engine** — the Ideas page is upgraded from a manual user-authored feed to a fully automated idea feed. Three background scanners run every 60 minutes during market hours: a news RSS scanner, a theme scanner, and a technical universe scanner. Results are merged, scored, and surfaced as ranked idea cards with one-click "Add to Watchlist."

3. **Persistent Buy Signal Audit Trail** — every scanner evaluation (pass or fail) is written to a new `buy_now_signals` table, giving users a transparent record of which conditions passed and which caused suppression.

### How V3 connects to V1/V2

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

## 2. Goals and Non-Goals

### Goals

- Users can maintain a personal watchlist on the Opportunities page and see buy zone + live signal status per ticker in one table.
- A "STRONG BUY" alert fires only when ALL 10 conditions pass — never partial, never approximate.
- The Ideas page auto-populates every hour with ranked, auto-generated cards from three independent data sources.
- Every idea card shows enough context (reason flagged, buy zone, confidence, win rate, news catalyst, moat score, financial quality, entry priority) for the user to make an informed judgment.
- One-click "Add to Watchlist" from any idea card creates the watchlist entry and the alert rule in a single action.
- No paid external APIs are required. News scanning uses free RSS feeds only.
- No scanner job runs outside market hours (9:30 AM – 4:00 PM ET, Mon–Fri).
- Ideas and scan candidates are prioritized by megatrend fit (AI / Robotics-Humanoids-Autopilot / Longevity), competitive moat, and financial quality. Manually added watchlist tickers are never filtered out.

### Non-Goals (V3)

- Real-time order execution triggered by STRONG BUY signals (covered by V2 auto-buy engine).
- Earnings calendar live API integration (near_earnings flag is manually set in V2; live lookup deferred to V4).
- LLM-generated natural-language thesis copy.
- Multi-language UI for new V3 pages (Thai/English i18n added in V2 for FAQ only; V3 pages are English).
- Redis-backed cross-worker cache (noted in `idea_generator_service.py` as a V3 upgrade; deferred to V4 if needed).

---

## 3. User Stories

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

## 4. Feature 1: Opportunities Page — Watchlist + Buy Zone + Live Scanner

### 4.1 Watchlist mechanics

- Users add tickers via a text input + "Add" button at the top of the Opportunities page.
- On submission: POST `/api/watchlist` is called. The backend stores the ticker in `user_watchlist` (or via `WatchlistIdea`/`WatchlistIdeaTicker` — see Section 6.1 for the decision), then fires `calculate_buy_zone(ticker)` as a background task.
- The new row enters the table immediately in an "Checking…" state while buy zone calculates.
- On remove: DELETE `/api/watchlist/{ticker}` removes the row; any associated `BuyNowSignal` records are retained for audit (soft approach: they remain orphaned, not cascaded).

### 4.2 Estimated buy price display

The Opportunities table shows both outputs of the buy zone pipeline:

```
Estimated entry zone (historically favorable): $140.20 – $144.80
Ideal entry based on backtest: $141.50
This is not a guaranteed price. Based on X similar historical setups.
```

**Ideal entry price** is the ATR midpoint of the zone where historical reward/risk is strongest — computed as `(buy_zone_low + buy_zone_high) / 2` as a baseline, refined by analog scoring to the price level with the highest 90-day win rate within the zone.

### 4.3 Opportunities table columns

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

### 4.4 Expanded row — EstimatedEntryPanel

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

## 5. Feature 2: Ideas Page — Auto-Generated Idea Feed

### 5.1 Three automatic sources

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

### 5.2 Deduplication and scoring

When the same ticker appears in multiple sources:
1. Merge into one `GeneratedIdea` record.
2. Combine `reason_summary` strings (e.g., "RSI pullback to support. News: NVIDIA wins $2B contract.").
3. Assign the highest `idea_score` from any individual source calculation.

All ideas are assigned a composite `idea_score` before persistence (see Section 8 for formula).

### 5.3 Idea card UI spec

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

### 5.4 Add to Watchlist behavior

When the user clicks "Add to Watchlist" on an idea card:

1. Add ticker to `user_watchlist`.
2. Trigger `calculate_buy_zone(ticker)` in background.
3. Create `PriceAlertRule` with `alert_type="entered_buy_zone"` and `enabled=True` by default.
4. Show toast: `"[TICKER] added to watchlist. Alert created for buy zone entry."`
5. Set `generated_idea.added_to_watchlist = True` (card shows a checkmark; button changes to "Added ✓" and is disabled).

Implementation note: steps 1–3 and 5 execute server-side in response to `POST /api/ideas/generated/{id}/add-to-watchlist`; step 4 is triggered client-side on 200 response.

---

## 6. Data Models

### 6.1 UserWatchlist (new table — or extend WatchlistIdea)

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

### 6.2 BuyNowSignal (new table)

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

### 6.3 GeneratedIdea (new table)

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

## 7. ALL CONDITIONS Gate

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

## 8. Idea Score Formula

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

## 9. Idea Quality Filters

These four filters are applied during `scan_by_theme()` and `scan_technical_universe()` to rank and annotate ideas. They do not hard-block ideas (except where thresholds explicitly gate inclusion — see scan_by_theme steps 2 and 4). Manually added watchlist tickers are **never** filtered out.

### 9.1 Megatrend filter

Prioritize stocks that fit one or more of:
- **AI** — artificial intelligence, machine learning, GPU compute, data infrastructure
- **Robotics / Humanoids / Autopilot** — industrial robots, humanoid robots, autonomous vehicles, drones
- **Longevity** — biotech, genomics, anti-aging therapeutics, diagnostics, precision medicine

`megatrend_fit_score` values used in the idea score formula:
- `1.0` — fits at least one megatrend (AI / Robotics / Longevity)
- `0.5` — fits another SUPPORTED_THEME but not a megatrend
- `0.0` — no theme connection

Stocks with no megatrend connection are deprioritized in ranking but never hard-blocked from the feed.

### 9.2 Competitive moat filter

Prefer companies that meet at least one of:
- Market share >= 50% within their primary industry or product category
- Difficult to replicate: proprietary IP, switching costs, network effects, regulatory moat
- Very few direct competitors (oligopoly or near-monopoly position)

`moat_score` is stored per ticker (0.0–1.0):
- Score sourced first from `HIGH_MOAT_TICKERS` seed map (see Section 10 for the full map).
- Fallback: yfinance `marketCap` + competitor count heuristic.
- Score >= 0.70: green "Strong moat" badge on the idea card.
- Score < 0.30: red badge "Low competitive moat — higher risk."

### 9.3 Financial quality filter

Prefer companies that meet the majority of:
- Revenue growth year-over-year (positive): `yfinance.info["revenueGrowth"]`
- Profit growth YoY OR strong demand + clear path to profitability: `earningsGrowth`
- Improving or stable gross margins: `grossMargins`
- Good cost control (improving operating leverage): `operatingMargins`
- If not yet profitable: strong and accelerating revenue growth as a substitute

`financial_quality_score` (0.0–1.0) is computed from the above four yfinance `.info` fields. If data is unavailable, the score defaults to 0.0 and `financial_flags = ["financials_unavailable"]`. The card shows "Financials unavailable" instead of the financial quality block.

### 9.4 Chart-based entry priority rules

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

## 10. RSS News Sources

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

## 11. SCAN_UNIVERSE Ticker List

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

## 12. API Endpoints

### 12.1 Watchlist endpoints (new)

#### POST /api/watchlist

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

#### DELETE /api/watchlist/{ticker}

Remove a ticker from the user's watchlist.

**Response 204:** No content.

**Errors:** 404 if ticker not in user's watchlist.

---

#### GET /api/opportunities (extend existing)

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

### 12.2 Scanner endpoints (extend existing)

#### POST /api/scanner/run-now

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

#### GET /api/scanner/status

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

### 12.3 Generated ideas endpoints (new, extend ideas router)

#### GET /api/ideas/generated

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

#### POST /api/ideas/generated/{id}/add-to-watchlist

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

#### GET /api/ideas/generated/last-scan

**Response 200:**
```json
{
  "last_scan_at": "2026-03-24T10:00:00Z",
  "ideas_generated": 47,
  "next_scan_at": "2026-03-24T11:00:00Z"
}
```

---

## 13. Scheduler Jobs

Both jobs are added to the **existing** `scheduler/jobs.py`. No second APScheduler instance is created.

### Job 1: Live Scanner (every 5 minutes, market hours)

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

### Job 2: Idea Generator (every 60 minutes, market hours)

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

### Market hours utility

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

## 14. Frontend Components

### 14.1 Opportunities page changes

The existing `frontend/app/opportunities/page.tsx` is extended. The existing watchlist sidebar panel (introduced in a prior bug-fix commit) is replaced by the full `WatchlistTable` as the primary page content.

#### WatchlistTable.tsx

Location: `frontend/components/opportunities/WatchlistTable.tsx`

- Full-width table rendering all columns from Section 4.3.
- Expandable rows: click a row to show `EstimatedEntryPanel` inline.
- Each row has an inline trash-icon "Remove" button.
- Rows in a loading/calculating state show a gray "Checking…" skeleton in Signal Status.
- Default sort: STRONG BUY rows first, then by `backtest_confidence` descending.
- Filter controls: "Ready only" toggle + theme chip set above the table.

#### BuyNowBadge.tsx

Location: `frontend/components/opportunities/BuyNowBadge.tsx`

States:
- **STRONG BUY** — green background, pulsing dot, bold white text.
- **Watching** — gray background, no pulse.
- **Checking…** — amber background, spinner.
- **Not Ready** — gray, no pulse.

Tooltip (on hover): renders a 10-row condition checklist with green checkmark or red X per condition, using the `condition_details` array from the API response.

#### EstimatedEntryPanel.tsx

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

#### Add ticker input

Simple `<input type="text">` + "Add" button at the top of the Opportunities page. On submit:
- POST `/api/watchlist`.
- New row appears immediately in "Checking…" state.
- Input clears after successful add.
- Shows inline error on 409 (already in watchlist) or 422 (invalid ticker).

---

### 14.2 Ideas page changes

The existing `frontend/app/ideas/page.tsx` gains the generated idea feed alongside (or replacing) the manual idea cards section.

#### IdeaFeed.tsx

Location: `frontend/components/ideas/IdeaFeed.tsx`

- Filter bar: All / News / Theme / Technical tabs (maps to `?source=` query param).
- Theme filter chips: AI, Energy, Defense, Space, Semiconductors.
- "Last updated X minutes ago" banner using `last-scan` endpoint data.
- Refresh button: calls `POST /api/scanner/run-now` equivalent for ideas; shows spinner during fetch; re-fetches idea list on completion.
- Scrollable list of `GeneratedIdeaCard` components sorted by `idea_score`.

#### GeneratedIdeaCard.tsx

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

#### AddToWatchlistButton.tsx

Location: `frontend/components/ideas/AddToWatchlistButton.tsx`

States:
- Default: `[ + Add to Watchlist ]` — clickable.
- Loading: spinner, disabled.
- Added: `[ Added ✓ ]` — green, disabled. Persists for the session.

On success: triggers a toast notification via the existing toast system.

---

## 15. Notification Content Templates

### In-app notification (STRONG BUY fired)

```
STRONG BUY SIGNAL — [TICKER]
All conditions confirmed. Historically favorable entry zone: $[low] – $[high]
Ideal entry: $[ideal] | Confidence: [confidence]% | 90-day win rate: [win_rate]%
Worst historical drawdown: -[drawdown]% | Invalidation: $[invalidation]
This is based on historical data, not a guarantee.
```

### Email notification

**Subject:** `NextGenStock: Buy signal triggered for [TICKER]`

**Body:** Same content as the in-app notification, plus:
```
View your Opportunities page: [link to /opportunities]
```

Both templates are rendered inside `notification_service.dispatch_notification()`. The existing service already abstracts channel routing — V3 adds no new notification channels.

---

## 16. Approved Wording Constraints

The following words and phrases are **prohibited** in all UI text, notification copy, log messages surfaced to users, and API response strings:

| Prohibited | Approved replacement |
|---|---|
| "guaranteed" | "historically favorable" |
| "safe" (in investment context) | "high-probability entry zone" |
| "certain to go up" | "positive outcome rate" |
| "can't lose" | "confidence score" |

These constraints apply to `reason_summary`, `thesis`, notification bodies, tooltip text, and card copy. They do not apply to internal log messages.

---

## 17. Integration Points — Extend vs Create New

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

## 18. Database Migrations

Three new Alembic migrations, chained from the current V2 head. Each implements `downgrade()`.

| Order | Table | Migration file |
|---|---|---|
| 1 | `user_watchlist` | `xxxx_add_user_watchlist.py` |
| 2 | `buy_now_signals` | `xxxx_add_buy_now_signals.py` |
| 3 | `generated_ideas` | `xxxx_add_generated_ideas.py` |

**Note on `user_watchlist`:** The spec asks to check if `watchlist_ideas` already covers this. It does not — `WatchlistIdea` requires a thesis title and is linked through a many-to-many ticker join. A direct `(user_id, ticker)` table is cleaner for scanner use.

---

## 19. Acceptance Criteria

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

## 20. Testing Requirements

### Backend unit tests

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

### Integration tests

- Ticker added to watchlist → `calculate_buy_zone()` called in background → `BuyNowSignal` evaluated → notification dispatched when all conditions pass.
- Idea card "Add to Watchlist" → `UserWatchlist` entry created → `PriceAlertRule` created with `entered_buy_zone` type → `added_to_watchlist=True` set on idea row.
- News scan returns valid RSS fixture → ticker extracted → `GeneratedIdea` row created with `source="news"` and `news_headline` populated.

---

## 21. Dependencies and Risks

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

## 22. Implementation Order

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

## 23. Open Questions

| # | Question | Decision needed by |
|---|---|---|
| OQ-01 | Should `POST /api/watchlist` live in `api/opportunities.py` or a new `api/watchlist.py`? Option A keeps the router count lower; Option B is cleaner separation. | Before step 10 |
| OQ-02 | How is `last_scan_at` stored for `GET /api/ideas/generated/last-scan`? Options: (a) process-level dict, (b) a `system_scan_metadata` single-row table, (c) query `MAX(generated_ideas.generated_at)`. Option (c) is zero-overhead but only works if ideas table is always populated. | Before step 13 |
| OQ-03 | The `not_near_earnings` condition currently relies on the manual `near_earnings` flag from V2 `WatchlistIdeaTicker`. For tickers added directly via `UserWatchlist` (not through an idea), this flag is not set. Should V3 default to `near_earnings=False` (pass condition) or `near_earnings=True` (conservative, suppress)? | Before step 6 |
| OQ-04 | Should `buy_now_signals` rows be pruned automatically? If yes: rolling 30-day retention by a scheduled cleanup job, or on-read filtering only? | Before step 2 |
| OQ-05 | The spec states `idea_score` replaces the existing `composite_score` for ranked ideas. Confirm that `GET /api/scanner/ideas` (V2) continues to return `composite_score`-ranked results from the in-process cache, while `GET /api/ideas/generated` (V3) uses `idea_score` from the DB. No migration of V2 behavior. | Before step 7 |

---

## 24. Appendix

### A. Supported themes

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

### B. Conservative scanner definition (from spec, for reference)

Conservative means all three of:
1. Stock is in an established uptrend (price above both 50-day AND 200-day MA).
2. Multiple confirmation signals agree: RSI + volume + trend regime all aligned.
3. Entry is near a proven support level — never chasing a breakout.

### C. Key existing file paths relevant to V3

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
