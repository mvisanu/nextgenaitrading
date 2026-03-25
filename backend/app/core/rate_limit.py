"""
Rate limiting via slowapi.

Limits:
  - Auth endpoints: 10 requests/minute per IP (login, register, refresh)
  - Trade execution: 10 requests/minute per user

Rate limiting is disabled when DEBUG=true so that local dev and E2E tests
(which all originate from 127.0.0.1) are not blocked.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(key_func=get_remote_address, enabled=not settings.debug)
