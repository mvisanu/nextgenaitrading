"""No broker network calls: exercise durable intents against an isolated SQLite ledger."""
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4
import pytest
import pytest_asyncio
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.base import Base
from app.models.user import User
from app.models.broker import BrokerCredential
from app.models.strategy import StrategyRun
from app.models.live import BrokerOrder, PositionSnapshot
from app.broker.base import OrderResult
from app.schemas.live import ExecuteRequest
from app.services import execution_service as service

@pytest_asyncio.fixture
async def ledger(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=[User.__table__, BrokerCredential.__table__, StrategyRun.__table__, BrokerOrder.__table__, PositionSnapshot.__table__]))
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        user = User(id=1, email="test@example.test", password_hash="unused")
        cred = BrokerCredential(id=1, user_id=1, provider="alpaca", profile_name="test", api_key="unused", encrypted_secret_key="unused", paper_trading=True)
        db.add_all([user, cred]); await db.commit()
        client = Mock()
        client.place_order.return_value = OrderResult("broker-1", "accepted", None, 0, {})
        client.get_order_by_client_id.return_value = OrderResult("broker-1", "filled", 100, 2, {})
        monkeypatch.setattr(service, "get_broker_client", lambda *args, **kwargs: client)
        yield SimpleNamespace(db=db, user=user, cred=cred, client=client)
    await engine.dispose()

def request(**changes):
    return ExecuteRequest(**{"symbol": "AAPL", "side": "buy", "notional_usd": 200, "credential_id": 1, "dry_run": False, "client_order_id": uuid4(), **changes})

@pytest.mark.asyncio
async def test_notional_stays_notional_and_unfilled_order_has_no_position(ledger):
    out = await service.execute_order(request(), ledger.db, ledger.user)
    assert out.status == "accepted"
    assert ledger.client.place_order.call_args.kwargs["quantity"] == 0
    assert ledger.client.place_order.call_args.kwargs["notional_usd"] == 200
    assert await ledger.db.scalar(select(func.count()).select_from(PositionSnapshot)) == 0
    assert out.client_order_id

@pytest.mark.asyncio
async def test_intent_is_committed_before_broker_call_and_timeout_replays_once(ledger):
    payload = request()
    ledger.client.place_order.side_effect = TimeoutError("response lost")
    out = await service.execute_order(payload, ledger.db, ledger.user)
    assert out.status == "submission_unknown"
    assert await ledger.db.scalar(select(func.count()).select_from(BrokerOrder)) == 1
    recovered = await service.execute_order(payload, ledger.db, ledger.user)
    assert recovered.status == "filled"
    again = await service.execute_order(payload, ledger.db, ledger.user)
    assert again.id == recovered.id
    assert ledger.client.place_order.call_count == 1
    position = await ledger.db.scalar(select(PositionSnapshot))
    assert position.quantity == 2

@pytest.mark.asyncio
async def test_partial_fill_reconciliation_is_incremental(ledger):
    ledger.client.place_order.return_value = OrderResult("broker-1", "partially_filled", 90, 1, {})
    payload = request()
    await service.execute_order(payload, ledger.db, ledger.user)
    await service.reconcile_order(str(payload.client_order_id), ledger.db, ledger.user)
    await service.reconcile_order(str(payload.client_order_id), ledger.db, ledger.user)
    position = await ledger.db.scalar(select(PositionSnapshot))
    assert position.quantity == 2
    assert position.avg_entry_price == 100

@pytest.mark.asyncio
async def test_conflicting_replay_never_calls_broker(ledger):
    payload = request()
    await service.execute_order(payload, ledger.db, ledger.user)
    with pytest.raises(HTTPException) as exc:
        await service.execute_order(payload.model_copy(update={"notional_usd": 500}), ledger.db, ledger.user)
    assert exc.value.status_code == 409
    assert ledger.client.place_order.call_count == 1

@pytest.mark.asyncio
async def test_lookup_failure_does_not_resubmit(ledger):
    payload = request()
    ledger.client.place_order.side_effect = TimeoutError()
    await service.execute_order(payload, ledger.db, ledger.user)
    ledger.client.get_order_by_client_id.side_effect = Exception("not found yet")
    with pytest.raises(HTTPException) as exc:
        await service.execute_order(payload, ledger.db, ledger.user)
    assert exc.value.status_code == 503
    assert ledger.client.place_order.call_count == 1

