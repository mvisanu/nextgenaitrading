# E2E Test Results Report

**Date:** 2026-03-24
**Environment:** All services running (Docker PostgreSQL on :5432, FastAPI backend on :8000, Next.js frontend on :3000)
**Runner:** Playwright with 1 worker, 3 browsers (chromium, firefox, webkit)
**Duration:** ~1.1 hours

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tests** | 789 |
| **Passed** | 421 |
| **Failed** | 358 |
| **Skipped** | 10 |
| **Pass rate** | **53.4%** |

### Per-Browser Breakdown

| Browser | Total | Passed | Failed | Skipped |
|---------|-------|--------|--------|---------|
| Chromium | 263 | 141 | 118 | 4 |
| Firefox | 263 | 139 | 120 | 4 |
| WebKit | 263 | 141 | 120 | 2 |

---

## Failure Categories

### Category 1: Auth 401 Tests Returning 200 (~48 failures)

Tests expect unauthenticated requests to return HTTP 401, but receive 200 instead. The test creates a fresh request context (or logs out first) expecting no valid session, but the backend still serves a successful response.

**Affected endpoints and test IDs:**
- `GET /auth/me` -- AUTH-03-02, API-13
- `POST /auth/logout` then `GET /auth/me` -- AUTH-04-01, API-15
- `GET /backtests` -- BT-03
- `GET /backtests/{id}` -- BT-06
- `GET /backtests/{id}/trades` -- BT-08
- `GET /broker/credentials` -- CRED-08
- `POST /live/run-signal-check` -- LIVE-03
- `POST /live/execute` -- LIVE-07
- `GET /live/orders` -- LIVE-09
- `GET /live/positions` -- LIVE-11
- `GET /live/status` -- LIVE-14
- `GET /artifacts` -- ART-11
- `GET /auth/me` (unauthenticated) -- AUTH-07-03
- SEC-09 (8 of 16 endpoints): `GET /auth/me`, `GET /profile`, `PATCH /profile`, `GET /broker/credentials`, `GET /backtests`, `GET /strategies/runs`, `GET /live/orders`, `GET /live/positions`, `GET /live/status`, `GET /artifacts`
- API-18 (protected endpoints batch test)
- STRAT-07, STRAT-12, PROF-07, PROF-08

**Root cause:** The Playwright `request` context shares cookies across calls within the same test fixture. When a prior test logs in using the same `request` fixture, cookies persist. Additionally, some endpoints (GET list endpoints) may be returning 200 with empty arrays instead of 401 when the auth dependency resolves a stale/default session. The `dev@nextgenstock.local` user session from DB seeding may also be interfering.

**Impact:** ~48 unique test cases failing across all browsers.

---

### Category 2: Middleware Redirect Failures (~42 failures)

Tests expect unauthenticated browser access to protected routes (`/dashboard`, `/strategies`, `/backtests`, `/live-trading`, `/artifacts`, `/profile`) to redirect to `/login`, but the page stays on the protected route.

**Affected test IDs:**
- AUTH-06: 6 routes x 3 browsers = 18 failures
- MW-01: 6 routes x 3 browsers = 18 failures
- MW-02: `/login` redirect should include `callbackUrl` query param (3 failures, times out at 1 min)
- MW-03: Root path `/` should redirect to `/login` (3 failures)
- DASH-02: Unauthenticated access to `/dashboard` should redirect (3 failures)

**Root cause:** The Next.js middleware (`frontend/middleware.ts`) is either not checking the `access_token` cookie properly, not intercepting the routes, or there is a timing/rendering issue where the page loads before the redirect fires. All these tests timeout at ~11 seconds waiting for the URL to change.

**Impact:** ~42 failures (14 unique test cases x 3 browsers).

---

### Category 3: UI Element Not Found (~39 failures)

Tests look for specific DOM elements/selectors that do not exist in the current frontend implementation.

**Affected test IDs and missing elements:**

| Test ID | Missing Element | Selector Used |
|---------|----------------|---------------|
| ART-13 | Page heading on `/artifacts` | `h1, h2, [data-testid="page-title"]` |
| ART-14 | "BTC-USD" or "BTC" text in artifact list | `text=BTC-USD`, `text=BTC` (chromium only) |
| ART-16 | Copy button for Pine Script | `button:has-text("Copy"), button[aria-label*="copy" i], [data-testid="copy-button"]` |
| BT-14 | Backtest run form | Run form selectors on `/backtests` |
| BT-17 | Leaderboard table | Leaderboard table visibility check |
| DASH-03 | Dashboard heading "Dashboard" | Heading containing "Dashboard" |
| DASH-04 | KPI metric cards | KPI card selectors |
| DASH-05 | Recent strategy runs section (nextgenstock-live) | Strategy runs section |
| DASH-07 | User email in sidebar/header | Email text matching test user |
| LIVE-18 | Disclaimer/warning alert | Alert/disclaimer selectors |
| LIVE-22 | Orders history table | Orders table selectors |
| CRED-10 | Add credential form interaction | Times out trying to add credential via UI (60s timeout) |
| CRED-14 | Test connection result badge (firefox/webkit) | Result badge after test button click |
| PROF-09 | Profile form elements | Expected form element selectors |
| STRAT-18 | Validation error for invalid symbol | Error message display |
| STRAT-19 | Signal/confirmation count in results | Result display selectors |
| STRAT-01/02 | Strategy response shape fields | `confirmation_count` field expected but missing |

