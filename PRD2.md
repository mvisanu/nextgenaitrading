# Product Requirements Document: NextGenStock — Feature Expansion

**Version:** 2.0
**Date:** 2026-03-24
**Status:** Draft
**Supersedes:** PRD.md (v1.0, 2026-03-19)

---

## 1. Executive Summary

This document covers the second major feature wave for NextGenStock: an Intelligent Buy Zone Estimator, a Smart Price Alert Engine, an Optional Auto-Buy Execution system, a Theme / World Trend Scoring Engine, and an Idea Pipeline with conviction-weighted watchlists. Together these five features transform the platform from a backtest-and-execute tool into a continuous market intelligence layer that surfaces high-probability entry opportunities, notifies users in real time, and optionally executes trades autonomously — all within the same secure, per-user-isolated architecture established in v1.

---

## 2. Problem Statement

The v1 platform lets users run strategies and review historical results, but it is entirely reactive: users must know which ticker to run, when to run it, and manually interpret the output. There is no proactive layer that watches a universe of stocks, identifies when conditions become favorable, or alerts the user before an opportunity passes. This gap means users either miss entries or spend significant time manually checking each ticker. The five features in this PRD close that gap by introducing a structured intelligence pipeline from idea capture through to optional automated execution.

---

## 3. Goals & Success Metrics

### Business Goals

- Increase daily active sessions by giving users a reason to return to the platform every trading day
- Establish a defensible data moat through per-user idea history, conviction scores, and theme alignment records
- Lay the groundwork for a premium tier gated on auto-buy execution and real-time alert quotas
- Maintain zero cross-user data leaks and zero guaranteed-profit language throughout all new features

### User Goals

- Know immediately when a tracked ticker enters a historically favorable buy zone
- Understand exactly why a buy zone was identified, not just that it was
- Save and rank investment theses without committing to a trade
- Optionally let the platform execute small positions when all risk controls pass

### Key Performance Indicators (KPIs)

| KPI | Target | Measurement Method |
|-----|--------|--------------------|
| Buy zone calculation latency (on-demand) | < 8 seconds p95 | Backend request logs |
| Alert evaluation cycle time | < 60 seconds end-to-end | Scheduler job logs |
| Auto-buy dry-run API response | < 3 seconds p95 | Backend request logs |
| False alert rate (alert fired but zone not actually entered) | < 2% | Alert audit log sampling |
| Cross-user data access incidents | 0 | Automated ownership-check test suite |
| UI text containing banned profit language | 0 phrases | Pre-release linting scan |
| Theme score refresh staleness | < 6 hours | Scheduler completion logs |
| Buy zone snapshot staleness | < 1 hour | Scheduler completion logs |

---

## 4. Target Users & Personas

### Primary Persona: Solo Quant Hobbyist — "Alex" (carried from v1)

- **Role / Context:** Individual investor with programming literacy; already using v1 strategy runs and backtests; wants proactive signals without building a separate monitoring script
- **Key Pain Points:** Misses entries because there is no alert when a stock pulls back into a good zone; spends time manually re-running strategies to check regime; no structured place to record why a stock is interesting
- **Jobs To Be Done:** Set a buy zone alert on NVDA and get notified when price approaches; record a thesis about AI infrastructure plays with linked tickers and a conviction rating; review ranked opportunity list each morning

### Secondary Persona: Power User / Small Fund Operator — "Morgan" (carried from v1)

- **Role / Context:** Manages paper and live Alpaca accounts; evaluates multiple opportunities simultaneously; values audit trails above all else
- **Key Pain Points:** Cannot delegate monitoring to the platform; must manually verify each safeguard before placing a trade; no structured log of why an auto-trade was or was not executed
- **Jobs To Be Done:** Enable auto-buy only for paper mode; review the full safeguard breakdown for every blocked decision; see which tickers are closest to triggering across theme categories

### Tertiary Persona: Theme Investor — "Jordan" (new in v2)

- **Role / Context:** Invests thematically — AI infrastructure, renewable energy, defense — and wants to track an entire basket of tickers aligned to a macro view
- **Key Pain Points:** No way to see which tickers in a theme are best positioned technically; conviction about a theme does not translate into prioritized action
- **Jobs To Be Done:** Tag a group of tickers under "AI" and "power infrastructure"; see them ranked by entry quality and theme alignment; get alerted when the highest-conviction one enters a favorable zone

---

## 5. Scope

### In Scope (v2 MVP)

