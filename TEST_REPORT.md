# TEST_REPORT.md

## Summary

| Metric | Value |
|--------|-------|
| **Report date** | 2026-03-31 |
| **Backend unit tests** | 548 passed, 0 failed |
| **Frontend unit tests** | 189 passed, 56 failed (10 suites) |
| **Frontend build** | PASS (zero errors, zero warnings) |
| **Frontend ESLint** | PASS (clean) |
| **TypeScript (tsc --noEmit)** | PASS (clean) |
| **E2E tests** | BLOCKED (requires live servers) |
| **Total confirmed bugs** | 12 |

---

## Coverage Matrix

| Area | Test IDs | Result |
|---|---|---|
| Backend: 548 unit tests (v1/v2/v3/v4) | T-001 | PASS |
| Frontend: Next.js production build | T-002 | PASS |
| Frontend: ESLint | T-003 | PASS |
| Frontend: TypeScript strict | T-004 | PASS |
| auto_buy_engine.py — position_size_limit safeguard | T-005 | FAIL (BUG-001) |
| auto_buy_engine.py — daily_risk_budget calculation | T-006 | FAIL (BUG-002) |
| execution_service.py — phantom positions on NotImplemented | T-007 | FAIL (BUG-003) |
| middleware/proxy.ts — auth session detection in tests | T-008 | FAIL (BUG-004) |
| api.ts — 401 silent-refresh flow | T-009 | FAIL (BUG-005) |
| Login/Register pages — form contract change | T-010 | FAIL (BUG-006) |
| StrategyModeSelector — role=tab ARIA contract | T-011 | FAIL (BUG-007) |
| StrategyForm — Leverage label/input association | T-012 | FAIL (BUG-008) |
| LiveTradingPage — button text regression | T-013 | FAIL (BUG-009) |
| ArtifactsPage — header text regression | T-014 | FAIL (BUG-010) |
| ProfilePage — section heading regression | T-015 | FAIL (BUG-010) |
| Scheduler tasks — missing gc.collect() | T-016 | FAIL (BUG-011) |
| CORS configuration | T-017 | PASS |
| Multi-tenancy (user_id scoping) | T-018 | PASS |
| DELETE endpoint status code | T-019 | PASS |
| Broker key exposure | T-020 | PASS |
| List endpoint bounded limit | T-021 | PARTIAL (BUG-012) |
| E2E tests (playwright) | T-022 | BLOCKED |

---

## Test Results

### T-001 — Backend Unit Tests (548 tests)
- **Category:** Unit
- **Covers:** v2 auto-buy engine, v2 buy-zone, v2 alert engine, v2 theme scoring, v3 scanner services, v4 options engine, auth
- **Result:** PASS
- **Notes:** All 548 tests pass in 6.93s. Ran from `backend/` with `.venv/Scripts/python.exe -m pytest tests/`.

### T-002 — Frontend Production Build
- **Category:** Build
- **Covers:** All 41 routes, TypeScript compilation, Next.js 15 optimization
- **Result:** PASS
- **Notes:** Clean build, 0 errors, 0 warnings. All 41 pages generated successfully.

### T-003 — Frontend ESLint
- **Category:** Static Analysis
- **Covers:** `app/`, `components/`, `lib/` directories
- **Result:** PASS
- **Notes:** No ESLint errors or warnings.

### T-004 — TypeScript tsc --noEmit
- **Category:** Static Analysis
- **Covers:** Entire frontend TypeScript codebase
- **Result:** PASS
- **Notes:** No type errors detected.

### T-005 — auto_buy_engine position_size_limit Safeguard
- **Category:** Business Logic
- **Covers:** `backend/app/services/auto_buy_engine.py` lines 230-242
- **Result:** FAIL
- **Expected:** Safeguard blocks orders where the computed trade amount exceeds `max_trade_amount`
- **Actual:** Check is tautological — always passes. `notional = (max_trade_amount / price) * price` always equals `max_trade_amount`
- **See:** BUG-001