**nextgenstock-live.spec.ts** specific UI failures (all behind login wall, timeout at ~16.5s):
- DASH-01 through DASH-06 (dashboard page tests)
- PAGES-01 through PAGES-08 (protected page rendering)
- SESSION-01 through SESSION-04 (session management)
- NAV-01 through NAV-03 (navigation flows)

**Root cause:** Frontend pages exist but either (a) don't render the expected elements with the selectors tests look for, (b) the authenticated page never loads because the login flow in the test fails first (cascading from Category 5), or (c) the page structure differs from the test expectations.

**Impact:** ~39 unique test cases x 3 browsers, though many of the nextgenstock-live.spec.ts failures are cascading from login failures.

---

### Category 4: Multi-Tenancy Returning Wrong Status Codes (~39 failures)

Tests expect 403 or 404 when User B accesses User A's resources, but receive 200 instead.

**Affected test IDs:**

| Test ID | Resource | Expected | Got |
|---------|----------|----------|-----|
| MT-01 | `GET /backtests/{userA_runId}` | 403/404 | 200 |
| MT-02 | `GET /backtests/{runId}/trades` | 403/404 | 200 |
| MT-03 | `GET /backtests/{runId}/leaderboard` | 403/404 | 200 |
| MT-04 | `GET /backtests` (list filtering) | Not contain User A's IDs | Contains them |
| MT-05 | `GET /strategies/runs/{runId}` | 403/404 | 200 |
| MT-06 | `GET /strategies/runs` (list filtering) | Not contain User A's IDs | Contains them |
| MT-07 | `POST /broker/credentials/{credId}/test` | 403/404 | 200 |
| MT-08 | `DELETE /broker/credentials/{credId}` | 403/404 | 204 |
| MT-09 | `PATCH /broker/credentials/{credId}` | 403/404 | 200 |
| MT-10 | `GET /artifacts/{artifactId}` | 403/404 | 200 |
| MT-11 | `GET /artifacts` (list filtering) | Only User B's | Contains User A's |
| MT-12 | `GET /live/orders` (filtering) | Not contain User A's | Contains them |
| MT-14 | User ID injection in request body | Should be ignored | User ID accepted |
| ART-12 | `GET /artifacts/{id}/pine-script` | 403/404 | 200 |
| BT-13 | `GET /backtests/{id}/chart-data` | 403/404 | 200 |
| CRED-07 | `GET /broker/credentials/{id}` | 403 | 200 |
| SEC-10 | `GET /backtests/{id}` cross-user | 403/404 | 200 |
| SEC-11 | `PATCH /broker/credentials/{id}` cross-user | 403/404 | 200 |
| LIVE-17 | `GET /live/orders` cross-user | Not visible | Visible |

**Root cause:** The backend queries are not properly scoping by `user_id`. The `WHERE user_id = current_user.id` filter is either missing or the `get_current_user` dependency is returning a shared/default user (possibly the `dev@nextgenstock.local` seeded user) for all requests. This is likely the same root cause as Category 1 -- if auth is not properly isolating sessions, both users resolve to the same account.

**Impact:** 13 unique test cases x 3 browsers = 39 failures. This is a **critical security issue**.

---

### Category 5: Auth UI Flow Failures (~18 failures)

Login and registration form submissions do not redirect to `/dashboard` after success.

**Affected test IDs:**
- AUTH-01-05: Register form stays on `/register` after submit (3 browsers)
- AUTH-02-05: Login form stays on `/login` after submit (3 browsers)
- AUTH-07-01: HttpOnly cookie check fails because login never completes in browser (3 browsers)
- AUTH-07-02: localStorage check fails because login never completes (3 browsers)
- REG-UI-05: Valid registration does not redirect to `/dashboard` (3 browsers)
- REG-UI-06: Duplicate email error toast not shown (stays on /register) (3 browsers)
- REG-UI-10: Authenticated user visiting `/register` not redirected to `/dashboard` (3 browsers)
- LOGIN-UI-07: Successful login does not redirect to `/dashboard` (3 browsers)
- LOGIN-UI-11: Authenticated user visiting `/login` not redirected to `/dashboard` (3 browsers)