- **Feature A — Intelligent Buy Zone Estimator:** On-demand and scheduled calculation of buy zone ranges, confidence scores, expected return/drawdown estimates, and human-readable explanations for any yfinance-trackable ticker
- **Feature B — Smart Price Alert Engine:** Six alert types evaluated on a 5-minute scheduler cycle with in-app, email, and webhook notification channels; per-rule cooldown and market-hours filtering
- **Feature C — Optional Auto-Buy Execution:** Nine-safeguard decision engine; disabled by default; paper-mode default when enabled; full decision log; dry-run endpoint; broker execution via existing `factory.py`
- **Feature D — Theme / World Trend Scoring Engine:** Ten supported themes; blended score from sector mapping, user tags, and idea thesis text; 6-hour refresh cycle; theme score feeds into buy zone confidence and idea ranking
- **Feature E — Idea Pipeline and Conviction Watchlist:** CRUD idea cards with thesis text, theme tags, linked tickers, conviction slider, and watch-only guard; composite auto-ranking formula
- **Seven new database tables** with full Alembic migrations (reversible)
- **Four new frontend pages:** `/opportunities`, `/ideas`, `/alerts`, `/auto-buy`
- **Buy zone analysis panel** added to existing stock detail views
- **Background scheduler** (APScheduler) wired into FastAPI lifespan
- **Unit and integration test suites** for all five features

### Out of Scope (v2)

- WebSocket real-time price streaming (alert evaluation remains poll-based)
- Robinhood broker execution (stub remains; auto-buy routes through Alpaca only)
- News ingestion pipeline or NLP classification (theme scoring uses sector mapping and user tags only)
- Earnings date API integration (earnings blackout uses a static or manually maintained flag in v2; live earnings calendar is post-v2)
- Mobile native apps
- Subscription billing or feature gating
- Social or sharing features between users
- Admin panel

### Future Considerations (Post-v2)

- Real-time alert delivery via WebSocket or Alpaca streaming
- News/topic classification pipeline feeding theme scores automatically
- Live earnings calendar integration (Polygon.io or similar)
- Robinhood auto-buy support once the client is fully implemented
- User-configurable theme definitions beyond the ten built-in themes
- Strategy marketplace that exposes buy zone signals as a shareable artifact
- Notification channels: Discord webhook, Slack webhook, SMS

---

## 6. Functional Requirements

### 6.1 Feature A — Intelligent Buy Zone Estimator

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-A01 | System calculates a buy zone for any yfinance-trackable ticker on demand via `GET /api/stocks/{ticker}/buy-zone` | Must Have | Returns latest snapshot if < 1 hour old; otherwise triggers recalculation |
| FR-A02 | Force-recalculate endpoint `POST /api/stocks/{ticker}/recalculate-buy-zone` persists a new snapshot and returns the result | Must Have | Always runs full pipeline regardless of snapshot age |
| FR-A03 | Calculation pipeline has seven independently scored layers: trend quality (0.20), pullback quality (0.20), support proximity (0.20), volatility normalization (0.10), historical analog win rate (0.20), drawdown penalty (0.05), theme alignment bonus (0.05) | Must Have | Each layer returns a sub-score 0.0–1.0 and one explanation string |
| FR-A04 | Buy zone range (`buy_zone_low`, `buy_zone_high`) is derived from ATR-adjusted support bands at the reward/risk optimum identified by analog scoring | Must Have | |
| FR-A05 | Result includes `confidence_score`, `entry_quality_score`, `expected_return_30d`, `expected_return_90d`, `expected_drawdown`, `positive_outcome_rate_30d`, `positive_outcome_rate_90d`, `invalidation_price`, `time_horizon_days` | Must Have | All fields persisted to `stock_buy_zone_snapshots` |
| FR-A06 | Result includes `explanation` array of human-readable strings, one per scoring layer plus any blocking conditions | Must Have | Displayed verbatim in UI |
| FR-A07 | `feature_payload_json` field captures raw inputs (OHLCV window, indicator values) for post-hoc auditability | Must Have | Never exposed in API response; backend-only |
| FR-A08 | `user_id` is nullable on `stock_buy_zone_snapshots`; system-wide snapshots (user_id = NULL) may be shared across users to reduce redundant computation | Should Have | Per-user recalculate always produces a user-scoped row |
| FR-A09 | Historical OHLCV data is loaded via the existing backtesting data loader, not a separate yfinance call | Must Have | Prevents duplicated data fetching logic |
| FR-A10 | Analog scoring finds historical windows with similar multi-factor state (RSI band, ATR ratio, trend slope, pullback depth) and computes forward returns at 5, 20, 60, and 120 trading days | Must Have | Minimum 5 analog matches required to produce a score; else confidence is capped at 0.40 |
| FR-A11 | Scheduler refreshes all buy zone snapshots older than 1 hour every 60 minutes | Must Have | Job is idempotent; logs start, finish, and error per ticker |
| FR-A12 | No result text uses the banned phrases listed in Section 13; all probabilistic language follows the approved vocabulary | Must Have | Enforced by pre-release linting scan |

