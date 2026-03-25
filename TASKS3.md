# TASKS3.md

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
