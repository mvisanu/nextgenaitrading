"""
Tests for politician_ranker_service.py — scoring and ranking logic.

Uses importlib.util to load modules directly from file paths so that this
test can run alongside the congress-copy-bot worktree tests (which occupy
the `app.*` namespace) without causing sys.modules collisions.
"""
from __future__ import annotations
import importlib.util
import os
import sys
import math
from datetime import date, timedelta

import pytest

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))

# Load politician_scraper_service directly and register it so the ranker can
# import it via `from app.services.politician_scraper_service import ...`.
_SCRAPER_PATH = os.path.join(_BACKEND_DIR, "app", "services", "politician_scraper_service.py")
_scraper_spec = importlib.util.spec_from_file_location(
    "app.services.politician_scraper_service", _SCRAPER_PATH
)
_scraper_mod = importlib.util.module_from_spec(_scraper_spec)
sys.modules.setdefault("app.services.politician_scraper_service", _scraper_mod)
_scraper_spec.loader.exec_module(_scraper_mod)  # type: ignore[union-attr]

PoliticianTrade = _scraper_mod.PoliticianTrade

# Now load the ranker; it will resolve `from app.services.politician_scraper_service`
# from sys.modules above.
_RANKER_PATH = os.path.join(_BACKEND_DIR, "app", "services", "politician_ranker_service.py")
_ranker_spec = importlib.util.spec_from_file_location("_politician_ranker_service", _RANKER_PATH)
_ranker_mod = importlib.util.module_from_spec(_ranker_spec)
sys.modules["_politician_ranker_service"] = _ranker_mod  # register before exec for @dataclass
_ranker_spec.loader.exec_module(_ranker_mod)  # type: ignore[union-attr]

PoliticianScore = _ranker_mod.PoliticianScore
rank_politicians = _ranker_mod.rank_politicians
get_best_politician = _ranker_mod.get_best_politician


def _trade(politician_id: str, ticker: str, excess_return: float, days_ago: int = 5) -> PoliticianTrade:
    disc = date.today() - timedelta(days=days_ago)
    return PoliticianTrade(
        trade_id=f"{politician_id}_{ticker}_{disc}_buy",
        politician_id=politician_id,
        politician_name=politician_id.replace("-", " ").title(),
        ticker=ticker,
        asset_type="stock",
        trade_type="buy",
        trade_date=disc,
        disclosure_date=disc,
        amount_low=15001.0,
        amount_high=50000.0,
        excess_return=excess_return,
        price_change=excess_return + 1.0,
    )


def test_rank_politicians_returns_top_scores():
    trades = [
        _trade("j-jackson", "AAPL", 8.0),
        _trade("j-jackson", "GEV", 5.0),
        _trade("j-jackson", "BK", 3.0),
        _trade("j-jackson", "MSFT", -1.0),
        _trade("j-jackson", "TSLA", 2.0),
        _trade("n-pelosi", "NVDA", 1.0),
        _trade("n-pelosi", "AMZN", -0.5),
        _trade("n-pelosi", "GOOG", 0.5),
        _trade("n-pelosi", "SPY", -2.0),
        _trade("n-pelosi", "META", 3.0),
    ]
    scores = rank_politicians(trades, lookback_days=90, min_trades=5)
    assert len(scores) >= 1
    assert scores[0].politician_id == "j-jackson"
    assert scores[0].buy_trades == 5
    assert scores[0].win_rate == 80.0  # 4 out of 5 positive


def test_rank_politicians_excludes_below_min_trades():
    trades = [
        _trade("j-jackson", "AAPL", 5.0),
        _trade("j-jackson", "GEV", 3.0),
        _trade("n-pelosi", "NVDA", 10.0),  # only 1 trade
    ]
    scores = rank_politicians(trades, lookback_days=90, min_trades=2)
    ids = [s.politician_id for s in scores]
    assert "j-jackson" in ids
    assert "n-pelosi" not in ids


def test_rank_politicians_excludes_old_trades():
    old_trade = _trade("j-jackson", "AAPL", 5.0, days_ago=200)
    trades = [old_trade] + [_trade("n-pelosi", f"T{i}", 1.0, days_ago=10) for i in range(4)]
    scores = rank_politicians(trades, lookback_days=90, min_trades=1)
    ids = [s.politician_id for s in scores]
    assert "n-pelosi" in ids
    assert "j-jackson" not in ids


def test_score_formula_higher_excess_beats_higher_volume():
    # A: 13 wins + 1 loss — high quality
    a_trades = [_trade("jackson", f"S{i}", 8.3) for i in range(13)]
    a_trades.append(_trade("jackson", "LOSE", -1.0))
    # B: 35 wins + 48 losses — high volume, poor quality
    b_wins = [_trade("cisneros", f"W{i}", 0.5) for i in range(35)]
    b_losses = [_trade("cisneros", f"L{i}", -0.5) for i in range(48)]
    all_trades = a_trades + b_wins + b_losses
    scores = rank_politicians(all_trades, lookback_days=90, min_trades=5)
    assert scores[0].politician_id == "jackson"


def test_get_best_politician_returns_top_when_no_pin():
    trades = [
        _trade("j-jackson", f"T{i}", 5.0 - i * 0.5) for i in range(5)
    ] + [
        _trade("n-pelosi", f"P{i}", 3.0 - i * 0.5) for i in range(5)
    ]
    best = get_best_politician(trades, target_politician_id=None)
    assert best is not None
    assert best.politician_id == "j-jackson"


def test_get_best_politician_respects_pin():
    trades = [
        _trade("j-jackson", f"T{i}", 5.0) for i in range(5)
    ] + [
        _trade("n-pelosi", f"P{i}", 1.0) for i in range(5)
    ]
    best = get_best_politician(trades, target_politician_id="n-pelosi")
    assert best is not None
    assert best.politician_id == "n-pelosi"


def test_get_best_politician_returns_none_when_pin_not_found():
    trades = [_trade("j-jackson", f"T{i}", 5.0) for i in range(5)]
    best = get_best_politician(trades, target_politician_id="nobody")
    assert best is None