### 6.2 Feature B — Smart Price Alert Engine

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-B01 | Users can create, read, update, and delete `PriceAlertRule` records via `/api/alerts` CRUD endpoints | Must Have | All operations scoped by `current_user.id`; 403 on ownership mismatch |
| FR-B02 | Six alert types supported: `entered_buy_zone`, `near_buy_zone`, `below_invalidation`, `confidence_improved`, `theme_score_increased`, `macro_deterioration` | Must Have | See trigger conditions in Section 9 |
| FR-B03 | `near_buy_zone` alert uses a user-configurable `proximity_pct` threshold stored in `threshold_json` | Must Have | Default 2.0% |
| FR-B04 | `confidence_improved` fires when `confidence_score` increases by >= 0.10 versus the previous snapshot | Must Have | |
| FR-B05 | `theme_score_increased` fires when `theme_score_total` increases by >= 0.15 | Must Have | |
| FR-B06 | Each rule has a `cooldown_minutes` field (default 60) that prevents re-firing within the cooldown window after the last trigger | Must Have | |
| FR-B07 | `market_hours_only` flag (default True) suppresses alert evaluation outside NYSE market hours (09:30–16:00 ET, weekdays) | Must Have | |
| FR-B08 | Scheduler evaluates all enabled alert rules every 5 minutes | Must Have | Evaluation is idempotent across concurrent runs |
| FR-B09 | Notifications route through the `NotificationChannel` abstraction (`InAppNotification`, `EmailNotification`, `WebhookNotification`) | Must Have | v2 ships InApp; Email and Webhook are wired but configurable |
| FR-B10 | Alert evaluation results (triggered / skipped / cooldown) are written to the application log | Must Have | |
| FR-B11 | UI `/alerts` page displays all user alert rules with enable/disable toggle, alert type, threshold, and last-triggered timestamp | Must Have | |

### 6.3 Feature C — Optional Auto-Buy Execution

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-C01 | `AutoBuySettings.enabled` defaults to `False` for every user; cannot be set to `True` without the user completing the confirmation dialog | Must Have | Dialog text: "Enabling auto-buy may result in real orders being placed. Confirm you understand the risks." |
| FR-C02 | `AutoBuySettings.paper_mode` defaults to `True`; switching to live mode requires a second explicit confirmation | Must Have | |
| FR-C03 | Nine safeguard checks must all pass before any order is submitted: `price_inside_buy_zone`, `confidence_above_threshold`, `drawdown_within_limit`, `liquidity_filter`, `spread_filter`, `not_near_earnings`, `position_size_limit`, `daily_risk_budget`, `no_duplicate_order` | Must Have | Any single failure produces decision state `blocked_by_risk` |
| FR-C04 | Every decision is persisted to `auto_buy_decision_logs` with the full safeguard breakdown (`reason_codes_json` contains PASSED or FAILED: <reason> per check) | Must Have | |
| FR-C05 | `POST /api/auto-buy/dry-run/{ticker}` runs the full decision pipeline and returns the result without submitting an order, regardless of settings | Must Have | `dry_run: true` in response |
| FR-C06 | Order submission reuses `broker/factory.py` → `get_broker_client()` → `client.place_order()` | Must Have | No new broker abstraction |
| FR-C07 | When `paper_mode=True`, route to `AlpacaClient(paper=True)`; log simulated order details without hitting live broker | Must Have | |
| FR-C08 | Decision states are: `candidate`, `ready_to_alert`, `ready_to_buy`, `blocked_by_risk`, `order_submitted`, `order_filled`, `order_rejected`, `cancelled` | Must Have | |
| FR-C09 | Scheduler evaluates auto-buy candidates every 5 minutes; candidates are tickers from user's active watchlist ideas with `tradable=True` | Must Have | |
| FR-C10 | `GET /api/auto-buy/decision-log` returns paginated log of all decisions for the current user | Must Have | |
| FR-C11 | High theme score on a poor technical setup must never override the `price_inside_buy_zone` or `confidence_above_threshold` checks | Must Have | Non-negotiable per feature spec |
| FR-C12 | UI `/auto-buy` settings panel shows each safeguard check and its current pass/fail state for the most recent dry-run result | Should Have | |

### 6.4 Feature D — Theme / World Trend Scoring Engine

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-D01 | Ten themes are supported in v2: `ai`, `renewable_energy`, `power_infrastructure`, `data_centers`, `space_economy`, `aerospace`, `defense`, `robotics`, `semiconductors`, `cybersecurity` | Must Have | |
| FR-D02 | Theme score is a blend of: sector/industry mapping (yfinance sector field), curated ticker-to-theme tag map, user-assigned tags from watchlist ideas, and analyst notes from idea thesis text | Must Have | News classification is out of scope for v2 |
| FR-D03 | `ThemeScoreResult` includes `theme_score_total` (0.0–1.0), `theme_scores_by_category` (dict), `narrative_momentum_score`, `sector_tailwind_score`, `macro_alignment_score`, `user_conviction_score`, and `explanation` array | Must Have | |
| FR-D04 | `GET /api/stocks/{ticker}/theme-score` returns the current score; `POST /api/stocks/{ticker}/theme-score/recompute` forces a fresh calculation | Must Have | |
| FR-D05 | Scheduler refreshes all theme scores every 360 minutes | Must Have | Job is idempotent |
| FR-D06 | Theme score feeds into buy zone confidence (5% weight per FR-A03) and idea ranking formula (35% weight per FR-E03) | Must Have | |
| FR-D07 | User-assigned theme tags on a watchlist idea update the `user_conviction_score` sub-component for all linked tickers | Must Have | |
| FR-D08 | `StockThemeScore` table has no `user_id` column; scores are system-wide per ticker | Must Have | User influence is captured via `user_conviction_score` computed at query time from that user's ideas |