**Root cause:** The form submission handler in the register/login pages likely calls the API but does not perform `router.push("/dashboard")` on success, or the redirect depends on middleware that is broken (see Category 2). The page remains at the auth URL after form submission. Error message: `Expected pattern: /\/dashboard/; Received string: "http://localhost:3000/login"` (or `/register`).

**Impact:** ~18 failures (6 unique test cases x 3 browsers), plus ~60 cascading failures in nextgenstock-live.spec.ts.

---

### Category 6: Email Mismatch in /auth/me (3 failures)

- AUTH-03-01: Expected `e2e-user-a@nextgenstock.io` but received `dev@nextgenstock.local`
- API-14: Same issue -- `GET /auth/me` returns wrong user data
- API-15: Logout + subsequent `/auth/me` still returns 200 (related)

**Root cause:** The `GET /auth/me` endpoint returns `dev@nextgenstock.local` instead of the test user's email. This indicates the login flow creates a session but `get_current_user` resolves to the pre-seeded dev user, or the access token JWT contains the wrong user ID. This could be caused by a DB seeding script that creates a default session that persists across test runs.

**Impact:** 3 unique test cases x 3 browsers = 9 failures.

---

### Category 7: Live Status 404 vs Actual Response (3 failures)

- LIVE-13: `GET /live/status` expected 404 when no credentials exist, but got a different status (likely 200 with empty/default data, or 422).

**Root cause:** The endpoint returns a default/empty account status rather than 404 when no broker credentials exist for the user.

**Impact:** 3 failures (1 test x 3 browsers).

---

### Category 8: Strategy Response Shape Mismatches (6 failures)

- STRAT-01: Conservative backtest response missing `confirmation_count` field
- STRAT-02: Aggressive backtest response missing `trailing_stop_pct` field
- STRAT-08: Invalid timeframe not returning 422 (likely returns 200 and uses default)

**Root cause:** The `StrategyRunOut` schema may not include all fields the tests expect, or the backtest endpoint normalizes/accepts invalid timeframes silently.

**Impact:** 3 unique test cases x 3 browsers = ~9 failures.

---

### Category 9: Skipped Tests (10 total)

These tests were skipped (marked with `-`), not failed:
- CRED-13: Delete credential confirmation dialog (3 browsers)
- CRED-14: Test connection result badge (chromium skipped; firefox/webkit fail)
- LIVE-20: Live trading confirmation dialog (3 browsers)
- LIVE-23: Warning banner for LIVE mode (3 browsers)

These are likely `test.skip()` or `test.fixme()` in the spec files, pending UI implementation.

---

## Per-Spec File Breakdown

### artifacts.spec.ts (16 tests per browser = 48 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| ART-01 | GET /artifacts empty array | PASS | PASS | PASS | -- |
| ART-02 | AI Pick creates artifact | PASS | PASS | PASS | -- |
| ART-03 | Artifact metadata shape | PASS | PASS | PASS | -- |
| ART-04 | mode_name is 'ai-pick' | PASS | PASS | PASS | -- |
| ART-05 | BLSH artifact mode_name | PASS | PASS | PASS | -- |
| ART-06 | GET /artifacts/{id} | PASS | PASS | PASS | -- |
| ART-07 | 404 for non-existent | PASS | PASS | PASS | -- |
| ART-08 | Pine Script with code | PASS | PASS | PASS | -- |
| ART-09 | Code starts with @version=5 | PASS | PASS | PASS | -- |
| ART-10 | Symbol matches optimizer | PASS | PASS | PASS | -- |
| ART-11 | 401 when unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| ART-12 | 403 for other user's artifact | FAIL | FAIL | FAIL | Cat 4 |
| ART-13 | Artifacts page loads | FAIL | FAIL | FAIL | Cat 3 |
| ART-14 | BTC symbol visible | FAIL | PASS | PASS | Cat 3 |
| ART-15 | Click shows Pine Script | PASS | PASS | PASS | -- |
| ART-16 | Copy button present | FAIL | FAIL | FAIL | Cat 3 |

**Pass: 36/48 | Fail: 11/48 | Skip: 0**

---

