"""FastAPI router for Options Trading Engine — /api/v4/options

All routes require authenticated user via Supabase JWT.
All DB queries scoped to current_user.id.
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.options import OptionsExecution, OptionsPosition, IVHistory
from app.schemas.options import (
    ExecuteSignalIn,
    ExecutionResultOut,
    ExpirationsOut,
    IVRankOut,
    OptionContractOut,
    OptionsExecutionOut,
    OptionsPositionOut,
    OptionsRiskModelOut,
    OptionsSignalOut,
    PortfolioGreeksOut,
    ScanFilterIn,
    SignalLegOut,
)
from app.options.broker import get_options_broker
from app.options.broker.base import OptionContract
from app.options.greeks import compute_greeks
from app.options.iv import compute_iv_rank, compute_iv_percentile, get_iv_history
from app.options.scanner import OptionsScannerFilter, run_scan
from app.options.signals import SignalConfig, OptionsSignal, evaluate_signal
from app.options.risk import model_risk
from app.options.calendar import get_days_to_earnings
from app.options.executor import OptionsExecutor
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["options"])


def _contract_to_out(c: OptionContract) -> OptionContractOut:
    return OptionContractOut(
        symbol=c.symbol,
        expiration=c.expiration,
        strike=c.strike,
        option_type=c.option_type,  # type: ignore[arg-type]
        bid=c.bid,
        ask=c.ask,
        mid=c.mid,
        volume=c.volume,
        open_interest=c.open_interest,
        implied_volatility=c.implied_volatility,
        delta=c.delta,
        gamma=c.gamma,
        theta=c.theta,
        vega=c.vega,
        illiquid=c.illiquid,
    )


def _get_broker():
    broker_name = getattr(settings, "options_active_broker", "alpaca")
    return get_options_broker(broker_name)


# ─── GET /expirations ─────────────────────────────────────────────────────────

@router.get("/expirations", response_model=ExpirationsOut)
async def get_expirations(
    symbol: str = Query(..., min_length=1, max_length=20),
    current_user: User = Depends(get_current_user),
):
    broker = _get_broker()
    try:
        dates = await broker.get_expirations(symbol.upper())
    except Exception as exc:
        logger.error("get_expirations error for %s: %s", symbol, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch expirations from broker")
    return ExpirationsOut(symbol=symbol.upper(), expirations=dates)


# ─── GET /chain ───────────────────────────────────────────────────────────────

@router.get("/chain", response_model=list[OptionContractOut])
async def get_chain(
    symbol: str = Query(..., min_length=1, max_length=20),
    expiration: date = Query(...),
    underlying_price: float = Query(default=100.0, gt=0.0),
    current_user: User = Depends(get_current_user),
):
    broker = _get_broker()
    try:
        chain = await broker.get_options_chain(symbol.upper(), expiration)
    except Exception as exc:
        logger.error("get_chain error for %s: %s", symbol, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch options chain from broker")

    chain = compute_greeks(chain, underlying_price)
    return [_contract_to_out(c) for c in chain]


# ─── POST /scan ───────────────────────────────────────────────────────────────

@router.post("/scan", response_model=list[OptionContractOut])
async def scan(
    body: ScanFilterIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    broker = _get_broker()
    f = OptionsScannerFilter(
        symbol=body.symbol.upper(),
        expiration=body.expiration,
        min_delta=body.min_delta,
        max_delta=body.max_delta,
        min_oi=body.min_oi,
        min_volume=body.min_volume,
        min_iv_rank=body.min_iv_rank,
        strategy_bias=body.strategy_bias,
    )
    try:
        contracts = await run_scan(f, broker, body.underlying_price, db)
    except Exception as exc:
        logger.error("scan error: %s", exc)
        raise HTTPException(status_code=502, detail="Options scan failed")
    return [_contract_to_out(c) for c in contracts]


# ─── GET /signals ─────────────────────────────────────────────────────────────

@router.get("/signals", response_model=list[OptionsSignalOut])
async def get_signals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate signals for the user's watchlist symbols."""
    from app.models.user_watchlist import UserWatchlist

    result = await db.execute(
        select(UserWatchlist).where(UserWatchlist.user_id == current_user.id).limit(20)
    )
    watchlist = result.scalars().all()
    symbols_env = getattr(settings, "options_scanner_symbols", "AAPL,TSLA,NVDA,SPY,QQQ")
    default_symbols = [s.strip() for s in symbols_env.split(",") if s.strip()]
    symbols = [w.ticker for w in watchlist] if watchlist else default_symbols

    broker = _get_broker()
    config = SignalConfig(
        earnings_block_days=getattr(settings, "options_earnings_block_days", 5),
        min_iv_rank=getattr(settings, "options_min_iv_rank", 30.0),
        min_pop=getattr(settings, "options_min_pop", 0.60),
        max_single_trade_loss=getattr(settings, "options_max_single_trade_loss", 500.0),
    )
    signals: list[OptionsSignalOut] = []

    for sym in symbols[:10]:
        try:
            # Get nearest expiration
            exps = await broker.get_expirations(sym)
            if not exps:
                continue
            exp = exps[0]
            chain = await broker.get_options_chain(sym, exp)
            if not chain:
                continue

            history = await get_iv_history(sym, db)
            sample_iv = next((c.implied_volatility for c in chain if c.implied_volatility > 0), 0.30)
            iv_rank = compute_iv_rank(sample_iv, history)
            iv_pct = compute_iv_percentile(sample_iv, history)
            days_to_earnings = await get_days_to_earnings(sym)

            # Derive underlying trend from IV (simplified — real impl uses TA)
            underlying_trend = "neutral"
            chain = compute_greeks(chain, 100.0)  # placeholder price

            signal = evaluate_signal(sym, chain, iv_rank, iv_pct, underlying_trend, days_to_earnings, config)

            legs = [
                SignalLegOut(
                    symbol=c.symbol,
                    strike=c.strike,
                    option_type=c.option_type,  # type: ignore[arg-type]
                    expiration=c.expiration,
                    delta=c.delta,
                    theta=c.theta,
                )
                for c in signal.contract_legs
            ]
            signals.append(OptionsSignalOut(
                symbol=signal.symbol,
                strategy=signal.strategy,
                confidence=signal.confidence,
                iv_rank=signal.iv_rank,
                iv_percentile=signal.iv_percentile,
                underlying_trend=signal.underlying_trend,
                days_to_earnings=signal.days_to_earnings,
                signal_time=signal.signal_time,
                blocked=signal.blocked,
                block_reason=signal.block_reason,
                legs=legs,
            ))
        except Exception as exc:
            logger.warning("Signal generation failed for %s: %s", sym, exc)

    return signals


