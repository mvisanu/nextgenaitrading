"""
NextGenStock — FastAPI application entry point.

Startup: initialise DB connection pool, start APScheduler
Shutdown: stop scheduler, dispose engine / close pool
"""
from __future__ import annotations

import asyncio
import logging
import logging.config
import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import DisconnectionError as DBAPIDisconnectionError
from sqlalchemy.exc import InterfaceError, OperationalError

from app.core.config import settings
from app.core.rate_limit import limiter

# ── CORS origin validation helper ─────────────────────────────────────────────
_allowed_origins: set[str] = set()


def _is_origin_allowed(origin: str | None) -> bool:
    """Check if the given origin is in the configured CORS allow-list."""
    if not origin:
        return False
    if not _allowed_origins:
        _allowed_origins.update(settings.cors_origins_list)
    return origin in _allowed_origins


# ── Structured logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Degraded-mode migration recovery ──────────────────────────────────────────
# start.sh sets MIGRATIONS_OK=0 when it could not reach the database. We still
# boot (so /healthz and the DB-free routes answer instead of Render returning a
# blanket 502), then keep retrying here so the API heals itself the moment the
# database comes back — no manual redeploy needed.
_MIGRATION_RETRY_MAX = 60          # give up after ~2h of a hard-down database
_MIGRATION_RETRY_CAP_SECONDS = 300


async def _run_migrations() -> bool:
    """Run migrate_fix + alembic upgrade head in a subprocess. True on success."""
    proc = await asyncio.create_subprocess_shell(
        "python /app/migrate_fix.py && alembic upgrade head",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    stdout, _ = await proc.communicate()
    if proc.returncode != 0:
        logger.warning(
            "Background migration attempt failed: %s",
            (stdout or b"").decode(errors="replace").strip()[-400:],
        )
    return proc.returncode == 0


async def _heal_migrations(app: FastAPI) -> None:
    """Retry migrations until they apply, then bring the scheduler online."""
    from app.scheduler.jobs import register_jobs, scheduler

    delay = 30
    for attempt in range(1, _MIGRATION_RETRY_MAX + 1):
        await asyncio.sleep(delay)
        delay = min(delay * 2, _MIGRATION_RETRY_CAP_SECONDS)

        logger.info("Retrying migrations (attempt %d/%d)", attempt, _MIGRATION_RETRY_MAX)
        if not await _run_migrations():
            continue

        app.state.migrations_ok = True
        app.state.migration_error = None
        logger.info("Migrations applied — API recovered from degraded mode")

        # The scheduler was held back while the DB was unreachable; start it now.
        if settings.scheduler_enable and not scheduler.running:
            register_jobs()
            scheduler.start()
            logger.info("APScheduler started after recovery")
        return

    app.state.migration_error = (
        f"migrations still failing after {_MIGRATION_RETRY_MAX} attempts"
    )
    logger.error("Giving up on background migrations — API stays degraded")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import get_engine
    from app.scheduler.jobs import register_jobs, scheduler
    from app.services.alpaca_stream import stream_manager

    logger.info("NextGenStock backend starting — pool initialising")

    # start.sh exports MIGRATIONS_OK. Absent (e.g. local `uvicorn` runs) means
    # migrations were handled out-of-band — treat as healthy.
    app.state.migrations_ok = os.getenv("MIGRATIONS_OK", "1") == "1"
    app.state.migration_error = (
        None if app.state.migrations_ok else "database unreachable at startup"
    )

    heal_task: asyncio.Task[None] | None = None
    if not app.state.migrations_ok:
        logger.error(
            "DEGRADED: migrations did not apply at startup. Serving /healthz and "
            "DB-free routes; retrying migrations in the background."
        )
        heal_task = asyncio.create_task(_heal_migrations(app))

    # Production safety checks
    if not settings.cookie_secure and "localhost" not in settings.cors_origins:
        logger.warning(
            "SECURITY WARNING: COOKIE_SECURE=false but CORS origins don't include "
            "localhost. Set COOKIE_SECURE=true for production deployments."
        )

    # Start APScheduler if enabled. Held back while degraded — every job hits the
    # database, so starting it against a dead DB only burns memory and floods the
    # logs. _heal_migrations() starts it once the database is back.
    if settings.scheduler_enable and app.state.migrations_ok:
        register_jobs()
        scheduler.start()
        logger.info("APScheduler started")
    elif settings.scheduler_enable:
        logger.warning("Scheduler deferred — waiting for the database (degraded mode)")
    else:
        logger.info("Scheduler disabled (SCHEDULER_ENABLE=false)")

    # Start Alpaca real-time stream (if keys configured)
    _key = (settings.alpaca_data_key or settings.alpaca_api_key).strip()
    _secret = (settings.alpaca_data_secret or settings.alpaca_secret_key).strip()
    _feed = getattr(settings, "alpaca_feed", "iex") or "iex"
    if _key and _secret:
        stream_manager.configure(_key, _secret, feed=_feed)
        await stream_manager.start()

    # pool_pre_ping=True handles reconnect; no explicit warm-up needed
    yield

    # Stop the background migration healer, if one is running
    if heal_task is not None and not heal_task.done():
        heal_task.cancel()
        try:
            await heal_task
        except asyncio.CancelledError:
            pass

    # Shutdown scheduler before disposing DB engine
    if settings.scheduler_enable and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")

    # Stop Alpaca stream
    await stream_manager.stop()

    logger.info("NextGenStock backend shutting down — disposing engine")
    engine = get_engine()
    if engine is not None:
        await engine.dispose()


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="NextGenStock API",
    description=(
        "Production-grade multi-user AI trading platform. "
        "**Educational use only — live trading carries real financial risk.**"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return 429 with CORS headers so the browser doesn't misreport it as a CORS error.

    slowapi's default handler bypasses CORSMiddleware (known FastAPI/Starlette behaviour
    for @app.exception_handler callbacks), so we inject the CORS headers manually — the
    same pattern used for the RequestValidationError and unhandled Exception handlers.
    """
    headers: dict[str, str] = {}
    origin = request.headers.get("origin")
    if origin and _is_origin_allowed(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"

    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": str(exc.detail)},
        headers=headers,
    )

# ── CORS ──────────────────────────────────────────────────────────────────────
# When allow_credentials=True the CORS spec forbids Access-Control-Allow-Headers: *.
# Starlette reflects back the request headers instead, but being explicit is safer
# and more portable.  Set-Cookie cannot appear in expose_headers (forbidden header).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization", "X-Requested-With", "x-e2e-test"],
    expose_headers=[],
    max_age=600,
)

# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return field-level validation errors in a consistent format.

    CORSMiddleware does not inject headers into responses produced by
    exception handlers, so we mirror what it would have done for any
    origin in the allow-list.
    """
    errors = []
    for e in exc.errors():
        errors.append(
            {
                "field": ".".join(str(loc) for loc in e["loc"]),
                "message": e["msg"],
                "type": e["type"],
            }
        )
    logger.warning(
        "Validation error on %s %s: %s",
        request.method,
        request.url.path,
        errors,
    )

    headers: dict[str, str] = {}
    origin = request.headers.get("origin")
    if origin and _is_origin_allowed(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors},
        headers=headers,
    )


