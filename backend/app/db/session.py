"""
Async SQLAlchemy engine, session factory, and FastAPI dependency.

The engine and session factory are created lazily on first access so that
importing this module does not require asyncpg to be installed (which lets
unit tests import API modules without the driver present).
"""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level singletons — populated on first call to _get_session_factory().
_async_engine = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return (creating on first call) the shared session factory."""
    global _async_engine, _session_factory
    if _session_factory is None:
        _async_engine = create_async_engine(
            settings.database_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=settings.pool_size,
            max_overflow=settings.max_overflow,
            pool_recycle=300,     # recycle connections every 5 min — handles Render idle spin-down
            pool_timeout=30,      # raise after 30 s if no connection is available
            pool_reset_on_return="rollback",  # clean up transactions on connection return
            # Disable asyncpg prepared statement cache — required when Supabase
            # routes connections through pgbouncer (transaction/statement mode).
            # Also disable server-side JIT to avoid pgbouncer plan cache issues.
            connect_args={
                "statement_cache_size": 0,
                "server_settings": {"jit": "off"},
            },
        )
        _session_factory = async_sessionmaker(
            bind=_async_engine,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


# Public name kept for any code that references AsyncSessionLocal directly
# (e.g. background task helpers that call ``async with AsyncSessionLocal() as db``).
# Calling AsyncSessionLocal() returns the async context manager from the factory.
class _LazySessionLocalProxy:
    """
    Thin callable proxy so that ``async with AsyncSessionLocal() as session``
    works without importing asyncpg at module load time.
    """
    def __call__(self):
        return _get_session_factory()()


AsyncSessionLocal = _LazySessionLocalProxy()


def get_engine():
    """Return the shared async engine, creating it on first call."""
    _get_session_factory()  # side-effect: initialises _async_engine
    return _async_engine


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an AsyncSession and guarantees cleanup.

    Yields exactly once. The previous version wrapped the ``yield`` in a
    retry loop, so an OSError raised by the endpoint's own query — thrown back
    into the generator at the yield point — was caught by the retry handler,
    which then looped and yielded a *second* time. The asyncgen machinery
    rejects that with ``RuntimeError: generator didn't stop after athrow()``,
    which masked every transient database error behind a confusing 500.

    Stale pooled connections (Render spin-down) are already handled by
    pool_pre_ping, which validates each connection on checkout; the pool is also
    disposed here when a connection error does occur, so the next request starts
    clean. An unreachable database becomes a 503 rather than an opaque 500.

    Use as: db: AsyncSession = Depends(get_db)
    """
    import asyncpg  # only needed at call time, not import time
    from sqlalchemy.exc import DisconnectionError
    from sqlalchemy.exc import InterfaceError as SAInterfaceError
    from sqlalchemy.exc import OperationalError

    # Connection-level failures: the pool cannot reach Postgres at all. Query bugs
    # (ProgrammingError, IntegrityError, ...) are deliberately NOT in this tuple —
    # those are real defects and must keep surfacing as 500s.
    connection_errors = (
        asyncpg.InterfaceError,
        asyncpg.TooManyConnectionsError,
        OperationalError,
        SAInterfaceError,
        DisconnectionError,
        OSError,  # socket.gaierror — DB host does not resolve (e.g. paused project)
    )

    # The session is created without connecting: SQLAlchemy acquires a connection
    # lazily on first use. Keep it that way — eagerly connecting here would burn a
    # slot from the tiny Render pool (2 + 3 overflow) on every request that never
    # queries, including ones rejected by the auth dependency.
    session = _get_session_factory()()
    async with session:
        try:
            yield session
        except connection_errors as exc:
            await session.rollback()
            # Drop the pool so the next request builds fresh connections rather
            # than handing out ones pointing at a host that has gone away.
            if _async_engine is not None:
                await _async_engine.dispose()
            logger.error("Database unreachable: %s: %s", type(exc).__name__, exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The service is temporarily unavailable. Please try again shortly.",
            ) from exc
        except Exception:
            await session.rollback()
            raise
