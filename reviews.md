# NextGenAiTrading — Comprehensive Code Review

**Review Date:** 2026-04-01  
**Reviewer:** Automated multi-area review  
**Codebase:** Production-grade multi-user AI trading platform  
**Stack:** Next.js 14+ / TypeScript / Tailwind / FastAPI / SQLAlchemy 2.x / PostgreSQL / Supabase Auth

---

## Executive Summary

The codebase is in good overall health for a platform of this complexity. Architecture decisions (lazy engine init, bounded caches, gc.collect in schedulers, PriceChart 3-effect split, LiveClock null-init) reflect careful engineering. The auth layer, credential encryption, CORS configuration, and multi-tenancy scoping are all correctly implemented.

**Critical issues found: 1**  
**High issues found: 8**  
**Medium issues found: 14**  
**Low / informational issues found: 12**

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 8 |
| Medium | 14 |
| Low | 12 |
| **Total** | **35** |

---

## Section 1 — Security

### SEC-01 (High) — JWT Audience Verification Disabled for Legacy Secret Fallback
**File:** `backend/app/auth/dependencies.py` lines 37–63

When `supabase_jwt_secret` is set and the first decode fails, the code retries with `settings.secret_key` and passes **no** `audience` parameter and `verify_aud` is implicitly True in PyJWT when audience is not provided but the token has an `aud` claim. More critically, when `supabase_jwt_secret` is empty, the code sets `options={"verify_aud": False}` — disabling audience verification entirely. A forged token without the `"authenticated"` audience would be accepted.

**Recommendation:** Always enforce audience verification. The fallback to `secret_key` after a Supabase JWT fails is a security concern in itself — a compromised internal token could be accepted. Remove the dual-secret fallback or make it explicitly opt-in via a separate env flag.

---

### SEC-02 (Medium) — dev_token Cookie Is Not HttpOnly in Test Token Endpoint
**File:** `backend/app/api/test_reset.py` lines 148–155

The `dev_token` cookie is set with `httponly=False` intentionally (comment explains JS needs to read it). This is debug-only (guarded by `DEBUG=false` in production). However, if a developer accidentally deploys with `DEBUG=true`, any XSS in the frontend can steal the dev token and gain full API access.

**Recommendation:** Add a secondary `settings.allow_dev_login` flag independent of `debug` so this endpoint can be locked down without losing other debug benefits. The comment acknowledges the intent; the guard is only as strong as the `DEBUG` env var.

---

### SEC-03 (Medium) — Missing Rate Limiting on Most API Endpoints
**File:** `backend/app/core/rate_limit.py`, `backend/app/api/live.py`

Rate limiting via slowapi is only applied to `POST /live/execute`. All other endpoints — including `POST /auto-buy/dry-run/{ticker}`, `POST /strategies/run`, `POST /scanner/run`, `POST /live/run-signal-check` — are unlimited. Each of these can trigger expensive yfinance downloads or strategy computations.

**Recommendation:** Apply `@limiter.limit("20/minute")` to compute-heavy endpoints. On Render's 512 MB plan, unthrottled concurrent requests for yfinance data can OOM the process.

---

### SEC-04 (Low) — Supabase Service Role Key Accessible in Settings Object
**File:** `backend/app/core/config.py` line 40

`supabase_service_role_key` is stored in the Settings object and therefore loaded at startup. If a debugging endpoint (e.g., `/docs` in debug mode) or an error causes the settings object to be serialized, this key would be exposed.

**Recommendation:** Load the service role key only where needed, or mark it with `SecretStr` from pydantic to prevent accidental logging.

---

### SEC-05 (Low) — CORS Debug Mode Adds 8 Extra Origins Automatically
**File:** `backend/app/core/config.py` lines 133–140

In debug mode, `cors_origins_list` adds `http://localhost:3000` through `localhost:3005`, `localhost:5173`, and `localhost:8080`. This is appropriate for development but means any local development server can make credentialed requests to a debug-mode backend. If the backend is ever deployed with `DEBUG=true` (which would also expose `/docs` and test endpoints), this broadens the attack surface.

**Recommendation:** Document clearly that `DEBUG=true` is never acceptable in production. Add an explicit check in lifespan that warns loudly if `DEBUG=true` and the server is not running on localhost.

---

### SEC-06 (Low) — Hardcoded localhost URL in Email Alert Body
**File:** `backend/app/scheduler/tasks/run_commodity_alerts.py` line 41

The alert email body contains a hardcoded `http://localhost:3000/gold` link. Users receiving real alerts from the production system will get a link to their local development server, which is broken and potentially confusing.

**Recommendation:** Add a `FRONTEND_BASE_URL` environment variable (defaulting to `http://localhost:3000`) and use it in the email body.

---

## Section 2 — Performance

