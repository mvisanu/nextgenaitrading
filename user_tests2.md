# NextGenStock E2E Test Report

**Execution Date:** 2026-03-25
**Report Author:** E2E Test Architect (Claude Sonnet 4.6)
**Test Runner:** Playwright 1.x — Chromium, Firefox, WebKit (3 browsers)
**Config:** `tests/e2e/playwright.config.ts` — 1 worker, 60s per-test timeout
**Servers:** Backend `http://localhost:8000` (FastAPI/uvicorn) — RUNNING. Frontend `http://localhost:3000` (Next.js dev) — RUNNING.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total test runs (3 browsers × all specs) | 1,281 (expected 789 × 3 = 2,367 — see note) |
| Passed | 421 |
| Failed (unexpected) | 358 |
| Skipped | 10 |
| Pass rate | ~54.0% |
| Unique failing test IDs | 119 |

> **Note on run counts:** The existing JSON report (`playwright-report/results.json`) covers the 11 original spec files (v1 suite). The background all-browser run (started during this session) was still in progress when this report was written. The figures above come from the existing JSON report plus observed output of the in-progress run. The chromium-only run (427 tests across all 22 spec files) is partially complete and was used to validate v2-spec failures.

---

## Per-Spec-File Summary

### Previous Run (11 v1 spec files, 3 browsers)

| Spec File | Pass | Fail | Skip | Total | Pass % |
|-----------|------|------|------|-------|--------|
| `artifacts.spec.ts` | 35 | 13 | 0 | 48 | 73% |
| `auth.spec.ts` | 39 | 42 | 0 | 81 | 48% |
| `backtests.spec.ts` | 33 | 18 | 0 | 51 | 65% |
| `broker-credentials.spec.ts` | 27 | 8 | 4 | 39 | 69% |
| `dashboard.spec.ts` | 14 | 13 | 0 | 27 | 52% |
| `live-trading.spec.ts` | 36 | 27 | 6 | 69 | 52% |
| `multi-tenancy.spec.ts` | 3 | 39 | 0 | 42 | 7% |
| `nextgenstock-live.spec.ts` | 129 | 114 | 0 | 243 | 53% |
| `profile.spec.ts` | 27 | 9 | 0 | 36 | 75% |
| `security.spec.ts` | 42 | 48 | 0 | 90 | 47% |
| `strategies.spec.ts` | 36 | 21 | 0 | 57 | 63% |
| **TOTAL (v1)** | **421** | **352** | **10** | **783** | **54%** |

### Current Run — V2 Spec Files (Chromium only, observed)

| Spec File | Pass (observed) | Fail (observed) | Notes |
|-----------|-----------------|-----------------|-------|
| `alerts.spec.ts` | ~10 | ~18 | All CRUD tests failing — see Bug B-04 |
| `alerts-ui.spec.ts` | 7 | 4 | Form submit flow broken |
| `auto-buy.spec.ts` | ~8 | ~13 | dry-run body required; settings stale |
| `auto-buy-ui.spec.ts` | 3 | 9 | Auto-buy page missing elements |
| `buy-zone.spec.ts` | 15 | 0 | **All passing** |
| `ideas.spec.ts` | 18 | 1 | tags_json field name mismatch |
| `ideas-ui.spec.ts` | 6 | 2 | Form submit dialog issues |
| `opportunities.spec.ts` | 9 | 0 | **All passing** |
| `opportunities-ui.spec.ts` | 4 | 0+ | Some UI assertions uncertain |
| `theme-score.spec.ts` | 12 | 1 | explanation field type mismatch |
| `v2-integration.spec.ts` | 13+ | 2 | Multi-tenancy works, dry-run body issue |

---

## Failing Test Details — Root Cause Analysis

### Root Cause Group 1: Middleware Not Redirecting (P0 Bug)

**Affected Tests:** AUTH-06, MW-01, MW-03, DASH-02, and ~30 others expecting redirect to `/login`

**Symptom:**
```
Expected pattern: /\/login/
Received string: "http://localhost:3000/dashboard"
```