@pytest.mark.asyncio
async def test_dry_run_never_changes_holdings(ledger):
    ledger.client.place_order.return_value = OrderResult("simulated", "simulated", 100, 2, {})
    await service.execute_order(request(dry_run=True), ledger.db, ledger.user)
    assert await ledger.db.scalar(select(func.count()).select_from(PositionSnapshot)) == 0

@pytest.mark.asyncio
async def test_invalid_strategy_rejected_before_submission(ledger):
    with pytest.raises(HTTPException) as exc:
        await service.execute_order(request(strategy_run_id=999), ledger.db, ledger.user)
    assert exc.value.status_code == 422
    ledger.client.place_order.assert_not_called()

@pytest.mark.asyncio
async def test_other_user_cannot_reconcile_order(ledger):
    payload = request()
    await service.execute_order(payload, ledger.db, ledger.user)
    with pytest.raises(HTTPException) as exc:
        await service.reconcile_order(str(payload.client_order_id), ledger.db, User(id=2))
    assert exc.value.status_code == 404
    ledger.client.get_order_by_client_id.assert_not_called()

@pytest.mark.asyncio
async def test_short_cover_and_flip_accounting(ledger):
    for side, qty, price in [("sell", 2, 100), ("buy", 1, 80), ("buy", 2, 90)]:
        await service._upsert_position_snapshot(ledger.db, 1, "AAPL", side, qty, price, None, 1, True)
        await ledger.db.commit()
    position = await ledger.db.scalar(select(PositionSnapshot))
    assert position.position_side == "long"
    assert position.quantity == 1
    assert position.avg_entry_price == 90
    assert position.realized_pnl == 30

@pytest.mark.asyncio
async def test_delayed_submission_response_cannot_regress_recovered_fill(ledger):
    payload = request()
    await service.execute_order(payload, ledger.db, ledger.user)
    await service.reconcile_order(str(payload.client_order_id), ledger.db, ledger.user)
    stale = OrderResult("broker-1", "accepted", None, 0, {})
    out = await service._save_result(str(payload.client_order_id), stale, ledger.db, ledger.user)
    assert out.status == "filled"
    out = await service._save_failure(str(payload.client_order_id), "submission_unknown", "late timeout", ledger.db, 1)
    assert out.status == "filled"
    assert out.filled_quantity == 2

@pytest.mark.asyncio
async def test_replay_keeps_original_environment_after_credential_settings_change(ledger):
    payload = request()
    await service.execute_order(payload, ledger.db, ledger.user)
    ledger.cred.paper_trading = False
    await ledger.db.commit()
    recovered = await service.execute_order(payload, ledger.db, ledger.user)
    assert recovered.broker_paper is True
    assert ledger.client.place_order.call_count == 1

@pytest.mark.asyncio
async def test_unconfirmed_old_order_still_blocks_auto_buy(ledger):
    from datetime import datetime, timedelta, timezone
    from app.services.auto_buy_engine import _check_no_duplicate_order
    ledger.db.add(BrokerOrder(user_id=1, symbol="AAPL", side="buy", status="submission_unknown", dry_run=False,
        created_at=datetime.now(timezone.utc) - timedelta(days=3)))
    await ledger.db.commit()
    assert not (await _check_no_duplicate_order(1, "AAPL", ledger.db)).passed

@pytest.mark.asyncio
async def test_daily_budget_does_not_count_notional_and_fills_twice(ledger):
    from app.services.auto_buy_engine import _check_daily_risk_budget
    ledger.db.add(BrokerOrder(user_id=1, symbol="AAPL", side="buy", status="filled", dry_run=False,
        notional_usd=900, filled_quantity=9, filled_price=100))
    await ledger.db.commit()
    assert (await _check_daily_risk_budget(1, SimpleNamespace(max_trade_amount=500), ledger.db)).passed

@pytest.mark.parametrize("changes", [{"notional_usd": float("inf")}, {"quantity": 2}, {"notional_usd": None}, {"client_order_id": None}])
def test_request_rejects_invalid_amounts_and_missing_id(changes):
    with pytest.raises(ValidationError): request(**changes)

def test_explicit_paper_execution_cannot_be_redirected_to_live_url(monkeypatch):
    from app.broker import factory
    client = Mock()
    monkeypatch.setattr(factory, "AlpacaClient", client)
    monkeypatch.setattr(factory, "decrypt_value", lambda value: "test")
    cred = SimpleNamespace(provider="alpaca", api_key="test", encrypted_secret_key="test",
        paper_trading=False, base_url="https://api.alpaca.markets")
    factory.get_broker_client(cred, paper=True)
    assert client.call_args.kwargs["paper"] is True
    assert client.call_args.kwargs["base_url"] is None
