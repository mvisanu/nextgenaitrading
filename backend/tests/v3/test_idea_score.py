"""
Unit tests for the V3 idea_score formula in v3_idea_generator_service.py
"""
from __future__ import annotations

import pytest

from app.services.v3_idea_generator_service import IdeaCandidate, compute_idea_score


def _make_candidate(**kwargs) -> IdeaCandidate:
    defaults = dict(
        ticker="NVDA",
        company_name="NVIDIA",
        source="technical",
        reason_summary="Test",
        current_price=500.0,
        confidence_score=0.0,
        technical_setup_score=0.0,
        news_relevance_score=0.0,
        megatrend_fit_score=0.0,
        moat_score=0.0,
        financial_quality_score=0.0,
        near_52w_low=False,
        at_weekly_support=False,
    )
    defaults.update(kwargs)
    return IdeaCandidate(**defaults)


class TestIdeaScoreFormula:
    def test_all_zero_components_gives_zero(self):
        c = _make_candidate()
        assert compute_idea_score(c) == 0.0

    def test_all_max_components_give_1_0(self):
        c = _make_candidate(
            confidence_score=1.0,
            megatrend_fit_score=1.0,
            moat_score=1.0,
            financial_quality_score=1.0,
            technical_setup_score=1.0,
            news_relevance_score=1.0,
        )
        assert compute_idea_score(c) == 1.0

    def test_score_capped_at_1_0_with_entry_boosts(self):
        """Even with max components + both entry boosts, score <= 1.0."""
        c = _make_candidate(
            confidence_score=1.0,
            megatrend_fit_score=1.0,
            moat_score=1.0,
            financial_quality_score=1.0,
            technical_setup_score=1.0,
            news_relevance_score=1.0,
            near_52w_low=True,
            at_weekly_support=True,
        )
        assert compute_idea_score(c) == 1.0

    def test_near_52w_low_boost_adds_0_15(self):
        c_base = _make_candidate(confidence_score=0.5)
        c_boost = _make_candidate(confidence_score=0.5, near_52w_low=True)
        diff = compute_idea_score(c_boost) - compute_idea_score(c_base)
        assert abs(diff - 0.15) < 0.001

    def test_weekly_support_boost_adds_0_10(self):
        c_base = _make_candidate(confidence_score=0.5)
        c_boost = _make_candidate(confidence_score=0.5, at_weekly_support=True)
        diff = compute_idea_score(c_boost) - compute_idea_score(c_base)
        assert abs(diff - 0.10) < 0.001

    def test_both_boosts_additive(self):
        c_base = _make_candidate(confidence_score=0.5)
        c_both = _make_candidate(confidence_score=0.5, near_52w_low=True, at_weekly_support=True)
        diff = compute_idea_score(c_both) - compute_idea_score(c_base)
        assert abs(diff - 0.25) < 0.001

    def test_confidence_weight_is_0_25(self):
        """confidence_score=1.0 alone should produce 0.25 base."""
        c = _make_candidate(confidence_score=1.0)
        assert abs(compute_idea_score(c) - 0.25) < 0.001

    def test_megatrend_weight_is_0_20(self):
        c = _make_candidate(megatrend_fit_score=1.0)
        assert abs(compute_idea_score(c) - 0.20) < 0.001

    def test_moat_weight_is_0_15(self):
        c = _make_candidate(moat_score=1.0)
        assert abs(compute_idea_score(c) - 0.15) < 0.001

    def test_financial_weight_is_0_15(self):
        c = _make_candidate(financial_quality_score=1.0)
        assert abs(compute_idea_score(c) - 0.15) < 0.001

    def test_technical_weight_is_0_15(self):
        c = _make_candidate(technical_setup_score=1.0)
        assert abs(compute_idea_score(c) - 0.15) < 0.001

    def test_news_weight_is_0_10(self):
        c = _make_candidate(news_relevance_score=1.0)
        assert abs(compute_idea_score(c) - 0.10) < 0.001

    def test_score_always_in_0_1_range(self):
        for conf in [0.0, 0.3, 0.7, 1.0]:
            for mega in [0.0, 0.5, 1.0]:
                c = _make_candidate(confidence_score=conf, megatrend_fit_score=mega, near_52w_low=True)
                score = compute_idea_score(c)
                assert 0.0 <= score <= 1.0, f"Score out of range: {score}"