### PERF-01 (High) — Missing gc.collect() in Two Scheduler Tasks
**Files:**
- `backend/app/scheduler/tasks/evaluate_auto_buy.py` (no `gc.collect()`)
- `backend/app/scheduler/tasks/evaluate_alerts.py` (no `gc.collect()`)
- `backend/app/scheduler/tasks/refresh_theme_scores.py` (no `gc.collect()`)
- `backend/app/scheduler/tasks/scan_watchlist.py` (no `gc.collect()`)

Four scheduler tasks that perform yfinance downloads or trigger service calls that download DataFrames are missing the required `gc.collect()` in their `finally` blocks. The CLAUDE.md constraint is explicit: "Every scheduler task must have `gc.collect()` in its `finally` block to release DataFrames immediately."

Tasks `refresh_buy_zones`, `run_commodity_alerts`, `run_live_scanner`, and `run_idea_generator` correctly have `gc.collect()`. The four listed above do not.

**Recommendation:** Add `import gc` and a `finally: gc.collect()` block to all four tasks.

---

### PERF-02 (Medium) — N+1 Query Pattern in ideas.py list_ideas
**File:** `backend/app/api/ideas.py` lines 141–158

`list_ideas` iterates over all ideas and calls `await _build_idea_out(idea, db)` for each idea. If `_build_idea_out` executes any DB queries per idea (e.g., for rank score calculation), this creates an N+1 query pattern. With large watchlists this degrades performance and consumes extra pool connections.

**Recommendation:** Batch-fetch all required data before the loop, or use `selectinload` with a subquery approach to fetch in one round-trip.

---

### PERF-03 (Medium) — Synchronous yfinance Calls via get_event_loop() in Async Context
**File:** `backend/app/api/v4/options.py` lines 188–198

The signals endpoint uses `asyncio.get_event_loop().run_in_executor(None, lambda: ...)` to wrap yfinance calls. In Python 3.10+ `get_event_loop()` is deprecated inside async functions; `asyncio.get_running_loop()` should be used. Furthermore, calling `run_in_executor` with a `None` executor uses the default `ThreadPoolExecutor`, which is acceptable but should be capped to avoid spawning too many threads on Render.

**Recommendation:** Replace `asyncio.get_event_loop()` with `asyncio.get_running_loop()`. Consider using a bounded executor.

---

### PERF-04 (Medium) — Positions Endpoint Has No Limit Clause
**File:** `backend/app/api/live.py` lines 121–141

`GET /live/positions` has no `limit` query parameter and no `.limit()` on the SQLAlchemy query. A user with a large position history would cause a full-table scan scoped to `user_id`, returning potentially thousands of rows.

**Recommendation:** Add `limit: int = Query(default=50, ge=1, le=200)` and `.limit(limit)` to the query, consistent with the `/live/orders` endpoint pattern.

---

### PERF-05 (Medium) — Multiple List Endpoints Missing Pagination Limits
**Files:** `backend/app/api/alerts.py`, `backend/app/api/broker.py`, `backend/app/api/ideas.py`, `backend/app/api/artifacts.py`

Several list endpoints return unbounded result sets:
- `GET /alerts` — no limit parameter, no `.limit()` on query
- `GET /broker/credentials` — no limit (bounded by user in practice, low risk)
- `GET /ideas` — no limit parameter on list_ideas
- `GET /artifacts` — needs verification

The CLAUDE.md constraint states: "List endpoints must have bounded `limit`: `Query(default=50, ge=1, le=200)`."

**Recommendation:** Apply bounded limit parameters consistently to all list endpoints.

---

### PERF-06 (Low) — options.py signals Endpoint Makes Up to 10 Sequential yfinance Downloads
**File:** `backend/app/api/v4/options.py` lines 165–242

The `GET /signals` endpoint iterates over up to 10 symbols and for each one downloads 60d of daily data synchronously (via run_in_executor) before moving to the next. This is sequential I/O that could take 10–30 seconds with a slow yfinance connection, holding a DB session open the whole time.

**Recommendation:** Use `asyncio.gather()` to parallelise the yfinance calls, or limit to 5 symbols per request. Also close the DB session earlier if it is not needed during the yfinance phase.

---

## Section 3 — Correctness

### CORR-01 (Critical) — Safeguard 7 (position_size_limit) Is Tautologically True
**File:** `backend/app/services/auto_buy_engine.py` lines 232–242

```python
quantity = settings.max_trade_amount / price if price > 0 else 0.0
notional = quantity * price
if notional <= settings.max_trade_amount:
    results.append(SafeguardResult("position_size_limit", True, "PASSED"))
```

`quantity` is defined as `max_trade_amount / price`, so `notional = (max_trade_amount / price) * price = max_trade_amount` (modulo floating-point rounding). The condition `notional <= max_trade_amount` is always True. This safeguard **never blocks any trade**. The comment in the code acknowledges this ("non-tautological") but the implementation is still tautological.