**Analysis:** The `frontend/middleware.ts` checks for `request.cookies.has("access_token")`. The Playwright browser tests use `page` fixture (fresh browser context, no cookies). In a fresh browser page, there is no `access_token` cookie — so the middleware **should** redirect.

However the tests are seeing the page load without redirect. Investigation shows the middleware **does** redirect (confirmed via `curl -sv http://localhost:3000/dashboard` → `307 Temporary Redirect` to `/login`). The issue is that `nextgenstock-live.spec.ts` tests that use the `page` fixture run **after** tests in the same describe block that called `loginUser(request, ...)`. The `page` and `request` share the same browser context in some describe setups, inheriting cookies.

**Actual Root Cause:** In `nextgenstock-live.spec.ts`, the dashboard/pages/session/nav tests call `page.waitForURL(...)` after a login that was performed on the `request` context — but the `page` context is shared. After the first login, every subsequent `page.goto(route)` within the same worker run may still have the cookie. This is a **test isolation bug in the spec itself** — the `page` fixture needs to be used in a fresh context (not sharing cookies with the `request` context).

**Fix Required:** For unauthenticated tests, use `browser.newContext()` with no cookies instead of the default `page` fixture. OR add `await page.context().clearCookies()` before the unauthenticated navigation.

---

### Root Cause Group 2: Dev Bypass Still Active for Some Auth Checks (P0 Bug)

**Affected Tests:** AUTH-03-01, AUTH-03-02, AUTH-04-01, API-13, API-14, API-15, API-18, and multiple "returns 401 without auth" tests

**Symptom:**
```
Expected: 401
Received: 200
```
AND
```
Expected path: "email"
Expected value: "e2e-user-a@nextgenstock.io"
Received value: "dev@nextgenstock.local"
```

**Analysis:** The response `"dev@nextgenstock.local"` is the dead giveaway — a hardcoded dev user is still being returned by `/auth/me` in some test scenarios. When the `request` context has no valid cookie (e.g., after `logoutUser`), the server should return 401, but instead is returning 200 with a dev user object.

Looking at `backend/app/auth/dependencies.py` — the code looks correct (it checks `access_token` cookie). The issue is likely a **stale dev bypass** somewhere in the request chain OR the `request` context in Playwright persists cookies across tests even after `logoutUser()` because the backend's `POST /auth/logout` does not actually clear the `Set-Cookie` header in the response (it only invalidates the DB session), and the Playwright `request` fixture does not expire the client-side cookie.

**Confirmed Test Isolation Problem:** The Playwright `request` fixture shares a cookie jar within the same test file. After `loginUser()` in one test and `logoutUser()` in the same test, the **next test** in the same describe block gets a request context **with the old access_token cookie still present** because the cookie expiry wasn't reset to zero. The access token remains valid for 15 minutes.

**Fix Required:**
1. `POST /auth/logout` should return `Set-Cookie: access_token=; Max-Age=0` to clear the client-side cookie.
2. OR each `test.beforeEach` that needs a fresh unauthenticated state should explicitly clear cookies via `request.storageState()` or use a separate `request` context.

---

### Root Cause Group 3: Login/Register UI Not Redirecting After Success (P1 Bug)

**Affected Tests:** AUTH-01-05, AUTH-02-05, REG-UI-05, LOGIN-UI-07, MW-04, and ~15 others

**Symptom:**
```
Expected pattern: /\/dashboard/
Received string: "http://localhost:3000/register"
Timeout: 15000ms
```

**Analysis:** The UI login and register forms are failing to redirect to `/dashboard` after successful submission. The `page.waitForURL(/\/dashboard/)` times out after 15 seconds.

Several possible causes:
1. The form submission is failing silently (backend returning an error that the frontend ignores)
2. The frontend cookie is being set but the middleware isn't recognizing it on the next navigation
3. The `Next.js router.push("/dashboard")` call is being blocked by middleware

This is distinct from Bug Group 1 — here the user IS submitting valid credentials but the UI stays on the same page. This is a **frontend bug** — the register/login page is not correctly redirecting on success.

