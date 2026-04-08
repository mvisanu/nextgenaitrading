import pytest
from app.schemas.wheel_bot import (
    WheelBotSetupRequest,
    WheelBotSessionResponse,
    WheelBotSummaryResponse,
)
from app.models.wheel_bot import WheelBotSession


def test_setup_request_defaults():
    req = WheelBotSetupRequest(symbol="TSLA")
    assert req.symbol == "TSLA"
    assert req.dry_run is True


def test_setup_request_symbol_uppercase():
    req = WheelBotSetupRequest(symbol="tsla")
    assert req.symbol == "TSLA"


def test_session_response_from_orm():
    orm = WheelBotSession(
        id=1,
        user_id=42,
        symbol="TSLA",
        dry_run=True,
        stage="sell_put",
        shares_qty=0,
        total_premium_collected=0.0,
        status="active",
    )
    resp = WheelBotSessionResponse.model_validate(orm)
    assert resp.id == 1
    assert resp.stage == "sell_put"
    assert resp.total_premium_collected == 0.0


def test_summary_response_required_fields():
    s = WheelBotSummaryResponse(
        session_id=1,
        date="2026-04-07",
        stage="sell_put",
        symbol="TSLA",
        active_contract_symbol=None,
        shares_qty=0,
        cost_basis_per_share=None,
        total_premium_collected=350.0,
        account_equity=25000.0,
        account_cash=24000.0,
        total_return_pct=1.4,
        last_action="Sold put TSLA250418P00180000 @ $3.50",
    )
    assert s.total_premium_collected == 350.0
    assert s.total_return_pct == 1.4
