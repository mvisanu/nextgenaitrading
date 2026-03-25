"""
Unit tests for notification_service.

Tests: channel selection logic, InAppNotification logging,
       Email/Webhook stub behaviour, dispatch_notification routing,
       exception handling in dispatch.
"""
from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.notification_service import (
    InAppNotification,
    EmailNotification,
    WebhookNotification,
    dispatch_notification,
    get_notification_channels,
)


class TestInAppNotification:
    @pytest.mark.asyncio
    async def test_send_logs_at_info_level(self, caplog) -> None:
        channel = InAppNotification()
        with caplog.at_level(logging.INFO):
            await channel.send(
                user_id=1,
                subject="Test alert",
                body="NVDA entered buy zone",
                metadata={"alert_rule_id": 42},
            )
        assert "IN_APP_NOTIFICATION" in caplog.text
        assert "Test alert" in caplog.text

    @pytest.mark.asyncio
    async def test_send_includes_user_id(self, caplog) -> None:
        channel = InAppNotification()
        with caplog.at_level(logging.INFO):
            await channel.send(user_id=99, subject="S", body="B", metadata={})
        assert "user_id=99" in caplog.text


class TestEmailNotification:
    @pytest.mark.asyncio
    async def test_disabled_does_not_dispatch(self, caplog) -> None:
        channel = EmailNotification()
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_email_enabled = False
            with caplog.at_level(logging.DEBUG):
                await channel.send(user_id=1, subject="Sub", body="Body", metadata={})
        # Should not log INFO (just debug skip message)
        info_messages = [r for r in caplog.records if r.levelno >= logging.INFO]
        assert not any("EMAIL_NOTIFICATION" in r.message for r in info_messages)

    @pytest.mark.asyncio
    async def test_enabled_logs_stub_info(self, caplog) -> None:
        channel = EmailNotification()
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_email_enabled = True
            with caplog.at_level(logging.INFO):
                await channel.send(user_id=1, subject="My Subject", body="Body", metadata={})
        assert "EMAIL_NOTIFICATION" in caplog.text


class TestWebhookNotification:
    @pytest.mark.asyncio
    async def test_disabled_does_not_dispatch(self, caplog) -> None:
        channel = WebhookNotification()
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_webhook_enabled = False
            mock_settings.notification_webhook_url = ""
            with caplog.at_level(logging.DEBUG):
                await channel.send(user_id=1, subject="S", body="B", metadata={})
        info_messages = [r for r in caplog.records if r.levelno >= logging.INFO]
        assert not any("WEBHOOK_NOTIFICATION" in r.message for r in info_messages)

    @pytest.mark.asyncio
    async def test_enabled_without_url_does_not_dispatch(self, caplog) -> None:
        channel = WebhookNotification()
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_webhook_enabled = True
            mock_settings.notification_webhook_url = ""  # missing URL
            with caplog.at_level(logging.DEBUG):
                await channel.send(user_id=1, subject="S", body="B", metadata={})
        info_messages = [r for r in caplog.records if r.levelno >= logging.INFO]
        assert not any("WEBHOOK_NOTIFICATION" in r.message for r in info_messages)

    @pytest.mark.asyncio
    async def test_enabled_with_url_logs_stub(self, caplog) -> None:
        channel = WebhookNotification()
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_webhook_enabled = True
            mock_settings.notification_webhook_url = "https://hooks.example.com/notify"
            with caplog.at_level(logging.INFO):
                await channel.send(user_id=1, subject="Webhook test", body="B", metadata={})
        assert "WEBHOOK_NOTIFICATION" in caplog.text


class TestGetNotificationChannels:
    def test_always_includes_in_app(self) -> None:
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_email_enabled = False
            mock_settings.notification_webhook_enabled = False
            mock_settings.notification_webhook_url = ""
            channels = get_notification_channels()
        assert any(isinstance(c, InAppNotification) for c in channels)

    def test_email_added_when_enabled(self) -> None:
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_email_enabled = True
            mock_settings.notification_webhook_enabled = False
            mock_settings.notification_webhook_url = ""
            channels = get_notification_channels()
        assert any(isinstance(c, EmailNotification) for c in channels)

    def test_webhook_not_added_when_url_missing(self) -> None:
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_email_enabled = False
            mock_settings.notification_webhook_enabled = True
            mock_settings.notification_webhook_url = ""
            channels = get_notification_channels()
        assert not any(isinstance(c, WebhookNotification) for c in channels)

    def test_webhook_added_when_enabled_with_url(self) -> None:
        with patch("app.services.notification_service.settings") as mock_settings:
            mock_settings.notification_email_enabled = False
            mock_settings.notification_webhook_enabled = True
            mock_settings.notification_webhook_url = "https://hooks.example.com/x"
            channels = get_notification_channels()
        assert any(isinstance(c, WebhookNotification) for c in channels)


class TestDispatchNotification:
    @pytest.mark.asyncio
    async def test_dispatch_calls_all_channels(self) -> None:
        ch1 = AsyncMock(spec=InAppNotification)
        ch2 = AsyncMock(spec=EmailNotification)
        with patch(
            "app.services.notification_service.get_notification_channels",
            return_value=[ch1, ch2],
        ):
            await dispatch_notification(
                user_id=1, subject="Test", body="Alert body", metadata={"key": "val"}
            )
        ch1.send.assert_called_once_with(
            user_id=1, subject="Test", body="Alert body", metadata={"key": "val"}
        )
        ch2.send.assert_called_once_with(
            user_id=1, subject="Test", body="Alert body", metadata={"key": "val"}
        )

    @pytest.mark.asyncio
    async def test_dispatch_none_metadata_becomes_empty_dict(self) -> None:
        channel = AsyncMock(spec=InAppNotification)
        with patch(
            "app.services.notification_service.get_notification_channels",
            return_value=[channel],
        ):
            await dispatch_notification(user_id=1, subject="S", body="B")
        _, kwargs = channel.send.call_args
        assert kwargs["metadata"] == {}

    @pytest.mark.asyncio
    async def test_dispatch_continues_if_channel_raises(self, caplog) -> None:
        """Failure in one channel must not prevent other channels from firing."""
        failing_ch = AsyncMock(spec=InAppNotification)
        failing_ch.send.side_effect = RuntimeError("SMTP timeout")
        ok_ch = AsyncMock(spec=EmailNotification)
        with patch(
            "app.services.notification_service.get_notification_channels",
            return_value=[failing_ch, ok_ch],
        ):
            with caplog.at_level(logging.ERROR):
                await dispatch_notification(user_id=1, subject="S", body="B")
        # Second channel must still be called despite first channel failing
        ok_ch.send.assert_called_once()
        assert "SMTP timeout" in caplog.text
