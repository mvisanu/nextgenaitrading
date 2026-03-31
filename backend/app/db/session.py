"""
Async SQLAlchemy engine, session factory, and FastAPI dependency.

The engine and session factory are created lazily on first access so that
importing this module does not require asyncpg to be installed (which lets
unit tests import API modules without the driver present).
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

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
    Retries once on asyncpg interface/connection errors (handles Render
    spin-down where pooled connections become stale before pool_pre_ping
    can detect them).
    Use as: db: AsyncSession = Depends(get_db)
    """
    import asyncpg  # only needed at call time, not import time

    for attempt in range(2):
        session = _get_session_factory()()
        try:
            async with session:
                try:
                    yield session
                    return
                except Exception:
                    await session.rollback()
                    raise
        except (asyncpg.InterfaceError, asyncpg.TooManyConnectionsError, OSError) as exc:
            if attempt == 0:
                # First failure — likely a stale pooled connection.
                # Dispose the pool to force fresh connections, then retry.
                if _async_engine is not None:
                    await _async_engine.dispose()
                continue
            raise  # Re-raise on second attempt
