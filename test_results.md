# E2E Test Results — 2026-03-27

**Run:** `npx playwright test --config=e2e/playwright.config.ts --project=chromium`
**Browser:** Chromium only (1 worker, sequential)
**Duration:** 43.1 minutes
**Date:** 2026-03-27

---

## Overall Summary

| Status | Count |
|--------|-------|
| ✅ Passed | 173 |
| ❌ Failed | 325 |
| ⏭ Skipped | 1 |
| **Total** | **499** |
| **Pass rate** | **34.7%** |

---

## Results by Spec File

| Spec File | Passed | Failed | Total | Pass % | Notes |
|-----------|--------|--------|-------|--------|-------|
| `supabase-auth.spec.ts` | 60 | 1 | 61 | 98.4% | ✅ Near-perfect — 1 branding check |
| `security.spec.ts` | 29 | 0 | 29 | 100% | ✅ All passing |
| `nextgenstock-live.spec.ts` | 28 | 54 | 82 | 34.1% | ❌ Auth system mismatch (see below) |
| `live-trading.spec.ts` | 7 | 16 | 23 | 30.4% | ❌ Auth failures |
| `ideas.spec.ts` | 5 | 15 | 20 | 25.0% | ❌ Auth failures |
| `auto-buy.spec.ts` | 5 | 19 | 24 | 20.8% | ❌ Auth failures |
| `alerts.spec.ts` | 6 | 17 | 23 | 26.1% | ❌ Auth failures |
| `backtests.spec.ts` | 3 | 14 | 17 | 17.6% | ❌ Auth failures |
| `strategies.spec.ts` | 3 | 16 | 19 | 15.8% | ❌ Auth failures |
| `multi-tenancy.spec.ts` | 3 | 10 | 13 | 23.1% | ❌ Auth failures |
| `v3-opportunities.spec.ts` | 4 | 14 | 18 | 22.2% | ❌ Auth failures |
| `v3-ideas.spec.ts` | 2 | 19 | 21 | 9.5% | ❌ Auth failures |
| `v2-integration.spec.ts` | 4 | 11 | 15 | 26.7% | ❌ Auth failures |
| `buy-zone.spec.ts` | 2 | 13 | 15 | 13.3% | ❌ Auth failures |
| `theme-score.spec.ts` | 2 | 11 | 13 | 15.4% | ❌ Auth failures |
| `broker-credentials.spec.ts` | 1 | 13 | 14 | 7.1% | ❌ Auth failures |
| `artifacts.spec.ts` | 1 | 15 | 16 | 6.3% | ❌ Auth failures |
| `profile.spec.ts` | 2 | 10 | 12 | 16.7% | ❌ Auth failures |
| `dashboard.spec.ts` | 1 | 8 | 9 | 11.1% | ❌ Auth failures |
| `opportunities.spec.ts` | 1 | 8 | 9 | 11.1% | ❌ Auth failures |
| `opportunities-ui.spec.ts` | 1 | 8 | 9 | 11.1% | ❌ Auth failures |
| `alerts-ui.spec.ts` | 1 | 11 | 12 | 8.3% | ❌ Auth failures |
| `auto-buy-ui.spec.ts` | 1 | 14 | 15 | 6.7% | ❌ Auth failures |
| `ideas-ui.spec.ts` | 1 | 8 | 9 | 11.1% | ❌ Auth failures |

---

## Root Cause Analysis

### Primary Issue: Auth System Mismatch (~300 failures)

The vast majority of failures share a single root cause: **all test specs except `supabase-auth.spec.ts` and `security.spec.ts` authenticate via the legacy password-based endpoints** (`POST /auth/register`, `POST /auth/login`) which were **removed** during the Supabase magic-link migration.

