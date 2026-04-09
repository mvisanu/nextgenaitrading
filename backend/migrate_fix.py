"""
Pre-migration state repair.

If alembic_version contains only '5bafc0ec3474' (the merge head) but
alembic can't locate the corresponding file, reset the table to the two
pre-merge heads so 'alembic upgrade head' can reapply the merge cleanly.

Run once at container startup, before alembic upgrade head.
"""
from __future__ import annotations

import asyncio
import os
import re
import sys

STALE_REVISION = "5bafc0ec3474"
PRE_MERGE_HEADS = ("v6b_congress_trade_unique_fix", "v7c_wheel_bot_credential")


async def _connect():
    import asyncpg  # already in requirements.txt

    url = os.environ["DATABASE_URL"]
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)

    ssl = None
    if "ssl=require" in url:
        url = re.sub(r"[?&]ssl=require", "", url)
        ssl = "require"

    return await asyncpg.connect(url, ssl=ssl, statement_cache_size=0, timeout=30)


async def fix() -> None:
    conn = await _connect()
    try:
        rows = await conn.fetch("SELECT version_num FROM alembic_version")
        current = {r["version_num"] for r in rows}
        print(f"[migrate_fix] alembic_version = {current}", flush=True)

        if current == {STALE_REVISION}:
            print(
                f"[migrate_fix] Stale merge head detected ('{STALE_REVISION}' not in "
                f"migration files). Resetting to pre-merge heads: {PRE_MERGE_HEADS}",
                flush=True,
            )
            await conn.execute("DELETE FROM alembic_version")
            for head in PRE_MERGE_HEADS:
                await conn.execute(
                    "INSERT INTO alembic_version (version_num) VALUES ($1)", head
                )
            print("[migrate_fix] Reset complete — alembic will reapply the merge.", flush=True)
        else:
            print("[migrate_fix] No fix needed.", flush=True)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(fix())
