# ── Stage 1: builder ──────────────────────────────────────────────────────────
# Compile C-extension wheels (hmmlearn, numpy, asyncpg) separately so the
# final image never needs build-essential, saving ~200 MB on cold starts.
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .

# Pre-build all wheels into /wheels so the runtime stage installs offline.
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# Only the runtime shared library (libpq5) and curl for the HEALTHCHECK.
FROM python:3.11-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user — least privilege principle.
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

WORKDIR /app

# Install pre-built wheels; no compiler needed, no PyPI network call at runtime.
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels /wheels/* \
    && rm -rf /wheels

# Copy source after deps so Docker layer cache reuses the install layer
# on code-only changes.
COPY --chown=appuser:appgroup . .

# start.sh must be executable by the non-root user.
RUN chmod +x /app/start.sh

USER appuser

EXPOSE 8000

# Render and Docker runtimes poll this to determine container health.
# --start-period gives uvicorn time to import all modules (hmmlearn, numpy)
# before the first check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# start.sh:
#   1. migrate_fix.py  — resets broken alembic_version state if needed
#   2. alembic upgrade head — applies any pending migrations
#   3. uvicorn         — serves the API
CMD ["/app/start.sh"]