### auth.spec.ts (21 tests per browser = 63 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| AUTH-01-01 | Register returns 201 | PASS | PASS | PASS | -- |
| AUTH-01-02 | Duplicate email 409/422 | PASS | PASS | PASS | -- |
| AUTH-01-03 | Short password 422 | PASS | PASS | PASS | -- |
| AUTH-01-04 | Malformed email 422 | PASS | PASS | PASS | -- |
| AUTH-01-05 | Register UI redirects | FAIL | FAIL | FAIL | Cat 5 |
| AUTH-01-06 | Inline error duplicate | PASS | PASS | PASS | -- |
| AUTH-02-01 | Login returns 200 | PASS | PASS | PASS | -- |
| AUTH-02-02 | Wrong password 401 | PASS | PASS | PASS | -- |
| AUTH-02-03 | Non-existent email 401 | PASS | PASS | PASS | -- |
| AUTH-02-04 | No raw tokens in body | PASS | PASS | PASS | -- |
| AUTH-02-05 | Login UI redirects | FAIL | FAIL | FAIL | Cat 5 |
| AUTH-02-06 | Error on wrong password | PASS | PASS | PASS | -- |
| AUTH-03-01 | /auth/me returns user | FAIL | FAIL | FAIL | Cat 6 |
| AUTH-03-02 | 401 without cookie | FAIL | FAIL | FAIL | Cat 1 |
| AUTH-04-01 | Logout then 401 | FAIL | FAIL | FAIL | Cat 1 |
| AUTH-04-02 | UI logout redirects | PASS | PASS | PASS | -- |
| AUTH-05-01 | Refresh returns 200 | PASS | PASS | PASS | -- |
| AUTH-05-02 | Refresh without cookie 401 | PASS | PASS | PASS | -- |
| AUTH-06 x6 | Middleware redirects (6 routes) | 6xFAIL | 6xFAIL | 6xFAIL | Cat 2 |
| AUTH-07-01 | HttpOnly cookie check | FAIL | FAIL | FAIL | Cat 5 |
| AUTH-07-02 | No JWT in localStorage | FAIL | FAIL | FAIL | Cat 5 |
| AUTH-07-03 | Unauth API returns 401 | FAIL | FAIL | FAIL | Cat 1 |

**Pass: 30/63 | Fail: 33/63 | Skip: 0**

---

### backtests.spec.ts (17 tests per browser = 51 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| BT-01 | POST /backtests/run 202 | PASS | PASS | PASS | -- |
| BT-02 | GET /backtests has entries | PASS | PASS | PASS | -- |
| BT-03 | 401 unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| BT-04 | GET /{id} correct details | PASS | PASS | PASS | -- |
| BT-05 | 404 non-existent | PASS | PASS | PASS | -- |
| BT-06 | 401 unauthenticated /{id} | FAIL | FAIL | FAIL | Cat 1 |
| BT-07 | Trades array | PASS | PASS | PASS | -- |
| BT-08 | 401 trades unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| BT-09 | Leaderboard ranked | PASS | PASS | PASS | -- |
| BT-10 | One selected_winner | PASS | PASS | PASS | -- |
| BT-11 | Chart-data shape | PASS | PASS | PASS | -- |
| BT-12 | OHLCV fields | PASS | PASS | PASS | -- |
| BT-13 | 403 cross-user chart-data | FAIL | FAIL | FAIL | Cat 4 |
| BT-14 | UI run form loads | FAIL | FAIL | FAIL | Cat 3 |
| BT-15 | Equity curve renders | PASS | PASS | PASS | -- |
| BT-16 | Trade list table | PASS | PASS | PASS | -- |
| BT-17 | Leaderboard table | FAIL | FAIL | FAIL | Cat 3 |

**Pass: 33/51 | Fail: 18/51 | Skip: 0**

---

### broker-credentials.spec.ts (14 tests per browser = 42 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| CRED-01 | Create Alpaca | PASS | PASS | PASS | -- |
| CRED-02 | Create Robinhood | PASS | PASS | PASS | -- |
| CRED-03 | List without raw keys | PASS | PASS | PASS | -- |
| CRED-04 | Update profile_name | PASS | PASS | PASS | -- |
| CRED-05 | Delete returns 204 | PASS | PASS | PASS | -- |
| CRED-06 | Test returns {ok: bool} | PASS | PASS | PASS | -- |
| CRED-07 | 403 cross-user | FAIL | FAIL | FAIL | Cat 4 |
| CRED-08 | 401 unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| CRED-09 | UI credential section | PASS | PASS | PASS | -- |
| CRED-10 | Add via UI | FAIL | FAIL | FAIL | Cat 3 |
| CRED-11 | No raw keys in DOM | PASS | PASS | PASS | -- |
| CRED-12 | Green badge | PASS | PASS | PASS | -- |
| CRED-13 | Delete confirmation | SKIP | SKIP | SKIP | Skipped |
| CRED-14 | Test connection badge | SKIP | FAIL | FAIL | Cat 3 |

**Pass: 27/42 | Fail: 10/42 | Skip: 3-4**

---

### dashboard.spec.ts (9 tests per browser = 27 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| DASH-01 | Lands on dashboard | PASS | PASS | PASS | -- |
| DASH-02 | Unauth redirects | FAIL | FAIL | FAIL | Cat 2 |
| DASH-03 | Heading "Dashboard" | FAIL | FAIL | FAIL | Cat 3 |
| DASH-04 | KPI cards present | FAIL | FAIL | FAIL | Cat 3 |
| DASH-05 | Recent runs section | FAIL | PASS | PASS | Cat 3 |
| DASH-06 | Sidebar links | PASS | PASS | PASS | -- |
| DASH-07 | User email visible | FAIL | FAIL | FAIL | Cat 3 |
| DASH-08 | Broker health section | PASS | PASS | PASS | -- |
| DASH-09 | CTA navigation | PASS | PASS | PASS | -- |