### 6.5 Feature E — Idea Pipeline and Conviction Watchlist

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-E01 | Users can create, read, update, and delete `WatchlistIdea` records via `/api/ideas` CRUD endpoints | Must Have | Scoped by `current_user.id` |
| FR-E02 | Each idea has: `title`, `thesis` (free text), `conviction_score` (integer 1–10), `watch_only` flag, `tradable` flag, `tags_json` (list of theme strings), and one-or-more linked `WatchlistIdeaTicker` rows | Must Have | |
| FR-E03 | Ideas are auto-ranked by: `(theme_score_total * 0.35) + (entry_quality_score * 0.35) + (conviction_score / 10 * 0.20) + (alert_readiness_bonus * 0.10)` | Must Have | `GET /api/ideas` returns list sorted by `rank_score` descending |
| FR-E04 | Ideas with `watch_only=True` are excluded from all broker actions; the auto-buy engine skips these entirely | Must Have | |
| FR-E05 | Ideas with `tradable=False` (e.g. pre-IPO tickers) are excluded from auto-buy candidate evaluation | Must Have | |
| FR-E06 | UI `/ideas` page includes: add/edit/delete cards, thesis textarea, theme tag multi-select, linked tickers input, watch-only toggle with tooltip, conviction slider 1–10 | Must Have | |
| FR-E07 | `GET /api/ideas` response includes the computed `rank_score` for each idea | Must Have | |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Rationale |
|----|----------|-------------|-----------|
| NFR-01 | Performance | Buy zone on-demand response: < 8 seconds p95 (cold cache) | yfinance + analog scoring is compute-heavy; set user expectation |
| NFR-02 | Performance | Dry-run auto-buy decision: < 3 seconds p95 | User-initiated, synchronous; must feel responsive |
| NFR-03 | Performance | Alert evaluation cycle completes within 60 seconds for up to 500 active rules | Scheduler fires every 5 minutes; must complete well within window |
| NFR-04 | Scalability | Scheduler jobs are idempotent and safe to run with a single worker | Render free tier has one background worker; no distributed locking required at v2 scale |
| NFR-05 | Security | All new API endpoints require `Depends(get_current_user)` | No anonymous access to buy zone, alerts, ideas, or auto-buy |
| NFR-06 | Security | All data reads and writes are scoped by `user_id`; ownership assertions use the existing `assert_ownership()` pattern | Multi-tenancy is non-negotiable |
| NFR-07 | Security | Broker API keys are never returned in auto-buy API responses; auto-buy engine reads credentials in-memory only | Consistent with v1 constraint |
| NFR-08 | Reliability | All scheduler jobs log start, completion, and any per-ticker errors | Enables debugging without stopping the scheduler |
| NFR-09 | Reliability | All new Alembic migrations implement a reversible `downgrade()` | Required for safe rollback |
| NFR-10 | Compliance | No UI text, API response, log line, or comment may use the banned profit language phrases | See Section 13; pre-release linting scan required |
| NFR-11 | Auditability | Every auto-buy order attempt (success or failure) is persisted to `auto_buy_decision_logs` before the broker call is made | Ensures an audit record exists even if the broker call hangs |
| NFR-12 | Observability | Buy zone calculation, alert evaluation, and auto-buy decisions are logged at INFO level with ticker, user_id, and outcome | Structured logs compatible with Render log drain |

---

## 8. Authentication and Authorisation

All five features are additive to the existing auth architecture. No changes to the auth layer are required.

- All new endpoints use `Depends(get_current_user)` from `auth/dependencies.py`
- Access token: 15-minute expiry, HTTP-only cookie, SameSite=Lax (unchanged)
- Refresh token: 7-day expiry, stored as SHA-256 hash in `UserSession` (unchanged)
- `auto_buy_settings.enabled = True` requires a client-side confirmation dialog before the PATCH call is made; the backend does not enforce a two-step flow — the client is responsible for the UX gate
- `auto_buy_settings.paper_mode = False` (live mode) requires a second confirmation dialog in the UI
- No new roles or permission tiers are introduced in v2; all users have identical capability access

---

## 9. Data Model (High-Level)

Seven new tables are added to the existing 14-table schema. All existing tables are unchanged.

### `stock_buy_zone_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int, nullable, FK → users | NULL = system-wide snapshot |
| ticker | str | |
| current_price | float | |
| buy_zone_low | float | |
| buy_zone_high | float | |
| confidence_score | float | 0.0–1.0 |
| entry_quality_score | float | 0.0–1.0 |
| expected_return_30d | float | percent |
| expected_return_90d | float | percent |
| expected_drawdown | float | percent, negative |
| positive_outcome_rate_30d | float | 0.0–1.0 |
| positive_outcome_rate_90d | float | 0.0–1.0 |
| invalidation_price | float | |
| horizon_days | int | |
| explanation_json | dict | list of explanation strings |
| feature_payload_json | dict | raw inputs; not exposed in API |
| model_version | str | |
| created_at | datetime | |