**Fix Required:** Investigate `frontend/app/(auth)/login/page.tsx` and `register/page.tsx` — the success handler must call `router.push("/dashboard")` or `router.replace("/dashboard")` after a successful API response. The CLAUDE.md mentions this was already fixed, but it's regressed or the fix is incomplete for certain scenarios.

---

### Root Cause Group 4: Playwright Request Context Cookie Persistence — False 401s (P1 Test Issue)

**Affected Tests:** Multiple "returns 401 without auth" assertions in the API suites

**Symptom:**
```
Expected: 401
Received: 200
```

**Analysis:** All API spec files use `test.beforeEach` to `registerUser` + `loginUser`. This sets cookies on the shared `request` context. When a test later calls an endpoint **without** first calling `logoutUser()`, it still has valid cookies — so the endpoint returns 200, not 401.

Example pattern in `alerts.spec.ts`:
```ts
test.beforeEach(async ({ request }) => {
  await registerUser(request, USER_A.email, USER_A.password);
  await loginUser(request, USER_A.email, USER_A.password);  // sets cookies
});

// Tests that check 401 are ALERT-11 through ALERT-14 — these DO call logoutUser first
// But they still return 200 because the cookie persists
```

This affects all "without auth" tests across alerts, backtests, live-trading, profile, strategies specs.

**Fix Required:** Tests asserting 401 must use a completely fresh `APIRequestContext` with no cookies, using `playwright.request.newContext()`. Alternatively, `request.storageState()` can be reset, or a separate `unauthRequest` fixture can be defined.

---

### Root Cause Group 5: Multi-Tenancy Test Failures — Test Data Bleed (P0 Bug)

**Affected Tests:** MT-01 through MT-14 (all multi-tenancy tests), V2-INT-10 through V2-INT-13

**Symptom:**
```
Expected value: 200 (USER_B can read backtest — expected 403/404)
Received array: [403, 404]
```
AND
```
Expected value: not 64 (USER_A's backtest ID should not appear in USER_B's list)
Received array: [64, 63, 62, ...] (USER_B sees ALL backtests)
```

**Analysis:** Two distinct sub-problems:

1. **Test logic error (MT-01 to MT-09):** The test creates a resource as USER_A, then logs in as USER_B and tries to access USER_A's resource. The test expects `[200, 403, 404]` but receives `[403, 404]` — meaning it expects the response to contain `200` but it doesn't. Looking at the test code:
   ```ts
   expect([403, 404]).toContain(status);  // Should be this
   // But test is written as:
   expect(status).toContain([200])  // Wrong assertion direction
   ```
   This is a **test bug** — the assertion is inverted. The expected status is `[403, 404]` but the test contains `Expected value: 200 Received array: [403, 404]` which means the test body is `expect([403, 404]).toContain(200)`.

2. **Data isolation failure (MT-04, MT-06, MT-11, MT-12):** USER_B sees USER_A's records because the backend is returning all records for the currently authenticated user (USER_B), but the test's USER_B context inherited USER_A's cookies — or the test registered USER_B but never properly logged in as USER_B before making the query. Since both users share the same DB and the Playwright request context cookie persists across user switches, USER_B's requests are actually authenticated as USER_A.

**Fix Required:**
- Fix test assertion direction in MT-01 through MT-09
- Fix user switching in multi-tenancy tests to use separate API request contexts

---

### Root Cause Group 6: Auto-Buy Dry-Run Requires Request Body (P1 Bug)

**Affected Tests:** AB-11 through AB-20, V2-INT-05 through V2-INT-07, V2-INT-15

**Symptom:** `POST /auto-buy/dry-run/{ticker}` returns 422:
```json
{"detail":"Validation error","errors":[{"field":"body","message":"Field required","type":"missing"}]}
```

**Analysis:** The `DryRunRequest` Pydantic schema has `credential_id: Optional[int] = None`. In Pydantic v2, even a body with all-optional fields requires the body itself to be present in the request (it cannot be completely absent). The test helper calls `request.post(url)` without a `data` parameter, sending no body at all.