**Pass: 16/27 | Fail: 11/27 | Skip: 0**

---

### live-trading.spec.ts (23 tests per browser = 69 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| LIVE-01 | Signal check returns shape | PASS | PASS | PASS | -- |
| LIVE-02 | No broker order created | PASS | PASS | PASS | -- |
| LIVE-03 | 401 unauthenticated signal | FAIL | FAIL | FAIL | Cat 1 |
| LIVE-04 | Dry-run OrderOut | PASS | PASS | PASS | -- |
| LIVE-05 | Dry-run default | PASS | PASS | PASS | -- |
| LIVE-06 | Order in GET /live/orders | PASS | PASS | PASS | -- |
| LIVE-07 | 401 execute unauth | FAIL | FAIL | FAIL | Cat 1 |
| LIVE-08 | Orders array | PASS | PASS | PASS | -- |
| LIVE-09 | 401 orders unauth | FAIL | FAIL | FAIL | Cat 1 |
| LIVE-10 | Positions array | PASS | PASS | PASS | -- |
| LIVE-11 | 401 positions unauth | FAIL | FAIL | FAIL | Cat 1 |
| LIVE-12 | Account status shape | PASS | PASS | PASS | -- |
| LIVE-13 | 404 no credentials | FAIL | FAIL | FAIL | Cat 7 |
| LIVE-14 | 401 status unauth | FAIL | FAIL | FAIL | Cat 1 |
| LIVE-15 | Chart-data candles | PASS | PASS | PASS | -- |
| LIVE-16 | 422 invalid symbol | PASS | PASS | PASS | -- |
| LIVE-17 | Cross-user order isolation | FAIL | FAIL | FAIL | Cat 4 |
| LIVE-18 | Disclaimer alert | FAIL | FAIL | FAIL | Cat 3 |
| LIVE-19 | Dry-run toggle | PASS | PASS | PASS | -- |
| LIVE-20 | Confirmation dialog | SKIP | SKIP | SKIP | Skipped |
| LIVE-21 | Positions table | PASS | PASS | PASS | -- |
| LIVE-22 | Orders history table | FAIL | FAIL | FAIL | Cat 3 |
| LIVE-23 | LIVE mode banner | SKIP | SKIP | SKIP | Skipped |

**Pass: 30/69 | Fail: 27/69 | Skip: 6**

---

### multi-tenancy.spec.ts (14 tests per browser = 42 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| MT-01 | Cross-user backtest read | FAIL | FAIL | FAIL | Cat 4 |
| MT-02 | Cross-user trades read | FAIL | FAIL | FAIL | Cat 4 |
| MT-03 | Cross-user leaderboard | FAIL | FAIL | FAIL | Cat 4 |
| MT-04 | List filtering backtests | FAIL | FAIL | FAIL | Cat 4 |
| MT-05 | Cross-user strategy run | FAIL | FAIL | FAIL | Cat 4 |
| MT-06 | List filtering strategy runs | FAIL | FAIL | FAIL | Cat 4 |
| MT-07 | Cross-user cred test | FAIL | FAIL | FAIL | Cat 4 |
| MT-08 | Cross-user cred delete | FAIL | FAIL | FAIL | Cat 4 |
| MT-09 | Cross-user cred update | FAIL | FAIL | FAIL | Cat 4 |
| MT-10 | Cross-user artifact read | FAIL | FAIL | FAIL | Cat 4 |
| MT-11 | Artifact list filtering | FAIL | FAIL | FAIL | Cat 4 |
| MT-12 | Cross-user orders | FAIL | FAIL | FAIL | Cat 4 |
| MT-13 | Cross-user positions | PASS | PASS | PASS | -- |
| MT-14 | User ID injection | FAIL | FAIL | FAIL | Cat 4 |

**Pass: 3/42 | Fail: 39/42 | Skip: 0**

---

### nextgenstock-live.spec.ts (89 tests per browser = 267 total)

