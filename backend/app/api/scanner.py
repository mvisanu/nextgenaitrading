"""
Scanner API.

POST /api/scanner/estimate-buy-prices
    Accepts a list of tickers, returns per-ticker signal + estimated entry price.
    Does not write to the DB; purely a read + compute endpoint.

POST /api/scanner/run
    Full watchlist scan for the authenticated user. Fetches all tickers from the
    user's watchlist ideas, runs ConservativeStrategy on each, dispatches BUY-signal
    notifications, and returns a ranked ScanResultOut list.

GET  /api/scanner/ideas
    Returns the top 15 auto-generated stock ideas from STOCK_UNIVERSE.
    Results are cached process-locally for 30 minutes.

POST /api/scanner/ideas/{ticker}/save
    Saves a generated idea to the user's watchlist ideas as a new WatchlistIdea
    with the primary ticker set. Idempotent — returns 200 if the idea already
    exists for that ticker for this user, 201 on creation.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.user import User
from app.schemas.idea import IdeaOut, TickerOut
from app.schemas.scanner import (
    EstimatedBuyPriceOut,
    GeneratedIdeaOut,
    ScanRequest,
    ScanResultOut,
)
from app.services.idea_generator_service import generate_ideas
from app.services.scanner_service import estimate_buy_price, scan_watchlist

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scanner", tags=["scanner"])

# Maximum number of tickers accepted per estimate request
_MAX_ESTIMATE_TICKERS = 20


# ── POST /api/scanner/estimate-buy-prices ─────────────────────────────────────


@router.post(
    "/estimate-buy-prices",
    response_model=list[EstimatedBuyPriceOut],
    summary="Estimate buy prices for a list of tickers",
)
async def estimate_buy_prices(
    payload: ScanRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[EstimatedBuyPriceOut]:
    """
    Run ConservativeStrategy on each supplied ticker and return signal data
    with an estimated entry price. One failing ticker is skipped, not raised.
    Maximum 20 tickers per request.
    """
    if len(payload.tickers) > _MAX_ESTIMATE_TICKERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {_MAX_ESTIMATE_TICKERS} tickers per request.",
        )

    results: list[EstimatedBuyPriceOut] = []
    for raw_ticker in payload.tickers:
        ticker = raw_ticker.upper().strip()
        try:
            out = await estimate_buy_price(ticker, db)
            results.append(out)
        except Exception as exc:
            logger.error(
                "estimate_buy_prices: failed for %s user_id=%d: %s",
                ticker, current_user.id, exc,
            )
            # Surface a placeholder so the caller knows which ticker failed
            results.append(
                EstimatedBuyPriceOut(
                    ticker=ticker,
                    estimated_buy_price=None,
                    current_price=0.0,
                    signal="error",
                    regime=None,
                    confirmation_count=0,
                    min_confirmations=7,
                    confirmations_needed=[],
                    buy_zone_low=None,
                    buy_zone_high=None,
                )
            )

    return results


# ── POST /api/scanner/run ─────────────────────────────────────────────────────


@router.post(
    "/run",
    response_model=list[ScanResultOut],
    summary="Scan all watchlist tickers and notify on BUY signals",
)
async def run_scan(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ScanResultOut]:
    """
    Collect all unique tickers from the authenticated user's watchlist ideas,
    run ConservativeStrategy on each, and dispatch notifications for any BUY signals.
    Returns results sorted by confirmation_count descending (strongest signals first).
    """
    # Collect all unique tickers from the user's watchlist ideas
    ticker_result = await db.execute(
        select(WatchlistIdeaTicker.ticker)
        .join(WatchlistIdea, WatchlistIdea.id == WatchlistIdeaTicker.idea_id)
        .where(WatchlistIdea.user_id == current_user.id)
        .distinct()
    )
    tickers: list[str] = [row[0] for row in ticker_result.fetchall()]

    if not tickers:
        logger.info("run_scan: user_id=%d has no watchlist tickers", current_user.id)
        return []

    logger.info(
        "run_scan: scanning %d tickers for user_id=%d",
        len(tickers), current_user.id,
    )

    results = await scan_watchlist(tickers, current_user.id, db)

    # Sort: BUY first, then by confirmation_count descending
    results.sort(key=lambda r: (r.signal != "buy", -r.confirmation_count))
    return results


# ── GET /api/scanner/ideas ────────────────────────────────────────────────────


@router.get(
    "/ideas",
    response_model=list[GeneratedIdeaOut],
    summary="Auto-generated stock ideas from the universe scan",
)
async def get_ideas(
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[GeneratedIdeaOut]:
    """
    Return the top 15 auto-generated ideas ranked by composite score.
    Results are cached process-locally for 30 minutes.
    """
    ideas = await generate_ideas(top_n=15)
    return ideas


# ── POST /api/scanner/ideas/{ticker}/save ─────────────────────────────────────


@router.post(
    "/ideas/{ticker}/save",
    response_model=IdeaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a generated idea to the user's watchlist",
)
async def save_generated_idea(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IdeaOut:
    """
    Save a generated idea to the user's WatchlistIdea collection.

    Idempotent: if the user already has an idea with this primary ticker,
    the existing idea is returned with HTTP 200 instead of creating a duplicate.
    The caller should check the response status to distinguish create vs. existing.
    """
    ticker = ticker.upper().strip()

    # Check for an existing idea with this ticker as primary for this user
    existing_result = await db.execute(
        select(WatchlistIdea)
        .join(WatchlistIdeaTicker, WatchlistIdeaTicker.idea_id == WatchlistIdea.id)
        .options(selectinload(WatchlistIdea.tickers))
        .where(
            WatchlistIdea.user_id == current_user.id,
            WatchlistIdeaTicker.ticker == ticker,
            WatchlistIdeaTicker.is_primary.is_(True),
        )
        .limit(1)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        logger.info(
            "save_generated_idea: idea for %s already exists (id=%d) for user_id=%d",
            ticker, existing.id, current_user.id,
        )
        return _build_idea_out_simple(existing)

    # Fetch the generated idea data so we can use its thesis
    ideas = await generate_ideas(top_n=50)
    gen_idea = next((i for i in ideas if i.ticker == ticker), None)

    if gen_idea is not None:
        title = gen_idea.title
        thesis = gen_idea.thesis
        tags = gen_idea.tags
    else:
        # Ticker may not be in the universe cache; use sensible defaults
        title = f"{ticker} — Scanner idea"
        thesis = f"Auto-saved from scanner. Run a strategy to generate a full thesis."
        tags = []

    idea = WatchlistIdea(
        user_id=current_user.id,
        title=title,
        thesis=thesis,
        conviction_score=5,
        watch_only=False,
        tradable=True,
        tags_json=tags,
        metadata_json={"source": "scanner"},
    )
    db.add(idea)
    await db.flush()  # get idea.id

    db.add(
        WatchlistIdeaTicker(
            idea_id=idea.id,
            ticker=ticker,
            is_primary=True,
            near_earnings=False,
        )
    )

    await db.commit()

    # Reload with eager-loaded tickers
    reload_result = await db.execute(
        select(WatchlistIdea)
        .options(selectinload(WatchlistIdea.tickers))
        .where(WatchlistIdea.id == idea.id)
    )
    idea = reload_result.scalar_one()

    logger.info(
        "save_generated_idea: created idea id=%d ticker=%s user_id=%d",
        idea.id, ticker, current_user.id,
    )
    return _build_idea_out_simple(idea)


# ── GET /api/scanner/status ────────────────────────────────────────────────────


@router.get(
    "/status",
    summary="V3 scanner status — last scan time and queue size",
)
async def get_scanner_status(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Return:
      - last_scan_at: timestamp of the most recent BuyNowSignal for this user
      - ticker_count: number of tickers in the user's V3 watchlist
      - next_scan_interval_minutes: configured live scanner interval
    """
    from datetime import timedelta
    from app.core.config import settings
    from app.models.buy_signal import BuyNowSignal
    from app.models.user_watchlist import UserWatchlist
    from app.utils.market_hours import is_market_hours
    from sqlalchemy import func

    # Most recent signal for this user
    last_sig_result = await db.execute(
        select(func.max(BuyNowSignal.created_at)).where(BuyNowSignal.user_id == current_user.id)
    )
    last_scan_at = last_sig_result.scalar()

    # Ticker count
    count_result = await db.execute(
        select(func.count(UserWatchlist.id)).where(UserWatchlist.user_id == current_user.id)
    )
    tickers_in_queue = count_result.scalar() or 0

    # Compute next_scan_at from last_scan_at + interval
    next_scan_at = None
    if last_scan_at is not None:
        next_scan_at = last_scan_at + timedelta(minutes=settings.live_scanner_minutes)

    return {
        "last_scan_at": last_scan_at,
        "next_scan_at": next_scan_at,
        "tickers_in_queue": tickers_in_queue,
        "market_hours_active": is_market_hours(),
    }