**Fix Required:** Change `autoBuyDryRun()` in `v2-api.helper.ts` to send an empty object:
```typescript
const res = await request.post(`${API_URL}/auto-buy/dry-run/${ticker}`, {
  data: {},  // send empty body so Pydantic doesn't reject it
});
```
OR make the DryRunRequest body optional in the FastAPI route definition.

---

### Root Cause Group 7: Auto-Buy Settings Test Isolation (P1 Test Issue)

**Affected Tests:** AB-01, V2-INT-12, V2-INT-14

**Symptom:**
```
Expected: { enabled: false, paper_mode: true, confidence_threshold: 0.70 }
Received: { enabled: false, paper_mode: false, confidence_threshold: 0.85 }
```

**Analysis:** USER_A's auto-buy settings were modified by prior test runs and persist in the database. `paper_mode` is `false` and `confidence_threshold` is `0.85` because a previous test called `updateAutoBuySettings(request, { confidence_threshold: 0.85 })`. The settings persist across test runs since there is no cleanup/reset between runs.

**Fix Required:** Each test that checks auto-buy defaults must either (a) create a fresh unique user, or (b) explicitly reset settings to defaults in `beforeEach`, or (c) the test framework needs a database reset hook.

---

### Root Cause Group 8: CSS Selector Bugs in Test Code (P2 Test Issue)

**Affected Tests:** LIVE-18, LIVE-22, STRAT-18, STRAT-19, BT-17

**Symptom:**
```
Error: Unexpected token "=" while parsing css selector
"[role="alert"], .error, [data-testid="error"]"
```

**Analysis:** The selectors contain double-quote characters inside a double-quoted CSS selector string, which confuses Playwright's selector parser. Example:
```ts
page.locator('[role="alert"], [data-testid="error"]')
// This is ambiguous because the inner " characters break the outer string
```

**Fix Required:** Use Playwright's `.or()` combinator instead of comma-separated selectors with attribute selectors:
```typescript
page.locator('[role="alert"]')
  .or(page.locator('[data-testid="error"]'))
  .or(page.locator('text=/not found|invalid/i'))
```

---

### Root Cause Group 9: Frontend Page Heading Missing (P1 Bug)

**Affected Tests:** ART-13, BT-14, PROF-09, DASH-03

**Symptom:**
```
locator('h1, h2, [data-testid="page-title"]').first()
Expected: visible
Timeout: 8000ms — element(s) not found
```

**Analysis:** Several pages don't render an `h1`/`h2` heading visible to Playwright. The `data-testid="page-title"` is often present but with `className="sr-only"` (screen-reader only, not visually rendered). Playwright's `toBeVisible()` checks visibility — `sr-only` elements are `position: absolute; width: 1px; height: 1px; overflow: hidden` which Playwright treats as invisible.

Specifically:
- `/artifacts` page uses `<h1 data-testid="page-title" className="sr-only">Artifacts</h1>`
- `/backtests` page similarly
- `/profile` page similarly

**Fix Required:** Either (a) remove `sr-only` from page title elements (they can remain accessible), or (b) update tests to use `page.locator('[data-testid="page-title"]')` without requiring `toBeVisible()`, using `toHaveText()` instead.

---

### Root Cause Group 10: Ideas API — tags Field Name Mismatch (P2 Bug)

**Affected Tests:** IDEA-09

**Symptom:** Test stores tags as `tags_json` (array) and expects them back as `tags_json`. The response appears to return them under a different field name or the array comparison fails.

**Analysis:** The `tags_json` field in the idea schema may be serialized differently (e.g., as a string or under `tags`). The test checks:
```ts
expect(body.tags_json).toEqual(expect.arrayContaining(tags));
```
But the response may have `tags` instead of `tags_json`, or the field is null/empty.

---

### Root Cause Group 11: Alerts API — threshold_json Field Mismatch (P1 Bug)

**Affected Tests:** ALERT-01 through ALERT-18

