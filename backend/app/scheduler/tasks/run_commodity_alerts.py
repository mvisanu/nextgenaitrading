"""
Scheduler task: check commodity buy signals and notify users.

Runs every N minutes (default 15). For each user who has commodity alert
prefs with email or SMS enabled, evaluates their watched symbols and fires
notifications when:
  - buy_signal is True
  - confidence >= user's min_confidence threshold
  - cooldown_minutes have elapsed since last alert

This task uses real yfinance data — it does NOT use the mock signal
generator in api/gold.py.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.commodity_alert_prefs import CommodityAlertPrefs
from app.services.commodity_signal_service import evaluate_signal
from app.services.notification_service import send_email, send_sms

logger = logging.getLogger(__name__)


def _build_email_body(symbol: str, price: float, confidence: int, reason: str) -> str:
    return (
        f"NextGenAi Trading — Commodity BUY Signal\n"
        f"{'=' * 45}\n\n"
        f"Symbol:     {symbol}\n"
        f"Price:      {price:,.4f}\n"
        f"Confidence: {confidence}%\n\n"
        f"Analysis:\n{reason}\n\n"
        f"{'─' * 45}\n"
        f"This is an educational signal — not financial advice.\n"
        f"Always use proper risk management.\n\n"
        f"Manage alerts: http://localhost:3000/gold\n"
    )


def _build_sms_body(symbol: str, price: float, confidence: int) -> str:
    return (
        f"NextGenAi Trading: BUY signal for {symbol} @ {price:,.2f} "
        f"(confidence {confidence}%). Educational only — not financial advice."
    )


async def run_commodity_alerts() -> None:
    """
    Evaluate commodity signals for all users with active alert prefs.
    """
    logger.info("run_commodity_alerts: starting")

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(CommodityAlertPrefs).where(
                    (CommodityAlertPrefs.email_enabled == True)  # noqa: E712
                    | (CommodityAlertPrefs.sms_enabled == True)  # noqa: E712
                )
            )
            prefs_list: list[CommodityAlertPrefs] = list(result.scalars().all())

        if not prefs_list:
            logger.debug("run_commodity_alerts: no users with active alert prefs")
            return

        logger.info("run_commodity_alerts: checking %d user pref(s)", len(prefs_list))

        # Deduplicate symbols across all users to minimise yfinance calls
        all_symbols: set[str] = set()
        for prefs in prefs_list:
            for sym in (prefs.symbols or ["XAUUSD"]):
                all_symbols.add(sym.upper())

        # Fetch signals once per symbol
        signal_cache: dict[str, object] = {}
        for sym in all_symbols:
            signal_cache[sym] = evaluate_signal(sym)

        now = datetime.now(timezone.utc)
        alerts_sent = 0

        for prefs in prefs_list:
            symbols = [s.upper() for s in (prefs.symbols or ["XAUUSD"])]

            # Cooldown check
            if prefs.last_alerted_at:
                elapsed = (now - prefs.last_alerted_at).total_seconds() / 60
                if elapsed < prefs.cooldown_minutes:
                    logger.debug(
                        "run_commodity_alerts: user_id=%d in cooldown (%.1f/%d min)",
                        prefs.user_id,
                        elapsed,
                        prefs.cooldown_minutes,
                    )
                    continue

            for sym in symbols:
                sig = signal_cache.get(sym)
                if sig is None:
                    logger.warning("run_commodity_alerts: no signal data for %s", sym)
                    continue

                if not sig.buy_signal:
                    logger.debug("run_commodity_alerts: %s — no buy signal", sym)
                    continue

                if sig.confidence < prefs.min_confidence:
                    logger.debug(
                        "run_commodity_alerts: %s confidence %d < threshold %d",
                        sym,
                        sig.confidence,
                        prefs.min_confidence,
                    )
                    continue

                subject = f"BUY Signal: {sym} @ {sig.current_price:,.2f} ({sig.confidence}% confidence)"

                if prefs.email_enabled and prefs.alert_email:
                    send_email(
                        to_address=prefs.alert_email,
                        subject=subject,
                        body_text=_build_email_body(
                            sym, sig.current_price, sig.confidence, sig.reason
                        ),
                    )

                if prefs.sms_enabled and prefs.alert_phone:
                    send_sms(
                        to_number=prefs.alert_phone,
                        body=_build_sms_body(sym, sig.current_price, sig.confidence),
                    )

                alerts_sent += 1

                # Update last_alerted_at after first symbol fires for this user
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(CommodityAlertPrefs).where(
                            CommodityAlertPrefs.id == prefs.id
                        )
                    )
                    row = result.scalar_one_or_none()
                    if row:
                        row.last_alerted_at = now
                        await db.commit()

                # Only alert once per user per run (first matching symbol wins)
                break

        logger.info(
            "run_commodity_alerts: complete — users=%d alerts_sent=%d",
            len(prefs_list),
            alerts_sent,
        )

    except Exception as exc:
        logger.exception("run_commodity_alerts: job failed: %s", exc)
