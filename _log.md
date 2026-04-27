# Session Log

## 2026-04-22 (session 5 — Login audit + bug fixes)
- Ran e2e-test-architect → wrote `test_login.md` with 9 login bugs identified across login page, pin-setup, and auth callback
- Fixed all 9 bugs via bug-fixer:
  - **BUG-LOGIN-006 (CRITICAL):** PIN lockout counter was reset to 0 on lockout trigger — removed `attempt_count = 0` from lockout block in `pin_auth.py`; counter now persists through the lockout window
  - **BUG-LOGIN-001/002:** PinPad `value[i]?.trim() ?? ""` — space-padded initial `"    "` no longer renders as 4 filled dots
  - **BUG-LOGIN-003:** Backspace handler unified to space-padding (`value.slice(0,i) + " " + value.slice(i+1)`)
  - **BUG-LOGIN-008:** Dead `"magic"` union member removed from `Mode` type; Enter-key guard updated
  - **BUG-LOGIN-009:** Collapsed dead if-else in pin-setup (both branches were identical)
  - **BUG-LOGIN-005/007/004:** Clarifying comments added on cleanPin comparison, PKCE cookie ordering, disabled button condition
- Fixed **infinite 401 redirect loop** on dashboard: `apiFetch` now calls `supabase.auth.signOut()` + clears `dev_token` cookie BEFORE `window.location.href = "/login"`; `getAuthHeaders` proactively signs out when `refreshSession()` fails — without this, middleware saw stale cookies and bounced user back from `/login` → `/dashboard` → 401 → repeat
- Fixed **"not authenticated" on pin-setup after magic link**: `handleSetPin` + `useEffect` cold-cache branch now call `refreshSession()` first (reads refresh_token from cookies, bypasses stale localStorage session that was carrying an expired access_token)
- Confirmed `user_pins` table already present (`alembic current` → `v8_user_pins (head)`); no migration needed

## 2026-04-22 (session 4 — Crons CRUD)
- Added full CRUD to `/crons` page — edit, delete, add, pause/resume, run-now
- Backend: `backend/app/api/crons.py` — new endpoints `PATCH /crons/jobs/{id}`, `DELETE /crons/jobs/{id}`, `POST /crons/jobs`, `POST /crons/jobs/{id}/pause`, `/resume`, `/run-now`; `GET /crons/templates`
- Backend: `backend/app/scheduler/jobs.py` — added `JOB_TEMPLATES` registry with callable + default trigger kwargs + description for every registered job (13 templates)
- Frontend: `frontend/lib/crons-api.ts` — typed wrappers for all new endpoints
- Frontend: `frontend/app/crons/page.tsx` — row action menu (Run Now / Edit / Pause-Resume / Delete), Add Job dialog with template selector, Edit dialog with interval or cron form, delete confirmation dialog; uses react-query mutations + toast notifications
- All endpoints Auth-gated; mutations are in-memory (APScheduler) and lost on backend restart — documented in footer copy
- Restarted port 8002 to pick up the new endpoints

## 2026-04-22 (session 3 — MAJOR JWT FIX)
- **Root cause of all 401s found:** Supabase moved this project to **ES256 (asymmetric ECDSA) JWT signing** — user access tokens now carry `alg: ES256, kid: ...` and must be verified against the project's JWKS endpoint, not with an HMAC shared secret. Backend was only doing HS256 + `SUPABASE_JWT_SECRET`, so every user token failed verification → 401 on `/auth/set-pin`, `/profile`, `/auth/has-pin`, and all dashboard endpoints.
- Legacy `HS256` path still worked for dev tokens (`POST /test/token`) and for the `anon_key`/`service_role_key` artefacts (still HS256), which is why dev-login worked but magic-link login did not.
- **Fix in `backend/app/auth/dependencies.py`:**
  - Added JWKS-based verification path for `ES256/RS256` tokens using `jwt.PyJWKClient` (cached per project URL, 1h key lifespan)
  - Kept legacy HS256 path for backward compat
  - Algorithm allow-list (`ES256`/`RS256`/`HS256`/...) prevents `alg=none` confusion attacks
  - Added `leeway=10s` to tolerate clock skew (fixed ImmatureSignatureError)
  - Added diagnostic `_log_decode_failure()` with header alg, iss, aud, role
- Verified against live project (`mhdeczgappgbazxjnyaf.supabase.co`): ES256 user tokens verify correctly, service_role_key correctly rejected (missing aud).
- Killed stale uvicorn processes on ports 8001 and 8002 (both had pre-fix code in memory); restarted 8002 fresh. Port 8000 auto-reloaded (`--reload`).
- End-to-end verified on port 8002: `/auth/set-pin` → 204, `/profile` → 200, `/auth/has-pin` → 200.
- No `requirements.txt` change needed — `PyJWT 2.12.1` and `cryptography 46.0.5` already installed.

## 2026-04-22 (session 2)
- Fixed 401 Unauthorized on `POST /auth/set-pin` from the pin-setup page
- Root cause: `handleSetPin` used `refreshSession()` → `getSession()` fallback; when the refresh token is stale/rotated, `getSession()` returns an expired access token and the backend rejects it
- Fix: replaced token-fetch logic with `getUser()` first (server-validates + auto-refreshes in one network call, writes fresh token to cookie storage), then reads the session; falls back to `refreshSession()` if `getSession()` still shows stale value
- Added 401-specific catch handler: on backend 401, calls `signOut()` + redirects to `/login` (prevents user getting stuck on pin-setup with an invalid session)
- Confirmed `v8_user_pins` migration already applied (`alembic current` → `v8_user_pins (head)`)

## 2026-04-22
- Diagnosed crons page failure: root cause was `useSearchParams()` in `frontend/app/(auth)/pin-setup/page.tsx` without a `<Suspense>` boundary — Next.js 15 hard build error that prevented Vercel deploy
- Fixed `pin-setup/page.tsx`: moved page logic into `PinSetupPageContent`, wrapped default export in `<Suspense fallback=<Loader2 spinner>>` 
- Verified frontend build passes clean after fix
- Confirmed crons inspector page (`/crons`) and backend `GET /api/v1/crons/jobs` are correctly wired — 13 APScheduler jobs returned
- PIN auth system confirmed complete: `pin-login`, `set-pin`, `has-pin` backend routes; `pin-setup` and login PIN mode frontend; `v8_user_pins` migration

## 2026-04-09
- Diagnosed Render crash loop: "Can't locate revision '5bafc0ec3474'" — DB stamped with merge head but Render image predated the file
- Added `backend/migrate_fix.py` — asyncpg script that resets stale `alembic_version` to pre-merge heads before alembic runs
- Added `backend/start.sh` — startup wrapper (migrate_fix → alembic upgrade head → uvicorn)
- Updated `backend/Dockerfile` CMD to use `start.sh` instead of inline alembic + uvicorn
- Updated CLAUDE.md: Alembic-on-Render constraint, Implementation Status timestamp
- Pushed `9ae349c` to main → triggered Render auto-deploy

## 2026-04-08
- Fixed alembic multiple-heads error — created merge migration `5bafc0ec3474` joining `v6b_congress_trade_unique_fix` + `v7c_wheel_bot_credential` into single head
- Disabled `copy_trading_monitor` scheduler job (Quiver API returning 401)
- Removed `frontend/app/congress-copy/` + `frontend/lib/congress-copy-api.ts` — broken Vercel build (missing types, backend route unregistered)
- Diagnosed Render backend 404s: caused by alembic failure preventing uvicorn from starting
- Updated CLAUDE.md: alembic fix, session workflow (status.md + _log.md convention)
