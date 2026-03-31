"""IV rank and IV percentile computation from 52-week rolling history."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.options import IVHistory


def compute_iv_rank(current_iv: float, iv_history_52w: list[float]) -> float:
    """IV Rank = (current - 52w_low) / (52w_high - 52w_low) × 100."""
    if not iv_history_52w:
        return 0.0
    low = min(iv_history_52w)
    high = max(iv_history_52w)
    if high == low:
        return 0.0
    return round((current_iv - low) / (high - low) * 100, 2)


def compute_iv_percentile(current_iv: float, iv_history_52w: list[float]) -> float:
    """IV Percentile = % of days in past year where IV was below current IV."""
    if not iv_history_52w:
        return 0.0
    below = sum(1 for iv in iv_history_52w if iv < current_iv)
    return round(below / len(iv_history_52w) * 100, 2)


async def get_iv_history(symbol: str, db: AsyncSession) -> list[float]:
    """Query iv_history table for past 252 trading days."""
    from datetime import timedelta
    cutoff = date.today().replace(year=date.today().year - 1)
    result = await db.execute(
        select(IVHistory.iv)
        .where(IVHistory.symbol == symbol)
        .where(IVHistory.date >= cutoff)
        .order_by(IVHistory.date.desc())
        .limit(252)
    )
    rows = result.scalars().all()
    return list(rows)


async def store_iv_snapshot(symbol: str, iv: float, db: AsyncSession) -> None:
    """Upsert today's IV into iv_history table."""
    from sqlalchemy.dialects.postgresql import insert

    today = date.today()
    stmt = (
        insert(IVHistory)
        .values(symbol=symbol, date=today, iv=iv)
        .on_conflict_do_update(
            index_elements=["symbol", "date"],
            set_={"iv": iv},
        )
    )
    await db.execute(stmt)
    await db.commit()
