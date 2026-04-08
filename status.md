# Project Status — 2026-04-08

## Working
- All V1–V7 backend + frontend features built and pushed to main
- Alembic migrations: single head (`5bafc0ec3474`) — `alembic upgrade head` succeeds locally
- Frontend build: clean (no TypeScript errors)
- Vercel: deploying from main (latest commit `bd44561`)

## Known Issues
- **Render backend**: Was returning 404 on all endpoints because `alembic upgrade head` failed (multiple heads error). Fixed by merge migration `5bafc0ec3474`. Pending Render redeploy to confirm recovery.
- **Copy Trading scheduler**: Disabled (`copy_trading_monitor` removed from `jobs.py`) — Quiver Quant API returning 401. Frontend + backend routes still intact.
- **Morning brief**: Will recover automatically once Render redeploys successfully.

## Pending / Watch
- Confirm Render deploy completes after `81302d3` push — check Events + Logs tab
- Quiver API 401: need valid API key or alternative data source for copy trading scheduler
- Known bugs in `morning_brief.py` (ZeroDivisionError if ema200==0, bias logic gap) — documented in CLAUDE.md, not yet fixed