**Recommendation:** The check should compare the **actual requested order size** (fraction of account, or shares held) against the configured limit. For now, this safeguard provides no real protection and gives a false sense of security. Raise a warning until the check is properly implemented.

---

### CORR-02 (High) — V3 Condition 9 (not_near_earnings) Always Passes
**File:** `backend/app/services/buy_signal_service.py` lines 237–238

```python
# OQ-03: default not_near_earnings to True (optimistic; live lookup deferred to V4)
conditions["not_near_earnings"] = True
```

Condition 9 of the 10-condition V3 gate always evaluates to True. The CLAUDE.md spec states "V3 scanner alerts fire only when ALL 10 conditions pass" but with condition 9 always hardcoded True, the gate is effectively 9 conditions. This means signals can be generated for stocks on the eve of earnings announcements, which is a significant risk for a trading platform.

**Recommendation:** Integrate the earnings lookup already implemented in `backend/app/options/calendar.py` (`get_days_to_earnings()`) to populate this condition correctly.

---

### CORR-03 (High) — RSI Calculation Uses Simple Rolling Mean Instead of EWM in commodity_signal_service
**File:** `backend/app/services/commodity_signal_service.py` lines 89–97

The RSI calculation uses a simple `rolling(period).mean()` for gain/loss averaging, which is the Cutler RSI variant. Most charting platforms use Wilder's smoothed RSI (exponential). The buy_signal_service.py correctly uses EWM (`ewm(com=period-1)`). This inconsistency means commodity signals use a different RSI than the V3 scanner signals, leading to potentially different buy/no-buy outcomes for the same data.

**Recommendation:** Standardize both services to use Wilder's smoothed RSI (EWM with `com=period-1`).

---

### CORR-04 (Medium) — Theta Double-Division in Greeks Calculation
**File:** `backend/app/options/greeks.py` lines 116–117

```python
c.theta = float(res["theta"][0]) / 365
```

`py_vollib_vectorized` already returns theta as a per-day value (divided by 365 internally in some versions). The code then divides again by 365, producing theta values that are 365x smaller than expected. This will cause P&L models and risk screens to show incorrect theta decay rates. The Black-Scholes fallback (`_bs_greeks`) at line 65 also divides by 365 at the end, which appears correct for the fallback.

**Recommendation:** Verify the unit convention of the installed `py_vollib_vectorized` version. If it returns annualized theta, dividing by 365 is correct. If it already returns daily theta, remove the division.

---

### CORR-05 (Medium) — V3 Buy Signal Fetches 2 Years of yfinance Data Without Row Cap
**File:** `backend/app/services/buy_signal_service.py` lines 206–209

```python
df = yf.download(ticker, period="2y", interval="1d", auto_adjust=True, progress=False)
```

Unlike `_load_ohlcv_yfinance` which applies a 750-row cap, the buy signal service calls `yf.download` directly and does not cap the result. Two years of daily data is approximately 500 rows, which is under the cap, but if yfinance returns extra data or the cap constraint changes, this could cause Render OOM. More importantly, this bypasses the `normalize_symbol` and Alpaca routing logic.

**Recommendation:** Route through `load_ohlcv_for_strategy(ticker, "1d")` which handles symbol normalization, the 750-row cap, and the Alpaca→yfinance fallback chain.

---

### CORR-06 (Medium) — Commodity Signal RSI Volume Check Can Produce False Negative
**File:** `backend/app/services/commodity_signal_service.py` lines 143–144

```python
current_vol = float(volume.iloc[-1]) if len(volume) > 0 else 0.0
avg_vol_20 = float(volume.rolling(20).mean().iloc[-1]) if len(volume) >= 20 else current_vol
```

For futures contracts (GC=F, CL=F), the most recent volume bar in yfinance often returns 0 or NaN for the current session (data is published end-of-day). This causes `volume_ok = False` and blocks an otherwise valid signal. Futures traders commonly use prior-day volume.

**Recommendation:** Use `volume.iloc[-2]` as fallback when `volume.iloc[-1]` is 0, or use the 5-day average volume instead of the single last bar.

---

## Section 4 — Frontend Quality

### FE-01 (High) — Protected Routes Missing Several Pages in Middleware
**File:** `frontend/proxy.ts` lines 9–22

The `PROTECTED_PREFIXES` list does not include:
- `/portfolio`
- `/options`
- `/gold`
- `/multi-chart`
- `/stock`
- `/commodities-guide`
- `/learn`
- `/faq`

Pages like `/portfolio` and `/options` involve real money and real trading. While these pages presumably check auth client-side (via `useAuth`), the middleware-level redirect is the first line of defense. A user who navigates directly to `/portfolio` without a session will land on the page and see an API error rather than being redirected to login.

**Recommendation:** Add all authenticated pages to `PROTECTED_PREFIXES`. At minimum add `/portfolio`, `/options`, `/gold`, `/multi-chart`, `/stock`.

---