def _cors_headers(request: Request) -> dict[str, str]:
    """CORS headers CORSMiddleware would have added (it skips exception handlers)."""
    origin = request.headers.get("origin")
    if origin and _is_origin_allowed(origin):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}


# Database *connectivity* failures — the pool cannot reach Postgres at all (paused
# Supabase project, DNS failure, pooler restart). These are transient infrastructure
# faults, not application bugs, so they get a 503 the client can act on instead of an
# opaque 500. Deliberately narrow: ProgrammingError / IntegrityError and friends are
# NOT caught here — those are genuine bugs and must keep surfacing as 500s.
@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
@app.exception_handler(DBAPIDisconnectionError)
async def database_unavailable_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Database unavailable on %s %s: %s",
        request.method,
        request.url.path,
        type(exc).__name__,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "The service is temporarily unavailable. Please try again shortly."},
        headers=_cors_headers(request),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)

    # Starlette/FastAPI bug: CORSMiddleware does not add CORS headers to responses
    # produced by @app.exception_handler callbacks, so a 500 returned here reaches
    # the browser without Access-Control-Allow-Origin and is treated as a CORS error.
    # Fix: inspect the Origin header and add the headers manually when the origin is
    # in the allow-list, mirroring exactly what CORSMiddleware would have done.
    headers: dict[str, str] = {}
    origin = request.headers.get("origin")
    if origin and _is_origin_allowed(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
        headers=headers,
    )


