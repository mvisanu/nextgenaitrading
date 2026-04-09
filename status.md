# Project Status — 2026-04-09

## Working
- All V1–V7 backend + frontend features built and pushed to main
- Alembic migrations: single head (`5bafc0ec3474`) — `alembic upgrade head` succeeds locally
- Frontend build: clean (no TypeScript errors)
- Vercel: deploying from main

## Render Startup Fix (deployed 2026-04-09)
- **Root cause**: Render's running image predated `81302d3` (the commit that added the merge migration file), but the DB had already been stamped with `5bafc0ec3474`. Container crashed on every restart with "Can't locate revision '5bafc0ec3474'".
- **Fix applied**: Added `backend/migrate_fix.py` (detects and resets stale merge head), `backend/start.sh` (wrapper: fix → alembic → uvicorn), updated Dockerfile CMD to use `start.sh`. Pushed as `9ae349c`.
- **Expected**: Render auto-deploys from `9ae349c`, fresh image includes merge migration file, `migrate_fix.py` resets DB state, `alembic upgrade head` succeeds, uvicorn starts.

## Known Issues
- **Copy Trading scheduler**: Disabled — Quiver Quant API returning 401. Frontend + backend routes still intact.
- **Morning brief**: `ZeroDivisionError` if `ema200==0`; bias logic gap (bullish_count=2 + Below falls through to Neutral). Documented in CLAUDE.md, not yet fixed.

## Pending / Watch
- Confirm Render deploy from `9ae349c` completes — check Events + Logs tab
- Quiver API 401: need valid API key or alternative data source for copy trading scheduler
