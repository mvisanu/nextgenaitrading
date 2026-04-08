"""
Ranks politicians by their stock market performance.
Uses ExcessReturn vs SPY pre-calculated by Quiver Quant (no yfinance needed).
"""
import logging
from datetime import date, timedelta
from dataclasses import dataclass, field

import config
from capitol_scraper import PoliticianTrade, fetch_all_recent_trades, fetch_politician_trades, fetch_top_politicians

logger = logging.getLogger(__name__)


@dataclass
class PoliticianScore:
    politician_id: str
    politician_name: str
    total_trades: int
    buy_trades: int
    win_rate: float           # % of buys where ExcessReturn > 0
    avg_excess_return: float  # average ExcessReturn vs SPY
    avg_price_change: float   # average raw price change
    recent_trade_count: int   # trades in the last 30 days
    score: float              # composite (higher = better)
    best_trades: list[str] = field(default_factory=list)


def _score_politician(
    politician_id: str,
    politician_name: str,
    trades: list[PoliticianTrade],
    today: date,
) -> PoliticianScore:
    buy_trades = [t for t in trades if t.trade_type == "buy"]
    recent_count = sum(1 for t in trades if (today - t.disclosure_date).days <= 30)

    # Only use buys that have ExcessReturn data
    scored = [t for t in buy_trades if t.excess_return is not None]

    if not scored:
        win_rate = 0.0
        avg_excess = 0.0
        avg_price = 0.0
        best = []
    else:
        wins = [t for t in scored if t.excess_return > 0]
        win_rate = len(wins) / len(scored) * 100
        avg_excess = sum(t.excess_return for t in scored) / len(scored)
        avg_price = sum(t.price_change for t in scored if t.price_change is not None) / max(1, len(scored))
        best = sorted(wins, key=lambda t: t.excess_return, reverse=True)[:5]
        best = [f"{t.ticker} +{t.excess_return:.1f}% vs SPY" for t in best]

    # Composite score — quality over quantity:
    #   win_rate:    weighted heavily (are picks actually good?)
    #   avg_excess:  weighted most (outperforming SPY is the goal)
    #   recency:     log-scaled so volume traders don't dominate;
    #                a politician with 5 recent trades scores similarly to one with 50
    import math
    recency_bonus = math.log1p(recent_count) * 3.0
    score = (win_rate * 1.5) + (avg_excess * 5.0) + recency_bonus

    return PoliticianScore(
        politician_id=politician_id,
        politician_name=politician_name,
        total_trades=len(trades),
        buy_trades=len(buy_trades),
        win_rate=win_rate,
        avg_excess_return=avg_excess,
        avg_price_change=avg_price,
        recent_trade_count=recent_count,
        score=score,
        best_trades=best,
    )


def rank_politicians(
    lookback_days: int = None,
    min_trades: int = None,
    top_n: int = 10,
) -> list[PoliticianScore]:
    lookback_days = lookback_days or config.RANK_LOOKBACK_DAYS
    min_trades = min_trades or config.MIN_TRADES_TO_QUALIFY
    today = date.today()
    cutoff = today - timedelta(days=lookback_days)

    logger.info("Loading all congressional trades from Quiver Quant...")
    all_trades = fetch_all_recent_trades()

    # Group by politician
    by_politician: dict[str, list[PoliticianTrade]] = {}
    for t in all_trades:
        if t.disclosure_date >= cutoff:
            by_politician.setdefault(t.politician_id, []).append(t)

    logger.info(f"Scoring {len(by_politician)} politicians with trades in last {lookback_days}d...")
    scores: list[PoliticianScore] = []

    for pid, trades in by_politician.items():
        if len(trades) < min_trades:
            continue
        pname = trades[0].politician_name
        score = _score_politician(pid, pname, trades, today)
        scores.append(score)

    scores.sort(key=lambda s: s.score, reverse=True)
    logger.info(f"Ranked {len(scores)} qualifying politicians")
    return scores[:top_n]


def get_best_politician() -> PoliticianScore | None:
    if config.TARGET_POLITICIAN:
        logger.info(f"Using manually configured politician: {config.TARGET_POLITICIAN}")
        trades = fetch_politician_trades(config.TARGET_POLITICIAN, days_back=config.RANK_LOOKBACK_DAYS)
        if not trades:
            logger.warning(f"No trades found for {config.TARGET_POLITICIAN}")
            return None
        politician_name = trades[0].politician_name if trades else config.TARGET_POLITICIAN
        return _score_politician(config.TARGET_POLITICIAN, politician_name, trades, date.today())

    ranked = rank_politicians()
    if not ranked:
        logger.warning("No politicians qualified for ranking.")
        return None

    best = ranked[0]
    logger.info(
        f"Best politician: {best.politician_name} "
        f"(score={best.score:.1f}, win_rate={best.win_rate:.0f}%, "
        f"avg_excess={best.avg_excess_return:.1f}% vs SPY)"
    )
    return best


def print_rankings(scores: list[PoliticianScore]) -> None:
    print(f"\n{'Rank':<5} {'Politician':<30} {'Buys':<7} {'Win%':<7} {'ExcessRet%':<12} {'Recent':<8} {'Score':<8}")
    print("-" * 82)
    for i, s in enumerate(scores, 1):
        print(
            f"{i:<5} {s.politician_name:<30} {s.buy_trades:<7} "
            f"{s.win_rate:<7.0f} {s.avg_excess_return:<12.1f} "
            f"{s.recent_trade_count:<8} {s.score:<8.1f}"
        )
        if s.best_trades:
            print(f"       Best: {', '.join(s.best_trades)}")
    print()
