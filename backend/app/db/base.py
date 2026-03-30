"""
Declarative base for all ORM models.

Import all model modules here so Alembic autogenerate can discover them.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic sees them at revision time
from app.models import (  # noqa: F401, E402
    artifact,
    backtest,
    broker,
    live,
    strategy,
    user,
    # v2 models
    buy_zone,
    theme_score,
    idea,
    alert,
    auto_buy,
    # v3 models
    user_watchlist,
    buy_signal,
    generated_idea,
    # commodity alert prefs
    commodity_alert_prefs,
)