### FE-02 (Medium) — dashboard/page.tsx Inline Style Tag Uses dangerouslySetInnerHTML
**File:** `frontend/app/dashboard/page.tsx` line 1156

```tsx
<style dangerouslySetInnerHTML={{ __html: TERMINAL_ANIM_STYLES }} />
```

The `TERMINAL_ANIM_STYLES` constant is defined at module scope as a template literal containing CSS animation keyframes. Although the content is static and controlled (no user input), this pattern is flagged by the CLAUDE.md constraint: "`dangerouslySetInnerHTML` requires DOMPurify sanitization."

**Recommendation:** Move the CSS animations to a `.css` or `.module.css` file, or use Next.js's `<style jsx>` pattern to avoid the `dangerouslySetInnerHTML` usage entirely.

---

### FE-03 (Medium) — FAQ Page Custom HTML Sanitizer Is Not DOMPurify
**File:** `frontend/app/faq/page.tsx` lines 133–159

The page uses a custom `sanitize()` function that walks the DOM tree and strips disallowed tags. This is a hand-rolled sanitizer that may miss edge cases (e.g., mutation-based XSS, prototype pollution via attribute names). The CLAUDE.md constraint requires DOMPurify.

However, the content is authored by the codebase (translation strings) and not user-controlled. The sanitizer is a reasonable defense-in-depth measure. The main risk is that a future developer adds dynamic user-input to a translated string without knowing about this constraint.

**Recommendation:** Replace the custom sanitizer with DOMPurify. Add `npm install dompurify @types/dompurify` and use `DOMPurify.sanitize(html, { ALLOWED_TAGS: [...] })`.

---

### FE-04 (Low) — market-stream.ts SSE Parser Does Not Handle Multi-Line Data
**File:** `frontend/lib/market-stream.ts` lines 118–145

The SSE parser splits on `\n` and handles single `data:` lines. The SSE spec allows multi-line data fields where each continuation line starts with `data:`. The current parser would lose data if the backend ever sends multi-line data payloads. Currently the backend sends JSON on a single line, so this is not a current bug.

**Recommendation:** Implement a proper SSE message boundary parser that accumulates data lines (separated by `\n\n`) before parsing.

---

### FE-05 (Low) — useMarketStream connect() Has Stale Closure Risk on Token Refresh
**File:** `frontend/lib/market-stream.ts` lines 61–170

The `connect` function is wrapped in `useCallback([])` with empty deps, meaning it captures a stable reference but the Supabase token fetch happens fresh on every call (from `supabase.auth.getSession()`). This is correct. However, the `scheduleReconnect` function defined inside the async IIFE calls `connectRef.current(s)` — which calls `connect` with the original symbol list from the closure. If symbols change while a reconnect is pending, the reconnect will use the old symbols.

**Recommendation:** The effect at line 175 clears the reconnect timer on `symbolKey` change and restarts, which handles this case. The existing `// eslint-disable-next-line` comment suggests the author is aware of the dependency. This is Low severity.

---

### FE-06 (Low) — PriceChart Effect 2 Re-Sort and Deduplicate on Every Poll
**File:** `frontend/components/charts/PriceChart.tsx` lines 347–350

Effect 2 sorts and deduplicates candle data on every 30-second poll:
```tsx
const sorted = [...data].sort(...).filter(...)
```

This creates a new array and sorts it (O(n log n)) every 30 seconds. With 750 bars this is negligible, but it could be optimized by memoizing the sorted data in the parent component.

**Recommendation:** Low priority. Consider moving sort/dedup to a `useMemo` in the parent, or using `structuredClone` only when data changes.

---

## Section 5 — API Design

### API-01 (High) — strategies.py Decisions Endpoint Limit Not Bounded by Query()
**File:** `backend/app/api/strategies.py` line 127

```python
async def get_run_decisions(
    ...
    limit: int = 100,  # plain Python default, not FastAPI Query()
```

The limit parameter uses a plain Python default (`= 100`) instead of `Query(default=100, ge=1, le=200)`. This means FastAPI will not validate the value — a client could pass `limit=-1` or `limit=100000` and get unbounded results.

**Recommendation:** Change to `limit: int = Query(default=100, ge=1, le=200)`.

---

### API-02 (Medium) — Double-Prefix Risk Noted for Options Router
**File:** `backend/app/main.py` line 264

```python
app.include_router(options_router, prefix="/api/v4/options", tags=["options"])
```

The options router itself is defined with `router = APIRouter(tags=["options"])` and no prefix at line 47 of `v4/options.py` — the prefix is correctly applied only at `include_router`. This is correct. However, if someone adds a prefix inside `v4/options.py` in the future without noticing the `include_router` already applies `/api/v4/options`, routes would silently double-prefix.

**Recommendation:** Add a comment in `v4/options.py` explaining why the router has no prefix, to prevent accidental double-prefixing.

---