| Test Group | Test IDs | Chromium | Firefox | WebKit | Category |
|------------|----------|----------|---------|--------|----------|
| API-01 to API-12 | Auth API basics | 12 PASS | 12 PASS | 12 PASS | -- |
| API-13 | /auth/me without cookie | FAIL | FAIL | FAIL | Cat 1 |
| API-14 | /auth/me with session | FAIL | FAIL | FAIL | Cat 6 |
| API-15 | Logout + /auth/me | FAIL | FAIL | FAIL | Cat 1 |
| API-16, API-17 | Refresh token | PASS | PASS | PASS | -- |
| API-18 | Protected endpoints batch | FAIL | FAIL | FAIL | Cat 1 |
| REG-UI-01 to 04 | Register form validation | 4 PASS | 4 PASS | 4 PASS | -- |
| REG-UI-05 | Register redirects | FAIL | FAIL | FAIL | Cat 5 |
| REG-UI-06 | Duplicate error toast | FAIL | FAIL | FAIL | Cat 5 |
| REG-UI-07 to 09 | Register UI basics | 3 PASS | 3 PASS | 3 PASS | -- |
| REG-UI-10 | Auth user redirect from register | FAIL | FAIL | FAIL | Cat 5 |
| LOGIN-UI-01 to 06 | Login form validation | 6 PASS | 6 PASS | 6 PASS | -- |
| LOGIN-UI-07 | Login redirects | FAIL | FAIL | FAIL | Cat 5 |
| LOGIN-UI-08 to 10 | Login UI basics | 3 PASS | 3 PASS | 3 PASS | -- |
| LOGIN-UI-11 | Auth user redirect from login | FAIL | FAIL | FAIL | Cat 5 |
| MW-01 x6 | Route protection | 6 FAIL | 6 FAIL | 6 FAIL | Cat 2 |
| MW-02 | callbackUrl param | FAIL | FAIL | FAIL | Cat 2 |
| MW-03 | Root redirect | FAIL | FAIL | FAIL | Cat 2 |
| MW-04 | Auth user access | FAIL | FAIL | FAIL | Cat 2/5 |
| MW-05, MW-06 | Public routes allowed | PASS | PASS | PASS | -- |
| DASH-01 to DASH-06 | Dashboard page | 6 FAIL | 6 FAIL | 6 FAIL | Cat 3/5 |
| PAGES-01 to PAGES-08 | Protected pages | 8 FAIL | 8 FAIL | 8 FAIL | Cat 3/5 |
| SESSION-01 to SESSION-04 | Session management | 4 FAIL | 4 FAIL | 4 FAIL | Cat 5 |
| UI-01 to UI-08 | Auth page consistency | 8 PASS | 8 PASS | 8 PASS | -- |
| ERR-01 to ERR-03 | Error handling | 3 PASS | 3 PASS | 3 PASS | -- |
| NAV-01 to NAV-03 | Navigation flows | 3 FAIL | 3 FAIL | 3 FAIL | Cat 5 |

**Pass: 120/267 | Fail: 147/267 | Skip: 0**

---

### profile.spec.ts (12 tests per browser = 36 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| PROF-01 to PROF-06 | API CRUD operations | 6 PASS | 6 PASS | 6 PASS | -- |
| PROF-07 | 401 GET unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| PROF-08 | 401 PATCH unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| PROF-09 | UI form elements | FAIL | FAIL | FAIL | Cat 3 |
| PROF-10 | Form pre-populated | PASS | PASS | PASS | -- |
| PROF-11 | Update success toast | PASS | PASS | PASS | -- |
| PROF-12 | Navigable from sidebar | PASS | PASS | PASS | -- |

**Pass: 27/36 | Fail: 9/36 | Skip: 0**

---

### security.spec.ts (15 unique tests, 16 endpoints in SEC-09 = variable per browser)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| SEC-01 | HttpOnly access_token | FAIL | FAIL | FAIL | Cat 5 |
| SEC-02 | HttpOnly refresh_token | FAIL | FAIL | FAIL | Cat 5 |
| SEC-03 | No localStorage tokens | FAIL | FAIL | FAIL | Cat 5 |
| SEC-04 | No sessionStorage tokens | FAIL | FAIL | FAIL | Cat 5 |
| SEC-05 to SEC-08 | Key masking | 4 PASS | 4 PASS | 4 PASS | -- |
| SEC-09 (16 endpoints) | 401 per endpoint | 8F/8P | 8F/8P | 8F/8P | Cat 1 |
| SEC-10 | Cross-user backtest 403 | FAIL | FAIL | FAIL | Cat 4 |
| SEC-11 | Cross-user cred 403 | FAIL | FAIL | FAIL | Cat 4 |
| SEC-12 to SEC-14 | No sensitive fields | 3 PASS | 3 PASS | 3 PASS | -- |
| SEC-15 | /healthz public | PASS | PASS | PASS | -- |

SEC-09 endpoints that FAIL (return 200 instead of 401): `GET /auth/me`, `GET /profile`, `PATCH /profile`, `GET /broker/credentials`, `GET /backtests`, `GET /strategies/runs`, `GET /live/orders`, `GET /live/positions`, `GET /live/status`, `GET /artifacts`

SEC-09 endpoints that PASS: `POST /broker/credentials`, `POST /backtests/run`, `POST /strategies/ai-pick/run`, `POST /strategies/buy-low-sell-high/run`, `POST /live/run-signal-check`, `POST /live/execute`

---

### strategies.spec.ts (19 tests per browser = 57 total)