### T-006 — auto_buy_engine daily_risk_budget Calculation
- **Category:** Business Logic
- **Covers:** `backend/app/services/auto_buy_engine.py` lines 154-155
- **Result:** FAIL
- **Expected:** Daily total is the sum of trade values (not doubled)
- **Actual:** Uses `+` between `notional_usd` and `filled_price * filled_qty`, double-counting orders that have both fields populated
- **See:** BUG-002

### T-007 — execution_service Phantom Positions on NotImplementedError
- **Category:** Data Integrity
- **Covers:** `backend/app/services/execution_service.py` line 127
- **Result:** FAIL
- **Expected:** No `PositionSnapshot` upsert when broker returns `NotImplementedError`
- **Actual:** Condition `if order_status not in ("error",)` allows `"not_implemented"` through, creating a phantom position for an order that was never placed
- **See:** BUG-003

### T-008 — middleware/proxy.ts Authentication Session Detection
- **Category:** Auth
- **Covers:** `frontend/__tests__/middleware.test.ts`, `frontend/proxy.ts`
- **Result:** FAIL (5 tests)
- **Expected:** Authenticated mock returns 200 for protected routes, 307 for auth routes
- **Actual:** `proxy.ts` gates the Supabase client creation behind `if (supabaseUrl && supabaseKey)`. In the test environment, these env vars are empty strings, so the block is skipped and `user` remains `null` regardless of mock state
- **See:** BUG-004

### T-009 — api.ts 401 Silent-Refresh Flow
- **Category:** Auth
- **Covers:** `frontend/__tests__/lib/api.test.ts`
- **Result:** FAIL (2 tests)
- **Expected:** `authApi.me()` triggers a token refresh and retries on 401; throws "Session expired" when refresh fails
- **Actual:** `authApi.me()` now calls Supabase directly (not the backend fetch wrapper), so the mock-fetch-based test assertions are never triggered — 0 fetch calls instead of 3
- **See:** BUG-005

### T-010 — Login and Register Page Form Contract
- **Category:** UI
- **Covers:** `frontend/__tests__/app/(auth)/login.test.tsx`, `register.test.tsx`
- **Result:** FAIL (17 tests across both suites)
- **Expected:** Password field present; branding text "NextGenStock"; button labeled "Sign in"
- **Actual:** Login page was redesigned to magic-link (email only — no password field). Branding changed to "NextGen Trading". Submit button is now "Send magic link" with an icon, not an accessible button named "Sign in"
- **See:** BUG-006

### T-011 — StrategyModeSelector ARIA Role Contract
- **Category:** Accessibility / UI
- **Covers:** `frontend/__tests__/components/strategy/StrategyModeSelector.test.tsx`
- **Result:** FAIL (6 tests)
- **Expected:** Four elements with `role="tab"` labelled Conservative / Aggressive / AI Pick / Buy Low/Sell High
- **Actual:** Component uses custom `<button>` elements without `role="tab"` or `aria-selected` — redesigned away from Radix Tabs
- **See:** BUG-007

### T-012 — StrategyForm Leverage Label Association
- **Category:** Accessibility / UI
- **Covers:** `frontend/__tests__/components/strategy/StrategyForm.test.tsx`
- **Result:** FAIL (13 tests)
- **Expected:** `<label>` for "Leverage Exposure" is programmatically associated with the range input
- **Actual:** `<label>` has no `htmlFor` attribute and the `<input type="range">` has no matching `id` — WCAG 1.3.1 violation. `getByLabelText(/Leverage/i)` throws because no associated control is found
- **See:** BUG-008

