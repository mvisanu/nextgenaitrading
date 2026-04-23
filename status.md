# Project Status — 2026-04-22

## Working
- All V1–V7 backend + frontend features built and pushed to main
- Alembic migrations: single head — currently at `v8_user_pins`
- Frontend build: clean (no TypeScript errors, no Suspense violations)
- Vercel: deploying from main
- **Supabase JWT verification:** backend supports both legacy HS256 (shared secret) AND new ES256/RS256 (JWKS-based) tokens. Current project (`mhdeczgappgbazxjnyaf`) uses ES256; fix applied 2026-04-22 in `backend/app/auth/dependencies.py`.
- **PIN auth system** (backend + frontend):
  - `POST /auth/pin-login` — verifies email + PIN, returns Supabase `token_hash`
  - `POST /auth/set-pin` — bcrypt hashes and stores 4-digit PIN
  - `GET /auth/has-pin` — checks whether user has a PIN set
  - `frontend/app/(auth)/pin-setup/page.tsx` — PIN setup wizard (2-step: enter + confirm)
  - `frontend/app/(auth)/login/page.tsx` — PIN login mode alongside magic link
  - `frontend/lib/pin-auth-api.ts` — typed wrappers for all 3 PIN endpoints
  - DB migration: `backend/alembic/versions/v8_user_pins.py`
- **Crons inspector page** (`/crons`):
  - Backend: `GET /api/v1/crons/jobs` — lists all 13 APScheduler jobs with trigger + next_run_time
  - Frontend: `frontend/app/crons/page.tsx` — auth-gated, 30s auto-refresh, skeleton loading state

## 13 Registered Scheduler Jobs
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

## Render Startup Fix (deployed 2026-04-09)
- `backend/migrate_fix.py` detects and resets stale merge head before alembic runs
- `backend/start.sh` wraps: migrate_fix → alembic upgrade head → uvicorn
- Dockerfile CMD uses `start.sh`

## Known Issues
- **Copy Trading scheduler**: Disabled — Quiver Quant API returning 401. Frontend + backend routes still intact.
- **Morning brief** (`morning_brief.py`):
  - `ZeroDivisionError` if `ema200 == 0` (line 154)
  - Bias logic gap: `bullish_count=2` + `price_vs_ema200="Below"` falls through to `"Neutral"` instead of `"Bearish"` (lines 170–175)

## Pending
- Quiver API 401: need valid API key or alternative data source for copy trading scheduler
- Fix `morning_brief.py` ZeroDivisionError + bias logic gap
- Add `UserPin` model import to `backend/app/db/base.py` for full Alembic consistency (minor)
