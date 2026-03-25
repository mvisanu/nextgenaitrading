"""
Unit tests for utils/market_hours.py

All tests are pure — they pass a datetime argument to is_market_hours()
so no external state or clock is needed.
"""
from __future__ import annotations

from datetime import datetime

import pytz
import pytest

from app.utils.market_hours import is_market_hours

_ET = pytz.timezone("America/New_York")


def _et(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    """Construct a timezone-aware Eastern datetime."""
    return _ET.localize(datetime(year, month, day, hour, minute))


class TestWeekends:
    def test_saturday_returns_false(self):
        # 2026-03-21 is a Saturday
        assert is_market_hours(_et(2026, 3, 21, 10, 0)) is False

    def test_sunday_returns_false(self):
        # 2026-03-22 is a Sunday
        assert is_market_hours(_et(2026, 3, 22, 12, 0)) is False


class TestWeekdayBoundaries:
    def test_before_market_open_returns_false(self):
        # 9:29 AM ET weekday
        assert is_market_hours(_et(2026, 3, 24, 9, 29)) is False

    def test_exactly_at_open_returns_true(self):
        # 9:30 AM ET — market opens (inclusive)
        assert is_market_hours(_et(2026, 3, 24, 9, 30)) is True

    def test_midday_returns_true(self):
        # 12:00 PM ET
        assert is_market_hours(_et(2026, 3, 24, 12, 0)) is True

    def test_one_minute_before_close_returns_true(self):
        # 3:59 PM ET
        assert is_market_hours(_et(2026, 3, 24, 15, 59)) is True

    def test_exactly_at_close_returns_false(self):
        # 4:00 PM ET — market closed (exclusive)
        assert is_market_hours(_et(2026, 3, 24, 16, 0)) is False

    def test_after_close_returns_false(self):
        # 6:00 PM ET
        assert is_market_hours(_et(2026, 3, 24, 18, 0)) is False


class TestDSTBoundary:
    def test_dst_spring_forward_day_still_works(self):
        """
        US DST springs forward on 2026-03-08 at 2:00 AM ET.
        10:00 AM ET on that day should still return True.
        """
        # March 8, 2026 is DST transition day (Sunday — market closed)
        assert is_market_hours(_et(2026, 3, 8, 10, 0)) is False  # Sunday

        # The following Monday (March 9) is a valid trading day
        assert is_market_hours(_et(2026, 3, 9, 10, 0)) is True

    def test_before_dst_standard_time(self):
        """
        In January (EST = UTC-5), 9:30 AM ET is still market open.
        pytz handles the DST offset correctly via localize().
        """
        assert is_market_hours(_et(2026, 1, 12, 9, 30)) is True
        assert is_market_hours(_et(2026, 1, 12, 9, 29)) is False


class TestNaiveDatetime:
    def test_naive_datetime_treated_as_et(self):
        """A naive datetime should be treated as ET and not raise."""
        naive = datetime(2026, 3, 24, 10, 0)  # no tzinfo
        # Should not raise; result should be True (10 AM weekday)
        assert is_market_hours(naive) is True


class TestDefaultNow:
    def test_no_argument_does_not_raise(self):
        """Calling with no argument uses current time — should not raise."""
        result = is_market_hours()
        assert isinstance(result, bool)
