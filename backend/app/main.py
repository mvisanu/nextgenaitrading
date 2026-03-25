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
from slowapi import _rate_limit_exceeded_handler
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

    logger.info("NextGenStock backend starting — pool initialising")

    # Start APScheduler if enabled
    if settings.scheduler_enable:
        register_jobs()
        scheduler.start()
        logger.info("APScheduler started")
    else:
        logger.info("Scheduler disabled (SCHEDULER_ENABLE=false)")

    # pool_pre_ping=True handles reconnect; no explicit warm-up needed
    yield

    # Shutdown scheduler before disposing DB engine
    if settings.scheduler_enable and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")

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
    docs_url="/docs" if settings.cors_origins == "http://localhost:3000" else None,
    redoc_url="/redoc" if settings.cors_origins == "http://localhost:3000" else None,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"],
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