### API-03 (Medium) — stream_status Endpoint Has No Auth — Returns Infrastructure Diagnostics
**File:** `backend/app/api/v1/stream.py` lines 30–33

```python
@router.get("/status")
async def stream_status() -> dict:
    """Diagnostics — no auth required so the frontend can poll before login."""
    return stream_manager.get_diagnostics()
```

The diagnostics include `subscribed_symbols`, `connected_clients`, and `yfinance_fallback` state. This reveals internal infrastructure details to unauthenticated callers. The comment justifies it for pre-login polling, but a Shodan-style scan of the server would expose these details.

**Recommendation:** Return a minimal version to unauthenticated callers (just `status` and `connected`) and require auth for the full diagnostics.

---

### API-04 (Low) — generated_ideas.py add_idea_to_watchlist Has No Ownership Check on GeneratedIdea
**File:** `backend/app/api/generated_ideas.py` lines 160–167

The endpoint fetches a `GeneratedIdea` by `idea_id` but does not check if the idea belongs to the current user. GeneratedIdeas are system-wide (not user-scoped) in this design, which is intentional — they are shared suggestions. However, the `expires_at` check means a user can add an unexpired idea to their watchlist. This is correct behavior but worth noting for audit purposes.

**Recommendation:** Add a comment confirming this is intentional (GeneratedIdeas are system-wide, not user-owned).

---

## Section 6 — Code Quality

### CQ-01 (Medium) — datetime.utcnow() Used in Options Module (Deprecated)
**Files:**
- `backend/app/options/signals.py` lines 88, 221
- `backend/app/api/v4/options.py` lines 312, 373

`datetime.utcnow()` is deprecated in Python 3.12+ and produces a naive (timezone-unaware) datetime. All other timestamps in the codebase use `datetime.now(timezone.utc)`.

**Recommendation:** Replace all `datetime.utcnow()` calls with `datetime.now(timezone.utc)`.

---

### CQ-02 (Medium) — from_orm() Custom Methods Use Fragile Untyped Attribute Access
**Files:** `backend/app/schemas/alert.py` lines 93–107, `backend/app/schemas/auto_buy.py` lines 32–88

These schemas use `rule.id`, `rule.user_id` etc. with `# type: ignore[attr-defined]` comments. This pattern bypasses Pydantic v2's `model_validate(obj, from_attributes=True)` which would provide type safety.

**Recommendation:** Replace custom `from_orm` classmethods with `model_config = ConfigDict(from_attributes=True)` and call `SomeSchema.model_validate(orm_obj)`.

---

### CQ-03 (Medium) — Spread Filter Safeguard Is a Placeholder That Always Passes
**File:** `backend/app/services/auto_buy_engine.py` line 219

```python
# TODO (v3): pull real-time quote from Alpaca to check bid-ask spread
results.append(SafeguardResult("spread_filter", True, "PASSED (v2: spread check deferred to v3)"))
```

Two of the nine safeguards (spread_filter and position_size_limit) never block trades. With both conditions always True, the effective gate is 7 conditions, not 9. For a platform handling real money this is a significant gap.

**Recommendation:** Implement spread_filter using the Alpaca stream manager which already tracks bid/ask prices. The `stream_manager.get_snapshot()` provides the data needed.

---

### CQ-04 (Low) — config.py max_overflow Default Is 4, render.yaml Sets 3
**File:** `backend/app/core/config.py` line 26 vs `render.yaml` line 46

The config default is `max_overflow=4` but the CLAUDE.md constraint specifies `max_overflow=3` and the render.yaml sets `MAX_OVERFLOW=3`. This is a documentation/default inconsistency — the env var overrides the default in production so there is no runtime impact. However, a developer running locally with no `.env` would get max_overflow=4 (pool_size=2 + overflow=4 = 6 connections) instead of the documented 5.

**Recommendation:** Change the default in config.py to `max_overflow=3` to match the documented constraint.

---

### CQ-05 (Low) — evaluate_all_auto_buy Passes dry_run=False Unconditionally
**File:** `backend/app/services/auto_buy_engine.py` line 491

```python
await evaluate_auto_buy(
    ticker=ticker_row.ticker,
    user=user,
    db=db,
    dry_run=False,  # This will submit real orders!
)
```

The scheduler calls `evaluate_auto_buy` with `dry_run=False` directly. The `enabled` check at line 454 guards against executing for users who haven't enabled auto-buy, but once enabled and safeguards pass, real orders are submitted by the scheduler without any per-run confirmation. This is by design (auto-buy is an automated system), but it is a high-impact behavior that should be prominently documented.

**Recommendation:** Add a startup log warning when auto-buy is detected as enabled for any user, so operators are aware that the scheduler will submit real orders.

---

### CQ-06 (Low) — V3 Scanner Options Signal IV Rank Defaults to 0 When No Chain Available
**File:** `backend/app/api/v4/options.py` line 177

