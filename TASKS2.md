# TASKS2.md

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