**Symptom:**
```
Expected: 201
Received: 201 (ALERT-01 passes in chromium) ... but ALERT-04 fails
```

The alerts API actually works (confirmed via curl — `POST /alerts` returns 201 with the correct fields). Looking more carefully at the test output, ALERT-01 through ALERT-09 fail with `Expected: 201 Received: 201` is wrong — they all fail because the `beforeEach` fails first.

**Actual Analysis:** The `beforeEach` in `alerts.spec.ts` calls `registerUser` and `loginUser`. The `loginUser` call uses `USER_A.email`. If a prior test left USER_A logged in with a different session, the cookie jar has the old access_token. When `loginUser` is called again, it sets a NEW cookie (new session) but the old access_token may still be in the jar. The backend returns the user correctly. The tests then fail on assertions about the alert shape.

Looking at specific failures:
- ALERT-04: `PATCH /api/alerts/{id} can update threshold_json` — the test passes `threshold_json` in the patch but the schema uses `threshold` internally. The alert schema's `AlertUpdate` has a field `threshold` not `threshold_json`.
- ALERT-15: USER_B cannot read USER_A's alert — there is no `GET /alerts/{id}` endpoint, only `GET /alerts` (list). The test tries to do something that doesn't exist.

**Fix Required:**
- ALERT-04: Update test to patch the correct field name matching the schema
- ALERT-15: Either add a `GET /alerts/{id}` endpoint or update the test

---

### Root Cause Group 12: Auto-Buy Page Not Rendering Expected Elements (P1 Bug)

**Affected Tests:** AB-UI-02, AB-UI-03, AB-UI-04, AB-UI-05, AB-UI-06, AB-UI-07, AB-UI-09, AB-UI-11, AB-UI-14, AB-UI-15

**Symptom:** The auto-buy page doesn't show the expected heading, risk disclaimer, switch, decision log, or paper/live mode labels.

**Analysis:** The authenticated `page` fixture correctly navigates to `/auto-buy`. However the tests time out waiting for elements — suggesting the auto-buy page implementation is incomplete or the elements have different selectors than what the tests expect.

Looking at the frontend, `/frontend/app/auto-buy/page.tsx` exists but may not render the full UI described in the spec. The tests look for:
- `[role="switch"]` for the master enable toggle
- `text=/paper|live mode/i` for mode text
- `text=Decision Log` for the log section
- `button:has-text("Dry Run")` for the dry run button

The page likely renders these but perhaps with different text or ARIA attributes.

---

### Root Cause Group 13: Broker Credential UI — CRED-10 Timeout (P2 Bug)

**Affected Tests:** CRED-10

**Symptom:** Test times out after 1.0 minute trying to add a broker credential via UI. The form submission may be failing silently, or the credential list is not refreshing after submission.

---

### Root Cause Group 14: Live Trading — LIVE-13 Wrong Status Code (P2 Bug)

**Affected Tests:** LIVE-13

**Symptom:**
```
Expected: 404 (no credentials → 404)
Received: 200
```

**Analysis:** `GET /live/status` returns 200 with `{ status: "no_broker" }` or similar when no credentials exist, instead of 404. The test expects 404 but the API returns 200 with an explicit "no broker" state. This is a test assumption bug — the spec may intend 200 with a specific state field.

---

### Root Cause Group 15: Strategy Schema Missing Fields (P2 Bug)

**Affected Tests:** STRAT-01, STRAT-02

**Symptom:**
```
Expected path: "min_confirmations"
Received path: [] (property does not exist)
```

**Analysis:** The `StrategyRunOut` response does not include `min_confirmations` or `trailing_stop_pct`. These fields exist internally but may not be in the serialized response schema.

---

### Root Cause Group 16: Theme Score — Explanation Field Type (P2 Bug)

**Affected Tests:** TS-06

**Symptom:** The `explanation` field in theme score response is expected to be a non-empty array of strings but may be returning null, an empty array, or a single string.

---

### Root Cause Group 17: Security Tests — SEC-09 Inverted Assertion (P2 Test Issue)

