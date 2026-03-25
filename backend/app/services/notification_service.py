"""
Notification abstraction layer.

Route notifications through this abstraction so channels can be added
without changing alert logic.

v2 ships only InAppNotification as a concrete channel.
EmailNotification and WebhookNotification are wired but stub only —
they log a line if env vars are not configured.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationChannel(ABC):
    @abstractmethod
    async def send(
        self,
        user_id: int,
        subject: str,
        body: str,
        metadata: dict,
    ) -> None:
        """Dispatch a notification. Must be idempotent — safe to call multiple times."""
        ...


class InAppNotification(NotificationChannel):
    """
    In-app notification: writes to the application log.
    In v3, this will persist to an `in_app_notifications` table and be
    delivered over WebSocket. For v2, structured log entries serve as
    the audit trail.
    """

    async def send(
        self,
        user_id: int,
        subject: str,
        body: str,
        metadata: dict,
    ) -> None:
        logger.info(
            "IN_APP_NOTIFICATION | user_id=%d | subject=%s | body=%s | metadata=%s",
            user_id,
            subject,
            body,
            metadata,
        )


class EmailNotification(NotificationChannel):
    """
    Email channel stub.
    Set NOTIFICATION_EMAIL_ENABLED=true and configure SMTP settings to activate.
    """

    async def send(
        self,
        user_id: int,
        subject: str,
        body: str,
        metadata: dict,
    ) -> None:
        if not settings.notification_email_enabled:
            logger.debug(
                "EmailNotification is disabled (NOTIFICATION_EMAIL_ENABLED=false). "
                "Would have sent to user_id=%d: %s",
                user_id,
                subject,
            )
            return
        # TODO (v3): implement SMTP / SendGrid dispatch here
        logger.info(
            "EMAIL_NOTIFICATION (stub) | user_id=%d | subject=%s",
            user_id,
            subject,
        )


class WebhookNotification(NotificationChannel):
    """
    Webhook channel stub.
    Set NOTIFICATION_WEBHOOK_ENABLED=true and NOTIFICATION_WEBHOOK_URL to activate.
    """

    async def send(
        self,
        user_id: int,
        subject: str,
        body: str,
        metadata: dict,
    ) -> None:
        if not settings.notification_webhook_enabled or not settings.notification_webhook_url:
            logger.debug(
                "WebhookNotification is disabled (NOTIFICATION_WEBHOOK_ENABLED=false). "
                "Would have sent to user_id=%d: %s",
                user_id,
                subject,
            )
            return
        # TODO (v3): implement HTTP POST to notification_webhook_url
        logger.info(
            "WEBHOOK_NOTIFICATION (stub) | user_id=%d | subject=%s | url=%s",
            user_id,
            subject,
            settings.notification_webhook_url,
        )


def get_notification_channels() -> list[NotificationChannel]:
    """Return the active notification channels in priority order."""
    channels: list[NotificationChannel] = [InAppNotification()]
    if settings.notification_email_enabled:
        channels.append(EmailNotification())
    if settings.notification_webhook_enabled and settings.notification_webhook_url:
        channels.append(WebhookNotification())
    return channels


async def dispatch_notification(
    user_id: int,
    subject: str,
    body: str,
    metadata: Optional[dict] = None,
) -> None:
    """Dispatch a notification through all configured channels."""
    meta = metadata or {}
    for channel in get_notification_channels():
        try:
            await channel.send(user_id=user_id, subject=subject, body=body, metadata=meta)
        except Exception as exc:
            logger.exception(
                "Notification channel %s failed for user_id=%d: %s",
                type(channel).__name__,
                user_id,
                exc,
            )
