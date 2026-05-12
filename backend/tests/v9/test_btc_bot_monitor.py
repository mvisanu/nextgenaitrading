"""Orchestrator + credential-resolver unit tests.

Avoid hitting Alpaca by patching BtcBotClient. Use the conftest fixtures for
deterministic user + session inputs.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.scheduler.tasks.btc_bot_monitor import _resolve_creds_for_user


def test_resolve_creds_returns_env_for_bootstrap_user(user_bootstrap):
    """User matching BTC_BOT_BOOTSTRAP_USER_EMAIL gets env-var creds."""
    creds = _resolve_creds_for_user(user_bootstrap, broker_cred=None)
    assert creds is not None
    api, secret = creds
    assert api == "test-key"
    assert secret == "test-secret"


def test_resolve_creds_returns_none_for_other_user_without_broker_cred(user_other):
    """Non-bootstrap user without saved credentials → no creds available."""
    creds = _resolve_creds_for_user(user_other, broker_cred=None)
    assert creds is None


def test_resolve_creds_prefers_broker_cred_over_env(user_bootstrap):
    """If user has a BrokerCredential, prefer it even if env vars are set."""
    mock_cred = MagicMock()
    with patch("app.scheduler.tasks.btc_bot_monitor.decrypt_value") as mock_dec:
        mock_dec.side_effect = ["personal-key", "personal-secret"]
        creds = _resolve_creds_for_user(user_bootstrap, broker_cred=mock_cred)
    assert creds == ("personal-key", "personal-secret")