### T-013 — LiveTradingPage Button Text Regression
- **Category:** UI
- **Covers:** `frontend/__tests__/app/live-trading.test.tsx`
- **Result:** FAIL (2 tests)
- **Expected:** "Dry Run" text visible in mode selector; "Execute LIVE Order" button text
- **Actual:** Mode selector renders "DRY RUN" (all-caps). Execute button renders "EXECUTE LIVE ORDER" (all-caps). Tests use exact-match text queries
- **See:** BUG-009

### T-014 — ArtifactsPage Header Text Regression
- **Category:** UI
- **Covers:** `frontend/__tests__/app/artifacts.test.tsx`
- **Result:** FAIL (1 test)
- **Expected:** Header matches `/Pine Script Artifacts \(2\)/`
- **Actual:** The artifacts page header is split across elements — "Pine Script Artifacts" and "(2)" are in separate DOM nodes, so the compound regex fails
- **See:** BUG-010

### T-015 — ProfilePage Section Heading Regression
- **Category:** UI
- **Covers:** `frontend/__tests__/app/profile.test.tsx`
- **Result:** FAIL (7 tests)
- **Expected:** "User Profile" section heading; "Broker Credentials" section heading; button labelled "Add Credential"; Alpaca badge text "/Alpaca.*Stocks.*ETFs/"
- **Actual:** Section headings and button text have been renamed or restructured in the redesign — the profile page has been significantly restyled
- **See:** BUG-010

### T-016 — Scheduler Tasks Missing gc.collect()
- **Category:** Memory / Reliability
- **Covers:** `backend/app/scheduler/tasks/evaluate_auto_buy.py`, `evaluate_alerts.py`, `refresh_theme_scores.py`, `scan_watchlist.py`
- **Result:** FAIL
- **Expected:** `gc.collect()` in `finally` block of every scheduler task (per CLAUDE.md Render constraint)
- **Actual:** `evaluate_auto_buy.py`, `evaluate_alerts.py`, `refresh_theme_scores.py`, and `scan_watchlist.py` have no `gc.collect()` call. Only `refresh_buy_zones.py`, `run_commodity_alerts.py`, `run_idea_generator.py`, and `run_live_scanner.py` comply
- **See:** BUG-011

### T-017 — CORS Configuration
- **Category:** Security
- **Covers:** `backend/app/main.py`
- **Result:** PASS
- **Notes:** CORS never uses `["*"]`. Uses `settings.cors_origins_list`. Error handlers validate origin before reflecting. Both localhost:3000 and Vercel URL are in the allow-list.

### T-018 — Multi-tenancy (user_id Scoping)
- **Category:** Security
- **Covers:** All API endpoints, service layer
- **Result:** PASS
- **Notes:** `assert_ownership()` enforced at credential layer. All DB queries include `WHERE user_id = current_user.id`. `_upsert_position_snapshot` scoped to `user_id`. `evaluate_auto_buy` loads user object and passes it explicitly.

### T-019 — DELETE Endpoint Status Codes
- **Category:** API Contract
- **Covers:** `alerts.py`, `broker.py`, `ideas.py`, `watchlist.py`
- **Result:** PASS
- **Notes:** All DELETE endpoints return `Response(status_code=204)` not using decorator `status_code=204`.

### T-020 — Broker Key Exposure
- **Category:** Security
- **Covers:** All API response schemas, credential service
- **Result:** PASS
- **Notes:** `BrokerCredential` model redacts keys. `get_credential()` returns ORM object for internal use only, never in API response.

### T-021 — List Endpoint Bounded Limit
- **Category:** API Contract
- **Covers:** All list endpoints
- **Result:** PARTIAL
- **Notes:** `GET /runs/{run_id}/decisions` in `strategies.py:127` uses `limit: int = 100` without `Query(ge=1, le=200)` — not a FastAPI Query parameter, so there is no server-side enforcement of the upper bound. All other list endpoints comply.
- **See:** BUG-012

### T-022 — E2E Tests (Playwright)
- **Category:** E2E
- **Result:** BLOCKED
- **Notes:** Requires live backend server (`:8000`) and frontend server (`:3000`) with valid Supabase credentials. Cannot be executed in the current environment.

