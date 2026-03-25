"""
T3-36 — Integration tests for live_scanner_service.py

Tests scan_user_watchlist() behavior end-to-end (mocking the DB session
and evaluate_buy_signal so no live network calls are made).

Coverage:
  - Empty watchlist returns []
  - Single ticker: signal persisted and returned in result
  - Multiple tickers: one result per row
  - all_conditions_pass only True when evaluate_buy_signal says so
  - Per-ticker errors are captured without aborting the whole batch
  - alert_enabled=False is forwarded to evaluate_buy_signal
  - Cooldown suppression (all_conditions_pass=False) does NOT raise
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from app.services.live_scanner_service import LiveScanResult, scan_user_watchlist


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_watchlist_row(ticker: str, alert_enabled: bool = True) -> MagicMock:
    """Create a mock UserWatchlist row."""
    row = MagicMock()
    row.ticker = ticker
    row.alert_enabled = alert_enabled
    return row


def _make_signal(all_conditions_pass: bool, suppressed_reason: str | None = None) -> MagicMock:
    """Create a mock BuyNowSignal with the desired pass/fail state."""
    sig = MagicMock()
    sig.all_conditions_pass = all_conditions_pass
    sig.suppressed_reason = suppressed_reason
    sig.signal_strength = "STRONG_BUY" if all_conditions_pass else "SUPPRESSED"
    return sig


def _make_db_with_watchlist(rows: list) -> AsyncMock:
    """
    Build a mock AsyncSession that returns *rows* when UserWatchlist is queried.
    """
    scalars_result = MagicMock()
    scalars_result.all.return_value = rows

    execute_result = MagicMock()
    execute_result.scalars.return_value = scalars_result

    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result)
    return db


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestScanUserWatchlistEmptyList:
    @pytest.mark.asyncio
    async def test_empty_watchlist_returns_empty_list(self):
        """A user with no watchlist entries should get an empty result list."""
        db = _make_db_with_watchlist([])
        results = await scan_user_watchlist(user_id=1, db=db)
        assert results == []

    @pytest.mark.asyncio
    async def test_empty_watchlist_does_not_call_evaluate(self):
        """evaluate_buy_signal must never be called for an empty watchlist."""
        db = _make_db_with_watchlist([])
        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
        ) as mock_eval:
            await scan_user_watchlist(user_id=1, db=db)
            mock_eval.assert_not_called()


class TestScanUserWatchlistSingleTicker:
    @pytest.mark.asyncio
    async def test_single_ticker_returns_one_result(self):
        """One watchlist row → one LiveScanResult in the returned list."""
        rows = [_make_watchlist_row("NVDA")]
        db = _make_db_with_watchlist(rows)
        signal = _make_signal(all_conditions_pass=True)

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ):
            results = await scan_user_watchlist(user_id=42, db=db)

        assert len(results) == 1
        result = results[0]
        assert isinstance(result, LiveScanResult)
        assert result.ticker == "NVDA"
        assert result.signal is signal
        assert result.error is None

    @pytest.mark.asyncio
    async def test_evaluate_called_with_correct_args(self):
        """evaluate_buy_signal must receive ticker, user_id, db, and alert_enabled."""
        rows = [_make_watchlist_row("AAPL", alert_enabled=False)]
        db = _make_db_with_watchlist(rows)
        signal = _make_signal(all_conditions_pass=False)

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ) as mock_eval:
            await scan_user_watchlist(user_id=7, db=db)

        mock_eval.assert_called_once_with(
            ticker="AAPL",
            user_id=7,
            db=db,
            alert_enabled=False,
        )

    @pytest.mark.asyncio
    async def test_all_conditions_pass_true_reflected_in_result(self):
        """When evaluate returns a passing signal, result.signal.all_conditions_pass is True."""
        rows = [_make_watchlist_row("MSFT")]
        db = _make_db_with_watchlist(rows)
        signal = _make_signal(all_conditions_pass=True)

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ):
            results = await scan_user_watchlist(user_id=1, db=db)

        assert results[0].signal.all_conditions_pass is True

    @pytest.mark.asyncio
    async def test_all_conditions_pass_false_reflected_in_result(self):
        """When a condition fails, all_conditions_pass must be False in the result."""
        rows = [_make_watchlist_row("TSLA")]
        db = _make_db_with_watchlist(rows)
        signal = _make_signal(
            all_conditions_pass=False,
            suppressed_reason="rsi_not_overbought",
        )

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ):
            results = await scan_user_watchlist(user_id=1, db=db)

        assert results[0].signal.all_conditions_pass is False
        assert results[0].signal.suppressed_reason == "rsi_not_overbought"


class TestScanUserWatchlistMultipleTickers:
    @pytest.mark.asyncio
    async def test_three_tickers_returns_three_results(self):
        """One result per watchlist row, regardless of pass/fail state."""
        rows = [
            _make_watchlist_row("NVDA"),
            _make_watchlist_row("AAPL"),
            _make_watchlist_row("MSFT"),
        ]
        db = _make_db_with_watchlist(rows)

        signals = [
            _make_signal(all_conditions_pass=True),
            _make_signal(all_conditions_pass=False, suppressed_reason="above_200d_moving_average"),
            _make_signal(all_conditions_pass=False, suppressed_reason="rsi_not_overbought"),
        ]

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            side_effect=signals,
        ):
            results = await scan_user_watchlist(user_id=5, db=db)

        assert len(results) == 3
        tickers = [r.ticker for r in results]
        assert "NVDA" in tickers
        assert "AAPL" in tickers
        assert "MSFT" in tickers

    @pytest.mark.asyncio
    async def test_only_one_strong_buy_in_mixed_batch(self):
        """Exactly one STRONG BUY among three tickers should be counted correctly."""
        rows = [
            _make_watchlist_row("NVDA"),
            _make_watchlist_row("AAPL"),
            _make_watchlist_row("MSFT"),
        ]
        db = _make_db_with_watchlist(rows)

        signals = [
            _make_signal(all_conditions_pass=True),   # NVDA passes
            _make_signal(all_conditions_pass=False),
            _make_signal(all_conditions_pass=False),
        ]

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            side_effect=signals,
        ):
            results = await scan_user_watchlist(user_id=5, db=db)

        strong_buys = [r for r in results if r.signal and r.signal.all_conditions_pass]
        assert len(strong_buys) == 1
        assert strong_buys[0].ticker == "NVDA"

    @pytest.mark.asyncio
    async def test_all_conditions_pass_requires_all_ten_to_pass(self):
        """
        all_conditions_pass should only be True when the signal object explicitly
        reports it — the scanner does not override the gate logic.
        """
        rows = [_make_watchlist_row("TEST")]
        db = _make_db_with_watchlist(rows)

        # Signal with all_conditions_pass = False (nine pass, one fails)
        signal = _make_signal(
            all_conditions_pass=False,
            suppressed_reason="price_inside_backtest_buy_zone",
        )

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ):
            results = await scan_user_watchlist(user_id=1, db=db)

        # The scanner must NOT flip all_conditions_pass to True
        assert results[0].signal.all_conditions_pass is False


class TestScanUserWatchlistErrorHandling:
    @pytest.mark.asyncio
    async def test_per_ticker_error_is_captured_without_abort(self):
        """
        A RuntimeError from evaluate_buy_signal for one ticker must be captured
        in result.error; the remaining tickers should still be processed.
        """
        rows = [
            _make_watchlist_row("BADTICKER"),
            _make_watchlist_row("NVDA"),
        ]
        db = _make_db_with_watchlist(rows)
        good_signal = _make_signal(all_conditions_pass=True)

        async def _eval(ticker: str, user_id: int, db, alert_enabled: bool = True):
            if ticker == "BADTICKER":
                raise RuntimeError("Cannot evaluate BADTICKER: data unavailable")
            return good_signal

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            side_effect=_eval,
        ):
            results = await scan_user_watchlist(user_id=1, db=db)

        assert len(results) == 2
        bad_result = next(r for r in results if r.ticker == "BADTICKER")
        good_result = next(r for r in results if r.ticker == "NVDA")

        assert bad_result.signal is None
        assert bad_result.error is not None
        assert "unavailable" in bad_result.error.lower()

        assert good_result.signal is good_signal
        assert good_result.error is None

    @pytest.mark.asyncio
    async def test_all_tickers_error_returns_all_error_results(self):
        """All-fail scenario: every result has signal=None and an error string."""
        rows = [_make_watchlist_row("A"), _make_watchlist_row("B")]
        db = _make_db_with_watchlist(rows)

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            side_effect=RuntimeError("market closed"),
        ):
            results = await scan_user_watchlist(user_id=1, db=db)

        assert len(results) == 2
        for r in results:
            assert r.signal is None
            assert r.error is not None

    @pytest.mark.asyncio
    async def test_scan_never_raises_on_evaluate_exception(self):
        """scan_user_watchlist itself must never propagate exceptions from evaluate."""
        rows = [_make_watchlist_row("CRASH")]
        db = _make_db_with_watchlist(rows)

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            side_effect=Exception("unexpected crash"),
        ):
            # Should not raise
            results = await scan_user_watchlist(user_id=1, db=db)

        assert len(results) == 1
        assert results[0].error is not None


class TestScanUserWatchlistCooldown:
    @pytest.mark.asyncio
    async def test_cooldown_active_produces_suppressed_signal(self):
        """
        When evaluate_buy_signal returns a signal with all_conditions_pass=False
        due to cooldown, the result must reflect that — not raise or be discarded.
        """
        rows = [_make_watchlist_row("NVDA")]
        db = _make_db_with_watchlist(rows)
        signal = _make_signal(
            all_conditions_pass=False,
            suppressed_reason="no_duplicate_signal_in_cooldown",
        )

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ):
            results = await scan_user_watchlist(user_id=1, db=db)

        assert len(results) == 1
        assert results[0].signal.all_conditions_pass is False
        assert results[0].signal.suppressed_reason == "no_duplicate_signal_in_cooldown"
        assert results[0].error is None

    @pytest.mark.asyncio
    async def test_alert_disabled_forwarded_to_evaluate(self):
        """
        When alert_enabled=False on the watchlist row, that flag must be forwarded
        to evaluate_buy_signal so notifications are suppressed even if conditions pass.
        """
        rows = [_make_watchlist_row("AAPL", alert_enabled=False)]
        db = _make_db_with_watchlist(rows)
        signal = _make_signal(all_conditions_pass=True)

        with patch(
            "app.services.live_scanner_service.evaluate_buy_signal",
            new_callable=AsyncMock,
            return_value=signal,
        ) as mock_eval:
            await scan_user_watchlist(user_id=3, db=db)

        _, kwargs = mock_eval.call_args
        assert kwargs.get("alert_enabled") is False


class TestLiveScanResultDataclass:
    def test_result_with_signal(self):
        signal = _make_signal(all_conditions_pass=True)
        r = LiveScanResult(ticker="NVDA", signal=signal)
        assert r.ticker == "NVDA"
        assert r.signal is signal
        assert r.error is None

    def test_result_with_error(self):
        r = LiveScanResult(ticker="FAIL", signal=None, error="data unavailable")
        assert r.signal is None
        assert "unavailable" in r.error
