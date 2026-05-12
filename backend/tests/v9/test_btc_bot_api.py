"""Direct-call tests for the btc-bot route handlers.

This codebase tests API handlers directly (mocking AsyncSession + User) rather
than via TestClient. Match that pattern.
"""
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.btc_bot import BtcBotAction, BtcBotSession


def _mock_db_with_first(returned_obj):
    """AsyncSession mock whose db.execute(...).scalars().first() returns `returned_obj`."""
    scalars = MagicMock()
    scalars.first = MagicMock(return_value=returned_obj)
    scalars.all = MagicMock(return_value=[returned_obj] if returned_obj else [])
    mock_result = MagicMock()
    mock_result.scalars.return_value = scalars
    db = MagicMock()
    db.execute = AsyncMock(return_value=mock_result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.asyncio
async def test_get_current_session_returns_none_when_no_active():
    from app.api.btc_bot import get_current_session

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    result = await get_current_session(db=db, user=user)
    assert result is None


@pytest.mark.asyncio
async def test_get_current_session_returns_row_when_active():
    from app.api.btc_bot import get_current_session

    session = BtcBotSession(
        id=10,
        user_id=1,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("94000.00"),
        total_qty=Decimal("0.10000000"),
        initial_buy_usd=Decimal("10000.00"),
        current_floor=Decimal("84600.00"),
    )
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)
    result = await get_current_session(db=db, user=user)
    assert result is session


@pytest.mark.asyncio
async def test_get_session_detail_404_when_missing():
    from fastapi import HTTPException

    from app.api.btc_bot import get_session_detail

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    with pytest.raises(HTTPException) as exc:
        await get_session_detail(session_id=999, db=db, user=user)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_actions_filters_by_action():
    from app.api.btc_bot import list_actions

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    result = await list_actions(action="initial_buy", limit=10, offset=0, db=db, user=user)
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_create_session_409_when_active_exists():
    from fastapi import HTTPException

    from app.api.btc_bot import create_session
    from app.schemas.btc_bot import BtcBotSessionCreateRequest

    existing = BtcBotSession(id=1, user_id=1, status="active")
    db = _mock_db_with_first(existing)
    user = MagicMock(id=1)

    with pytest.raises(HTTPException) as exc:
        await create_session(body=BtcBotSessionCreateRequest(), db=db, user=user)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_create_session_creates_when_no_active():
    from app.api.btc_bot import create_session
    from app.schemas.btc_bot import BtcBotSessionCreateRequest

    db = _mock_db_with_first(None)
    user = MagicMock(id=1)
    result = await create_session(
        body=BtcBotSessionCreateRequest(initial_buy_usd=Decimal("5000")),
        db=db, user=user,
    )
    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert isinstance(added, BtcBotSession)
    assert added.user_id == 1
    assert added.status == "active"
    assert added.initial_buy_usd == Decimal("5000")


@pytest.mark.asyncio
async def test_close_session_409_when_not_active():
    from fastapi import HTTPException

    from app.api.btc_bot import close_session

    session = BtcBotSession(id=10, user_id=1, status="cooldown")
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    with pytest.raises(HTTPException) as exc:
        await close_session(session_id=10, db=db, user=user)
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_close_session_with_no_position_sets_ended():
    from app.api.btc_bot import close_session

    session = BtcBotSession(
        id=10,
        user_id=1,
        status="active",
        total_qty=Decimal("0"),
        blended_entry_price=Decimal("94000"),
    )
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    result = await close_session(session_id=10, db=db, user=user)
    assert result.status == "ended"
    assert result.ended_at is not None


@pytest.mark.asyncio
async def test_cancel_cooldown_ends_session():
    from app.api.btc_bot import cancel_cooldown

    session = BtcBotSession(id=10, user_id=1, status="cooldown")
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    result = await cancel_cooldown(session_id=10, db=db, user=user)
    assert result.status == "ended"
    assert result.cooldown_until is None


@pytest.mark.asyncio
async def test_cancel_cooldown_409_when_not_cooldown():
    from fastapi import HTTPException

    from app.api.btc_bot import cancel_cooldown

    session = BtcBotSession(id=10, user_id=1, status="active")
    db = _mock_db_with_first(session)
    user = MagicMock(id=1)

    with pytest.raises(HTTPException) as exc:
        await cancel_cooldown(session_id=10, db=db, user=user)
    assert exc.value.status_code == 409