---

## Bug Report (Prioritised)

### CRITICAL — BUG-001: position_size_limit Safeguard Is Tautological (Always Passes)

- **Severity:** Critical
- **Failing Test:** T-005
- **File:** `backend/app/services/auto_buy_engine.py`, lines 230-242
- **Description:** The `position_size_limit` safeguard computes `quantity = max_trade_amount / price` then `notional = quantity * price`. This always equals `max_trade_amount` (floating-point identity), so `notional <= max_trade_amount` is always `True`. The check never fails, making it dead-letter protection.
- **Steps to Reproduce:**
  ```python
  max_trade_amount = 1000.0
  price = 150.0
  quantity = max_trade_amount / price   # 6.6667
  notional = quantity * price           # 1000.0 — always equals max_trade_amount
  assert notional <= max_trade_amount   # always True
  ```
- **Expected:** Safeguard should compare the *requested* order size to the configured limit. It should receive `notional_usd` directly or compare against an externally-supplied quantity.
- **Actual:** Check is a mathematical no-op; the safeguard always passes.
- **Suggested Fix:** Pass `notional_usd` (the actual requested amount) directly as a parameter to `run_safeguards()` and compare that to `max_trade_amount`, rather than recomputing quantity from price in the same function.

---

### CRITICAL — BUG-002: daily_risk_budget Double-Counts Orders with Both notional_usd and filled Fields

- **Severity:** Critical
- **Failing Test:** T-006
- **File:** `backend/app/services/auto_buy_engine.py`, line 155
- **Description:** The daily spend calculation uses:
  ```python
  (o.notional_usd or 0.0) + (o.filled_price or 0.0) * (o.filled_quantity or 0.0)
  ```
  For filled orders that have both `notional_usd` and `filled_price/qty` populated, both terms are non-zero, so the order value is counted twice. A $1,000 filled order is counted as $2,000 toward the daily cap.
- **Steps to Reproduce:** Create a `BrokerOrder` with `notional_usd=500, filled_price=100, filled_qty=5`. The daily total becomes `500 + 100*5 = 1000` instead of `500`.
- **Expected:** Use `notional_usd` when available, fall back to `filled_price * filled_qty` only if `notional_usd` is null. Use coalescing, not addition.
- **Actual:** Both values are summed with `+`, doubling the reported spend.
- **Suggested Fix:** Change to: `o.notional_usd if o.notional_usd else (o.filled_price or 0.0) * (o.filled_quantity or 0.0)`.

---

### HIGH — BUG-003: execution_service Creates Phantom PositionSnapshot for NotImplementedError Orders

- **Severity:** High
- **Failing Test:** T-007
- **File:** `backend/app/services/execution_service.py`, line 127
- **Description:** When a broker raises `NotImplementedError` (Robinhood stub for stock orders), the order status is set to `"not_implemented"`. The guard that gates the `PositionSnapshot` upsert checks `if order_status not in ("error",)`, which evaluates to `True` for `"not_implemented"`. A position row is therefore written for a trade that never reached any broker.
- **Steps to Reproduce:** Submit a stock order to a Robinhood credential. The `BrokerOrder` is created with `status="not_implemented"` and a `PositionSnapshot` row is immediately upserted, adding virtual shares to the portfolio that do not exist.
- **Expected:** Position upsert should be skipped when `order_status` is `"not_implemented"` or `"error"`.
- **Actual:** Only `"error"` is excluded; `"not_implemented"` proceeds to upsert.
- **Suggested Fix:** Change condition to `if order_status not in ("error", "not_implemented"):`.

---

### HIGH — BUG-004: middleware Tests Fail Because proxy.ts Skips Supabase When Env Vars Are Empty

