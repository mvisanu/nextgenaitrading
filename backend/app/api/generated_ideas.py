"""
V3 Generated Ideas API.

GET  /api/ideas/generated                      — list auto-generated idea cards
GET  /api/ideas/generated/last-scan            — last scan timestamp + count
POST /api/ideas/generated/{id}/add-to-watchlist — one-click add to watchlist + create alert rule
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.alert import PriceAlertRule
from app.models.generated_idea import GeneratedIdea
from app.models.user import User
from app.models.user_watchlist import UserWatchlist
from app.schemas.generated_idea import AddToWatchlistResponse, GeneratedIdeaOut, LastScanOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ideas/generated", tags=["generated-ideas"])


# ── POST /api/ideas/generated/run-now ─────────────────────────────────────────


@router.post("/run-now", response_model=dict)
async def run_idea_generator_now(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Manually trigger the V3 idea generator for on-demand scanning.

    Bypasses the market-hours guard — manual triggers always execute.
    Replaces the full idea batch (same as the scheduled job).
    """
    from app.services.v3_idea_generator_service import run_idea_generator

    saved = await run_idea_generator(db)
    return {
        "generated": len(saved),
        "top_ticker": saved[0].ticker if saved else None,
    }


async def _trigger_buy_zone_background(ticker: str, user_id: int) -> None:
    """Fire buy zone calculation in the background after a ticker is added."""
    from app.db.session import AsyncSessionLocal
    from app.services.buy_zone_service import calculate_buy_zone

    try:
        async with AsyncSessionLocal() as db:
            await calculate_buy_zone(ticker, db, user_id=user_id)
        logger.info("generated_ideas: background buy zone complete for %s user_id=%d", ticker, user_id)
    except Exception as exc:
        logger.error("generated_ideas: background buy zone failed for %s user_id=%d: %s", ticker, user_id, exc)


@router.get("/last-scan", response_model=LastScanOut)
async def get_last_scan(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LastScanOut:
    """
    Return the timestamp of the last idea generator run and the current idea count.

    Uses MAX(generated_at) from the generated_ideas table.
    Returns null for last_scan_at when the table is empty.
    """
    result = await db.execute(
        select(func.max(GeneratedIdea.generated_at), func.count(GeneratedIdea.id))
    )
    row = result.one()
    last_scan_at = row[0]
    idea_count = row[1] or 0

    # Compute next_scan_at: last_scan_at + idea_generator interval (if available)
    next_scan_at = None
    if last_scan_at is not None:
        from datetime import timedelta
        from app.core.config import settings
        next_scan_at = last_scan_at + timedelta(minutes=settings.idea_generator_minutes)

    return LastScanOut(last_scan_at=last_scan_at, ideas_generated=idea_count, next_scan_at=next_scan_at)


@router.get("", response_model=list[GeneratedIdeaOut])
async def list_generated_ideas(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    source: Optional[str] = Query(default=None, description="Filter by source: news|theme|technical"),
    theme: Optional[str] = Query(default=None, description="Filter by theme tag (e.g. ai, defense)"),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[GeneratedIdeaOut]:
    """
    Return the current batch of auto-generated idea cards, sorted by idea_score descending.

    Ideas are refreshed every 60 minutes during market hours.
    Expired ideas (>24h) are automatically excluded.

    LANGUAGE NOTE: All scoring uses "confidence score", "positive outcome rate" —
    never implied guarantees.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    query = (
        select(GeneratedIdea)
        .where(GeneratedIdea.expires_at > now)
        .order_by(desc(GeneratedIdea.idea_score))
    )
    if source:
        query = query.where(GeneratedIdea.source == source)

    result = await db.execute(query)
    rows = list(result.scalars().all())

    # Theme filter (JSON array containment — filter in Python for portability)
    if theme:
        rows = [r for r in rows if theme in (r.theme_tags or [])]

    rows = rows[:limit]
    return [GeneratedIdeaOut.model_validate(r) for r in rows]


@router.post(
    "/{idea_id}/add-to-watchlist",
    response_model=AddToWatchlistResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_idea_to_watchlist(
    idea_id: int,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AddToWatchlistResponse:
    """
    One-click "Add to Watchlist" from an idea card.

    Steps:
      1. Verify the idea exists and is not expired.
      2. Add ticker to user_watchlist (idempotent).
      3. Create PriceAlertRule with type 'entered_buy_zone' (enabled=True).
      4. Mark idea.added_to_watchlist = True.
      5. Trigger buy zone calculation in background.

    Returns a confirmation with the newly created / existing watchlist item ID
    and alert rule ID.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    idea_result = await db.execute(
        select(GeneratedIdea).where(GeneratedIdea.id == idea_id)
    )
    idea = idea_result.scalar_one_or_none()
    if not idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found.")
    if idea.expires_at < now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="This idea has expired and can no longer be added.")

    ticker = idea.ticker

    # Step 2: add to user_watchlist (idempotent)
    existing_wl = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == current_user.id,
            UserWatchlist.ticker == ticker,
        )
    )
    wl_row = existing_wl.scalar_one_or_none()
    watchlist_entry_created = False
    if not wl_row:
        wl_row = UserWatchlist(
            user_id=current_user.id,
            ticker=ticker,
            alert_enabled=True,
        )
        db.add(wl_row)
        await db.flush()
        watchlist_entry_created = True

    # Step 3: create PriceAlertRule (idempotent — skip if already exists for this user+ticker+type)
    existing_alert = await db.execute(
        select(PriceAlertRule).where(
            PriceAlertRule.user_id == current_user.id,
            PriceAlertRule.ticker == ticker,
            PriceAlertRule.alert_type == "entered_buy_zone",
        ).limit(1)
    )
    alert_row = existing_alert.scalar_one_or_none()
    alert_rule_created = False
    if not alert_row:
        alert_row = PriceAlertRule(
            user_id=current_user.id,
            ticker=ticker,
            alert_type="entered_buy_zone",
            threshold_json={},
            cooldown_minutes=240,       # 4-hour cooldown matches buy signal cooldown
            market_hours_only=True,
            enabled=True,
        )
        db.add(alert_row)
        await db.flush()
        alert_rule_created = True

    # Step 4: mark idea as added
    idea.added_to_watchlist = True

    await db.commit()

    logger.info(
        "generated_ideas: add_to_watchlist ticker=%s user_id=%d wl_created=%s alert_created=%s",
        ticker, current_user.id, watchlist_entry_created, alert_rule_created,
    )

    # Step 5: trigger buy zone in background
    background_tasks.add_task(_trigger_buy_zone_background, ticker, current_user.id)

    return AddToWatchlistResponse(
        ticker=ticker,
        watchlist_entry_created=watchlist_entry_created,
        alert_rule_created=alert_rule_created,
        idea_id=idea_id,
    )
