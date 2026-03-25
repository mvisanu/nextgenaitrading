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
            pool_recycle=3600,    # recycle connections older than 1 h — prevents stale-socket hangs
            pool_timeout=30,      # raise after 30 s if no connection is available
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
    Use as: db: AsyncSession = Depends(get_db)
    """
    async with _get_session_factory()() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
