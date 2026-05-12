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


from decimal import Decimal

from app.models.btc_bot import BtcBotSession
from app.services.btc_bot_service import SessionState


def _build_session_state(session: Optional[BtcBotSession]) -> SessionState:
    """Project a DB row (or None) into the immutable SessionState the decision fn needs."""
    if session is None:
        return SessionState(
            status="no_session",
            original_entry=None,
            blended_entry=None,
            total_qty=Decimal("0"),
            current_floor=None,
            trailing_active=False,
            trailing_high=None,
            ladder_next=0,
            cooldown_until=None,
        )
    return SessionState(
        status=session.status,  # type: ignore[arg-type]
        original_entry=session.original_entry_price,
        blended_entry=session.blended_entry_price,
        total_qty=session.total_qty or Decimal("0"),
        current_floor=session.current_floor,
        trailing_active=session.trailing_active,
        trailing_high=session.trailing_high,
        ladder_next=session.ladder_next,
        cooldown_until=session.cooldown_until,
    )


from app.models.btc_bot import BtcBotAction


def _record_action(
    db,
    *,
    session_id: int,
    user_id: int,
    action: str,
    btc_price: Optional[Decimal] = None,
    qty_delta: Optional[Decimal] = None,
    usd_delta: Optional[Decimal] = None,
    floor_before: Optional[Decimal] = None,
    floor_after: Optional[Decimal] = None,
    alpaca_order_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> None:
    """Insert one row into btc_bot_actions. Caller commits later."""
    row = BtcBotAction(
        session_id=session_id,
        user_id=user_id,
        action=action,
        btc_price=btc_price,
        qty_delta=qty_delta,
        usd_delta=usd_delta,
        floor_before=floor_before,
        floor_after=floor_after,
        alpaca_order_id=alpaca_order_id,
        notes=notes,
    )
    db.add(row)


def _record_error(db, session: Optional[BtcBotSession], reason: str) -> None:
    """Write an `error` action row. If we have no session yet, skip (nothing to attach to)."""
    if session is None:
        logger.error("btc_bot: error before session existed: %s", reason)
        return
    _record_action(
        db,
        session_id=session.id,
        user_id=session.user_id,
        action="error",
        notes=reason[:5000],
    )


from datetime import datetime, timedelta
from app.services.btc_bot_service import (
    AdoptPosition,
    AdvanceTrailing,
    ExitCooldown,
    FLOOR_MULT,
    Idle,
    InitialBuy,
    LadderBuy,
    StopOut,
    TickAction,
    compute_blended_entry,
    compute_new_floor_up_only,
)


def _apply_action(
    db,
    client,
    *,
    session: Optional[BtcBotSession],
    user_id: int,
    action: TickAction,
    price: Decimal,
    now_utc: datetime,
) -> Optional[BtcBotSession]:
    """Execute one TickAction. Returns the (possibly newly-created) session."""
    if isinstance(action, Idle):
        return session

    if isinstance(action, InitialBuy):
        fill = client.market_buy(usd_amount=action.usd_amount)
        new_session = BtcBotSession(
            user_id=user_id,
            status="active",
            original_entry_price=fill["filled_price"],
            blended_entry_price=fill["filled_price"],
            total_qty=fill["filled_qty"],
            initial_buy_usd=action.usd_amount,
            current_floor=(fill["filled_price"] * FLOOR_MULT).quantize(Decimal("0.01")),
            trailing_active=False,
            trailing_high=None,
            ladder_next=0,
            last_action_at=now_utc,
        )
        db.add(new_session)
        try:
            db.flush()
        except Exception:
            pass
        _record_action(
            db,
            session_id=new_session.id or 0,
            user_id=user_id,
            action="initial_buy",
            btc_price=fill["filled_price"],
            qty_delta=fill["filled_qty"],
            usd_delta=action.usd_amount,
            floor_after=new_session.current_floor,
            alpaca_order_id=fill["order_id"],
        )
        return new_session

    if isinstance(action, AdoptPosition):
        new_session = BtcBotSession(
            user_id=user_id,
            status="active",
            original_entry_price=action.avg_entry,
            blended_entry_price=action.avg_entry,
            total_qty=action.qty,
            initial_buy_usd=Decimal(str(settings.btc_bot_initial_usd)),
            current_floor=(action.avg_entry * FLOOR_MULT).quantize(Decimal("0.01")),
            trailing_active=False,
            trailing_high=None,
            ladder_next=0,
            last_action_at=now_utc,
        )
        db.add(new_session)
        try:
            db.flush()
        except Exception:
            pass
        _record_action(
            db,
            session_id=new_session.id or 0,
            user_id=user_id,
            action="adopted_position",
            btc_price=price,
            qty_delta=action.qty,
            floor_after=new_session.current_floor,
            notes=f"Adopted Alpaca position: avg_entry=${action.avg_entry} qty={action.qty}",
        )
        return new_session

    assert session is not None, f"_apply_action({action.__class__.__name__}) requires existing session"

    if isinstance(action, LadderBuy):
        floor_before = session.current_floor
        fill = client.market_buy(usd_amount=action.usd_amount)
        new_blended = compute_blended_entry(
            prior_qty=session.total_qty,
            prior_blended=session.blended_entry_price,
            fill_qty=fill["filled_qty"],
            fill_price=fill["filled_price"],
        )
        new_total_qty = (session.total_qty + fill["filled_qty"]).quantize(Decimal("0.00000001"))
        proposed_floor = (new_blended * FLOOR_MULT).quantize(Decimal("0.01"))
        new_floor = compute_new_floor_up_only(session.current_floor, proposed_floor)

        session.blended_entry_price = new_blended
        session.total_qty = new_total_qty
        session.current_floor = new_floor
        session.ladder_next = action.level
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action=f"ladder_l{action.level}",
            btc_price=fill["filled_price"],
            qty_delta=fill["filled_qty"],
            usd_delta=action.usd_amount,
            floor_before=floor_before,
            floor_after=new_floor,
            alpaca_order_id=fill["order_id"],
        )
        return session

    if isinstance(action, AdvanceTrailing):
        floor_before = session.current_floor
        session.current_floor = action.new_floor
        session.trailing_high = action.new_trailing_high
        session.trailing_active = True
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="trailing_activate" if action.activated_now else "trailing_advance",
            btc_price=price,
            floor_before=floor_before,
            floor_after=action.new_floor,
        )
        return session

    if isinstance(action, StopOut):
        floor_before = session.current_floor
        qty_to_sell = session.total_qty
        fill = client.market_sell_all(qty=qty_to_sell)
        proceeds = fill["filled_qty"] * fill["filled_price"]
        cost_basis = qty_to_sell * session.blended_entry_price
        realized = (proceeds - cost_basis).quantize(Decimal("0.01"))

        session.status = "cooldown"
        session.cooldown_until = now_utc + timedelta(minutes=settings.btc_bot_cooldown_minutes)
        session.realized_pnl = realized
        session.total_qty = Decimal("0")
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="stop_out",
            btc_price=fill["filled_price"],
            qty_delta=-qty_to_sell,
            usd_delta=proceeds,
            floor_before=floor_before,
            alpaca_order_id=fill["order_id"],
            notes=action.reason,
        )
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="cooldown_start",
            notes=f"cooldown until {session.cooldown_until.isoformat()}",
        )
        return session

    if isinstance(action, ExitCooldown):
        session.status = "ended"
        session.ended_at = now_utc
        session.last_action_at = now_utc
        _record_action(
            db,
            session_id=session.id,
            user_id=user_id,
            action="cooldown_exit",
            notes="Cooldown expired; session ended. Next tick will fire InitialBuy.",
        )
        return session

    raise RuntimeError(f"Unknown TickAction type: {type(action).__name__}")