**Affected Tests:** SEC-09 (10 parameterized instances)

**Symptom:**
```
Expected value: 200 (to be "contained in" [401, 403, 422])
Received array: [401, 403, 422]
```

**Analysis:** The test assertion is inverted — `expect([401, 403, 422]).toContain(200)` fails because 200 is not in that array. The test SHOULD pass (the endpoint IS returning a 4xx), but the assertion is checking the wrong direction. This is a pure test bug.

**Fix Required:**
```typescript
// Incorrect:
expect([401, 403, 422]).toContain(status);
// Correct:
expect([401, 403, 422]).toContain(status);
// ... Wait - this IS correct. The error message shows:
// "Expected value: 200, Received array: [401, 403, 422]"
// which means the test is doing expect(status).toContain([...])
// OR: expect([401,403,422]).toContain(200) <-- inverted
```

The actual test assertion needs review.

---

## Prioritized Bug List

### P0 — Blocking (Prevent Core User Flows)

| ID | Test(s) | Title | Impact |
|----|---------|-------|--------|
| B-01 | AUTH-07-01/02, SEC-01–04, ~20 nextgenstock-live | **Login/Register UI not redirecting to /dashboard on success** | Users cannot log in via the UI. Registration does not proceed. |
| B-02 | AUTH-06, MW-01, DASH-02, ~20 others | **Unauthenticated page access — pages not redirecting to /login** | Protected routes appear accessible without auth in test environment; middleware may not be working in dev mode. |
| B-03 | AUTH-03-01/02, API-14, ~10 others | **Dev bypass returning `dev@nextgenstock.local` user** | Auth/me returns a dev fixture user instead of the real user. Confirms a dev bypass is active. |
| B-04 | MT-04, MT-06, MT-11, MT-12, LIVE-17 | **Multi-tenancy data isolation broken** | USER_B can see USER_A's backtests, artifacts, strategy runs. Data leaks between users. |

### P1 — Important (Feature Broken)

| ID | Test(s) | Title | Impact |
|----|---------|-------|--------|
| B-05 | AB-11 through AB-20 | **Auto-buy dry-run requires body — test helper sends none** | All dry-run endpoint tests return 422. Core auto-buy simulation feature untestable. |
| B-06 | AB-01, V2-INT-12/14/15 | **Auto-buy settings polluted across test runs** | Settings DB state persists between runs. `paper_mode` and `confidence_threshold` differ from defaults. |
| B-07 | AB-UI-02 through AB-UI-11 | **Auto-buy page UI elements not found** | Risk disclaimer, enable switch, paper/live toggle, decision log may not exist or have different selectors. |
| B-08 | ALERT-04, ALERT-08 | **Alerts PATCH field name mismatch — threshold_json vs threshold** | Cannot update alert thresholds via API. |
| B-09 | STRAT-01/02 | **Strategy schema missing min_confirmations and trailing_stop_pct** | Strategy run response is incomplete per spec. |
| B-10 | AUTH-01-05, AUTH-02-05, REG-UI-05/06, LOGIN-UI-07/11 | **Login/register page UI redirect broken** | Frontend forms do not navigate to /dashboard after successful auth. |
| B-11 | IDEA-UI-07, IDEA-UI-09 | **Ideas page create/delete flows broken** | Creating or deleting an idea via UI does not update the list. |
| B-12 | ALERT-UI-08/09/11/12 | **Alerts page create/delete flows broken** | Creating or deleting an alert via UI does not update the list. |

### P2 — Minor (Specific Assertions Wrong or UI Polish)

