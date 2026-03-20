"""
NextGenStock — FastAPI application entry point.

Startup: initialise DB connection pool
Shutdown: dispose engine / close pool
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

from app.core.config import settings

# ── Structured logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import async_engine

    logger.info("NextGenStock backend starting — pool initialising")
    # pool_pre_ping=True handles reconnect; no explicit warm-up needed
    yield
    logger.info("NextGenStock backend shutting down — disposing engine")
    await async_engine.dispose()


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="NextGenStock API",
    description=(
        "Production-grade multi-user AI trading platform. "
        "**Educational use only — live trading carries real financial risk.**"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Set-Cookie", "Authorization"],
    expose_headers=["Set-Cookie"],
)

# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Return field-level validation errors in a consistent format."""
    errors = []
    for e in exc.errors():
        errors.append(
            {
                "field": ".".join(str(loc) for loc in e["loc"]),
                "message": e["msg"],
                "type": e["type"],
            }
        )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
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

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(broker_router)
app.include_router(strategies_router)
app.include_router(backtests_router)
app.include_router(live_router)
app.include_router(artifacts_router)