# ── POST /api/scanner/run-now ──────────────────────────────────────────────────


@router.post(
    "/run-now",
    summary="V3 manual trigger — scan all watchlist tickers immediately",
)
async def run_scanner_now(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Manually trigger the V3 live scanner for the authenticated user's watchlist.

    Executes synchronously and returns a summary of the scan.
    Does not require market hours — manual triggers bypass the time guard.
    """
    from app.services.live_scanner_service import scan_user_watchlist

    results = await scan_user_watchlist(user_id=current_user.id, db=db)

    strong_buys = [r.ticker for r in results if r.signal and r.signal.all_conditions_pass]
    errors = [r.ticker for r in results if r.error]

    return {
        "tickers_scanned": len(results),
        "strong_buy_signals": len(strong_buys),
        "strong_buy_tickers": strong_buys,
        "error_tickers": errors,
    }


def _build_idea_out_simple(idea: WatchlistIdea) -> IdeaOut:
    """
    Build an IdeaOut from an ORM object without computing the async rank score.
    The rank_score defaults to 0.0; callers can refresh via GET /api/ideas if needed.
    """
    tickers = [
        TickerOut(
            id=t.id,
            idea_id=t.idea_id,
            ticker=t.ticker,
            is_primary=t.is_primary,
            near_earnings=t.near_earnings,
        )
        for t in idea.tickers
    ]
    return IdeaOut(
        id=idea.id,
        user_id=idea.user_id,
        title=idea.title,
        thesis=idea.thesis,
        conviction_score=idea.conviction_score,
        watch_only=idea.watch_only,
        tradable=idea.tradable,
        tags=idea.tags_json or [],
        tickers=tickers,
        metadata=idea.metadata_json or {},
        rank_score=0.0,
        created_at=idea.created_at,
        updated_at=idea.updated_at,
    )
