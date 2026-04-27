# Project Status — 2026-04-22 (session 5)

## Working
- All V1–V7 backend + frontend features built and pushed to main
- Alembic migrations: single head — currently at `v8_user_pins`
- Frontend build: clean (no TypeScript errors, no Suspense violations)
- Vercel: deploying from main
- **Supabase JWT verification (fixed 2026-04-22):** backend supports BOTH legacy HS256 (shared secret) AND new ES256/RS256 (JWKS-based asymmetric) tokens. Current project (`mhdeczgappgbazxjnyaf`) uses ES256; `backend/app/auth/dependencies.py` uses `PyJWKClient` for asymmetric path, shared secret for HS256 path. Algorithm allow-list prevents `alg=none` confusion attacks. `leeway=10s` for clock skew.
- **Login system** (audited + 9 bugs fixed 2026-04-22):
  - Login page has 3 modes: `choose` (default) → `pin` or `magic-sent`; dead `"magic"` mode removed
  - **BUG-LOGIN-006 (CRITICAL) fixed:** PIN lockout counter no longer resets to 0 on lockout trigger; counter persists through lockout window
  - **Infinite 401 loop fixed:** `apiFetch` calls `signOut()` + clears `dev_token` before redirect to `/login`
  - **Pin-setup "not authenticated" fixed:** `handleSetPin` uses `refreshSession()` to bypass stale localStorage after PKCE magic-link exchange
  - PinPad visual bug fixed (space-padded `"    "` no longer rendered as filled dots)
- **PIN auth system** (backend + frontend):
  - `POST /auth/pin-login` — verifies email + PIN, returns Supabase `token_hash`
  - `POST /auth/set-pin` — bcrypt hashes and stores 4-digit PIN
  - `GET /auth/has-pin` — checks whether user has a PIN set
  - `frontend/app/(auth)/pin-setup/page.tsx` — PIN setup wizard; uses `refreshSession()` for cold-cache resilience after magic link; catches backend 401 → signOut + redirect
  - `frontend/app/(auth)/login/page.tsx` — PIN login mode (`choose`/`pin`/`magic-sent`) alongside magic link
  - `frontend/lib/pin-auth-api.ts` — typed wrappers for all 3 PIN endpoints
  - DB migration: `backend/alembic/versions/v8_user_pins.py` (applied)
- **Crons page — full CRUD** (`/crons`, added 2026-04-22):
  - Backend `/api/v1/crons/*`:
    - `GET /jobs` — list with `trigger_type` + parsed `interval_minutes` / `cron_*` fields
    - `GET /templates` — list addable templates (13); each flagged `already_registered`
    - `PATCH /jobs/{id}` — reschedule (interval↔cron switch allowed)
    - `DELETE /jobs/{id}` — remove from scheduler
    - `POST /jobs` — re-add from template; 409 if already registered
    - `POST /jobs/{id}/pause` · `/resume` · `/run-now`
  - Frontend `frontend/app/crons/page.tsx`: row action menu (Run Now / Edit / Pause-Resume / Delete), Add Job dialog with template picker, Edit dialog (interval or cron form), delete confirm dialog
  - Registry: `backend/app/scheduler/jobs.py::JOB_TEMPLATES` — callable + default trigger kwargs + description for every job
  - **Caveat:** All mutations are in-memory (APScheduler default MemoryJobStore). `register_jobs()` restores defaults on every backend restart. Documented in page footer.

## 13 Registered Scheduler Jobs (defaults)
| Job ID | Interval / Schedule |
|--------|---------------------|
| `refresh_buy_zones` | every 120 min |
| `refresh_theme_scores` | every 720 min |
| `evaluate_alerts` | every 10 min |
| `evaluate_auto_buy` | every 10 min |
| `scan_all_watchlists` | every 30 min |
| `run_live_scanner` | every 15 min |
| `run_idea_generator` | every 120 min |
| `run_news_scanner` | every 120 min |
| `prune_old_signals` | cron daily 02:00 UTC |
| `trailing_bot_monitor` | every 5 min |
| `wheel_bot_monitor` | every 15 min (market hours only) |
| `wheel_bot_daily_summary` | cron Mon–Fri 21:05 UTC |
| `run_commodity_alerts` | every 15 min |

These can be edited/paused/deleted/re-added live via the `/crons` page (changes reset on backend restart).

## Render Startup Fix (deployed 2026-04-09)
- `backend/migrate_fix.py` detects and resets stale merge head before alembic runs
- `backend/start.sh` wraps: migrate_fix → alembic upgrade head → uvicorn
- Dockerfile CMD uses `start.sh`

## Known Issues
- **Copy Trading scheduler**: Disabled — Quiver Quant API returning 401. Frontend + backend routes still intact.
- **Morning brief** (`morning_brief.py`):
  - `ZeroDivisionError` if `ema200 == 0` (line 154)
  - Bias logic gap: `bullish_count=2` + `price_vs_ema200="Below"` falls through to `"Neutral"` instead of `"Bearish"` (lines 170–175)
- **Crons management is non-persistent**: APScheduler uses default MemoryJobStore. Edits, deletes, adds, pauses all reset on backend restart. To persist, add a `cron_overrides` DB table and apply overrides in `register_jobs()`.

## Pending
- Quiver API 401: need valid API key or alternative data source for copy trading scheduler
- Fix `morning_brief.py` ZeroDivisionError + bias logic gap
- Add `UserPin` model import to `backend/app/db/base.py` for full Alembic consistency (minor)
- Optional: persist crons-management changes via a `cron_overrides` DB table