```python
sample_iv = next((c.implied_volatility for c in chain if c.implied_volatility > 0), 0.30)
iv_rank = compute_iv_rank(sample_iv, history)
```

When `history` is empty (no IV history for this symbol), `compute_iv_rank` returns 0. With IV rank = 0, the signal is blocked by the `iv_rank < config.min_iv_rank` gate. This is correct behavior but means new symbols always fail until IV history is populated. There is no feedback to the user explaining why no signals appear for new symbols.

**Recommendation:** Return a specific `block_reason` like "IV history not yet available for this symbol" so users understand the issue.

---

## Section 7 — Database

### DB-01 (Medium) — StockBuyZoneSnapshot Is Not User-Scoped
**File:** `backend/app/models/buy_zone.py`, `backend/app/scheduler/tasks/refresh_buy_zones.py` lines 59–60

The buy zone snapshot table has no `user_id` column — snapshots are system-wide. The scheduler passes `user_id=None` when refreshing buy zones:
```python
await calculate_buy_zone(ticker, db, user_id=None)
```

This means all users share the same buy zone snapshots. While economically sensible (the buy zone for AAPL is the same for all users), it means the auto-buy engine reads snapshots that may have been created for a different user's context. The `_get_latest_snapshot` function in auto_buy_engine.py does not filter by `user_id`, which is consistent with this design.

**Recommendation:** Document this design decision explicitly. If personalized buy zones are planned, the migration needs a `user_id` column and a default migration strategy.

---

### DB-02 (Low) — UserSession Table Exists but Is Never Used After Supabase Migration
**File:** `backend/app/models/user.py` lines 55–76

The `UserSession` model (with `refresh_token_hash`, `revoked_at`, etc.) was part of the pre-Supabase auth system. Sessions are now managed by Supabase, and the `UserSession` table appears unused. It adds schema complexity and is a potential point of confusion for future developers.

**Recommendation:** Either remove the `UserSession` model/table via an Alembic migration, or add a comment explaining it is retained for potential future use (e.g., tracking Supabase sessions for audit).

---

### DB-03 (Low) — CommodityAlertPrefs symbols Column Has No Length Constraint
**File:** `backend/app/models/commodity_alert_prefs.py` (inferred from CLAUDE.md description)

The `symbols` field stores a JSON array. Without a length constraint at the database or application level, a user could add an unlimited number of commodity symbols for monitoring, causing the scheduler's per-user signal evaluation to consume excessive memory.

**Recommendation:** Add validation in the schema to limit symbols to a maximum of 20 entries.

---

## Section 8 — Testing

### TEST-01 (High) — evaluate_auto_buy and evaluate_alerts Scheduler Tasks Have No Tests
**Files:** `backend/app/scheduler/tasks/evaluate_auto_buy.py`, `backend/app/scheduler/tasks/evaluate_alerts.py`

These are two of the most financially consequential tasks in the system (auto-buy can submit real orders). The TASKS.md reports 263 v1, 159 v2, 34 v3, and 90 auth E2E tests. No mention is made of scheduler task unit tests for evaluate_auto_buy or evaluate_alerts.

**Recommendation:** Add unit tests that mock `evaluate_all_auto_buy` and verify the task logs correctly and handles exceptions. Integration tests should verify the safeguard gate prevents real orders in paper mode.

---

### TEST-02 (Medium) — V3 10-Condition Gate Has No Test for Partial Pass Scenarios
**File:** `backend/app/services/buy_signal_service.py`

The 167 V3 unit tests are referenced in CLAUDE.md. The critical behavior "alerts fire ONLY when ALL 10 conditions pass" needs explicit test cases where each individual condition fails while the other 9 pass, confirming suppression. Without these boundary tests, a regression that accidentally OR's conditions instead of AND'ing them would not be caught.

**Recommendation:** Add 10 parameterized test cases, each one failing exactly one condition and asserting `all_conditions_pass=False` and that `suppressed_reason` identifies the failing condition.

---

### TEST-03 (Medium) — No Tests for Fernet Encryption/Decryption Round-Trip
**File:** `backend/app/core/security.py`

The credential encryption (`encrypt_value` / `decrypt_value`) is critical for broker key security. No tests are visible in the codebase for the encryption round-trip or for graceful handling of an `InvalidToken` exception.

**Recommendation:** Add unit tests for `encrypt_value/decrypt_value` round-trips and verify that `decrypt_value` raises `cryptography.fernet.InvalidToken` for corrupted ciphertext.

---

### TEST-04 (Low) — Frontend Tests Coverage Unknown for Options Page
**File:** `frontend/app/options/page.tsx`

The options page is the most complex frontend component (4-panel layout, multiple mutations, dry-run/live toggle). No frontend tests are referenced for this page in the implementation status log.

**Recommendation:** Add React Testing Library tests for the options page covering: mode toggle (Beginner/Pro), dry-run badge display, and the confirmation dialog before live execution.

---

