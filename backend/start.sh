#!/usr/bin/env bash
# Container startup script.
# 1. Repair any broken alembic_version state (e.g. stale merge head with no file).
# 2. Run migrations to the latest head, retrying on failure.
# 3. Start the API server — ALWAYS, even if the migrations never succeeded.
#
# Why step 3 is unconditional: a transient database outage (Supabase pause,
# pooler blip, DNS hiccup) used to abort this script under `set -e`, so uvicorn
# never started, the container crash-looped, and Render answered *every* request
# with an opaque 502 — including /healthz and the DB-free auth endpoints, which
# would otherwise have kept working. Losing the database must degrade the API,
# not black it out. When migrations fail we still boot, report the fact through
# /healthz + /readyz, and retry them in the background so the service heals
# itself once the database comes back.
set -uo pipefail

MIGRATION_ATTEMPTS="${MIGRATION_ATTEMPTS:-5}"
export MIGRATIONS_OK=0

echo "==> [1/2] Applying migrations (up to ${MIGRATION_ATTEMPTS} attempts)..."

delay=5
for attempt in $(seq 1 "${MIGRATION_ATTEMPTS}"); do
    if python /app/migrate_fix.py && alembic upgrade head; then
        export MIGRATIONS_OK=1
        echo "==> Migrations applied (attempt ${attempt})."
        break
    fi

    if [ "${attempt}" -lt "${MIGRATION_ATTEMPTS}" ]; then
        echo "!!! Migration attempt ${attempt}/${MIGRATION_ATTEMPTS} failed — retrying in ${delay}s." >&2
        sleep "${delay}"
        delay=$(( delay * 2 ))
    fi
done

if [ "${MIGRATIONS_OK}" != "1" ]; then
    echo "!!! Migrations failed after ${MIGRATION_ATTEMPTS} attempts — is the database reachable?" >&2
    echo "!!! Starting the API in DEGRADED mode:" >&2
    echo "!!!   - /healthz answers 200 (process is alive) so the service stays routable" >&2
    echo "!!!   - /readyz answers 503 until the database is back" >&2
    echo "!!!   - DB-free routes (e.g. POST /auth/register) keep working" >&2
    echo "!!!   - migrations retry in the background; the API self-heals on recovery" >&2
fi

echo "==> [2/2] Starting uvicorn (MIGRATIONS_OK=${MIGRATIONS_OK})..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --limit-concurrency 20 \
    --backlog 64
