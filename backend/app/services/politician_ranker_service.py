"""
Ranks politicians by trading performance using pre-fetched Quiver trade data.
Scoring formula: (win_rate * 1.5) + (avg_excess_return * 5.0) + log1p(recent_count) * 3.0
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from app.services.politician_scraper_service import PoliticianTrade

logger = logging.getLogger(__name__)


@dataclass
class PoliticianScore:
    politician_id: str
    politician_name: str
    total_trades: int
    buy_trades: int
    win_rate: float           # % of buys with ExcessReturn > 0
    avg_excess_return: float  # average % vs SPY
    recent_trade_count: int   # trades in last 30 days
    score: float
    best_trades: list[str] = field(default_factory=list)


def _score(
    politician_id: str,
    politician_name: str,
    trades: list[PoliticianTrade],
    today: date,
) -> PoliticianScore:
    buy_trades = [t for t in trades if t.trade_type == "buy"]
    recent_count = sum(
        1 for t in trades
        if t.disclosure_date and (today - t.disclosure_date).days <= 30
    )
    scored = [t for t in buy_trades if t.excess_return is not None]

    if not scored:
        win_rate = avg_excess = 0.0
        best: list[str] = []
    else:
        wins = [t for t in scored if t.excess_return > 0]
        win_rate = len(wins) / len(scored) * 100
        avg_excess = sum(t.excess_return for t in scored) / len(scored)
        top = sorted(wins, key=lambda t: t.excess_return, reverse=True)[:5]
        best = [f"{t.ticker} +{t.excess_return:.1f}% vs SPY" for t in top]

    recency_bonus = math.log1p(recent_count) * 3.0
    composite = (win_rate * 1.5) + (avg_excess * 5.0) + recency_bonus

    return PoliticianScore(
        politician_id=politician_id,
        politician_name=politician_name,
        total_trades=len(trades),
        buy_trades=len(buy_trades),
        win_rate=win_rate,
        avg_excess_return=avg_excess,
        recent_trade_count=recent_count,
        score=composite,
        best_trades=best,
    )


def rank_politicians(
    all_trades: list[PoliticianTrade],
    lookback_days: int = 90,
    min_trades: int = 5,
    top_n: int = 10,
) -> list[PoliticianScore]:
    today = date.today()
    cutoff = today - timedelta(days=lookback_days)

    by_politician: dict[str, list[PoliticianTrade]] = {}
    for t in all_trades:
        disc = t.disclosure_date
        if disc is None or disc < cutoff:
            continue
        by_politician.setdefault(t.politician_id, []).append(t)

    scores: list[PoliticianScore] = []
    for pid, trades in by_politician.items():
        if len(trades) < min_trades:
            continue
        pname = trades[0].politician_name
        scores.append(_score(pid, pname, trades, today))

    scores.sort(key=lambda s: s.score, reverse=True)
    return scores[:top_n]


def get_best_politician(
    all_trades: list[PoliticianTrade],
    target_politician_id: Optional[str] = None,
    lookback_days: int = 90,
    min_trades: int = 5,
) -> Optional[PoliticianScore]:
    if target_politician_id:
        pinned = [t for t in all_trades if t.politician_id.lower() == target_politician_id.lower()]
        if not pinned:
            logger.warning("No trades found for pinned politician %s", target_politician_id)
            return None
        pname = pinned[0].politician_name
        return _score(target_politician_id, pname, pinned, date.today())

    ranked = rank_politicians(all_trades, lookback_days=lookback_days, min_trades=min_trades)
    if not ranked:
        logger.warning("No politicians qualified for ranking")
        return None
    logger.info(
        "Best politician: %s (score=%.1f, win_rate=%.0f%%, avg_excess=%.1f%%)",
        ranked[0].politician_name, ranked[0].score, ranked[0].win_rate, ranked[0].avg_excess_return,
    )
    return ranked[0]
