#!/usr/bin/env bash
# Container startup script.
# 1. Repair any broken alembic_version state (e.g. stale merge head with no file).
# 2. Run migrations to the latest head.
# 3. Start the API server.
set -euo pipefail

echo "==> [1/3] Checking migration state..."
python /app/migrate_fix.py

echo "==> [2/3] Running Alembic migrations..."
alembic upgrade head

echo "==> [3/3] Starting uvicorn..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --limit-concurrency 20 \
    --backlog 64