| Test ID | Description | Chromium | Firefox | WebKit | Category |
|---------|-------------|----------|---------|--------|----------|
| STRAT-01 | Conservative shape | FAIL | FAIL | FAIL | Cat 8 |
| STRAT-02 | Aggressive shape | FAIL | FAIL | FAIL | Cat 8 |
| STRAT-03 | Invalid symbol 422 | PASS | PASS | PASS | -- |
| STRAT-04 | Symbol uppercase | PASS | PASS | PASS | -- |
| STRAT-05 | Leverage override | PASS | PASS | PASS | -- |
| STRAT-06 | Run persisted | PASS | PASS | PASS | -- |
| STRAT-07 | 401 unauthenticated | FAIL | FAIL | FAIL | Cat 1 |
| STRAT-08 | Invalid timeframe 422 | FAIL | FAIL | FAIL | Cat 8 |
| STRAT-09 | Robinhood + stock 422 | PASS | PASS | PASS | -- |
| STRAT-10 | AI Pick variant name | PASS | PASS | PASS | -- |
| STRAT-11 | AI Pick artifact | PASS | PASS | PASS | -- |
| STRAT-12 | AI Pick 401 unauth | FAIL | FAIL | FAIL | Cat 1 |
| STRAT-13 | BLSH variant name | PASS | PASS | PASS | -- |
| STRAT-14 | BLSH artifact | PASS | PASS | PASS | -- |
| STRAT-15 | Mode tabs load | PASS | PASS | PASS | -- |
| STRAT-16 | Symbol + run button | PASS | PASS | PASS | -- |
| STRAT-17 | Loading state | PASS | PASS | PASS | -- |
| STRAT-18 | Invalid symbol error | FAIL | FAIL | FAIL | Cat 3 |
| STRAT-19 | Result display | FAIL | FAIL | FAIL | Cat 3 |

**Pass: 36/57 | Fail: 21/57 | Skip: 0**

---

## Recommendations (Prioritized)

### Priority 1: Fix Backend Auth -- GET Endpoints Return 200 Without Cookie (Impact: ~48 tests)

**Problem:** GET endpoints (`/backtests`, `/strategies/runs`, `/live/orders`, `/live/positions`, `/live/status`, `/artifacts`, `/auth/me`, `/profile`, `/broker/credentials`) return 200 when no auth cookie is present.

**Investigation:** Check whether `get_current_user` in `app/auth/` has a fallback that returns a default user (like `dev@nextgenstock.local`) when no token cookie is found. POST endpoints correctly return 401, suggesting GET endpoints may have a different dependency or the cookie from a previous test leaks.

**Fix:** Ensure all protected endpoints use `Depends(get_current_user)` which raises `HTTPException(401)` when no valid token is found. Verify there is no `Optional` current_user dependency on GET routes. Also check if there is middleware that auto-creates sessions.

**Files to check:**
- `backend/app/auth/dependencies.py` (or wherever `get_current_user` is defined)
- `backend/app/api/` -- all route files for GET endpoints
- `backend/app/core/security.py` -- JWT decode logic

### Priority 2: Fix Next.js Middleware Redirects (Impact: ~42 tests)

**Problem:** Unauthenticated browser requests to `/dashboard`, `/strategies`, etc. are not redirected to `/login`.

**Fix:** Review `frontend/middleware.ts`. Ensure it checks for the `access_token` cookie and redirects to `/login` if missing. Verify the middleware `matcher` config includes all protected routes.

**Files to check:**
- `frontend/middleware.ts`

### Priority 3: Fix Multi-Tenancy -- Return 403/404 for Cross-User Access (Impact: ~39 tests)

**Problem:** User B can read/modify User A's resources. The backend returns 200 with User A's data instead of 403/404.

**Fix:** Add `assert_ownership(record, current_user)` checks in all service methods. For single-resource endpoints, if `record.user_id != current_user.id`, raise `HTTPException(403)`. For list endpoints, add `WHERE user_id = current_user.id` filter.

**Files to check:**
- `backend/app/api/backtests.py`
- `backend/app/api/strategies.py`
- `backend/app/api/broker.py`
- `backend/app/api/artifacts.py`
- `backend/app/api/live.py`
- `backend/app/services/` -- all service files

### Priority 4: Fix Auth UI Flows -- Form Submission Redirect (Impact: ~18 tests + ~60 cascading)

**Problem:** After successful login/register, the page stays on `/login` or `/register` instead of redirecting to `/dashboard`.

**Fix:** In the login and register form `onSubmit` handlers, ensure `router.push("/dashboard")` is called after a successful API response. Check that the response is properly awaited and cookies are set before navigation.