**Symptom pattern:**
- Tests that don't require auth → PASS (401 checks, unauthenticated redirect checks, healthz, etc.)
- Tests that require auth → FAIL or TIMEOUT at 1.0 minute (can't obtain a session via old endpoints)
- `POST /auth/register` → returns `404 Method Not Found`
- `POST /auth/login` → returns `404 Method Not Found`

**What's still 100% correct:**
- `security.spec.ts` (29/29) — tests the CORS policy, rate limiting, and CSP headers, none requiring auth
- `supabase-auth.spec.ts` (60/61) — tests the new Supabase flow directly
- Route protection (unauthenticated redirects) — all MW-01–06 pass
- Bearer-token 401 checks — all pass
- Legacy endpoint removal checks — `SA-13-01–04` confirm old endpoints return 404/405 ✅

**The 1 supabase-auth failure:**
- `SA-16-01` (login page branding) — likely looks for `NextGenStock` in a specific element that was renamed in the Sovereign Terminal redesign ("NextGenAi Trading")

### Secondary Issues (within nextgenstock-live.spec.ts)

| Test ID | Failure Description |
|---------|---------------------|
| REG-UI-01 | Register page looks for password field — page now uses email-only magic link (no password field) |
| REG-UI-03/04 | Password length/match validation tests — no password field exists anymore |
| LOGIN-UI-01 | Login page looks for password field — removed in Supabase migration |
| LOGIN-UI-03/04/05 | Password-related validation — no password field |
| API-02–11 | Tests call removed `POST /auth/register` and `POST /auth/login` endpoints |
| SESSION-01/02 | Access token cookie / localStorage checks — now uses Supabase session (different cookie name) |
| PAGES-01–08 | All authenticated page load tests — fail because can't log in |
| DASH-01–06 | Authenticated dashboard tests — can't log in |

---

## What's Fully Working (Confirmed Passing)

### Security & Route Protection
- ✅ All CORS policy checks (`security.spec.ts`) — 29/29
- ✅ All Supabase auth flow tests (`supabase-auth.spec.ts`) — 60/61
- ✅ Unauthenticated route protection — `/dashboard`, `/strategies`, `/backtests`, `/live-trading`, `/artifacts`, `/profile` all redirect to `/login`
- ✅ `/login` redirect includes `callbackUrl` param
- ✅ Root `/` redirects unauthenticated user to `/login`
- ✅ `/login` and `/register` accessible without auth (no redirect loop)
- ✅ Legacy auth endpoints `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` all return 404/405
- ✅ Magic link flow: no password fields on login or register pages
- ✅ Login page and register page have educational disclaimer text
- ✅ JWT tokens not stored in localStorage
- ✅ `GET /auth/me` without auth returns 401
- ✅ Protected endpoints return 401 without auth (strategies, backtests, live, artifacts)
- ✅ `POST /auth/logout`, `GET /auth/refresh` removed (legacy)

### API — 401 Checks (unauthenticated)
- ✅ BZ-06: Buy zone returns 401 without auth
- ✅ BZ-13: Recalculate returns 401 without auth
- ✅ TS-07: Theme score returns 401 without auth
- ✅ AB-07: Auto-buy settings no credentials in response
- ✅ AB-21–24: All auto-buy endpoints return 401 without auth
- ✅ BT-03: Backtests returns 401 without auth
- ✅ BT-06: Backtest by ID returns 401 without auth
- ✅ BT-08: Backtest trades returns 401 without auth
- ✅ LIVE-07: Execute returns 401 without auth
- ✅ LIVE-09: Orders returns 401 without auth
- ✅ LIVE-11: Positions returns 401 without auth
- ✅ LIVE-14: Status returns 401 without auth
- ✅ CRED-08: Credential listing returns 401 without auth
- ✅ MT-11: USER_B artifacts only shows USER_B data
- ✅ MT-12: USER_B cannot see USER_A's orders
- ✅ MT-13: USER_B cannot see USER_A's positions
- ✅ `GET /healthz` returns `{"status":"ok"}`
- ✅ Login response body does not contain raw JWT tokens (API-12)
- ✅ Registration/Login page submit button disables during pending request (REG-UI-08)
- ✅ Email validation error on empty submit (REG-UI-02, LOGIN-UI-02)
- ✅ `/login` → `/register` navigation works
- ✅ `/register` → `/login` navigation works
- ✅ UI: page titles correct, dark mode class applied, email autocomplete attribute set
- ✅ UI: register page has new-password autocomplete, form labels match inputs

---

## Recommended Fixes (Priority Order)

### P0 — Fix test authentication helpers (fixes ~300 failures)

The `global-setup.ts` and all spec helpers that call `POST /auth/register` / `POST /auth/login` need to switch to the dev token endpoint:

```typescript
// Old (broken):
await request.post('/auth/register', { data: { email, password } });
await request.post('/auth/login', { data: { email, password } });

// New — use dev token endpoint:
const res = await request.post('/test/token', { data: { email } });
const { access_token } = await res.json();
// then pass as Bearer header: Authorization: `Bearer ${access_token}`
```

Files to update:
- `tests/e2e/global-setup.ts`
- `tests/e2e/helpers/auth.helper.ts` (if exists)
- `tests/e2e/helpers/v2-api.helper.ts`
- All specs that call `authApi.login()` / `authApi.register()`

### P1 — Update login/register UI tests for magic link flow (fixes ~15 failures in nextgenstock-live)

- Remove all tests that check for password fields (REG-UI-03, REG-UI-04, LOGIN-UI-03, LOGIN-UI-04, etc.)
- Update REG-UI-01 / LOGIN-UI-01 to check for email-only form (no password input)
- Update SESSION-01/02 to check for `dev_token` / Supabase session pattern instead of httpOnly cookie

### P2 — Fix SA-16-01 branding check (1 failure)

`supabase-auth.spec.ts` SA-16-01 likely looks for the old "NextGenStock" brand text. Update the selector/assertion to match the new "NextGenAi Trading" Sovereign Terminal branding.

---

## Comparison with Previous Run (2026-03-26)

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Total tests | ~789 (3 browsers) | 499 (chromium) | This run is chromium-only |
| Pass rate | 54% | 34.7% | Lower — more auth-requiring tests now run |
| supabase-auth | 61/61 (100%) | 60/61 (98.4%) | -1 (branding rename) |
| security | 29/29 (100%) | 29/29 (100%) | No change |
| Route protection | ✅ passing | ✅ passing | Stable |

The drop in pass rate vs. the previous report reflects this run including all spec files (including many that rely on the legacy password auth system), whereas the previous report noted the legacy `auth.spec.ts` was deleted and superseded by `supabase-auth.spec.ts`. The other spec files still carry the old auth helper calls that need to be updated.
