import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date

from app.broker.wheel_alpaca_client import WheelAlpacaClient


@pytest.fixture
def client():
    return WheelAlpacaClient(
        api_key="test_key",
        secret_key="test_secret",
        base_url="https://paper-api.alpaca.markets",
    )


@pytest.mark.asyncio
async def test_get_account_returns_dict(client):
    mock_resp = MagicMock()
    mock_resp.is_success = True
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"cash": "24000.00", "equity": "25000.00"}

    with patch.object(client, "_client") as mock_client_ctx:
        mock_http = AsyncMock()
        mock_http.get.return_value = mock_resp
        mock_client_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await client.get_account()
        assert result["cash"] == "24000.00"


@pytest.mark.asyncio
async def test_get_position_returns_none_when_missing(client):
    mock_resp = MagicMock()
    mock_resp.status_code = 404

    with patch.object(client, "_client") as mock_client_ctx:
        mock_http = AsyncMock()
        mock_http.get.return_value = mock_resp
        mock_client_ctx.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await client.get_position("TSLA")
        assert result is None


def test_pick_expiration_selects_in_range(client):
    today = date(2026, 4, 7)
    expirations = [
        date(2026, 4, 10),  # 3 days — too soon
        date(2026, 4, 21),  # 14 days — OK
        date(2026, 5, 5),   # 28 days — OK
        date(2026, 6, 19),  # 73 days — too far
    ]
    result = client.pick_expiration(expirations, min_days=14, max_days=28, today=today)
    assert result == date(2026, 4, 21)


def test_closest_strike_to_target(client):
    contracts = [
        {"strike_price": "160.00", "bid_price": "1.50", "ask_price": "1.70", "type": "put",
         "symbol": "TSLA260416P00160000", "open_interest": "500"},
        {"strike_price": "180.00", "bid_price": "3.00", "ask_price": "3.20", "type": "put",
         "symbol": "TSLA260416P00180000", "open_interest": "300"},
        {"strike_price": "175.00", "bid_price": "2.50", "ask_price": "2.70", "type": "put",
         "symbol": "TSLA260416P00175000", "open_interest": "400"},
    ]
    result = client.closest_strike(contracts, target=178.0)
    assert result["strike_price"] == "180.00"


def test_mid_price(client):
    contract = {"bid_price": "2.80", "ask_price": "3.20"}
    assert client.mid_price(contract) == 3.0


def test_mid_price_zero_bid(client):
    contract = {"bid_price": "0", "ask_price": "0"}
    assert client.mid_price(contract) == 0.0
