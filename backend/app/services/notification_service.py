"""
Notification abstraction layer.

Route notifications through this abstraction so channels can be added
without changing alert logic.

v2: InAppNotification (log-based).
v4 (commodity alerts): Real SMTP email + Twilio SMS implemented.
  Set SMTP_* env vars to enable email.
  Set TWILIO_* env vars to enable SMS.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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


# ── Real delivery helpers (commodity alerts) ──────────────────────────────────

def send_email(to_address: str, subject: str, body_text: str) -> None:
    """
    Send a plain-text email via SMTP.

    Requires env vars:
      SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
    Falls back to a log warning if any var is missing.
    """
    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_pass]):
        logger.warning(
            "send_email: SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). "
            "Would have emailed %s: %s",
            to_address,
            subject,
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_address
    msg.attach(MIMEText(body_text, "plain"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.login(settings.smtp_user, settings.smtp_pass)
            smtp.sendmail(msg["From"], to_address, msg.as_string())
        logger.info("Email sent to %s: %s", to_address, subject)
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_address, exc)


def send_sms(to_number: str, body: str) -> None:
    """
    Send an SMS via Twilio.

    Requires env vars:
      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
    Falls back to a log warning if any var is missing.
    """
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number]):
        logger.warning(
            "send_sms: Twilio not configured. Would have texted %s: %s",
            to_number,
            body[:80],
        )
        return

    try:
        from twilio.rest import Client  # type: ignore[import]
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message = client.messages.create(
            body=body,
            from_=settings.twilio_from_number,
            to=to_number,
        )
        logger.info("SMS sent to %s (SID=%s): %s", to_number, message.sid, body[:60])
    except ImportError:
        logger.error("twilio package not installed — run: pip install twilio")
    except Exception as exc:
        logger.error("Failed to send SMS to %s: %s", to_number, exc)


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