**Files to check:**
- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(auth)/register/page.tsx`

### Priority 5: Update Frontend UI to Match Test Selectors (Impact: ~39 tests)

**Problem:** Tests look for elements like `h1`/`h2` headings, KPI cards, copy buttons, disclaimer alerts that don't exist in the DOM.

**Fix:** Either update frontend components to include the expected elements/selectors, or add `data-testid` attributes. Key gaps:
- Dashboard: Add `h1` with "Dashboard" text, KPI metric cards, user email display
- Artifacts: Add page heading, copy button with `aria-label="copy"`
- Backtests: Add run form UI, leaderboard table
- Live Trading: Add disclaimer alert, orders history table
- Profile: Ensure form has expected input elements with proper labels

### Priority 6: Clean Up Test DB Between Runs (Impact: ~9 tests)

**Problem:** The `dev@nextgenstock.local` user from DB seeding interferes with test assertions about user identity.

**Fix:** Either (a) add a test setup script that truncates user-related tables before the E2E suite, (b) use unique email prefixes per test run, or (c) ensure the seeding script is idempotent and doesn't create sessions that persist.

### Priority 7: Fix Strategy Response Schema (Impact: ~9 tests)

**Problem:** STRAT-01/02 expect fields like `confirmation_count` and `trailing_stop_pct` in the response. STRAT-08 expects invalid timeframes to return 422.

**Fix:** Check the `StrategyRunOut` Pydantic schema to ensure it includes all documented fields. Add timeframe validation in the backtest endpoint.

### Priority 8: Fix LIVE-13 -- /live/status Without Credentials (Impact: 3 tests)

**Problem:** `GET /live/status` returns something other than 404 when no credentials exist.

**Fix:** Return 404 with a descriptive message when the user has no broker credentials configured.

---

## Coverage Gap Analysis

### Well-Covered Areas (>80% pass rate)
- **Auth API basics** (register, login, refresh, validation errors): ~95% pass rate
- **Broker credential CRUD API**: ~90% pass rate
- **Profile API CRUD**: ~100% pass rate
- **Strategy execution API** (AI Pick, BLSH, conservative, aggressive): ~85% pass rate
- **Backtest execution and data retrieval API**: ~80% pass rate
- **UI consistency on auth pages** (titles, autocomplete, dark mode): 100% pass rate
- **Error handling** (backend unreachable, 500 errors): 100% pass rate
- **Credential key masking**: 100% pass rate
- **Sensitive field exclusion**: 100% pass rate

### Poorly Covered Areas (<50% pass rate)
- **Multi-tenancy isolation**: 7% pass rate (1/14 tests pass) -- CRITICAL SECURITY GAP
- **Authentication enforcement on GET endpoints**: ~0% pass rate -- SECURITY GAP
- **Frontend middleware route protection**: 0% pass rate
- **Post-login navigation and session management**: ~0% pass rate
- **Dashboard page rendering**: ~50% pass rate
- **nextgenstock-live.spec.ts protected pages**: ~0% pass rate (all behind broken login flow)

### Areas Not Tested (Skipped)
- Delete credential confirmation dialog (CRED-13)
- Live trading confirmation dialog when disabling dry-run (LIVE-20)
- LIVE mode warning banner (LIVE-23)

### Potential False Positives
Many `nextgenstock-live.spec.ts` failures (DASH-01 through DASH-06, PAGES-01 through PAGES-08, SESSION-01 through SESSION-04, NAV-01 through NAV-03) are likely **cascading failures** from the login flow not completing. These tests try to log in via the UI, fail to redirect to `/dashboard`, and then timeout waiting for dashboard elements. Fixing the auth UI redirect (Priority 4) and middleware (Priority 2) would likely resolve ~60+ of these failures automatically.

---

## Estimated Impact of Fixes

| Fix | Tests Unblocked | New Pass Rate |
|-----|----------------|---------------|
| Priority 1: Backend auth on GET endpoints | ~48 | ~59% |
| Priority 2: Next.js middleware redirects | ~42 | ~64% |
| Priority 3: Multi-tenancy 403/404 | ~39 | ~69% |
| Priority 4: Auth UI redirect | ~18 (+ ~60 cascading) | ~79% |
| Priority 5: Frontend UI selectors | ~39 | ~84% |
| Priority 6: DB cleanup | ~9 | ~85% |
| Priority 7: Strategy schema | ~9 | ~86% |
| Priority 8: LIVE-13 status | ~3 | ~87% |
| **All fixes combined** | **~358** | **~95%+** |

Note: Many failures overlap between categories (e.g., auth issues cause multi-tenancy tests to also fail), so the actual fix count will be less than the sum. Priorities 1 and 4 together would likely resolve the largest number of failures with the least code changes.

---

## Re-run Commands

```bash
# Full suite (all 3 browsers)
cd C:\Users\Bruce\source\repos\NextgenAiTrading\tests
npx playwright test --config=e2e/playwright.config.ts

# Single spec file
npx playwright test --config=e2e/playwright.config.ts e2e/specs/auth.spec.ts

# Single browser
npx playwright test --config=e2e/playwright.config.ts --project=chromium

# View HTML report from last run
npx playwright show-report tests/e2e/playwright-report
```
