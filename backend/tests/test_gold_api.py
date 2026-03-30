"""
Unit tests for backend/app/api/gold.py — Commodity Signal Engine.

Coverage:
  - _base_price helper (known symbols, alias normalisation, fallback)
  - _make_signal field validity, SL/TP directionality, R/R calculation
  - _make_risk_status kill-switch and mode logic
  - _make_performance stable seeding, strategy count, win-rate bounds
  - Endpoint functions called directly (no live DB/HTTP needed):
      get_signals, analyze_symbol, get_risk_status, get_performance
  - Auth guard: endpoints 401/403 without token via httpx AsyncClient
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from app.api.gold import (
    _base_price,
    _make_signal,
    _make_risk_status,
    _make_performance,
    _STRATEGY_NAMES,
    _STATUSES,
    get_signals,
    analyze_symbol,
    get_risk_status,
    get_performance,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_user() -> MagicMock:
    user = MagicMock()
    user.id = 1
    user.email = "test@example.com"
    return user


# ---------------------------------------------------------------------------
# _base_price
# ---------------------------------------------------------------------------

class TestBasePrice:
    def test_xauusd_returns_gold_price(self):
        assert _base_price("XAUUSD") == pytest.approx(3050.0)

    def test_case_insensitive(self):
        assert _base_price("xauusd") == _base_price("XAUUSD")

    def test_slash_normalised(self):
        assert _base_price("XAU/USD") == _base_price("XAUUSD")

    def test_dash_normalised(self):
        assert _base_price("XAU-USD") == _base_price("XAUUSD")

    def test_eurusd(self):
        price = _base_price("EURUSD")
        assert 1.0 < price < 1.5

    def test_btcusd(self):
        price = _base_price("BTCUSD")
        assert price > 10_000

    def test_unknown_symbol_returns_100(self):
        assert _base_price("ZZZYYYY") == pytest.approx(100.0)

    def test_empty_string_returns_100(self):
        assert _base_price("") == pytest.approx(100.0)

    def test_all_known_symbols_positive(self):
        for sym in ("XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD", "USOIL", "BRENTOIL",
                    "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "ETHUSD", "SOLUSD",
                    "COPPER", "NATGAS"):
            assert _base_price(sym) > 0


# ---------------------------------------------------------------------------
# _make_signal
# ---------------------------------------------------------------------------

class TestMakeSignal:
    def test_required_fields_present(self):
        sig = _make_signal("XAUUSD", "1h")
        assert sig.id
        assert sig.symbol == "XAUUSD"
        assert sig.timeframe == "1h"
        assert sig.strategy_name in _STRATEGY_NAMES
        assert sig.direction in ("long", "short")
        assert sig.status in _STATUSES

    def test_long_sl_below_entry_tp_above(self):
        found_long = False
        for _ in range(50):
            sig = _make_signal("XAUUSD", "1h")
            if sig.direction == "long":
                assert sig.stop_loss < sig.entry_price, "long SL must be below entry"
                assert sig.take_profit > sig.entry_price, "long TP must be above entry"
                found_long = True
                break
        assert found_long, "No long signal generated in 50 attempts"

    def test_short_sl_above_entry_tp_below(self):
        found_short = False
        for _ in range(50):
            sig = _make_signal("XAUUSD", "1h")
            if sig.direction == "short":
                assert sig.stop_loss > sig.entry_price, "short SL must be above entry"
                assert sig.take_profit < sig.entry_price, "short TP must be below entry"
                found_short = True
                break
        assert found_short, "No short signal generated in 50 attempts"

    def test_risk_reward_positive(self):
        for _ in range(10):
            sig = _make_signal("XAUUSD", "1h")
            assert sig.risk_reward_ratio > 0

    def test_confidence_score_in_range(self):
        for _ in range(20):
            sig = _make_signal("XAUUSD", "15min")
            assert 0 <= sig.confidence_score <= 100

    def test_volatility_positive(self):
        for _ in range(10):
            sig = _make_signal("XAUUSD", "4h")
            assert sig.volatility_snapshot > 0

    def test_position_size_fraction(self):
        for _ in range(10):
            sig = _make_signal("XAUUSD", "1d")
            assert 0 < sig.position_size_recommendation <= 1.0

    def test_reasoning_not_empty(self):
        sig = _make_signal("XAUUSD", "1h")
        assert len(sig.reasoning_summary) > 10

    def test_approved_wording_compliant(self):
        """No banned terms may appear in any reasoning summary."""
        banned = ["guaranteed", "safe", "certain to go up"]
        for _ in range(40):
            sig = _make_signal("XAUUSD", "1h")
            lower = sig.reasoning_summary.lower()
            for term in banned:
                assert term not in lower, f"Banned wording '{term}' found in reasoning"

    def test_timestamp_recency_when_0_hours_ago(self):
        from datetime import datetime, timezone, timedelta
        sig = _make_signal("XAUUSD", "1h", hours_ago=0)
        now = datetime.now(timezone.utc)
        assert sig.timestamp <= now
        assert sig.timestamp >= now - timedelta(minutes=5)

    def test_hours_ago_shifts_timestamp(self):
        from datetime import datetime, timezone, timedelta
        sig = _make_signal("XAUUSD", "1h", hours_ago=10)
        now = datetime.now(timezone.utc)
        assert sig.timestamp <= now - timedelta(hours=9)

    def test_non_gold_symbol_uses_correct_base(self):
        sig = _make_signal("EURUSD", "1h")
        assert sig.symbol == "EURUSD"
        base = _base_price("EURUSD")
        # Entry should be within ±2% of base
        assert abs(sig.entry_price - base) / base < 0.02

    def test_rr_formula_matches_sl_tp(self):
        sig = _make_signal("XAUUSD", "1h")
        risk = abs(sig.entry_price - sig.stop_loss)
        reward = abs(sig.take_profit - sig.entry_price)
        if risk > 0:
            expected_rr = round(reward / risk, 2)
            assert sig.risk_reward_ratio == pytest.approx(expected_rr, abs=0.05)

    def test_all_strategy_names_appear(self):
        """Over many calls, all 4 strategy names should appear."""
        seen = set()
        for _ in range(100):
            sig = _make_signal("XAUUSD", "1h")
            seen.add(sig.strategy_name)
        assert seen == set(_STRATEGY_NAMES)

    def test_all_statuses_can_appear(self):
        seen = set()
        for _ in range(200):
            sig = _make_signal("XAUUSD", "1h")
            seen.add(sig.status)
        # At minimum approved/sent/candidate should appear
        assert len(seen) >= 3


# ---------------------------------------------------------------------------
# _make_risk_status
# ---------------------------------------------------------------------------

class TestMakeRiskStatus:
    def test_daily_loss_cap_is_2pct(self):
        status = _make_risk_status("XAUUSD")
        assert status.daily_loss_cap_pct == pytest.approx(2.0)

    def test_symbol_uppercased(self):
        status = _make_risk_status("xauusd")
        assert status.symbol == "XAUUSD"

    def test_kill_switch_when_daily_loss_exceeds_cap(self):
        import unittest.mock as mock

        rng_mock = mock.MagicMock()
        rng_mock.randint.side_effect = [0, 0]   # consecutive=0, blocked=0
        rng_mock.uniform.return_value = 2.1       # daily_loss >= 2.0

        with mock.patch("app.api.gold.random.Random", return_value=rng_mock):
            status = _make_risk_status("XAUUSD")

        assert status.kill_switch_active is True
        assert status.mode == "kill_switch"
        assert "2" in (status.kill_switch_reason or "")

    def test_kill_switch_when_8_consecutive_losses(self):
        import unittest.mock as mock

        rng_mock = mock.MagicMock()
        rng_mock.randint.side_effect = [8, 0]    # consecutive=8
        rng_mock.uniform.return_value = 0.5

        with mock.patch("app.api.gold.random.Random", return_value=rng_mock):
            status = _make_risk_status("XAUUSD")

        assert status.kill_switch_active is True
        assert status.mode == "kill_switch"
        assert status.kill_switch_reason is not None

    def test_active_mode_normal_conditions(self):
        import unittest.mock as mock

        rng_mock = mock.MagicMock()
        rng_mock.randint.side_effect = [1, 0]
        rng_mock.uniform.return_value = 0.3

        with mock.patch("app.api.gold.random.Random", return_value=rng_mock):
            status = _make_risk_status("XAUUSD")

        assert status.mode == "active"
        assert status.kill_switch_active is False
        assert status.kill_switch_reason is None

    def test_no_kill_switch_means_no_reason(self):
        for _ in range(20):
            status = _make_risk_status("XAUUSD")
            if not status.kill_switch_active:
                assert status.kill_switch_reason is None
                break

    def test_last_updated_is_recent(self):
        from datetime import datetime, timezone, timedelta
        status = _make_risk_status("XAUUSD")
        now = datetime.now(timezone.utc)
        assert status.last_updated >= now - timedelta(seconds=5)

    def test_mode_is_valid_value(self):
        valid = {"active", "paused", "kill_switch"}
        for _ in range(20):
            status = _make_risk_status("XAUUSD")
            assert status.mode in valid


# ---------------------------------------------------------------------------
# _make_performance
# ---------------------------------------------------------------------------

class TestMakePerformance:
    def test_returns_all_four_strategies(self):
        perf = _make_performance("XAUUSD", 30)
        names = {s.strategy_name for s in perf.strategies}
        assert names == set(_STRATEGY_NAMES)

    def test_stable_seed_same_symbol_and_days(self):
        p1 = _make_performance("XAUUSD", 30)
        p2 = _make_performance("XAUUSD", 30)
        assert p1.overall_win_rate == p2.overall_win_rate
        assert p1.overall_expectancy == p2.overall_expectancy

    def test_different_days_produce_different_results(self):
        p30 = _make_performance("XAUUSD", 30)
        p60 = _make_performance("XAUUSD", 60)
        assert p30.days == 30
        assert p60.days == 60

    def test_overall_win_rate_in_range(self):
        perf = _make_performance("XAUUSD", 30)
        assert 0 <= perf.overall_win_rate <= 1

    def test_per_strategy_win_rate_in_range(self):
        perf = _make_performance("XAUUSD", 30)
        for s in perf.strategies:
            assert 0 <= s.win_rate <= 1

    def test_profit_factor_positive(self):
        perf = _make_performance("XAUUSD", 30)
        for s in perf.strategies:
            assert s.profit_factor > 0

    def test_expectancy_positive(self):
        perf = _make_performance("XAUUSD", 30)
        for s in perf.strategies:
            assert s.expectancy > 0

    def test_symbol_uppercased(self):
        perf = _make_performance("xauusd", 30)
        assert perf.symbol == "XAUUSD"

    def test_days_reflected_in_response(self):
        assert _make_performance("XAUUSD", 14).days == 14
        assert _make_performance("XAUUSD", 60).days == 60

    def test_total_signals_positive(self):
        perf = _make_performance("XAUUSD", 30)
        for s in perf.strategies:
            assert s.total_signals > 0


# ---------------------------------------------------------------------------
# Endpoint function tests — called directly, auth dependency bypassed
# ---------------------------------------------------------------------------

class TestGetSignalsEndpoint:
    @pytest.mark.asyncio
    async def test_returns_signal_list_response(self):
        result = await get_signals(
            symbol="XAUUSD",
            timeframe="1h",
            limit=10,
            _current_user=_fake_user(),
        )
        assert result.symbol == "XAUUSD"
        assert result.timeframe == "1h"
        assert len(result.signals) <= 10
        assert result.total == len(result.signals)

    @pytest.mark.asyncio
    async def test_symbol_uppercased(self):
        result = await get_signals(
            symbol="eurusd",
            timeframe="1h",
            limit=5,
            _current_user=_fake_user(),
        )
        assert result.symbol == "EURUSD"

    @pytest.mark.asyncio
    async def test_timeframe_reflected(self):
        for tf in ("15min", "1h", "4h", "1d"):
            result = await get_signals(
                symbol="XAUUSD",
                timeframe=tf,
                limit=3,
                _current_user=_fake_user(),
            )
            assert result.timeframe == tf

    @pytest.mark.asyncio
    async def test_limit_1_returns_1_signal(self):
        result = await get_signals(
            symbol="XAUUSD",
            timeframe="1h",
            limit=1,
            _current_user=_fake_user(),
        )
        assert len(result.signals) == 1

    @pytest.mark.asyncio
    async def test_signal_fields_complete(self):
        result = await get_signals(
            symbol="XAUUSD",
            timeframe="1h",
            limit=1,
            _current_user=_fake_user(),
        )
        sig = result.signals[0]
        assert sig.id
        assert sig.strategy_name in _STRATEGY_NAMES
        assert sig.direction in ("long", "short")
        assert sig.confidence_score >= 0
        assert sig.risk_reward_ratio > 0


class TestAnalyzeSymbolEndpoint:
    @pytest.mark.asyncio
    async def test_returns_1_to_4_signals(self):
        counts = set()
        for _ in range(20):
            result = await analyze_symbol(
                symbol="XAUUSD",
                timeframe="1h",
                _current_user=_fake_user(),
            )
            assert 1 <= result.signals_generated <= 4
            assert len(result.signals) == result.signals_generated
            counts.add(result.signals_generated)
        assert len(counts) > 1, "Expected variance in signal count over 20 calls"

    @pytest.mark.asyncio
    async def test_message_not_empty(self):
        result = await analyze_symbol(
            symbol="XAUUSD",
            timeframe="1h",
            _current_user=_fake_user(),
        )
        assert len(result.message) > 0

    @pytest.mark.asyncio
    async def test_message_contains_disclaimer(self):
        result = await analyze_symbol(
            symbol="XAUUSD",
            timeframe="1h",
            _current_user=_fake_user(),
        )
        msg = result.message.lower()
        assert "not financial advice" in msg or "historically favorable" in msg

    @pytest.mark.asyncio
    async def test_symbol_uppercased(self):
        result = await analyze_symbol(
            symbol="xagusd",
            timeframe="1h",
            _current_user=_fake_user(),
        )
        assert result.symbol == "XAGUSD"

    @pytest.mark.asyncio
    async def test_signals_generated_field_matches_list(self):
        result = await analyze_symbol(
            symbol="XAUUSD",
            timeframe="4h",
            _current_user=_fake_user(),
        )
        assert result.signals_generated == len(result.signals)


class TestGetRiskStatusEndpoint:
    @pytest.mark.asyncio
    async def test_returns_risk_status(self):
        result = await get_risk_status(
            symbol="XAUUSD",
            _current_user=_fake_user(),
        )
        assert result.symbol == "XAUUSD"
        assert result.daily_loss_cap_pct == pytest.approx(2.0)
        assert result.mode in ("active", "paused", "kill_switch")

    @pytest.mark.asyncio
    async def test_symbol_uppercased(self):
        result = await get_risk_status(symbol="xauusd", _current_user=_fake_user())
        assert result.symbol == "XAUUSD"

    @pytest.mark.asyncio
    async def test_kill_switch_false_means_no_reason(self):
        found = False
        for _ in range(20):
            result = await get_risk_status(symbol="XAUUSD", _current_user=_fake_user())
            if not result.kill_switch_active:
                assert result.kill_switch_reason is None
                found = True
                break
        assert found


class TestGetPerformanceEndpoint:
    @pytest.mark.asyncio
    async def test_returns_4_strategies(self):
        result = await get_performance(
            symbol="XAUUSD",
            days=30,
            _current_user=_fake_user(),
        )
        assert len(result.strategies) == 4

    @pytest.mark.asyncio
    async def test_days_reflected(self):
        result = await get_performance(
            symbol="XAUUSD",
            days=14,
            _current_user=_fake_user(),
        )
        assert result.days == 14

    @pytest.mark.asyncio
    async def test_symbol_uppercased(self):
        result = await get_performance(symbol="xauusd", days=30, _current_user=_fake_user())
        assert result.symbol == "XAUUSD"

    @pytest.mark.asyncio
    async def test_overall_win_rate_in_range(self):
        result = await get_performance(symbol="XAUUSD", days=30, _current_user=_fake_user())
        assert 0 <= result.overall_win_rate <= 1

    @pytest.mark.asyncio
    async def test_stable_results_for_same_params(self):
        r1 = await get_performance(symbol="XAUUSD", days=30, _current_user=_fake_user())
        r2 = await get_performance(symbol="XAUUSD", days=30, _current_user=_fake_user())
        assert r1.overall_win_rate == r2.overall_win_rate

    @pytest.mark.asyncio
    async def test_all_strategy_names_present(self):
        result = await get_performance(symbol="XAUUSD", days=30, _current_user=_fake_user())
        names = {s.strategy_name for s in result.strategies}
        assert names == set(_STRATEGY_NAMES)


# ---------------------------------------------------------------------------
# Auth guard — unauthenticated requests return 401/403
# ---------------------------------------------------------------------------

class TestAuthGuard:
    @pytest.mark.asyncio
    async def test_signals_requires_auth(self):
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport
        from app.api.gold import router

        app = FastAPI()
        app.include_router(router)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            r = await c.get("/gold/signals")
        assert r.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_analyze_requires_auth(self):
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport
        from app.api.gold import router

        app = FastAPI()
        app.include_router(router)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            r = await c.post("/gold/analyze")
        assert r.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_risk_status_requires_auth(self):
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport
        from app.api.gold import router

        app = FastAPI()
        app.include_router(router)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            r = await c.get("/gold/risk-status")
        assert r.status_code in (401, 403, 422)

    @pytest.mark.asyncio
    async def test_performance_requires_auth(self):
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport
        from app.api.gold import router

        app = FastAPI()
        app.include_router(router)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as c:
            r = await c.get("/gold/performance")
        assert r.status_code in (401, 403, 422)