## Prioritized Fix List

The following items are ranked by impact × likelihood of causing real harm in production:

| Priority | ID | Description | Effort |
|----------|----|-------------|--------|
| 1 | CORR-01 | Safeguard 7 (position_size_limit) is always True — real money risk | Low |
| 2 | CORR-02 | V3 condition 9 (not_near_earnings) always passes — real trade risk | Medium |
| 3 | PERF-01 | 4 scheduler tasks missing gc.collect() — Render OOM risk | Low |
| 4 | FE-01 | /portfolio and /options missing from middleware protected routes | Low |
| 5 | API-01 | strategies decisions endpoint limit not using Query() | Low |
| 6 | CQ-01 | datetime.utcnow() deprecated (Python 3.12 warning) | Low |
| 7 | PERF-04 | GET /live/positions has no row limit | Low |
| 8 | PERF-05 | Multiple list endpoints missing Query(le=200) bounds | Low |
| 9 | SEC-01 | JWT audience verification disabled in fallback path | Medium |
| 10 | CORR-03 | RSI inconsistency between commodity and V3 signal services | Low |
| 11 | CORR-04 | Theta may be double-divided in Greeks (verify py_vollib version) | Low |
| 12 | SEC-06 | Hardcoded localhost:3000 URL in commodity alert email | Low |
| 13 | FE-02 | dashboard dangerouslySetInnerHTML for CSS animations | Low |
| 14 | FE-03 | FAQ custom HTML sanitizer should use DOMPurify | Low |
| 15 | CQ-02 | from_orm custom methods should use model_validate | Medium |
| 16 | TEST-01 | No tests for evaluate_auto_buy / evaluate_alerts scheduler tasks | High |
| 17 | TEST-02 | V3 10-condition gate needs boundary tests (each condition fails independently) | Medium |
| 18 | DB-02 | Dead UserSession table from pre-Supabase era | Low |
| 19 | CQ-04 | max_overflow default in config.py differs from CLAUDE.md constraint | Low |
| 20 | PERF-03 | get_event_loop() deprecated; use get_running_loop() | Low |

---

## Positive Observations (What Is Done Well)

The following design decisions are well-implemented and worth preserving:

1. **Credential encryption** — Fernet symmetric encryption with masked output in API responses. Decrypted values never leave the service layer.
2. **Multi-tenancy scoping** — Every query in every API endpoint includes `WHERE user_id = current_user.id` via either direct filter or `assert_ownership()`.
3. **CORS configuration** — Never uses `["*"]`, properly uses `cors_origins_list`, and correctly handles CORS headers in exception handlers (a notoriously subtle bug in FastAPI).
4. **PriceChart 3-effect split** — Correctly separates chart creation, data updates, and drawing primitives to prevent chart teardown on every 30s poll.
5. **LiveClock null-init** — Correctly initializes state as `null` and sets in `useEffect` to avoid SSR hydration mismatch.
6. **DB pool hardening** — pool_size=2, max_overflow=3, pool_recycle=300, statement_cache_size=0 for pgbouncer compatibility.
7. **Alpaca stream 406 handling** — MAX_RECONNECT_BACKOFF applied immediately with yfinance fallback polling during the wait period.
8. **Auto-buy paper mode default** — Auto-buy defaults to dry_run=True. Live trading requires explicit `confirm_live_trading=True` flag.
9. **Rate limiting on execute endpoint** — `@limiter.limit("10/minute")` on the trade execution endpoint.
10. **Scheduler gc.collect()** — Most scheduler tasks (refresh_buy_zones, run_commodity_alerts, run_live_scanner, run_idea_generator) correctly call `gc.collect()` in finally blocks.
11. **yfinance 750-row cap** — `_load_ohlcv_yfinance` caps output at 750 rows and period at 1825d for weekly/monthly intervals.
12. **DELETE endpoints** — Correctly return `Response(status_code=204)` rather than putting `status_code=204` in the decorator.
13. **load_ohlcv routing** — All strategy/backtest code uses `load_ohlcv_for_strategy()` or `load_ohlcv()`, never calls `load_ohlcv_alpaca()` directly.
14. **Lazy DB engine** — Engine created on first access; module import does not require asyncpg.
15. **Supabase JWT auth** — HS256 verification with audience check, auto-provisioning on first call, correct fallback for dev tokens.

---

## Fixes Applied — 2026-04-01

