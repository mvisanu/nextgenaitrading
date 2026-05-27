from decimal import Decimal

from app.models.btc_bot import BtcBotAction, BtcBotSession


def test_btc_bot_session_defaults():
    """BtcBotSession must initialise with the documented defaults."""
    session = BtcBotSession(user_id=1)
    assert session.status == "active"
    assert session.total_qty == Decimal("0") or session.total_qty == 0
    assert session.initial_buy_usd in (Decimal("10000"), 10000, 10000.0)
    assert session.trailing_active is False
    assert session.ladder_next == 0


def test_btc_bot_session_has_required_fields():
    """All columns the decision engine touches must be settable."""
    session = BtcBotSession(
        user_id=1,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("92000.00"),
        total_qty=Decimal("0.10000000"),
        current_floor=Decimal("82800.00"),
        trailing_active=True,
        trailing_high=Decimal("100000.00"),
        ladder_next=1,
    )
    assert session.original_entry_price == Decimal("94000.00")
    assert session.trailing_active is True
    assert session.ladder_next == 1


def test_btc_bot_action_required_fields():
    """BtcBotAction needs session_id + user_id + action + created_at default."""
    action = BtcBotAction(
        session_id=1,
        user_id=1,
        action="initial_buy",
        btc_price=Decimal("94000.00"),
        qty_delta=Decimal("0.10000000"),
        usd_delta=Decimal("10000.00"),
        alpaca_order_id="abc-123",
    )
    assert action.action == "initial_buy"
    assert action.btc_price == Decimal("94000.00")
    assert action.qty_delta == Decimal("0.10000000")
