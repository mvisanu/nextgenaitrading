# Session Log

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
