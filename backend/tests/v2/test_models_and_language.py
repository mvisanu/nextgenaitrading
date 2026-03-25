"""
Tests for:
1. ORM model structure — column presence, nullability, defaults, relationships.
2. Language rules — ensure no banned phrases exist in service files.
3. Decision state set — AutoBuyDecisionLog valid states.
4. VALID_ALERT_TYPES set — alertconsistency between model and schema.
"""
from __future__ import annotations

import ast
import inspect
import os
from pathlib import Path

import pytest

from app.models.auto_buy import AutoBuySettings, AutoBuyDecisionLog, DECISION_STATES
from app.models.alert import PriceAlertRule, VALID_ALERT_TYPES as MODEL_ALERT_TYPES
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.theme_score import StockThemeScore
from app.schemas.alert import VALID_ALERT_TYPES as SCHEMA_ALERT_TYPES


# ── ORM model column presence (attribute inspection) ──────────────────────────

class TestStockBuyZoneSnapshotModel:
    def test_required_columns_present(self) -> None:
        cols = StockBuyZoneSnapshot.__table__.columns.keys()
        required = [
            "id", "user_id", "ticker", "current_price",
            "buy_zone_low", "buy_zone_high", "confidence_score",
            "entry_quality_score", "expected_return_30d", "expected_return_90d",
            "expected_drawdown", "positive_outcome_rate_30d", "positive_outcome_rate_90d",
            "invalidation_price", "horizon_days", "explanation_json",
            "feature_payload_json", "model_version", "created_at",
        ]
        for col in required:
            assert col in cols, f"Missing column: {col}"

    def test_user_id_is_nullable(self) -> None:
        col = StockBuyZoneSnapshot.__table__.columns["user_id"]
        assert col.nullable is True

    def test_feature_payload_json_present_for_audit(self) -> None:
        """FR-A07: feature_payload_json must exist for auditability."""
        cols = StockBuyZoneSnapshot.__table__.columns.keys()
        assert "feature_payload_json" in cols


class TestStockThemeScoreModel:
    def test_no_user_id_column(self) -> None:
        """Theme scores are system-wide — must NOT have a user_id column."""
        cols = StockThemeScore.__table__.columns.keys()
        assert "user_id" not in cols, "StockThemeScore must be system-wide (no user_id)"

    def test_ticker_is_unique(self) -> None:
        col = StockThemeScore.__table__.columns["ticker"]
        assert col.unique is True

    def test_required_score_columns(self) -> None:
        cols = StockThemeScore.__table__.columns.keys()
        for c in ["theme_score_total", "theme_scores_json", "narrative_momentum_score",
                  "sector_tailwind_score", "macro_alignment_score"]:
            assert c in cols


class TestWatchlistIdeaModel:
    def test_required_columns(self) -> None:
        cols = WatchlistIdea.__table__.columns.keys()
        for c in ["id", "user_id", "title", "thesis", "conviction_score",
                  "watch_only", "tradable", "tags_json", "metadata_json"]:
            assert c in cols

    def test_tickers_relationship_exists(self) -> None:
        assert hasattr(WatchlistIdea, "tickers")


class TestWatchlistIdeaTickerModel:
    def test_near_earnings_column_present(self) -> None:
        """OQ-02 resolution: near_earnings must exist."""
        cols = WatchlistIdeaTicker.__table__.columns.keys()
        assert "near_earnings" in cols

    def test_near_earnings_defaults_false(self) -> None:
        col = WatchlistIdeaTicker.__table__.columns["near_earnings"]
        assert col.default.arg is False or col.server_default is not None or \
               col.default.arg == False

    def test_idea_id_is_foreign_key(self) -> None:
        col = WatchlistIdeaTicker.__table__.columns["idea_id"]
        assert len(col.foreign_keys) > 0


class TestAutoBuySettingsModel:
    def test_unique_constraint_on_user_id(self) -> None:
        """Spec: one row per user."""
        col = AutoBuySettings.__table__.columns["user_id"]
        assert col.unique is True

    def test_enabled_defaults_false(self) -> None:
        col = AutoBuySettings.__table__.columns["enabled"]
        assert col.default.arg is False

    def test_paper_mode_defaults_true(self) -> None:
        col = AutoBuySettings.__table__.columns["paper_mode"]
        assert col.default.arg is True

    def test_confidence_threshold_default_0_70(self) -> None:
        col = AutoBuySettings.__table__.columns["confidence_threshold"]
        assert abs(col.default.arg - 0.70) < 1e-6

    def test_max_trade_amount_default_1000(self) -> None:
        col = AutoBuySettings.__table__.columns["max_trade_amount"]
        assert abs(col.default.arg - 1000.0) < 1e-6