# ─── GET /positions ───────────────────────────────────────────────────────────

@router.get("/positions", response_model=list[OptionsPositionOut])
async def get_positions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OptionsPosition)
        .where(OptionsPosition.user_id == current_user.id)
        .where(OptionsPosition.status == "open")
        .order_by(OptionsPosition.opened_at.desc())
        .limit(50)
    )
    return result.scalars().all()


# ─── POST /execute ────────────────────────────────────────────────────────────

@router.post("/execute", response_model=ExecutionResultOut)
async def execute_signal(
    body: ExecuteSignalIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a signal. Dry-run by default; live requires dry_run=False."""
    from app.options.broker.base import OptionContract as OC
    from datetime import date as date_type

    broker = _get_broker()
    config = SignalConfig(
        earnings_block_days=getattr(settings, "options_earnings_block_days", 5),
        min_iv_rank=getattr(settings, "options_min_iv_rank", 30.0),
        min_pop=getattr(settings, "options_min_pop", 0.60),
        max_single_trade_loss=getattr(settings, "options_max_single_trade_loss", 500.0),
    )

    # Reconstruct OptionContract objects from input legs
    contracts = [
        OC(
            symbol=leg.symbol,
            expiration=leg.expiration,
            strike=leg.strike,
            option_type=leg.option_type,
            bid=0.0,
            ask=0.0,
            mid=0.0,
            volume=0,
            open_interest=0,
            implied_volatility=0.0,
            delta=leg.delta,
            theta=leg.theta,
        )
        for leg in body.legs
    ]

    signal = OptionsSignal(
        symbol=body.symbol,
        strategy=body.strategy,
        contract_legs=contracts,
        confidence=body.confidence,
        iv_rank=body.iv_rank,
        iv_percentile=body.iv_percentile,
        underlying_trend=body.underlying_trend,
        days_to_earnings=None,
        signal_time=datetime.utcnow(),
        blocked=False,
        block_reason=None,
    )

    executor = OptionsExecutor(broker=broker, config=config)
    result = await executor.execute_signal(
        signal=signal,
        underlying_price=body.underlying_price,
        user_id=current_user.id,
        dry_run=body.dry_run,
        db=db,
    )

    risk_out = None
    if result.risk_model:
        rm = result.risk_model
        risk_out = OptionsRiskModelOut(
            max_profit=rm.max_profit,
            max_loss=rm.max_loss,
            breakeven_prices=rm.breakeven_prices,
            profit_at_expiry={str(k): v for k, v in rm.profit_at_expiry.items()},
            probability_of_profit=rm.probability_of_profit,
            risk_reward_ratio=rm.risk_reward_ratio,
            theta_per_day=rm.theta_per_day,
            days_to_expiry=rm.days_to_expiry,
            margin_required=rm.margin_required,
            passes_risk_gate=rm.passes_risk_gate,
            risk_gate_failures=rm.risk_gate_failures,
        )

    return ExecutionResultOut(
        symbol=result.symbol,
        status=result.status,
        block_reason=result.block_reason,
        order_id=result.order_id,
        dry_run=result.dry_run,
        risk_model=risk_out,
    )


# ─── GET /risk ────────────────────────────────────────────────────────────────

@router.get("/risk", response_model=OptionsRiskModelOut)
async def get_risk(
    symbol: str = Query(...),
    strategy: str = Query(...),
    underlying_price: float = Query(default=100.0, gt=0.0),
    current_user: User = Depends(get_current_user),
):
    """Return a stub risk model — used for quick previews before execution."""
    from app.options.signals import OptionsSignal as OS
    stub = OS(
        symbol=symbol,
        strategy=strategy,
        contract_legs=[],
        confidence=0.0,
        iv_rank=0.0,
        iv_percentile=0.0,
        underlying_trend="neutral",
        days_to_earnings=None,
        signal_time=datetime.utcnow(),
        blocked=True,
        block_reason="No legs provided",
    )
    config = SignalConfig()
    risk = model_risk(stub, config, underlying_price)
    return OptionsRiskModelOut(
        max_profit=risk.max_profit,
        max_loss=risk.max_loss,
        breakeven_prices=risk.breakeven_prices,
        profit_at_expiry={str(k): v for k, v in risk.profit_at_expiry.items()},
        probability_of_profit=risk.probability_of_profit,
        risk_reward_ratio=risk.risk_reward_ratio,
        theta_per_day=risk.theta_per_day,
        days_to_expiry=risk.days_to_expiry,
        margin_required=risk.margin_required,
        passes_risk_gate=risk.passes_risk_gate,
        risk_gate_failures=risk.risk_gate_failures,
    )


# ─── GET /greeks/portfolio ────────────────────────────────────────────────────

@router.get("/greeks/portfolio", response_model=PortfolioGreeksOut)
async def portfolio_greeks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OptionsPosition)
        .where(OptionsPosition.user_id == current_user.id)
        .where(OptionsPosition.status == "open")
    )
    positions = result.scalars().all()

    net_delta = net_gamma = net_theta = net_vega = 0.0
    for pos in positions:
        for leg in (pos.legs or []):
            net_delta += leg.get("delta", 0.0)
            net_gamma += leg.get("gamma", 0.0)
            net_theta += leg.get("theta", 0.0)
            net_vega += leg.get("vega", 0.0)

    return PortfolioGreeksOut(
        net_delta=round(net_delta, 4),
        net_gamma=round(net_gamma, 6),
        net_theta=round(net_theta, 4),
        net_vega=round(net_vega, 4),
        position_count=len(positions),
    )


# ─── GET /iv/{symbol} ────────────────────────────────────────────────────────

@router.get("/iv/{symbol}", response_model=IVRankOut)
async def get_iv_rank(
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    history = await get_iv_history(symbol.upper(), db)
    broker = _get_broker()
    try:
        exps = await broker.get_expirations(symbol.upper())
        if exps:
            chain = await broker.get_options_chain(symbol.upper(), exps[0])
            sample_iv = next((c.implied_volatility for c in chain if c.implied_volatility > 0), 0.0)
        else:
            sample_iv = 0.0
    except Exception:
        sample_iv = 0.0

    iv_rank = compute_iv_rank(sample_iv, history)
    iv_pct = compute_iv_percentile(sample_iv, history)
    return IVRankOut(symbol=symbol.upper(), current_iv=sample_iv, iv_rank=iv_rank, iv_percentile=iv_pct)


# ─── GET /executions ─────────────────────────────────────────────────────────

@router.get("/executions", response_model=list[OptionsExecutionOut])
async def get_executions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
):
    result = await db.execute(
        select(OptionsExecution)
        .where(OptionsExecution.user_id == current_user.id)
        .order_by(OptionsExecution.executed_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
