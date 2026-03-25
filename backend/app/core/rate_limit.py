"""
Rate limiting via slowapi.

Limits:
  - Auth endpoints: 10 requests/minute per IP (login, register, refresh)
  - Trade execution: 10 requests/minute per user
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