- **Severity:** High
- **Failing Test:** T-008 (5 tests)
- **File:** `frontend/proxy.ts` lines 41-64; `frontend/__tests__/middleware.test.ts`
- **Description:** `proxy.ts` only calls `supabase.auth.getUser()` inside `if (supabaseUrl && supabaseKey)`. In the Jest test environment, these env vars are empty strings, so the block is never entered and `user` stays `null` regardless of what the mock returns. This means:
  - Protected route + authenticated mock returns status 307 (not 200) — middleware redirects to /login
  - Auth route + authenticated mock returns status 200 (not 307) — no redirect to /dashboard
  - Root `/` + authenticated mock redirects to /login instead of /dashboard
- **Expected:** 5 authenticated-path tests to pass.
- **Actual:** All 5 fail with inverted status codes.
- **Suggested Fix:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to non-empty strings in `jest.setup.ts` (or a `.env.test` file) before the middleware module is loaded, so the Supabase branch executes and the mock takes effect.

---

### HIGH — BUG-005: api.ts 401 Silent-Refresh Tests Fail — authApi.me() No Longer Uses fetch Wrapper

- **Severity:** High
- **Failing Test:** T-009 (2 tests)
- **File:** `frontend/__tests__/lib/api.test.ts`; `frontend/lib/api.ts`
- **Description:** The tests for the "401 silent refresh" flow expect `authApi.me()` to issue 3 `fetch` calls (original then 401 then refresh then retry). However, `authApi.me()` now calls Supabase directly and is no longer routed through the `_fetch` wrapper with 401 handling. The mock-fetch counter stays at 0 and the expected "Session expired" rejection never fires.
- **Expected:** 3 fetch calls, retry after refresh, throw on double-401.
- **Actual:** 0 fetch calls; resolved with `null` instead of throwing.
- **Suggested Fix:** The `401 silent refresh flow` tests should be rewritten to test `_fetch()` directly with a protected backend endpoint (e.g., `profileApi.get()`), not `authApi.me()`.

---

### HIGH — BUG-006: Login and Register Test Suite Fails — UI Redesigned to Magic-Link Flow

- **Severity:** High
- **Failing Test:** T-010 (17 tests across login + register)
- **Files:** `frontend/__tests__/app/(auth)/login.test.tsx`, `register.test.tsx`; `frontend/app/(auth)/login/page.tsx`
- **Description:** The login page was redesigned from password-based auth to Supabase magic-link (email only). This introduced multiple test/code mismatches:
  1. Tests look for `getByLabelText(/password/i)` — no password field exists.
  2. Tests look for `getByText("NextGenStock")` — branding changed to "NextGen Trading".
  3. Tests look for `getByRole("button", { name: /sign in/i })` — button is now "Send magic link" with an icon; the button has no accessible text name.
  4. Tests invoke `mockOnSuccess()` / `mockOnError()` callbacks that were wired to the old `useMutation` pattern — the new page uses `useState` + direct async calls.
  5. The actual login/register error handlers use `error.message` directly (not `|| fallback`), so tests asserting fallback messages for empty `error.message` also fail.
- **Expected:** All login and register tests pass.
- **Actual:** 17 tests fail.
- **Suggested Fix:** Rewrite the test suites to match the current magic-link UI: email-only form, mock `supabase.auth.signInWithOtp`, assert on the "Check your email" confirmation state.

---

### MEDIUM — BUG-007: StrategyModeSelector Has No ARIA Role=Tab — Accessibility Regression

- **Severity:** Medium
- **Failing Test:** T-011 (6 tests)
- **File:** `frontend/components/strategy/StrategyModeSelector.tsx`; `frontend/__tests__/components/strategy/StrategyModeSelector.test.tsx`
- **Description:** The component was redesigned from Radix Tabs (which provides `role="tab"` and `aria-selected` automatically) to plain `<button>` elements. The test suite still queries `getByRole("tab", { name: /Conservative/i })`. Since the buttons have no `role="tab"` or `aria-selected`, all tab-role queries fail.
- **Expected:** Four elements accessible as `role="tab"` with `aria-selected` state.
- **Actual:** Four `<button>` elements with no ARIA tab role.
- **Suggested Fix (accessibility):** Add `role="tab"`, `aria-selected={isActive}`, and wrap in a `role="tablist"` container. Alternatively, revert to Radix Tabs primitive.
- **Suggested Fix (tests only):** Rewrite tests to query by `getByRole("button", { name: /Conservative/i })`.

