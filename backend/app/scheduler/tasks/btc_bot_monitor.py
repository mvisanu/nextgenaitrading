"""
APScheduler task: BTC trailing-stop bot monitor (V9).

Fires every BTC_BOT_MONITOR_MINUTES (default 15). Iterates active + cooldown
sessions across all users, executes one TickAction per session per fire.

This module is the only place I/O happens for the bot:
  - DB reads/writes go through AsyncSessionLocal
  - Alpaca calls go through BtcBotClient
  - Pure decisions delegated to services.btc_bot_service.evaluate_tick

One AsyncSessionLocal is opened OUTSIDE the per-user loop (CLAUDE.md rule);
gc.collect() in the finally block (Render memory rule).

NOTE: This module replaced an earlier read-only heartbeat (`monitor_btc_bot`).
The backward-compat alias at the bottom keeps `app.scheduler.jobs` importable
until Task 17 wires the new entry point.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings
from app.core.security import decrypt_value
from app.models.broker import BrokerCredential
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Credential resolution ──────────────────────────────────────────────────

def _resolve_creds_for_user(
    user: User,
    broker_cred: Optional[BrokerCredential],
) -> Optional[tuple[str, str]]:
    """
    Return (api_key, secret_key) for the user, or None if no usable credential.

    Precedence:
      1. user's BrokerCredential row (if non-None)
      2. env vars VISANU_ALPACA_* (only for the bootstrap user)
    """
    if broker_cred is not None:
        api = decrypt_value(broker_cred.api_key)
        secret = decrypt_value(broker_cred.encrypted_secret_key)
        return (api, secret)

    if (
        settings.btc_bot_bootstrap_user_email
        and user.email
        and user.email.lower() == settings.btc_bot_bootstrap_user_email.lower()
    ):
        api = settings.visanu_alpaca_api_key
        secret = settings.visanu_alpaca_secret_key
        if api and secret:
            return (api, secret)

    return None


# ── Placeholder for backward-compat with jobs.py (Task 17 cleans this up) ──

def monitor_btc_bot() -> None:
    """Placeholder during V9 buildout — Task 16 implements the real function."""
    logger.warning("btc_bot_monitor: not yet wired (Tasks 12-16 in progress)")
