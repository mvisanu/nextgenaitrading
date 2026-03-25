"""
Schema validation tests for all v2 Pydantic schemas.

Covers: field validation, validator logic, serialization, edge cases.
No DB or network — pure Pydantic validation.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.alert import AlertCreate, AlertOut, AlertUpdate, VALID_ALERT_TYPES
from app.schemas.auto_buy import (
    AutoBuySettingsUpdate,
    DryRunRequest,
    OpportunityOut,
)
from app.schemas.idea import IdeaCreate, IdeaUpdate, TickerIn, SUPPORTED_THEMES
from app.schemas.buy_zone import BuyZoneOut
from app.schemas.theme_score import ThemeScoreOut


# ── AlertCreate ────────────────────────────────────────────────────────────────

class TestAlertCreateSchema:
    def test_valid_all_types_accepted(self) -> None:
        for alert_type in VALID_ALERT_TYPES:
            obj = AlertCreate(ticker="NVDA", alert_type=alert_type)
            assert obj.alert_type == alert_type

    def test_invalid_alert_type_raises(self) -> None:
        with pytest.raises(ValidationError, match="alert_type must be one of"):
            AlertCreate(ticker="AAPL", alert_type="bad_type")

    def test_ticker_uppercased(self) -> None:
        obj = AlertCreate(ticker="nvda", alert_type="entered_buy_zone")
        assert obj.ticker == "NVDA"

    def test_ticker_stripped_and_uppercased(self) -> None:
        obj = AlertCreate(ticker="  aapl  ", alert_type="entered_buy_zone")
        assert obj.ticker == "AAPL"

    def test_empty_ticker_raises(self) -> None:
        with pytest.raises(ValidationError):
            AlertCreate(ticker="", alert_type="entered_buy_zone")

    def test_ticker_too_long_raises(self) -> None:
        with pytest.raises(ValidationError):
            AlertCreate(ticker="A" * 21, alert_type="entered_buy_zone")

    def test_cooldown_minutes_defaults_to_60(self) -> None:
        obj = AlertCreate(ticker="AAPL", alert_type="entered_buy_zone")
        assert obj.cooldown_minutes == 60

    def test_cooldown_minutes_minimum_1(self) -> None:
        with pytest.raises(ValidationError):
            AlertCreate(ticker="AAPL", alert_type="entered_buy_zone", cooldown_minutes=0)

    def test_cooldown_minutes_max_10080(self) -> None:
        obj = AlertCreate(ticker="AAPL", alert_type="entered_buy_zone", cooldown_minutes=10_080)
        assert obj.cooldown_minutes == 10_080

    def test_cooldown_minutes_above_max_raises(self) -> None:
        with pytest.raises(ValidationError):
            AlertCreate(ticker="AAPL", alert_type="entered_buy_zone", cooldown_minutes=10_081)

    def test_market_hours_only_defaults_true(self) -> None:
        obj = AlertCreate(ticker="AAPL", alert_type="entered_buy_zone")
        assert obj.market_hours_only is True

    def test_threshold_json_defaults_empty_dict(self) -> None:
        obj = AlertCreate(ticker="AAPL", alert_type="entered_buy_zone")
        assert obj.threshold_json == {}

    def test_near_buy_zone_accepts_threshold_json(self) -> None:
        obj = AlertCreate(
            ticker="NVDA",
            alert_type="near_buy_zone",
            threshold_json={"proximity_pct": 2.5},
        )
        assert obj.threshold_json["proximity_pct"] == 2.5

    def test_legacy_threshold_field_coerced_to_threshold_json(self) -> None:
        """The old 'threshold' field name is coerced to 'threshold_json' via model_validator."""
        obj = AlertCreate(
            ticker="NVDA",
            alert_type="near_buy_zone",
            threshold={"proximity_pct": 3.0},
        )
        assert obj.threshold_json["proximity_pct"] == 3.0


class TestAlertUpdateSchema:
    def test_all_fields_optional(self) -> None:
        obj = AlertUpdate()
        assert obj.enabled is None
        assert obj.cooldown_minutes is None
        assert obj.market_hours_only is None
        assert obj.threshold_json is None

    def test_partial_update_accepted(self) -> None:
        obj = AlertUpdate(enabled=False)
        assert obj.enabled is False
        assert obj.cooldown_minutes is None

    def test_cooldown_minimum_in_update(self) -> None:
        with pytest.raises(ValidationError):
            AlertUpdate(cooldown_minutes=0)


# ── IdeaCreate ────────────────────────────────────────────────────────────────

class TestIdeaCreateSchema:
    def test_valid_idea_with_supported_tags(self) -> None:
        obj = IdeaCreate(
            title="AI Infrastructure Play",
            thesis="Strong tailwind from data center demand",
            conviction_score=8,
            tags_json=["ai", "semiconductors"],
            tickers=[TickerIn(ticker="NVDA", is_primary=True)],
        )
        assert obj.conviction_score == 8
        assert "ai" in obj.tags_json

    def test_valid_idea_with_tags_legacy_name(self) -> None:
        """The 'tags' field name is coerced to 'tags_json' via model_validator."""
        obj = IdeaCreate(
            title="Legacy field test",
            tags=["ai", "defense"],  # legacy name
        )
        assert "ai" in obj.tags_json

    def test_unsupported_tag_raises(self) -> None:
        with pytest.raises(ValidationError, match="not a supported theme"):
            IdeaCreate(title="Test", tags_json=["flying_cars"])

    def test_all_supported_themes_accepted(self) -> None:
        obj = IdeaCreate(title="Big idea", tags_json=SUPPORTED_THEMES)
        assert len(obj.tags_json) == len(SUPPORTED_THEMES)

    def test_conviction_score_minimum_1(self) -> None:
        with pytest.raises(ValidationError):
            IdeaCreate(title="Test", conviction_score=0)

    def test_conviction_score_maximum_10(self) -> None:
        with pytest.raises(ValidationError):
            IdeaCreate(title="Test", conviction_score=11)

    def test_conviction_score_at_boundaries(self) -> None:
        assert IdeaCreate(title="A", conviction_score=1).conviction_score == 1
        assert IdeaCreate(title="A", conviction_score=10).conviction_score == 10

    def test_empty_title_raises(self) -> None:
        with pytest.raises(ValidationError):
            IdeaCreate(title="")

    def test_title_too_long_raises(self) -> None:
        with pytest.raises(ValidationError):
            IdeaCreate(title="A" * 256)

    def test_thesis_max_length(self) -> None:
        with pytest.raises(ValidationError):
            IdeaCreate(title="Test", thesis="X" * 10_001)

    def test_defaults(self) -> None:
        obj = IdeaCreate(title="Test Idea")
        assert obj.conviction_score == 5
        assert obj.watch_only is False
        assert obj.tradable is True
        assert obj.tags_json == []
        assert obj.tickers == []

    def test_ticker_uppercased_via_api(self) -> None:
        obj = IdeaCreate(title="Test", tickers=[TickerIn(ticker="nvda")])
        # The ticker is stored as-is in IdeaCreate; uppercasing happens in the API router
        # so we just verify the schema passes the value through
        assert obj.tickers[0].ticker == "nvda"


class TestIdeaUpdateSchema:
    def test_all_optional(self) -> None:
        obj = IdeaUpdate()
        assert obj.title is None

    def test_unsupported_tag_in_update_raises(self) -> None:
        with pytest.raises(ValidationError, match="not a supported theme"):
            IdeaUpdate(tags_json=["unknown_theme"])

    def test_unsupported_tag_legacy_name_raises(self) -> None:
        """Legacy 'tags' field is coerced to 'tags_json' and validated."""
        with pytest.raises(ValidationError, match="not a supported theme"):
            IdeaUpdate(tags=["unknown_theme"])

    def test_valid_tag_update_accepted(self) -> None:
        obj = IdeaUpdate(tags_json=["ai", "defense"])
        assert "ai" in obj.tags_json

    def test_none_tags_is_allowed(self) -> None:
        obj = IdeaUpdate(tags_json=None)
        assert obj.tags_json is None


# ── AutoBuySettingsUpdate ─────────────────────────────────────────────────────

class TestAutoBuySettingsUpdateSchema:
    def test_all_optional(self) -> None:
        obj = AutoBuySettingsUpdate()
        assert obj.enabled is None
        assert obj.confidence_threshold is None

    def test_confidence_threshold_bounds(self) -> None:
        assert AutoBuySettingsUpdate(confidence_threshold=0.0).confidence_threshold == 0.0
        assert AutoBuySettingsUpdate(confidence_threshold=1.0).confidence_threshold == 1.0
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(confidence_threshold=-0.01)
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(confidence_threshold=1.01)

    def test_max_trade_amount_must_be_positive(self) -> None:
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(max_trade_amount=0.0)
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(max_trade_amount=-100.0)

    def test_max_position_percent_bounds(self) -> None:
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(max_position_percent=0.0)
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(max_position_percent=1.01)

    def test_max_expected_drawdown_must_be_non_positive(self) -> None:
        assert AutoBuySettingsUpdate(max_expected_drawdown=0.0).max_expected_drawdown == 0.0
        with pytest.raises(ValidationError):
            AutoBuySettingsUpdate(max_expected_drawdown=0.01)


class TestDryRunRequestSchema:
    def test_credential_id_optional(self) -> None:
        obj = DryRunRequest()
        assert obj.credential_id is None

    def test_credential_id_accepted(self) -> None:
        obj = DryRunRequest(credential_id=42)
        assert obj.credential_id == 42


class TestOpportunityOutSchema:
    def test_minimal_construction(self) -> None:
        obj = OpportunityOut(ticker="NVDA", current_price=450.0)
        assert obj.ticker == "NVDA"
        assert obj.current_price == 450.0
        assert obj.rank_score == 0.0
        assert obj.alert_active is False
        assert obj.auto_buy_eligible is False

    def test_all_fields(self) -> None:
        obj = OpportunityOut(
            ticker="AAPL",
            current_price=200.0,
            buy_zone_low=185.0,
            buy_zone_high=195.0,
            distance_to_zone_pct=2.6,
            confidence_score=0.72,
            entry_quality_score=0.68,
            theme_score_total=0.55,
            alert_active=True,
            auto_buy_eligible=True,
            rank_score=0.65,
        )
        assert obj.alert_active is True
        assert obj.rank_score == 0.65