---

### MEDIUM — BUG-008: StrategyForm Leverage Label Not Programmatically Associated — WCAG 1.3.1 Violation

- **Severity:** Medium
- **Failing Test:** T-012 (13 tests)
- **File:** `frontend/components/strategy/StrategyForm.tsx`, lines 216-234
- **Description:** The `<label>` for "Leverage Exposure" has no `htmlFor` attribute. The `<input type="range">` has no `id` attribute. The association between label and control does not exist in the accessibility tree. This is a WCAG 1.3.1 (Level A) violation and is the root cause of all 13 StrategyForm test failures (`getByLabelText(/Leverage/i)` throws because no associated control is found).
- **Expected:** `<label htmlFor="leverage-{mode}">` paired with `<input id="leverage-{mode}">`.
- **Actual:** Label and input are adjacent but not linked.
- **Suggested Fix:** Add `htmlFor={\`leverage-${mode}\`}` to the label and `id={\`leverage-${mode}\`}` to the input.

---

### MEDIUM — BUG-009: LiveTradingPage Tests Fail — Button Text Casing Mismatch

- **Severity:** Medium
- **Failing Test:** T-013 (2 tests)
- **File:** `frontend/__tests__/app/live-trading.test.tsx`; `frontend/app/live-trading/page.tsx`
- **Description:** Two test failures due to UI text case changes:
  1. Test expects `screen.getByText("Dry Run")` — actual text is `"DRY RUN"` (all-caps label in mode selector).
  2. Test expects `screen.getByText("Execute LIVE Order")` — actual text is `"EXECUTE LIVE ORDER"` (all-caps submit button).
- **Suggested Fix:** Update test assertions to use case-insensitive regex: `getByText(/dry run/i)` and `getByText(/execute live order/i)`.

---

### MEDIUM — BUG-010: ArtifactsPage and ProfilePage Tests Fail — UI Restructuring

- **Severity:** Medium
- **Failing Tests:** T-014 (1 test), T-015 (7 tests)
- **Files:** `frontend/__tests__/app/artifacts.test.tsx`; `frontend/__tests__/app/profile.test.tsx`
- **Description:**
  - `ArtifactsPage`: Test queries `/Pine Script Artifacts \(2\)/` as a single text node. The page renders "Pine Script Artifacts" and "(2)" in separate DOM elements.
  - `ProfilePage`: Section headings "User Profile" and "Broker Credentials" have been renamed or restructured. "Add Credential" button text changed. Delete buttons have no accessible name, causing ambiguous `getByRole("button", { name: "" })` errors.
- **Suggested Fix:** Update tests to use `getByText` with partial match or regex. Add `aria-label` to icon-only delete buttons (e.g., `aria-label="Delete credential"`).

---

### MEDIUM — BUG-011: Four Scheduler Tasks Missing gc.collect() — Render OOM Risk

- **Severity:** Medium
- **Failing Test:** T-016
- **Files:** `backend/app/scheduler/tasks/evaluate_auto_buy.py`, `evaluate_alerts.py`, `refresh_theme_scores.py`, `scan_watchlist.py`
- **Description:** Per CLAUDE.md: "Every scheduler task must have `gc.collect()` in its `finally` block to release DataFrames immediately" — required for Render 512 MB Starter plan. Four tasks do not comply. `refresh_theme_scores` calls `compute_theme_score` per ticker (may load yfinance DataFrames) and is the highest risk.
- **Expected:** All scheduler task try/except blocks end with `finally: gc.collect()`.
- **Actual:** Only `refresh_buy_zones.py`, `run_commodity_alerts.py`, `run_idea_generator.py`, and `run_live_scanner.py` have `gc.collect()`.
- **Suggested Fix:** Add `finally: import gc; gc.collect()` block to each non-compliant task.

