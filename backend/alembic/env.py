"""
Alembic async-compatible env.py for SQLAlchemy 2.x + asyncpg.

Uses run_sync pattern for both online (async) and offline (sync URL) modes.
All models are imported via app.db.base so autogenerate discovers all tables.
"""
from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

# ── Add project root to sys.path ──────────────────────────────────────────────
# This allows `from app.xxx import yyy` to work when alembic is run from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config

# ── Logging ───────────────────────────────────────────────────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import Base and all models ────────────────────────────────────────────────
# app.db.base imports all model modules so autogenerate sees every table.
from app.db.base import Base  # noqa: E402
from app.core.config import settings  # noqa: E402

target_metadata = Base.metadata

# Override the sqlalchemy.url from alembic.ini with the real DATABASE_URL
config.set_main_option("sqlalchemy.url", settings.database_url)


# ── Offline mode (generates SQL without a live connection) ────────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (runs against the live async engine) ─────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(
        settings.database_url,
        poolclass=pool.NullPool,
        connect_args={"statement_cache_size": 0},
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ── Entry point ───────────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
