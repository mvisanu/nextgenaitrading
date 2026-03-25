"""
Market hours utility — V3 canonical implementation.

Uses pytz for proper DST-aware US/Eastern timezone handling.
All V3 scheduler tasks import `is_market_hours()` from this module.
The existing V2 scan_watchlist.py uses its own UTC-based inline guard
and is NOT modified.
"""
from __future__ import annotations

from datetime import datetime

import pytz

_ET = pytz.timezone("America/New_York")


def is_market_hours(now: datetime | None = None) -> bool:
    """
    Return True if *now* falls within NYSE/NASDAQ regular-session hours
    (9:30 AM – 4:00 PM US/Eastern, Monday–Friday).

    Parameters
    ----------
    now:
        Optional datetime to test.  Must be timezone-aware if supplied.
        Defaults to the current wall-clock time.

    Examples
    --------
    >>> from datetime import datetime
    >>> import pytz
    >>> et = pytz.timezone("America/New_York")
    >>> is_market_hours(et.localize(datetime(2026, 3, 24, 10, 0)))  # Tuesday 10:00 ET
    True
    >>> is_market_hours(et.localize(datetime(2026, 3, 24, 16, 0)))  # Tuesday 16:00 ET (closed)
    False
    >>> is_market_hours(et.localize(datetime(2026, 3, 21, 12, 0)))  # Saturday
    False
    """
    if now is None:
        now = datetime.now(_ET)
    elif now.tzinfo is None:
        # naive datetime — assume ET
        now = _ET.localize(now)
    else:
        now = now.astimezone(_ET)

    # Saturday = 5, Sunday = 6
    if now.weekday() >= 5:
        return False

    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)

    # 9:30 inclusive; 16:00 exclusive (market closes at exactly 16:00 — don't fire at close)
    return market_open <= now < market_close