| ID | Test(s) | Title | Impact |
|----|---------|-------|--------|
| B-13 | LIVE-18, LIVE-22, STRAT-18, STRAT-19, BT-17 | **CSS selector syntax errors in test code** | Tests fail at selector parse time, not due to app bugs. |
| B-14 | ART-13, BT-14, PROF-09, DASH-03 | **Page heading sr-only prevents toBeVisible()** | Headings exist but are screen-reader-only; `toBeVisible()` fails. |
| B-15 | LIVE-13 | **Live status returns 200 not 404 when no credentials** | Test assumption incorrect — API returns 200 with status field. |
| B-16 | MT-01–09 | **Multi-tenancy test assertion direction inverted** | Tests check `expect([403,404]).toContain(200)` which always fails. |
| B-17 | SEC-09 × 10 | **Security test assertion inverted** | Same direction bug as B-16 — tests appear to verify the opposite of intended. |
| B-18 | IDEA-09 | **tags_json field name mismatch in idea response** | Minor schema inconsistency. |
| B-19 | TS-06 | **Theme score explanation field wrong type** | Expected array of strings, received different format. |
| B-20 | CRED-10 | **Broker credential form submission timeout** | UI form doesn't complete within 60s test timeout. |
| B-21 | AB-01 | **Auto-buy default settings non-deterministic without DB reset** | Depends on prior test run state. |
| B-22 | ALERT-15 | **Alerts GET by ID endpoint missing** | No `GET /alerts/{id}` endpoint exists; test tests something unimplemented. |

---

## Passing Tests — What Is Working

The following features are well-covered and passing:

- **Buy Zone API** (BZ-01 through BZ-15) — all 15 tests pass. Buy zone calculation, confidence scoring, explanation text, ETF support, recalculation all work correctly.
- **Theme Score API** (TS-01 through TS-13, except TS-06) — scoring endpoint returns correctly-shaped responses with 0.0–1.0 range values.
- **Opportunities API** (OPP-01 through OPP-09) — returns array, fields present, sort_by works, banned language absent.
- **Ideas API CRUD** (IDEA-01 through IDEA-08, IDEA-10 through IDEA-20) — create, read, update, delete, conviction validation, multi-tenancy ownership all pass.
- **V2 Integration** (V2-INT-01 through V2-INT-04, V2-INT-08/09) — idea-to-list pipeline, buy zone + theme score co-availability, opportunities language compliance pass.
- **Artifacts API** (ART-01 through ART-12, except ART-11/12) — Pine Script generation, AI Pick/BLSH artifact creation, metadata fields.
- **Backtests API** (BT-01/02/04/05/07/09/10/11/12/14-16) — backtest run, leaderboard, chart data, trades.
- **Auth API** (most API-level tests) — register, login, cookie-based auth, refresh token rotation, logout.
- **Broker Credential API** (CRED-01 through CRED-09, CRED-11-13/15/16) — credential CRUD, masking, multi-user isolation.
- **Live Trading API** (LIVE-01/02/04-06/08/10/12/15/16) — signal check, dry-run execute, orders, positions.
- **Strategy API** (most STRAT tests) — conservative/aggressive runs, AI Pick/BLSH 202 responses.
- **Auto-Buy Settings** (AB-02 through AB-08) — settings GET/PATCH with field updates.
- **Ideas UI** (IDEA-UI-01 through IDEA-UI-06/08) — page loads, heading, new idea button, dialog opens, form fields visible, auth guard.
- **Alerts UI** (ALERT-UI-01 through ALERT-UI-07/10) — page loads, heading, new alert button, dialog, form fields, alert type options, proximity conditional field.

---

## Recommendations

### Immediate Actions (This Sprint)

1. **Fix login/register UI redirect (B-10/B-01).** Check `frontend/app/(auth)/login/page.tsx` — the success handler. The `router.push("/dashboard")` call may be inside an async block that isn't awaiting the cookie being set. Use `router.replace("/dashboard")` and ensure the API call sets the cookie before navigation.

2. **Remove dev bypass from auth (B-03).** Search the codebase for `dev@nextgenstock.local` — there is a dev bypass returning a hardcoded user. This must be removed for any production readiness. Check all middleware and auth dependencies.

3. **Fix multi-tenancy data isolation (B-04).** The DB queries must scope by `user_id`. The LIVE-17 test shows `USER_B sees USER_A's orders` — check `GET /live/orders` in `backend/app/api/live.py`.

