"""
Unit tests for megatrend_filter_service.py
"""
from __future__ import annotations

import pytest

from app.services.megatrend_filter_service import (
    PRIORITY_MEGATRENDS,
    compute_megatrend_fit_score,
    get_megatrend_tags,
    get_priority_megatrend_tags,
)


class TestGetMegatrendTags:
    def test_nvda_has_ai_tag(self):
        tags = get_megatrend_tags("NVDA")
        assert "ai" in tags

    def test_case_insensitive(self):
        assert get_megatrend_tags("nvda") == get_megatrend_tags("NVDA")

    def test_unknown_ticker_returns_empty_list(self):
        assert get_megatrend_tags("UNKNOWN_TICKER_XYZ") == []

    def test_tsla_has_robotics_and_ai(self):
        tags = get_megatrend_tags("TSLA")
        assert "robotics" in tags
        assert "ai" in tags

    def test_lly_has_longevity(self):
        assert "longevity" in get_megatrend_tags("LLY")

    def test_nvo_has_longevity(self):
        assert "longevity" in get_megatrend_tags("NVO")

    def test_isrg_has_robotics(self):
        assert "robotics" in get_megatrend_tags("ISRG")


class TestComputeMegatrendFitScore:
    def test_ai_tag_scores_1_0(self):
        assert compute_megatrend_fit_score(["ai"]) == 1.0

    def test_robotics_tag_scores_1_0(self):
        assert compute_megatrend_fit_score(["robotics"]) == 1.0

    def test_longevity_tag_scores_1_0(self):
        assert compute_megatrend_fit_score(["longevity"]) == 1.0

    def test_semiconductors_alone_scores_0_5(self):
        assert compute_megatrend_fit_score(["semiconductors"]) == 0.5

    def test_defense_alone_scores_0_5(self):
        assert compute_megatrend_fit_score(["defense"]) == 0.5

    def test_empty_tags_scores_0_0(self):
        assert compute_megatrend_fit_score([]) == 0.0

    def test_mixed_priority_and_other_scores_1_0(self):
        """If any priority megatrend is present, score is 1.0 regardless of others."""
        assert compute_megatrend_fit_score(["ai", "semiconductors"]) == 1.0

    def test_unknown_tags_scores_0_0(self):
        assert compute_megatrend_fit_score(["fintech", "cloud"]) == 0.0


class TestGetPriorityMegatrendTags:
    def test_filters_to_priority_only(self):
        result = get_priority_megatrend_tags(["ai", "semiconductors", "defense"])
        assert result == ["ai"]

    def test_empty_input(self):
        assert get_priority_megatrend_tags([]) == []

    def test_no_priority_tags_returns_empty(self):
        assert get_priority_megatrend_tags(["semiconductors", "energy"]) == []

    def test_all_three_priority_tags_returned(self):
        tags = ["ai", "robotics", "longevity", "defense"]
        result = get_priority_megatrend_tags(tags)
        assert set(result) == {"ai", "robotics", "longevity"}