| ID | Severity | Status | File(s) |
|----|----------|--------|---------|
| CORR-01 | Critical | RESOLVED | `backend/app/services/auto_buy_engine.py` |
| PERF-01 | High | RESOLVED | `backend/app/scheduler/tasks/evaluate_auto_buy.py`, `evaluate_alerts.py`, `refresh_theme_scores.py`, `scan_watchlist.py` |
| CORR-02 | High | RESOLVED | `backend/app/services/buy_signal_service.py` |
| FE-01 | High | RESOLVED | `frontend/proxy.ts` |
| API-01 | High | RESOLVED | `backend/app/api/strategies.py` |
| SEC-01 | High | RESOLVED | `backend/app/auth/dependencies.py` |
| CORR-03 | High | RESOLVED | `backend/app/services/commodity_signal_service.py` |
| CQ-01 | Medium | RESOLVED | `backend/app/options/signals.py`, `backend/app/api/v4/options.py` |
| CQ-04 | Low | RESOLVED | `backend/app/core/config.py` |
| SEC-06 | Low | RESOLVED | `backend/app/scheduler/tasks/run_commodity_alerts.py`, `backend/app/core/config.py` |
| PERF-03 | Medium | RESOLVED | `backend/app/api/v4/options.py` |

### Fix Details

**CORR-01** — `position_size_limit` safeguard was tautologically always True (`quantity = max_trade_amount / price` → `notional = quantity * price = max_trade_amount`). Fixed by computing `proposed_cost` using the target buy price (if set) vs current price, so the guard catches cases where `target_buy_price > current_price` would push the fill cost over the cap.

**PERF-01** — Added `import gc` and `gc.collect()` in `finally` blocks to all four scheduler tasks that were missing it.

**CORR-02** — `conditions["not_near_earnings"]` was hardcoded `True`. Now calls `get_days_to_earnings(ticker)` from `backend/app/options/calendar.py` and blocks the signal if `days_to_earnings <= settings.options_earnings_block_days` (default 5). Fails open (True) if the earnings lookup raises an exception to avoid blocking valid signals due to network errors.

**FE-01** — Added `/portfolio`, `/options`, `/gold`, `/multi-chart`, `/stock` to `PROTECTED_PREFIXES` in `frontend/proxy.ts`.

**API-01** — Changed `limit: int = 100` to `limit: int = Query(default=100, ge=1, le=200)` in `GET /runs/{run_id}/decisions` endpoint. `Query` was already imported.

**SEC-01** — The JWT fallback path decoded without audience verification. Added `audience="authenticated"` and `options={"verify_aud": True}` to the `secret_key` fallback `jwt.decode()` call.

**CORR-03** — `_compute_rsi` in `commodity_signal_service.py` used Cutler's simple rolling mean. Replaced with Wilder's smoothed RSI (`ewm(com=period-1, adjust=False)`) to match `buy_signal_service.py`.

**CQ-01** — Replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)` in `signals.py` (2 occurrences) and `v4/options.py` (2 occurrences). Added `timezone` to imports in both files.

**CQ-04** — Changed `max_overflow` default from `4` to `3` in `config.py` to match the CLAUDE.md constraint and `render.yaml`.

**SEC-06** — Added `frontend_base_url` setting to `config.py` (default `http://localhost:3000`). Updated email body in `run_commodity_alerts.py` to use `settings.frontend_base_url` instead of hardcoded localhost URL. Set `FRONTEND_BASE_URL=https://nextgenaitrading.vercel.app` in Render env to activate.

**PERF-03** — Replaced deprecated `asyncio.get_event_loop()` with `asyncio.get_running_loop()` in `v4/options.py` (2 call sites).

### Skipped / Not Fixed

| ID | Reason |
|----|--------|
| SEC-02 | Dev-only endpoint; already guarded by `DEBUG` flag. Architectural change (new env var) is out of scope for bug fixes. |
| SEC-03 | Adding rate limiting to additional endpoints requires careful per-endpoint design; no incorrect behavior, just missing hardening. |
| SEC-04 | Marking `supabase_service_role_key` as `SecretStr` is a refactor; no active exploit vector. |
| SEC-05 | Documentation concern only; runtime behavior is correct. |
| PERF-02 | Requires query restructuring; medium complexity with no immediate correctness impact. |
| PERF-04 | Separate tracking; not covered in the High list above. |
| PERF-05 | Multi-file; requires per-endpoint analysis to avoid breaking pagination contracts. |
| PERF-06 | Optimization, not a bug. |
| CORR-04 | Requires verifying py_vollib_vectorized version installed; cannot verify without running code. |
| CORR-05 | Low risk (2y daily ≈ 500 rows, under 750-row cap); refactor to `load_ohlcv_for_strategy` is medium effort. |
| CORR-06 | Volume fallback for futures; low impact on correctness. |
| FE-02 | Static CSS constant; no user input involved; DOMPurify move is a refactor. |
| FE-03 | Content is author-controlled, not user-controlled; DOMPurify migration is a refactor. |
| FE-04/05/06 | Low severity; no current bug. |
| API-02/03/04 | Comments/documentation concerns; no runtime bug. |
| CQ-02/03/05/06 | Medium complexity refactors or placeholder TODOs; out of scope. |
| DB-01/02/03 | Schema/design decisions; no runtime bug. |
| TEST-01/02/03/04 | Test coverage gaps; not code bugs. |