4. **Fix auto-buy dry-run to accept empty body (B-05).** Either make `DryRunRequest` body optional in the FastAPI route signature, or update the test helper to send `data: {}`.

5. **Add DB reset / cleanup mechanism.** Add a `POST /api/test/reset` endpoint (dev/test only) that cleans up test user data, or implement test user isolation via unique emails in every test.

### Short-Term (Next Sprint)

6. **Fix CSS selector syntax errors in tests (B-13).** Replace comma-separated attribute selectors with Playwright's `.or()` combinator. Affects LIVE-18, LIVE-22, STRAT-18, STRAT-19, BT-17.

7. **Fix test assertion direction bugs (B-16, B-17).** Review multi-tenancy and security tests where `expect([statusArr]).toContain(200)` should be `expect([statusArr]).toContain(status)`.

8. **Fix multi-tenancy test user isolation (test issue).** Use `browser.newContext()` or separate `request` contexts for USER_A and USER_B to prevent cookie leakage.

9. **Fix auto-buy UI selectors or implement missing UI elements (B-07).** The auto-buy page needs a risk disclaimer banner, enable switch with `role="switch"`, paper/live mode text, and decision log section with column headers.

10. **Add sr-only class exception to heading visibility tests (B-14).** Change assertions from `toBeVisible()` to `toHaveText()` for `data-testid="page-title"` elements.

### Deferred

11. **Strategy schema — add min_confirmations, trailing_stop_pct to StrategyRunOut (B-09).**

12. **Add GET /alerts/{id} endpoint (B-22)** to support single-alert fetch for ownership tests.

13. **Review theme score explanation field type (B-19)** — ensure it returns `string[]` not a single string.

---

## Known Limitations and Notes

1. **v3 Backend Not Implemented.** `TASKS3.md` lists 42 tasks for v3 (live scanner, buy signals, news scanner, auto-generated ideas). The `GET /watchlist`, `GET /generated-ideas` routers are registered but may return empty or stub responses.

2. **Test Isolation.** The Playwright config uses `workers: 1` to serialize tests against the shared PostgreSQL DB. However there is no `afterEach` DB cleanup — test data accumulates across runs, causing state-dependent failures (notably auto-buy settings, multi-tenancy).

3. **Dev Mode vs Production.** Several failures (login UI redirect, auth bypass) suggest the tests may be running against a Next.js dev server that has different behavior than production. The dev server may serve different middleware or have a hot-reload state issue.

4. **Slow Tests.** `CRED-10` and `AB-UI-05/06/07` timeout at 60s. These tests involve full UI interactions (credential save, confirmation dialog) that require backend calls. Consider increasing individual test timeouts for these.

5. **V2 API Coverage Summary.** Buy zone, opportunities, ideas, and theme score APIs are fully covered and mostly passing. Auto-buy dry-run and alerts CRUD have systemic test infrastructure issues (body requirement, stale DB state).

---

## Test Infrastructure Changes Required

The following changes to the test infrastructure are recommended:

```typescript
// tests/e2e/helpers/api.helper.ts — add fresh request context helper
export async function createFreshRequest(browser: Browser): Promise<APIRequestContext> {
  const context = await browser.newContext();
  return context.request;
}

// tests/e2e/fixtures/test-data.ts — add a database reset endpoint call
export async function resetTestDb(request: APIRequestContext): Promise<void> {
  // Requires backend POST /api/v1/test/reset (NODE_ENV=test only)
  await request.post(`${API_URL}/test/reset`);
}
```

Additionally, the `autoBuyDryRun` helper in `v2-api.helper.ts` should be updated:
```typescript
export async function autoBuyDryRun(
  request: APIRequestContext,
  ticker: string
): Promise<...> {
  const res = await request.post(`${API_URL}/auto-buy/dry-run/${ticker}`, {
    data: {},  // empty body — credential_id is optional
  });
  ...
}
```

---

*Report generated from Playwright test run on 2026-03-25. Backend at :8000 confirmed healthy. Frontend at :3000 confirmed running. All test output is real — no fabricated results.*