import asyncio
import gc
from datetime import timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.btc_bot_client import BtcBotClient
from app.db.session import AsyncSessionLocal
from app.services.btc_bot_service import evaluate_tick


async def _load_users_to_tick(db: AsyncSession) -> list[User]:
    """Users with active/cooldown sessions PLUS the bootstrap user (if configured)."""
    result = await db.execute(
        select(User).join(
            BtcBotSession, BtcBotSession.user_id == User.id
        ).where(
            BtcBotSession.status.in_(("active", "cooldown"))
        ).distinct()
    )
    users = list(result.scalars().all())
    user_ids_present = {u.id for u in users}

    if settings.btc_bot_bootstrap_user_email:
        bootstrap_result = await db.execute(
            select(User).where(User.email == settings.btc_bot_bootstrap_user_email)
        )
        bootstrap = bootstrap_result.scalars().first()
        if bootstrap and bootstrap.id not in user_ids_present:
            users.append(bootstrap)

    return users


async def _load_active_session(db: AsyncSession, user_id: int) -> Optional[BtcBotSession]:
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.user_id == user_id,
            BtcBotSession.status.in_(("active", "cooldown")),
        ).limit(1)
    )
    return result.scalars().first()


async def _load_broker_cred(db: AsyncSession, session: Optional[BtcBotSession]) -> Optional[BrokerCredential]:
    if session is None or session.credential_id is None:
        return None
    result = await db.execute(
        select(BrokerCredential).where(BrokerCredential.id == session.credential_id)
    )
    return result.scalars().first()