---

### LOW — BUG-012: GET /runs/{run_id}/decisions Has Unbounded limit Parameter

- **Severity:** Low
- **Failing Test:** T-021
- **File:** `backend/app/api/strategies.py`, line 127
- **Description:** `limit: int = 100` is a plain Python default parameter, not a `Query(ge=1, le=200)` FastAPI parameter. Clients can pass `?limit=999999` and the server will attempt to return all matching rows. CLAUDE.md states: "List endpoints must have bounded `limit`: `Query(default=50, ge=1, le=200)`".
- **Expected:** `limit: int = Query(default=100, ge=1, le=200)`
- **Actual:** `limit: int = 100` — no server-side enforcement.
- **Suggested Fix:** Change to `limit: int = Query(default=100, ge=1, le=200)` and add the `Query` import if missing.

---

## Skipped / Blocked Tests

- **T-022 (E2E Playwright):** BLOCKED — requires live backend on `:8000` and frontend on `:3000` with valid `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `DATABASE_URL` environment variables. 546 E2E tests exist at `tests/e2e/`. Infrastructure must be running to execute them.

---

## Recommendations

### Immediate (before next deploy)

1. **Fix BUG-001** (`position_size_limit` tautology) — this safeguard has never actually protected against oversized orders. Pass `notional_usd` as a direct parameter to `run_safeguards()` in `backend/app/services/auto_buy_engine.py`.

2. **Fix BUG-002** (`daily_risk_budget` double-counting) — the daily cap is half as effective as intended because filled orders are counted at 2x value. Change `+` to a coalescing expression on line 155 of `auto_buy_engine.py`.

3. **Fix BUG-003** (phantom positions for `not_implemented` orders) — add `"not_implemented"` to the exclusion list on line 127 of `backend/app/services/execution_service.py`.

### High priority (next sprint)

4. **Fix BUG-011** (scheduler `gc.collect()`) — add `finally: gc.collect()` to the four non-compliant scheduler tasks before the next Render deploy to prevent OOM crashes.

5. **Fix BUG-004** (middleware tests) — set non-empty Supabase env vars in `jest.setup.ts` before the middleware module is imported.

6. **Fix BUG-005** (api.ts 401 tests) — rewrite the two failing tests to use `profileApi.get()` or another `_fetch`-based endpoint rather than `authApi.me()`.

7. **Fix BUG-006** (login/register tests) — rewrite both test suites to match the current magic-link UI.

### Medium priority

8. **Fix BUG-007** (StrategyModeSelector ARIA) — add `role="tab"` and `aria-selected` to restore accessibility compliance and unblock 6 tests.

9. **Fix BUG-008** (Leverage label/input association) — add matching `htmlFor`/`id` to resolve WCAG 1.3.1 violation and unblock 13 tests.

10. **Fix BUG-009** (LiveTrading button text) — update 2 test assertions to use case-insensitive regex.

11. **Fix BUG-010** (Artifacts/Profile test regressions) — update tests to match current UI structure; add `aria-label` to icon-only delete buttons.

12. **Fix BUG-012** (unbounded limit) — wrap `limit` in `Query(ge=1, le=200)` for `GET /runs/{run_id}/decisions`.

---

## Key Finding

The 56 frontend test failures represent **accumulated drift between UI redesigns and their test files** — not production code defects. The production build, TypeScript, and ESLint all pass cleanly. The three backend bugs (BUG-001, BUG-002, BUG-003) are genuine logic defects in production code affecting financial safeguards and data integrity. These three should be treated as P0 and fixed before any further trading execution code is merged.