### `stock_theme_scores`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| ticker | str | system-wide, no user_id |
| theme_score_total | float | 0.0–1.0 |
| theme_scores_json | dict | per-category breakdown |
| narrative_momentum_score | float | |
| sector_tailwind_score | float | |
| macro_alignment_score | float | |
| created_at | datetime | |
| updated_at | datetime | |

### `watchlist_ideas`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users | |
| title | str | |
| thesis | str | free text |
| conviction_score | int | 1–10 |
| watch_only | bool | default False |
| tradable | bool | default True |
| tags_json | list | theme strings |
| metadata_json | dict | extensible |
| created_at | datetime | |
| updated_at | datetime | |

### `watchlist_idea_tickers`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| idea_id | int FK → watchlist_ideas | |
| ticker | str | |
| is_primary | bool | |

### `price_alert_rules`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users | |
| ticker | str | |
| alert_type | str | enum: see FR-B02 |
| threshold_json | dict | e.g. {"proximity_pct": 2.0} |
| cooldown_minutes | int | default 60 |
| market_hours_only | bool | default True |
| enabled | bool | default True |
| last_triggered_at | datetime, nullable | |
| created_at | datetime | |
| updated_at | datetime | |

### `auto_buy_settings`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users, unique | one row per user |
| enabled | bool | default False |
| paper_mode | bool | default True |
| confidence_threshold | float | default 0.70 |
| max_trade_amount | float | hard dollar cap per trade |
| max_position_percent | float | max % of portfolio per position |
| max_expected_drawdown | float | e.g. -0.10 |
| allow_near_earnings | bool | default False |
| allowed_account_ids_json | list | broker account IDs permitted to execute |
| created_at | datetime | |
| updated_at | datetime | |

### `auto_buy_decision_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | |
| user_id | int FK → users | |
| ticker | str | |
| decision_state | str | see FR-C08 |
| reason_codes_json | list | PASSED or FAILED: <reason> per safeguard |
| signal_payload_json | dict | buy zone snapshot used |
| order_payload_json | dict, nullable | filled only if order was submitted |
| dry_run | bool | |
| created_at | datetime | |

### Entity Relationships (new tables only)

```
users (existing)
  ├─< watchlist_ideas (user_id)
  │     └─< watchlist_idea_tickers (idea_id)
  ├─< price_alert_rules (user_id)
  ├─< auto_buy_settings (user_id, unique)
  └─< auto_buy_decision_logs (user_id)

stock_buy_zone_snapshots (user_id nullable → users)
stock_theme_scores (no user_id; system-wide)
```

---

## 10. Integrations and External Dependencies

| Service / Module | Purpose | Auth Method | Notes |
|-----------------|---------|-------------|-------|
| `backtesting/engine.py` (existing) | OHLCV data loading for buy zone calculation | Internal | Reuse data loader; do not duplicate yfinance calls |
| `broker/factory.py` (existing) | Order execution in auto-buy engine | Fernet-decrypted credentials | Paper mode routes to `AlpacaClient(paper=True)` |
| `strategies/` (existing) | Regime and signal logic for trend quality layer | Internal | Read-only reuse |
| APScheduler | Background job scheduling | N/A | Added via `apscheduler` package; wired to FastAPI lifespan |
| yfinance | Sector/industry field for theme scoring | None | Already a dependency |
| `notification_service.py` (new) | Alert delivery abstraction | Per-channel config | In-app ships v2; email/webhook are wired but require config |

---

## 11. Platform and Deployment