# ── Health checks ─────────────────────────────────────────────────────────────
# /healthz is LIVENESS: is the process up? It must never depend on the database,
# and Render's healthCheckPath points at it. If it 503'd whenever Postgres was
# down, Render would fail the deploy and keep serving nothing — the exact
# blackout this split is here to prevent.
@app.get("/healthz", tags=["health"], include_in_schema=False)
async def health(request: Request) -> dict[str, Any]:
    migrations_ok = getattr(request.app.state, "migrations_ok", True)
    body: dict[str, Any] = {
        "status": "ok" if migrations_ok else "degraded",
        "migrations": "applied" if migrations_ok else "pending",
    }
    error = getattr(request.app.state, "migration_error", None)
    if error:
        body["detail"] = error
    return body


# /readyz is READINESS: can we actually serve database-backed traffic? Returns
# 503 while the database is unreachable, so a degraded instance is visible
# rather than silently answering every data route with a 500.
@app.get("/readyz", tags=["health"], include_in_schema=False)
async def ready(request: Request) -> JSONResponse:
    from sqlalchemy import text

    from app.db.session import AsyncSessionLocal

    migrations_ok = getattr(request.app.state, "migrations_ok", True)

    db_ok = False
    db_error: str | None = None
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:  # noqa: BLE001 — any failure means "not ready"
        db_error = type(exc).__name__
        logger.warning("Readiness probe: database unreachable (%s)", db_error)

    ready_now = db_ok and migrations_ok
    body: dict[str, Any] = {
        "status": "ready" if ready_now else "not_ready",
        "database": "up" if db_ok else "down",
        "migrations": "applied" if migrations_ok else "pending",
    }
    if db_error:
        body["detail"] = db_error

    return JSONResponse(
        content=body,
        status_code=status.HTTP_200_OK if ready_now else status.HTTP_503_SERVICE_UNAVAILABLE,
    )


# ── Router registration ───────────────────────────────────────────────────────
from app.auth.router import router as auth_router
from app.api.profile import router as profile_router
from app.api.broker import router as broker_router
from app.api.strategies import router as strategies_router
from app.api.backtests import router as backtests_router
from app.api.live import router as live_router
from app.api.artifacts import router as artifacts_router
# v2 routers
from app.api.buy_zone import router as buy_zone_router
from app.api.alerts import router as alerts_router
from app.api.ideas import router as ideas_router
from app.api.auto_buy import router as auto_buy_router
from app.api.opportunities import router as opportunities_router
from app.api.scanner import router as scanner_router
# v3 routers
from app.api.watchlist import router as watchlist_router
from app.api.generated_ideas import router as generated_ideas_router
from app.api.news_feed import router as news_feed_router
from app.api.morning_brief import router as morning_brief_router
# commodity signal engine
from app.api.gold import router as gold_router
from app.api.commodity_alert_prefs import router as commodity_alert_router
# v4 options engine
from app.api.v4.options import router as options_router
# real-time stream (SSE proxy for Alpaca WebSocket)
from app.api.v1.stream import router as stream_router
# trailing stop bot
from app.api.trailing_bot import router as trailing_bot_router
from app.api.copy_trading import router as copy_trading_router
# wheel strategy bot
from app.api.wheel_bot import router as wheel_bot_router
# BTC trailing-stop bot
from app.api.btc_bot import router as btc_bot_router
# crons inspector
from app.api.crons import router as crons_router
# PIN auth
from app.api.pin_auth import router as pin_auth_router
# Password auth (email + password register)
from app.api.password_auth import router as password_auth_router

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(broker_router)
app.include_router(strategies_router)
app.include_router(backtests_router)
app.include_router(live_router)
app.include_router(artifacts_router)
# v2
app.include_router(buy_zone_router)
app.include_router(alerts_router)
app.include_router(ideas_router)
app.include_router(auto_buy_router)
app.include_router(opportunities_router)
app.include_router(scanner_router)
# v3
app.include_router(watchlist_router)
app.include_router(generated_ideas_router)
app.include_router(news_feed_router)
app.include_router(morning_brief_router)
# commodity signal engine
app.include_router(gold_router)
app.include_router(commodity_alert_router)
# v4 options engine
app.include_router(options_router, prefix="/api/v4/options", tags=["options"])
# real-time stream
app.include_router(stream_router)
# trailing stop bot
app.include_router(trailing_bot_router, prefix="/api/v1")
app.include_router(copy_trading_router, prefix="/api/v1")
app.include_router(wheel_bot_router, prefix="/api/v1")
app.include_router(btc_bot_router, prefix="/api/v1")
app.include_router(crons_router, prefix="/api/v1")
app.include_router(pin_auth_router)
app.include_router(password_auth_router)

# Test-only utilities (only mounted in debug mode)
if settings.debug:
    from app.api.test_reset import router as test_reset_router
    app.include_router(test_reset_router)