async def _tick_one_user(db: AsyncSession, user: User, now_utc: datetime) -> None:
    """Single-user tick. Must NEVER raise — log + record_error on failure."""
    session = await _load_active_session(db, user.id)
    broker_cred = await _load_broker_cred(db, session)

    creds = _resolve_creds_for_user(user, broker_cred)
    if creds is None:
        logger.info("btc_bot: user %d has no usable credentials — skipping", user.id)
        return
    api_key, secret_key = creds

    try:
        client = BtcBotClient(api_key=api_key, secret_key=secret_key, paper=True)
        price = client.get_btc_ask()
        position = client.get_btc_position()
    except Exception as exc:
        logger.exception("btc_bot: read failure for user %d: %s", user.id, exc)
        _record_error(db, session, f"Alpaca read failure: {exc}")
        return

    state = _build_session_state(session)
    alpaca_qty = position["qty"] if position else Decimal("0")
    alpaca_avg = position["avg_entry_price"] if position else None
    initial_usd = (
        session.initial_buy_usd if session
        else Decimal(str(settings.btc_bot_initial_usd))
    )

    action = evaluate_tick(
        state,
        current_price=price,
        alpaca_position_qty=alpaca_qty,
        alpaca_avg_entry=alpaca_avg,
        initial_buy_usd=initial_usd,
        now_utc=now_utc,
    )
    logger.info("btc_bot: user=%d action=%s price=%s", user.id, type(action).__name__, price)

    try:
        _apply_action(
            db, client,
            session=session,
            user_id=user.id,
            action=action,
            price=price,
            now_utc=now_utc,
        )
    except Exception as exc:
        logger.exception("btc_bot: apply failure for user %d action=%s: %s", user.id, type(action).__name__, exc)
        _record_error(db, session, f"Apply {type(action).__name__} failed: {exc}")


async def _run_monitor() -> None:
    now_utc = datetime.now(timezone.utc)
    logger.info("btc_bot_monitor: starting at %s", now_utc.isoformat())
    try:
        async with AsyncSessionLocal() as db:
            users = await _load_users_to_tick(db)
            if not users:
                logger.info("btc_bot_monitor: no users to tick")
                return
            logger.info("btc_bot_monitor: ticking %d user(s)", len(users))
            for user in users:
                try:
                    await _tick_one_user(db, user, now_utc)
                except Exception as exc:
                    logger.exception("btc_bot: unhandled error in tick for user %d: %s", user.id, exc)
            await db.commit()
    except Exception as exc:
        logger.exception("btc_bot_monitor: job failed: %s", exc)
    finally:
        gc.collect()


def monitor_btc_bots() -> None:
    """Synchronous APScheduler entry point (plural — the trader)."""
    asyncio.run(_run_monitor())


# Backward-compat alias for jobs.py until Task 17 rewires (will be removed there).
monitor_btc_bot = monitor_btc_bots
