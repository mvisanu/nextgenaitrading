"""Wheel Strategy Bot — state machine core logic."""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.wheel_alpaca_client import WheelAlpacaClient
from app.models.wheel_bot import WheelBotSession

logger = logging.getLogger(__name__)


async def _sell_new_put(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> None:
    """Select and sell a cash-secured put 10% OTM, expiration 14-28 days out."""
    price = await client.get_stock_latest_price(session.symbol)
    strike_target = round(price * 0.90, 2)

    account = await client.get_account()
    cash = float(account.get("cash", 0))
    if cash < strike_target * 100:
        session.last_action = (
            f"Insufficient cash (${cash:,.2f}) to sell put at strike "
            f"${strike_target:.2f} (requires ${strike_target * 100:,.2f})."
        )
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        return

    expirations = await client.get_expirations(session.symbol)
    target_exp = client.pick_expiration(expirations, min_days=14, max_days=28)
    if not target_exp:
        session.last_action = "No expiration found in 14–28 day range."
        return

    contracts = await client.get_options_chain(session.symbol, target_exp, "put")
    contract = client.closest_strike(contracts, target=strike_target)
    if not contract:
        session.last_action = f"No liquid put contract found near strike ${strike_target:.2f}."
        return

    premium = client.mid_price(contract)
    if premium <= 0:
        session.last_action = f"Put {contract['symbol']} has no bid — skipping."
        return

    limit = round(premium * 0.95, 2)
    order = await client.sell_to_open(contract["symbol"], qty=1, limit_price=limit, dry_run=session.dry_run)

    session.active_contract_symbol = contract["symbol"]
    session.active_order_id = order["order_id"]
    session.active_premium_received = premium
    session.active_strike = float(contract["strike_price"])
    session.active_expiry = target_exp.isoformat()
    session.total_premium_collected += premium * 100
    session.last_action = (
        f"Sold put {contract['symbol']} @ ${premium:.2f} premium. "
        f"Strike ${contract['strike_price']}, exp {target_exp}. "
        f"Total premium collected: ${session.total_premium_collected:,.2f}."
    )
    logger.info("wheel_bot session=%d: %s", session.id, session.last_action)


async def _handle_sell_put_stage(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> None:
    """Handle one monitor cycle while in Stage 1 (sell_put)."""
    if not session.active_contract_symbol:
        await _sell_new_put(session, client, db)
        return

    # Check assignment: do we now hold the underlying shares?
    position = await client.get_position(session.symbol)
    if position and float(position.get("qty", 0)) >= 100:
        fill_price = float(position["avg_entry_price"])
        premium_per_share = session.active_premium_received or 0.0
        session.stage = "sell_call"
        session.shares_qty = 100
        session.cost_basis_per_share = round(fill_price - premium_per_share, 4)
        session.active_contract_symbol = None
        session.active_order_id = None
        session.active_premium_received = None
        session.active_strike = None
        session.active_expiry = None
        session.last_action = (
            f"Assigned at ${fill_price:.2f}/share. "
            f"Cost basis: ${session.cost_basis_per_share:.2f} (after premium). "
            f"Moving to sell_call stage."
        )
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        return

    # Check expiry
    if session.active_expiry and date.today() > date.fromisoformat(session.active_expiry):
        session.active_contract_symbol = None
        session.active_order_id = None
        session.active_premium_received = None
        session.active_strike = None
        session.active_expiry = None
        session.last_action = "Put expired worthless. Will sell new put next cycle."
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        await _sell_new_put(session, client, db)
        return

    # Check 50% profit
    current_price = await client.get_option_current_price(session.active_contract_symbol)
    if (
        current_price is not None
        and session.active_premium_received
        and current_price <= session.active_premium_received * 0.50
    ):
        limit_close = round(current_price * 1.05, 2)
        await client.buy_to_close(
            session.active_contract_symbol, qty=1, limit_price=limit_close, dry_run=session.dry_run
        )
        session.last_action = (
            f"Early close: put {session.active_contract_symbol} "
            f"@ ${current_price:.2f} (50% of ${session.active_premium_received:.2f} premium). "
            f"Opening new put."
        )
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        session.active_contract_symbol = None
        session.active_order_id = None
        session.active_premium_received = None
        session.active_strike = None
        session.active_expiry = None
        await _sell_new_put(session, client, db)


async def _sell_new_call(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> None:
    """Select and sell a covered call 10% above cost basis, expiration 14-28 days out."""
    cost_basis = session.cost_basis_per_share or 0.0
    strike_target = round(cost_basis * 1.10, 2)

    expirations = await client.get_expirations(session.symbol)
    target_exp = client.pick_expiration(expirations, min_days=14, max_days=28)
    if not target_exp:
        session.last_action = "No expiration found in 14–28 day range."
        return

    contracts = await client.get_options_chain(session.symbol, target_exp, "call")
    contract = client.closest_strike(contracts, target=strike_target)
    if not contract:
        session.last_action = f"No liquid call contract found near strike ${strike_target:.2f}."
        return

    strike = float(contract["strike_price"])

    # RULE: never sell a call below cost basis
    if strike < cost_basis:
        session.last_action = (
            f"Call strike ${strike:.2f} is below cost basis ${cost_basis:.2f} — "
            f"not selling a call below cost basis."
        )
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        return

    premium = client.mid_price(contract)
    if premium <= 0:
        session.last_action = f"Call {contract['symbol']} has no bid — skipping."
        return

    limit = round(premium * 0.95, 2)
    order = await client.sell_to_open(contract["symbol"], qty=1, limit_price=limit, dry_run=session.dry_run)

    session.active_contract_symbol = contract["symbol"]
    session.active_order_id = order["order_id"]
    session.active_premium_received = premium
    session.active_strike = strike
    session.active_expiry = target_exp.isoformat()
    session.total_premium_collected += premium * 100
    session.last_action = (
        f"Sold call {contract['symbol']} @ ${premium:.2f} premium. "
        f"Strike ${strike:.2f} (cost basis ${cost_basis:.2f}), exp {target_exp}. "
        f"Total premium collected: ${session.total_premium_collected:,.2f}."
    )
    logger.info("wheel_bot session=%d: %s", session.id, session.last_action)


async def _handle_sell_call_stage(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> None:
    """Handle one monitor cycle while in Stage 2 (sell_call)."""
    if not session.active_contract_symbol:
        await _sell_new_call(session, client, db)
        return

    # Check if shares were called away
    position = await client.get_position(session.symbol)
    if position is None or float(position.get("qty", 0)) < 100:
        session.stage = "sell_put"
        session.shares_qty = 0
        session.cost_basis_per_share = None
        session.active_contract_symbol = None
        session.active_order_id = None
        session.active_premium_received = None
        session.active_strike = None
        session.active_expiry = None
        session.last_action = "Shares called away. Returning to sell_put stage."
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        return

    # Check expiry
    if session.active_expiry and date.today() > date.fromisoformat(session.active_expiry):
        session.active_contract_symbol = None
        session.active_order_id = None
        session.active_premium_received = None
        session.active_strike = None
        session.active_expiry = None
        session.last_action = "Call expired worthless. Will sell new call next cycle."
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        await _sell_new_call(session, client, db)
        return

    # Check 50% profit
    current_price = await client.get_option_current_price(session.active_contract_symbol)
    if (
        current_price is not None
        and session.active_premium_received
        and current_price <= session.active_premium_received * 0.50
    ):
        limit_close = round(current_price * 1.05, 2)
        await client.buy_to_close(
            session.active_contract_symbol, qty=1, limit_price=limit_close, dry_run=session.dry_run
        )
        session.last_action = (
            f"Early close: call {session.active_contract_symbol} "
            f"@ ${current_price:.2f} (50% of ${session.active_premium_received:.2f} premium). "
            f"Opening new call."
        )
        logger.info("wheel_bot session=%d: %s", session.id, session.last_action)
        session.active_contract_symbol = None
        session.active_order_id = None
        session.active_premium_received = None
        session.active_strike = None
        session.active_expiry = None
        await _sell_new_call(session, client, db)


async def check_and_act(
    session: WheelBotSession,
    client: WheelAlpacaClient,
    db: AsyncSession,
) -> None:
    """Dispatch one monitor cycle for the given session."""
    if session.stage == "sell_put":
        await _handle_sell_put_stage(session, client, db)
    elif session.stage == "sell_call":
        await _handle_sell_call_stage(session, client, db)
    else:
        logger.warning("wheel_bot session=%d: unknown stage '%s'", session.id, session.stage)


async def generate_daily_summary(
    session: WheelBotSession,
    client: WheelAlpacaClient,
) -> dict:
    """Build the end-of-day summary dict for one session."""
    account = await client.get_account()
    equity = float(account.get("equity", 0))
    cash = float(account.get("cash", 0))

    starting_equity = equity - session.total_premium_collected
    total_return_pct = (
        round(session.total_premium_collected / starting_equity * 100, 2)
        if starting_equity > 0
        else 0.0
    )

    tsla_pos = await client.get_position(session.symbol)

    return {
        "session_id": session.id,
        "date": str(date.today()),
        "stage": session.stage,
        "symbol": session.symbol,
        "active_contract_symbol": session.active_contract_symbol,
        "active_strike": session.active_strike,
        "active_expiry": session.active_expiry,
        "shares_qty": session.shares_qty,
        "cost_basis_per_share": session.cost_basis_per_share,
        "total_premium_collected": session.total_premium_collected,
        "account_equity": equity,
        "account_cash": cash,
        "total_return_pct": total_return_pct,
        "tsla_position": tsla_pos,
        "last_action": session.last_action,
    }