class TestAutoBuyDecisionLogModel:
    def test_required_columns(self) -> None:
        cols = AutoBuyDecisionLog.__table__.columns.keys()
        for c in ["id", "user_id", "ticker", "decision_state",
                  "reason_codes_json", "signal_payload_json", "order_payload_json", "dry_run"]:
            assert c in cols

    def test_order_payload_json_is_nullable(self) -> None:
        col = AutoBuyDecisionLog.__table__.columns["order_payload_json"]
        assert col.nullable is True

    def test_dry_run_defaults_true(self) -> None:
        col = AutoBuyDecisionLog.__table__.columns["dry_run"]
        assert col.default.arg is True


# ── Decision states ───────────────────────────────────────────────────────────

class TestDecisionStates:
    def test_all_8_states_present(self) -> None:
        expected = {
            "candidate", "ready_to_alert", "ready_to_buy", "blocked_by_risk",
            "order_submitted", "order_filled", "order_rejected", "cancelled",
        }
        assert DECISION_STATES == expected

    def test_states_are_strings(self) -> None:
        for state in DECISION_STATES:
            assert isinstance(state, str)


# ── Alert type consistency between model and schema ──────────────────────────

class TestAlertTypeConsistency:
    def test_model_and_schema_types_match(self) -> None:
        """Model VALID_ALERT_TYPES set must match schema VALID_ALERT_TYPES list."""
        assert set(MODEL_ALERT_TYPES) == set(SCHEMA_ALERT_TYPES)

    def test_exactly_6_alert_types(self) -> None:
        assert len(MODEL_ALERT_TYPES) == 6

    def test_all_expected_types_present(self) -> None:
        expected = {
            "entered_buy_zone",
            "near_buy_zone",
            "below_invalidation",
            "confidence_improved",
            "theme_score_increased",
            "macro_deterioration",
        }
        assert set(MODEL_ALERT_TYPES) == expected


# ── Language rules: banned phrases must not appear in service source ──────────

BANNED_PHRASES = [
    "guaranteed profit",
    "no chance of loss",
    "safe entry",
    "certain to go up",
    "buy now",
]

# Service files to scan (relative to project root)
_BACKEND_ROOT = Path(__file__).parent.parent.parent / "app"
_SERVICE_FILES = list((_BACKEND_ROOT / "services").glob("*.py"))


class TestLanguageRules:
    @staticmethod
    def _extract_code_lines(source: str) -> list[tuple[int, str]]:
        """
        Extract (lineno, line) pairs that are actual Python code, excluding:
        - Comment lines (start with #)
        - Module, class, and function docstrings (triple-quoted strings at
          the top of the file / immediately after def/class)
        - Lines inside LANGUAGE RULE documentation blocks

        This uses a simple state machine: track when we are inside a triple-quoted
        string and skip those lines.
        """
        lines = source.splitlines()
        code_lines: list[tuple[int, str]] = []
        in_triple_quote = False
        triple_char = None

        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()

            # Toggle triple-quote state
            for tq in ('"""', "'''"):
                count = stripped.count(tq)
                if not in_triple_quote:
                    if count >= 1:
                        in_triple_quote = True
                        triple_char = tq
                        # If the triple quote opens and closes on the same line
                        if count >= 2:
                            in_triple_quote = False
                        # Either way, this line is part of a docstring — skip it
                        break
                else:
                    if tq == triple_char and count >= 1:
                        in_triple_quote = False
                        # This closing line is docstring — skip it
                        break
            else:
                # Not a triple-quote line
                if in_triple_quote:
                    continue  # inside docstring — skip
                if stripped.startswith("#"):
                    continue  # comment line — skip
                code_lines.append((lineno, line))

        return code_lines

    @pytest.mark.parametrize("service_file", _SERVICE_FILES, ids=lambda p: p.name)
    def test_no_banned_phrases_in_service(self, service_file: Path) -> None:
        """
        FR-A12: banned profit language must not appear in any service code.
        Docstrings and LANGUAGE RULE comment blocks are excluded from the scan
        as they define what is banned, not violate it.
        """
        source = service_file.read_text(encoding="utf-8")
        code_lines = self._extract_code_lines(source)

        for lineno, line in code_lines:
            for phrase in BANNED_PHRASES:
                if phrase.lower() in line.lower():
                    pytest.fail(
                        f"Banned phrase '{phrase}' found in actual code at "
                        f"{service_file.name}:{lineno}: {line.strip()!r}"
                    )