- **Platform:** Web (unchanged from v1)
- **Backend hosting:** Render (FastAPI on web service; APScheduler runs in-process on the same dyno)
- **Frontend hosting:** Vercel (Next.js, unchanged)
- **Database:** Supabase PostgreSQL (unchanged); seven new tables added via Alembic migrations
- **Offline support:** None; all features require an active connection
- **Browser targets:** Same as v1 — modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- **Background worker:** APScheduler `AsyncIOScheduler` runs inside the FastAPI process; no separate Render Background Worker service required in v2
- **New environment variables required:**

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCHEDULER_ENABLE` | Master on/off switch for all scheduled jobs | `true` |
| `BUY_ZONE_REFRESH_MINUTES` | Scheduler interval for buy zone refresh | `60` |
| `THEME_SCORE_REFRESH_MINUTES` | Scheduler interval for theme score refresh | `360` |
| `ALERT_EVAL_MINUTES` | Scheduler interval for alert evaluation | `5` |
| `AUTO_BUY_EVAL_MINUTES` | Scheduler interval for auto-buy evaluation | `5` |
| `NOTIFICATION_EMAIL_ENABLED` | Enable email notification channel | `false` |
| `NOTIFICATION_WEBHOOK_ENABLED` | Enable webhook notification channel | `false` |

---

## 12. Monetisation Model

No changes to monetisation in v2. The platform remains free to operate. Auto-buy execution and real-time alert quotas are identified as potential premium-tier gates post-v2 but are not gated in this release.

---

## 13. Constraints and Assumptions

### Language Constraints (Non-Negotiable)

The following phrases are banned from all code, UI text, API responses, comments, and log messages. A linting scan must be run before any v2 feature is marked complete:

| Banned phrase | Required replacement |
|---------------|---------------------|
| "guaranteed profit" | "historically favorable outcome" |
| "no chance of loss" | "lower-risk area based on past data" |
| "safe entry" | "high-probability entry zone" |
| "certain to go up" | "positive outcome rate of X%" |
| "buy now" (as a command) | "entered buy zone" |
| "guaranteed winner" | (remove entirely or rephrase) |
| "safe forever" | (remove entirely or rephrase) |

Every recommendation surface must expose: confidence score, expected upside, expected drawdown, time horizon, major assumptions, and invalidation level.

### Technical Constraints

- **Extend, do not replace:** If any part of a feature already exists in the codebase, inspect and extend it; never rebuild from scratch
- **Backwards compatibility:** All existing v1 API endpoints, data models, and frontend pages must continue to function unchanged
- **Migration chain:** All new Alembic migrations must chain from the current migration head; every migration must have a working `downgrade()`
- **Auth pattern:** All new endpoints use `Depends(get_current_user)` from `auth/dependencies.py`; no new auth mechanism is introduced
- **Naming conventions:** Follow existing SQLAlchemy 2.x `Mapped[]` / `mapped_column()` patterns, async session usage from `db/session.py`, and router registration style from `main.py`
- **Charting libraries:** Do not introduce new charting libraries; use Lightweight Charts for price overlays, Recharts for metric panels, Plotly for scatter/heatmap if needed

### Auto-Buy Constraints

- Auto-buy is disabled by default and requires explicit user opt-in through a confirmation dialog
- Paper mode is the default when auto-buy is enabled; live mode requires a second confirmation
- All nine safeguards must pass; partial passes are not sufficient
- High theme score never overrides price or risk controls
- Every order attempt is logged to `auto_buy_decision_logs` before the broker call

### Assumptions

- The existing Alpaca broker client (`alpaca_client.py`) supports `place_order()` with a paper flag parameter; if not, this must be confirmed before implementing Feature C
- yfinance provides sector and industry fields for all tickers in the supported universe; tickers with no sector data receive a zero `sector_tailwind_score`
- APScheduler can run reliably inside the Render web dyno without being killed by the platform's request timeout; if this proves unstable, a Render Background Worker service will be added post-v2
- The five-minute scheduler interval for alert evaluation is fast enough for the "entered buy zone" alert type given that buy zone snapshots themselves refresh hourly; sub-minute freshness is not promised
- Earnings date data is not available from an integrated live source in v2; the `not_near_earnings` safeguard in Feature C is implemented as a manual flag on `WatchlistIdeaTicker` until a live earnings calendar is integrated

---

## 14. New Backend Directory Structure

The following additions extend the existing backend layout. No existing files are moved or renamed.

```
backend/app/
  api/
    buy_zone.py          # GET /api/stocks/{ticker}/buy-zone, POST recalculate
    theme_score.py       # GET /api/stocks/{ticker}/theme-score, POST recompute
    alerts.py            # CRUD /api/alerts
    ideas.py             # CRUD /api/ideas
    auto_buy.py          # settings, decision-log, dry-run
    opportunities.py     # GET /api/opportunities (aggregated ranked list)
  services/
    buy_zone_service.py        # zone calculation orchestrator
    analog_scoring_service.py  # historical pattern matching, forward return scoring
    theme_scoring_service.py   # theme alignment blending
    alert_engine_service.py    # alert rule evaluation and dispatch
    auto_buy_engine.py         # nine-safeguard decision engine
    notification_service.py    # NotificationChannel abstraction
  scheduler/
    jobs.py              # APScheduler setup, job registration
    tasks/
      refresh_buy_zones.py
      refresh_theme_scores.py
      evaluate_alerts.py
      evaluate_auto_buy.py
  models/
    buy_zone.py          # StockBuyZoneSnapshot
    theme_score.py       # StockThemeScore
    idea.py              # WatchlistIdea, WatchlistIdeaTicker
    alert.py             # PriceAlertRule
    auto_buy.py          # AutoBuySettings, AutoBuyDecisionLog
```

---

## 15. New Frontend Directory Structure

```
frontend/app/
  opportunities/page.tsx       # watchlist + buy zone ranked dashboard
  ideas/page.tsx               # idea and thesis management
  alerts/page.tsx              # alert rule configuration
  auto-buy/page.tsx            # auto-buy settings and decision log

frontend/components/
  buy-zone/
    BuyZoneCard.tsx            # zone range, confidence meter, invalidation level
    HistoricalOutcomePanel.tsx # positive outcome rate, return distribution
    ThemeScoreBadge.tsx        # per-category theme alignment display
  ideas/
    IdeaForm.tsx               # create/edit idea with all fields
    IdeaList.tsx               # ranked list with composite score display
  alerts/
    AlertConfigForm.tsx        # alert type, threshold, cooldown, toggle
  auto-buy/
    AutoBuySettings.tsx        # master switch, mode toggle, parameter sliders
    AutoBuyDecisionLog.tsx     # paginated log table with state badges
