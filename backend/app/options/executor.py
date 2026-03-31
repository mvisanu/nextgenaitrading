"""Options execution orchestrator.

Mirrors the auto-buy engine pattern:
- Dry-run by default — live requires explicit dry_run=False
- Every attempt logged to options_executions table
- Signal → risk gate → broker order
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.options import OptionsExecution, OptionsPosition
from .broker.base import OptionsBrokerBase, OptionsOrderRequest
from .risk import model_risk, OptionsRiskModel
from .signals import OptionsSignal, SignalConfig

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    symbol: str
    status: str       # "skipped", "risk_blocked", "simulated", "submitted", "error"
    block_reason: Optional[str]
    order_id: Optional[str]
    risk_model: Optional[OptionsRiskModel]
    dry_run: bool

    @classmethod
    def skipped(cls, symbol: str, reason: str) -> "ExecutionResult":
        return cls(symbol=symbol, status="skipped", block_reason=reason,
                   order_id=None, risk_model=None, dry_run=True)

    @classmethod
    def risk_blocked(cls, symbol: str, failures: list[str], risk: OptionsRiskModel) -> "ExecutionResult":
        return cls(symbol=symbol, status="risk_blocked",
                   block_reason="; ".join(failures), order_id=None, risk_model=risk, dry_run=True)


class OptionsExecutor:
    def __init__(
        self,
        broker: OptionsBrokerBase,
        config: SignalConfig,
    ) -> None:
        self.broker = broker
        self.config = config

    async def execute_signal(
        self,
        signal: OptionsSignal,
        underlying_price: float,
        user_id: int,
        dry_run: bool,
        db: AsyncSession,
    ) -> ExecutionResult:
        if signal.blocked:
            result = ExecutionResult.skipped(signal.symbol, signal.block_reason or "Signal blocked")
            await self._log(signal, None, result, user_id, dry_run, db)
            return result

        risk = model_risk(signal, self.config, underlying_price)

        if not risk.passes_risk_gate:
            result = ExecutionResult.risk_blocked(signal.symbol, risk.risk_gate_failures, risk)
            await self._log(signal, risk, result, user_id, dry_run, db)
            return result

        # Build order request
        from .broker.base import OptionsOrderLeg
        legs = [
            OptionsOrderLeg(contract=c, action="sell", quantity=1)
            for c in signal.contract_legs
        ]
        order_req = OptionsOrderRequest(
            strategy=signal.strategy,
            underlying=signal.symbol,
            legs=legs,
            order_type="limit",
            limit_credit=sum(c.mid for c in signal.contract_legs if signal.strategy in {
                "cash_secured_put", "covered_call", "iron_condor", "bull_put_spread", "bear_call_spread"
            }),
            dry_run=dry_run,
        )

        try:
            order_result = await self.broker.submit_order(order_req)
            exec_result = ExecutionResult(
                symbol=signal.symbol,
                status=order_result.status,
                block_reason=None,
                order_id=order_result.order_id,
                risk_model=risk,
                dry_run=dry_run,
            )
            # Persist position record
            await self._save_position(signal, risk, order_result, user_id, dry_run, db)
        except Exception as exc:
            logger.exception("Options execution error for %s: %s", signal.symbol, exc)
            exec_result = ExecutionResult(
                symbol=signal.symbol,
                status="error",
                block_reason=str(exc),
                order_id=None,
                risk_model=risk,
                dry_run=dry_run,
            )

        await self._log(signal, risk, exec_result, user_id, dry_run, db)
        return exec_result

    async def _log(
        self,
        signal: OptionsSignal,
        risk: Optional[OptionsRiskModel],
        result: ExecutionResult,
        user_id: int,
        dry_run: bool,
        db: AsyncSession,
    ) -> None:
        try:
            log = OptionsExecution(
                user_id=user_id,
                symbol=signal.symbol,
                signal=signal.to_dict(),
                risk_model=risk.to_dict() if risk else {},
                order_request={},
                order_result={"order_id": result.order_id, "status": result.status},
                status=result.status,
                block_reason=result.block_reason,
                dry_run=dry_run,
            )
            db.add(log)
            await db.commit()
        except Exception as exc:
            logger.error("Failed to log options execution: %s", exc)

    async def _save_position(
        self,
        signal: OptionsSignal,
        risk: OptionsRiskModel,
        order_result,
        user_id: int,
        dry_run: bool,
        db: AsyncSession,
    ) -> None:
        try:
            from datetime import date
            pos = OptionsPosition(
                user_id=user_id,
                symbol=signal.symbol,
                strategy=signal.strategy,
                legs=[
                    {
                        "symbol": c.symbol,
                        "strike": c.strike,
                        "option_type": c.option_type,
                        "expiration": c.expiration.isoformat(),
                    }
                    for c in signal.contract_legs
                ],
                broker="alpaca",
                order_id=order_result.order_id,
                status="open",
                max_profit=risk.max_profit,
                max_loss=risk.max_loss,
                breakeven_prices=risk.breakeven_prices,
                probability_of_profit=risk.probability_of_profit,
                iv_rank_at_entry=signal.iv_rank,
                days_to_expiry_at_entry=risk.days_to_expiry,
                dry_run=dry_run,
            )
            db.add(pos)
            await db.commit()
        except Exception as exc:
            logger.error("Failed to save options position: %s", exc)
