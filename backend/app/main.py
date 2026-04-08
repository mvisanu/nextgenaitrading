"""
NextGenStock — FastAPI application entry point.

Startup: initialise DB connection pool, start APScheduler
Shutdown: stop scheduler, dispose engine / close pool
"""
from __future__ import annotations

import logging
import logging.config
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

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


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import get_engine
    from app.scheduler.jobs import register_jobs, scheduler
    from app.services.alpaca_stream import stream_manager

    logger.info("NextGenStock backend starting — pool initialising")

    # Production safety checks
    if not settings.cookie_secure and "localhost" not in settings.cors_origins:
        logger.warning(
            "SECURITY WARNING: COOKIE_SECURE=false but CORS origins don't include "
            "localhost. Set COOKIE_SECURE=true for production deployments."
        )

    # Start APScheduler if enabled
    if settings.scheduler_enable:
        register_jobs()
        scheduler.start()
        logger.info("APScheduler started")
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


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/healthz", tags=["health"], include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok"}


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

# Test-only utilities (only mounted in debug mode)
if settings.debug:
    from app.api.test_reset import router as test_reset_router
    app.include_router(test_reset_router)