```

### `/opportunities` Page Requirements

- Table columns: ticker, current price, buy zone range, distance to zone (%), confidence score, theme score, alert status, auto-buy readiness, last updated
- Sorting: by confidence (desc), by distance to zone (asc), by theme score (desc), by risk/reward ratio
- Filtering: by theme tag, by sector, by alert status, by auto-buy eligibility
- Each row links to the stock detail page with the buy zone analysis panel

### `/ideas` Page Requirements

- Add, edit, and delete idea cards
- Thesis text area (free form)
- Theme tag multi-select from the ten supported themes
- Linked tickers input (primary ticker flag)
- Watch-only toggle with tooltip: "Watch-only ideas are tracked but never sent to a broker"
- Conviction slider 1–10
- List sorted by composite rank score descending; rank score displayed per card

### `/alerts` Page Requirements

- Per-ticker alert rules listed with shadcn/ui Switch for enable/disable
- Form fields: alert type dropdown, proximity threshold (for `near_buy_zone`), cooldown window, market hours only toggle
- Last triggered timestamp displayed per rule

### `/auto-buy` Page Requirements

- Settings panel: master enable switch with confirmation dialog, paper/live mode toggle with second confirmation for live, per-trade max amount input, confidence threshold slider, max expected drawdown slider, earnings blackout toggle, allowed broker accounts multi-select
- Decision log table: timestamp, ticker, decision state, reason codes (expandable), dry-run flag
- Badge colors: green = `order_filled`, amber = `ready_to_buy`, red = `blocked_by_risk`, gray = `candidate`

### Stock Detail Page Enhancement

Add a collapsible "Buy Zone Analysis" section to any existing stock detail view. Contents:

- Buy zone range, confidence score (as percentage)
- Expected 30-day return, expected drawdown
- 90-day positive outcome rate, invalidation price
- Expandable explanation string list
- Theme alignment: one `ThemeScoreBadge` per scored category
- Alert toggle (creates or enables a `near_buy_zone` rule for this ticker)
- Auto-buy eligibility badge (reads from the latest `auto_buy_decision_log` for this ticker)

---

## 16. Implementation Order

Follow this sequence to minimize integration conflicts:

1. Database migrations (all 7 tables, chained from current head)
2. ORM models (all 5 new model files)
3. Pydantic schemas for all new request/response DTOs
4. `buy_zone_service.py` + `analog_scoring_service.py`
5. `theme_scoring_service.py`
6. `alert_engine_service.py` + `notification_service.py`
7. `auto_buy_engine.py`
8. API routers (`buy_zone.py`, `theme_score.py`, `alerts.py`, `ideas.py`, `auto_buy.py`, `opportunities.py`); register all in `main.py`
9. Scheduler setup (`scheduler/jobs.py` + four task files); wire into FastAPI lifespan
10. Frontend pages and components (four new pages + stock detail panel)
11. Unit and integration tests
12. Pre-release linting scan for banned language phrases

---

## 17. Testing Requirements

### Backend Unit Tests

| File | Coverage target |
|------|----------------|
| `test_buy_zone_service.py` | Layer scoring, zone calculation, edge cases: no data, single bar, fewer than 5 analogs |
| `test_analog_scoring.py` | Historical window matching, forward return computation, minimum analog threshold |
| `test_theme_scoring.py` | Theme tag mapping, score blending, zero-sector-data fallback |
| `test_alert_engine.py` | Each of the six alert types, cooldown logic, market-hours filter |
| `test_auto_buy_engine.py` | Each of the nine safeguards independently, full pipeline pass, full pipeline block |
| `test_auto_buy_api.py` | Dry-run endpoint, settings CRUD, decision log retrieval, ownership enforcement |

### Backend Integration Tests

| Scenario | Description |
|----------|-------------|
| Price → zone → alert end-to-end | Simulate price update → buy zone recalculation → alert rule evaluation → notification dispatch |
| Dry-run auto-buy, all safeguards pass | All nine checks pass; decision state is `ready_to_buy`; no broker call made |
| Dry-run auto-buy blocked by earnings | `not_near_earnings` check fails; `reason_codes_json` contains `FAILED: earnings within 3 days` |
| Idea creation → theme score → ranking | Create idea with theme tags → recompute theme score for linked ticker → verify `rank_score` updates |

All tests mock `yfinance`, broker clients, and notification channels. No live network calls in the test suite.

---

## 18. Acceptance Criteria

The v2 feature set is complete when all of the following are true:

- [ ] User can view a computed buy zone with confidence score, expected upside, expected drawdown, and invalidation price for any tracked ticker
- [ ] Buy zone explanation strings are displayed verbatim in the UI
- [ ] User can create, enable, and disable price alert rules per ticker and per alert type
- [ ] Alert engine evaluates rules on a 5-minute schedule and dispatches in-app notifications
- [ ] User can save idea and thesis entries with theme tags, linked tickers, watch-only flag, and conviction rating
- [ ] Ideas are auto-ranked by the composite formula and the rank score is visible in the UI
- [ ] Theme scores are computed and displayed per ticker with per-category breakdown
- [ ] Auto-buy settings can be configured; all nine safeguards are visible in the UI
- [ ] Auto-buy dry-run returns a full decision breakdown with a PASSED or FAILED reason per safeguard
- [ ] Auto-buy is disabled by default; enabling requires an explicit confirmation dialog
- [ ] Switching auto-buy from paper to live mode requires a second confirmation dialog
- [ ] All seven new tables have Alembic migrations chained from the current head with working `downgrade()`
- [ ] All new endpoints return 401 without a valid JWT cookie and 403 on ownership mismatch
- [ ] All data reads and writes are scoped by `user_id`; no cross-user access is possible
- [ ] Pre-release linting scan finds zero instances of the banned profit language phrases in UI, API responses, or backend code
- [ ] Unit tests cover buy zone layer scoring, all six alert trigger conditions, all nine auto-buy safeguards
- [ ] Integration test covers the price → zone → alert end-to-end flow
- [ ] All existing v1 E2E tests continue to pass (no regressions)

---

## 19. Open Questions

| # | Question | Owner | Required before |
|---|----------|-------|----------------|
| OQ-01 | Does `AlpacaClient.place_order()` currently accept a `paper` flag, or does paper routing depend on which base URL the client was instantiated with? Confirm before implementing Feature C broker integration | Engineering | Feature C implementation |
| OQ-02 | What is the earnings date data source? yfinance provides `calendar` data but it is unreliable for near-term dates. Should the `not_near_earnings` safeguard use a manual flag on `WatchlistIdeaTicker` in v2 and a live calendar API in v3? | Product + Engineering | Feature C implementation |
| OQ-03 | Should the scheduler run in-process on the Render web dyno, or should a separate Render Background Worker be provisioned? In-process is simpler but risks being killed on dyno restart | Engineering | Scheduler implementation |
| OQ-04 | Is the InApp notification channel sufficient for v2 launch, or does at least one email provider (e.g. SendGrid) need to be wired before launch? | Product | Feature B implementation |
| OQ-05 | What is the expected ticker universe size per user? Analog scoring is O(n * windows) per ticker; if users track 200+ tickers, the 60-minute refresh window may be too short at launch scale | Engineering | Scheduler implementation |
| OQ-06 | Should `/opportunities` aggregate across all of a user's ideas, or should it show a curated set (e.g. top 50 by rank score)? | Product | Feature E + opportunities page |

---

## 20. Appendix

### Approved Probabilistic Vocabulary

Always use these phrasings when surfacing buy zone or theme score information to users:

- "historically favorable buy zone"
- "high-probability entry area"
- "confidence score of X%"
- "expected drawdown of X%"
- "scenario-based estimate"
- "positive outcome rate of X%"
- "entered buy zone" (not "buy now")
- "invalidation level at $X"
- "X analog setups produced a median Y% return over Z days"

### Safeguard Check Reference (Feature C)

| Safeguard | What it checks |
|-----------|---------------|
| `price_inside_buy_zone` | Current price is within `buy_zone_low`..`buy_zone_high` |
| `confidence_above_threshold` | `confidence_score` >= `AutoBuySettings.confidence_threshold` |
| `drawdown_within_limit` | `expected_drawdown` >= `AutoBuySettings.max_expected_drawdown` |
| `liquidity_filter` | Average daily volume meets a minimum threshold (configurable) |
| `spread_filter` | Bid-ask spread is within an acceptable percentage of mid price |
| `not_near_earnings` | No earnings event within 3 days (or `allow_near_earnings=True`) |
| `position_size_limit` | Order value <= `max_trade_amount` and <= `max_position_percent` of portfolio |
| `daily_risk_budget` | Total auto-buy spend today has not exceeded daily budget |
| `no_duplicate_order` | No open or pending order for this ticker already exists |

### Alert Type Reference (Feature B)

| Alert type | Trigger condition |
|------------|------------------|
| `entered_buy_zone` | Current price moved inside `buy_zone_low`..`buy_zone_high` |
| `near_buy_zone` | Current price within `proximity_pct`% of `buy_zone_low` |
| `below_invalidation` | Current price dropped below `invalidation_price` |
| `confidence_improved` | `confidence_score` increased by >= 0.10 since last snapshot |
| `theme_score_increased` | `theme_score_total` increased by >= 0.15 |
| `macro_deterioration` | `theme_score_total` dropped sharply or sector tailwind reversed |

### Existing Tables Unchanged in v2

`User`, `UserProfile`, `UserSession`, `BrokerCredential`, `StrategyRun`, `TradeDecision`, `BrokerOrder`, `PositionSnapshot`, `CooldownState`, `TrailingStopState`, `VariantBacktestResult`, `WinningStrategyArtifact`, `BacktestTrade`
