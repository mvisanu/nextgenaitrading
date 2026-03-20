from __future__ import annotations

from app.broker.alpaca_client import AlpacaClient
from app.broker.base import AbstractBrokerClient
from app.broker.robinhood_client import RobinhoodClient
from app.core.security import decrypt_value
from app.models.broker import BrokerCredential


def get_broker_client(
    credential: BrokerCredential, paper: bool | None = None
) -> AbstractBrokerClient:
    """
    Decrypt credentials in-memory and instantiate the correct broker client.
    Decrypted keys are never logged or returned.
    """
    api_key = decrypt_value(credential.api_key)
    secret_key = decrypt_value(credential.encrypted_secret_key)

    if credential.provider == "alpaca":
        use_paper = paper if paper is not None else credential.paper_trading
        return AlpacaClient(api_key=api_key, secret_key=secret_key, paper=use_paper)
    elif credential.provider == "robinhood":
        return RobinhoodClient(api_key=api_key, private_key=secret_key)
    else:
        raise ValueError(f"Unsupported broker provider: {credential.provider!r}")
