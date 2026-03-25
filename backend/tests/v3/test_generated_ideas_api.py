"""
T3-37 — Unit tests for generated_ideas API endpoints.

Tests every endpoint in app/api/generated_ideas.py by mocking the DB
session and auth dependency so no live DB or network is needed.

Endpoints:
  GET  /api/ideas/generated          — list with source/theme/limit filters
  GET  /api/ideas/generated/last-scan — returns LastScanOut shape
  POST /api/ideas/generated/run-now  — triggers idea generator
  POST /api/ideas/generated/{id}/add-to-watchlist — full happy path + error cases
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.generated_idea import AddToWatchlistResponse, GeneratedIdeaOut, LastScanOut


# ── Fixture helpers ───────────────────────────────────────────────────────────

def _make_idea(
    *,
    id: int = 1,
    ticker: str = "NVDA",
    company_name: str = "NVIDIA Corporation",
    source: str = "technical",
    reason_summary: str = "RSI pullback to support.",
    current_price: float = 487.20,
    buy_zone_low: Optional[float] = 472.0,
    buy_zone_high: Optional[float] = 485.0,
    ideal_entry_price: Optional[float] = 476.5,
    confidence_score: float = 0.71,
    historical_win_rate_90d: Optional[float] = 0.66,
    theme_tags: list = None,
    megatrend_tags: list = None,
    moat_score: float = 0.85,
    moat_description: Optional[str] = "Dominant GPU share for AI training",
    financial_quality_score: float = 0.80,
    financial_flags: list = None,
    near_52w_low: bool = False,
    at_weekly_support: bool = True,
    entry_priority: str = "WEEKLY_SUPPORT",
    idea_score: float = 0.82,
    news_headline: Optional[str] = None,
    news_url: Optional[str] = None,
    news_source: Optional[str] = None,
    catalyst_type: Optional[str] = None,
    added_to_watchlist: bool = False,
    expires_in_hours: float = 12.0,  # positive = not expired
) -> MagicMock:
    """Build a MagicMock GeneratedIdea ORM row."""
    now = datetime.now(timezone.utc)
    obj = MagicMock()
    obj.id = id
    obj.ticker = ticker
    obj.company_name = company_name
    obj.source = source
    obj.reason_summary = reason_summary
    obj.news_headline = news_headline
    obj.news_url = news_url
    obj.news_source = news_source
    obj.catalyst_type = catalyst_type
    obj.current_price = current_price
    obj.buy_zone_low = buy_zone_low
    obj.buy_zone_high = buy_zone_high
    obj.ideal_entry_price = ideal_entry_price
    obj.confidence_score = confidence_score
    obj.historical_win_rate_90d = historical_win_rate_90d
    obj.theme_tags = theme_tags if theme_tags is not None else ["ai", "semiconductors"]
    obj.megatrend_tags = megatrend_tags if megatrend_tags is not None else ["ai"]
    obj.moat_score = moat_score
    obj.moat_description = moat_description
    obj.financial_quality_score = financial_quality_score
    obj.financial_flags = financial_flags if financial_flags is not None else []
    obj.near_52w_low = near_52w_low
    obj.at_weekly_support = at_weekly_support
    obj.entry_priority = entry_priority
    obj.idea_score = idea_score
    obj.generated_at = now - timedelta(hours=1)
    obj.expires_at = now + timedelta(hours=expires_in_hours)
    obj.added_to_watchlist = added_to_watchlist
    return obj


def _make_db_execute_returning(scalars: list) -> AsyncMock:
    """
    Build a mock AsyncSession whose execute() returns an object
    where .scalars().all() == scalars.
    """
    scalars_mock = MagicMock()
    scalars_mock.all.return_value = scalars

    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_mock)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


def _make_current_user(user_id: int = 1) -> MagicMock:
    user = MagicMock()
    user.id = user_id
    return user


# ── Tests: list_generated_ideas ───────────────────────────────────────────────


class TestListGeneratedIdeas:
    @pytest.mark.asyncio
    async def test_returns_list_of_generated_idea_out(self):
        """
        Happy path: returns a list of GeneratedIdeaOut objects that can be
        validated against the schema.
        """
        from app.api.generated_ideas import list_generated_ideas

        idea = _make_idea(id=1, ticker="NVDA", source="technical")
        db = _make_db_execute_returning([idea])
        user = _make_current_user()

        with patch("app.api.generated_ideas.GeneratedIdeaOut.model_validate",
                   side_effect=lambda x: GeneratedIdeaOut(
                       id=x.id,
                       ticker=x.ticker,
                       company_name=x.company_name,
                       source=x.source,
                       reason_summary=x.reason_summary,
                       current_price=float(x.current_price),
                       buy_zone_low=float(x.buy_zone_low) if x.buy_zone_low else None,
                       buy_zone_high=float(x.buy_zone_high) if x.buy_zone_high else None,
                       ideal_entry_price=float(x.ideal_entry_price) if x.ideal_entry_price else None,
                       confidence_score=float(x.confidence_score),
                       historical_win_rate_90d=float(x.historical_win_rate_90d) if x.historical_win_rate_90d else None,
                       theme_tags=x.theme_tags or [],
                       megatrend_tags=x.megatrend_tags or [],
                       moat_score=float(x.moat_score),
                       moat_description=x.moat_description,
                       financial_quality_score=float(x.financial_quality_score),
                       financial_flags=x.financial_flags or [],
                       near_52w_low=x.near_52w_low,
                       at_weekly_support=x.at_weekly_support,
                       entry_priority=x.entry_priority,
                       idea_score=float(x.idea_score),
                       generated_at=x.generated_at,
                       expires_at=x.expires_at,
                       added_to_watchlist=x.added_to_watchlist,
                   )):
            result = await list_generated_ideas(
                current_user=user,
                db=db,
                source=None,
                theme=None,
                limit=50,
            )

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0].ticker == "NVDA"

    @pytest.mark.asyncio
    async def test_empty_db_returns_empty_list(self):
        """When no ideas are in the DB, return an empty list."""
        from app.api.generated_ideas import list_generated_ideas

        db = _make_db_execute_returning([])
        user = _make_current_user()

        result = await list_generated_ideas(
            current_user=user,
            db=db,
            source=None,
            theme=None,
            limit=50,
        )
        assert result == []

    @pytest.mark.asyncio
    async def test_source_filter_is_applied_in_query(self):
        """
        When source="news" is passed, list_generated_ideas should filter rows.
        We verify by returning only news-source ideas and checking the output.
        """
        from app.api.generated_ideas import list_generated_ideas

        news_idea = _make_idea(id=10, ticker="AAPL", source="news",
                               news_headline="Apple wins AI deal",
                               news_url="https://example.com/aapl")
        db = _make_db_execute_returning([news_idea])
        user = _make_current_user()

        with patch("app.api.generated_ideas.GeneratedIdeaOut.model_validate",
                   side_effect=lambda x: GeneratedIdeaOut(
                       id=x.id, ticker=x.ticker, company_name=x.company_name,
                       source=x.source, reason_summary=x.reason_summary,
                       current_price=float(x.current_price),
                       confidence_score=float(x.confidence_score),
                       theme_tags=x.theme_tags or [], megatrend_tags=x.megatrend_tags or [],
                       moat_score=float(x.moat_score),
                       financial_quality_score=float(x.financial_quality_score),
                       financial_flags=x.financial_flags or [],
                       near_52w_low=x.near_52w_low, at_weekly_support=x.at_weekly_support,
                       entry_priority=x.entry_priority, idea_score=float(x.idea_score),
                       generated_at=x.generated_at, expires_at=x.expires_at,
                       added_to_watchlist=x.added_to_watchlist,
                   )):
            result = await list_generated_ideas(
                current_user=user, db=db,
                source="news", theme=None, limit=50,
            )

        assert len(result) == 1
        assert result[0].source == "news"

    @pytest.mark.asyncio
    async def test_theme_filter_excludes_non_matching_rows(self):
        """
        Theme filter is applied in Python after the DB query.
        Rows whose theme_tags do not contain the requested theme are excluded.
        """
        from app.api.generated_ideas import list_generated_ideas

        ai_idea = _make_idea(id=1, ticker="NVDA", theme_tags=["ai", "semiconductors"])
        defense_idea = _make_idea(id=2, ticker="LMT", theme_tags=["defense"])
        db = _make_db_execute_returning([ai_idea, defense_idea])
        user = _make_current_user()

        def _validate(x):
            return GeneratedIdeaOut(
                id=x.id, ticker=x.ticker, company_name=x.company_name,
                source=x.source, reason_summary=x.reason_summary,
                current_price=float(x.current_price),
                confidence_score=float(x.confidence_score),
                theme_tags=x.theme_tags or [], megatrend_tags=x.megatrend_tags or [],
                moat_score=float(x.moat_score),
                financial_quality_score=float(x.financial_quality_score),
                financial_flags=x.financial_flags or [],
                near_52w_low=x.near_52w_low, at_weekly_support=x.at_weekly_support,
                entry_priority=x.entry_priority, idea_score=float(x.idea_score),
                generated_at=x.generated_at, expires_at=x.expires_at,
                added_to_watchlist=x.added_to_watchlist,
            )

        with patch("app.api.generated_ideas.GeneratedIdeaOut.model_validate",
                   side_effect=_validate):
            result = await list_generated_ideas(
                current_user=user, db=db,
                source=None, theme="ai", limit=50,
            )

        # Only the "ai"-tagged idea should appear
        assert len(result) == 1
        assert result[0].ticker == "NVDA"

    @pytest.mark.asyncio
    async def test_limit_is_respected(self):
        """
        When more rows are returned than the limit, only the first *limit* rows
        are included.
        """
        from app.api.generated_ideas import list_generated_ideas

        ideas = [_make_idea(id=i, ticker=f"T{i}") for i in range(10)]
        db = _make_db_execute_returning(ideas)
        user = _make_current_user()

        def _validate(x):
            return GeneratedIdeaOut(
                id=x.id, ticker=x.ticker, company_name=x.company_name,
                source=x.source, reason_summary=x.reason_summary,
                current_price=float(x.current_price),
                confidence_score=float(x.confidence_score),
                theme_tags=x.theme_tags or [], megatrend_tags=x.megatrend_tags or [],
                moat_score=float(x.moat_score),
                financial_quality_score=float(x.financial_quality_score),
                financial_flags=x.financial_flags or [],
                near_52w_low=x.near_52w_low, at_weekly_support=x.at_weekly_support,
                entry_priority=x.entry_priority, idea_score=float(x.idea_score),
                generated_at=x.generated_at, expires_at=x.expires_at,
                added_to_watchlist=x.added_to_watchlist,
            )

        with patch("app.api.generated_ideas.GeneratedIdeaOut.model_validate",
                   side_effect=_validate):
            result = await list_generated_ideas(
                current_user=user, db=db,
                source=None, theme=None, limit=3,
            )

        assert len(result) == 3


# ── Tests: get_last_scan ──────────────────────────────────────────────────────


class TestGetLastScan:
    @pytest.mark.asyncio
    async def test_returns_last_scan_out_shape(self):
        """
        get_last_scan must return a LastScanOut with last_scan_at and ideas_generated.
        """
        from app.api.generated_ideas import get_last_scan

        now = datetime.now(timezone.utc)
        result_row = MagicMock()
        result_row.__getitem__ = lambda s, i: now if i == 0 else 5

        db_result = MagicMock()
        db_result.one.return_value = (now, 5)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=db_result)
        user = _make_current_user()

        with patch("app.core.config.settings") as mock_settings:
            mock_settings.idea_generator_minutes = 60
            response = await get_last_scan(current_user=user, db=db)

        assert isinstance(response, LastScanOut)
        assert response.ideas_generated == 5
        assert response.last_scan_at == now

    @pytest.mark.asyncio
    async def test_returns_null_when_table_empty(self):
        """
        When the generated_ideas table has no rows, last_scan_at and next_scan_at
        must be None and ideas_generated must be 0.
        """
        from app.api.generated_ideas import get_last_scan

        db_result = MagicMock()
        db_result.one.return_value = (None, 0)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=db_result)
        user = _make_current_user()

        with patch("app.core.config.settings") as mock_settings:
            mock_settings.idea_generator_minutes = 60
            response = await get_last_scan(current_user=user, db=db)

        assert response.last_scan_at is None
        assert response.next_scan_at is None
        assert response.ideas_generated == 0

    @pytest.mark.asyncio
    async def test_next_scan_at_is_last_scan_plus_interval(self):
        """next_scan_at should be last_scan_at + idea_generator_minutes."""
        from app.api.generated_ideas import get_last_scan

        now = datetime.now(timezone.utc)
        db_result = MagicMock()
        db_result.one.return_value = (now, 3)

        db = AsyncMock()
        db.execute = AsyncMock(return_value=db_result)
        user = _make_current_user()

        with patch("app.core.config.settings") as mock_settings:
            mock_settings.idea_generator_minutes = 60
            response = await get_last_scan(current_user=user, db=db)

        expected_next = now + timedelta(minutes=60)
        assert response.next_scan_at is not None
        # Allow 1-second tolerance for datetime arithmetic
        delta = abs((response.next_scan_at - expected_next).total_seconds())
        assert delta < 1


# ── Tests: add_idea_to_watchlist ──────────────────────────────────────────────


class TestAddIdeaToWatchlist:
    def _make_db_for_add_to_watchlist(
        self,
        idea: MagicMock | None,
        existing_wl: MagicMock | None = None,
        existing_alert: MagicMock | None = None,
    ) -> AsyncMock:
        """
        Build an AsyncSession mock that:
          - execute() call 1: returns the GeneratedIdea lookup
          - execute() call 2: returns the UserWatchlist lookup
          - execute() call 3: returns the PriceAlertRule lookup
        """
        def _make_result(scalar_value):
            r = MagicMock()
            r.scalar_one_or_none.return_value = scalar_value
            return r

        call_count = [0]
        results = [
            _make_result(idea),
            _make_result(existing_wl),
            _make_result(existing_alert),
        ]

        async def _execute(stmt):
            idx = call_count[0]
            call_count[0] += 1
            return results[idx] if idx < len(results) else _make_result(None)

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=_execute)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_happy_path_creates_watchlist_entry_and_alert(self):
        """
        Happy path: valid non-expired idea → creates watchlist entry + alert,
        returns AddToWatchlistResponse with created=True flags.
        """
        from app.api.generated_ideas import add_idea_to_watchlist

        idea = _make_idea(id=1, ticker="NVDA", added_to_watchlist=False)
        db = self._make_db_for_add_to_watchlist(idea=idea, existing_wl=None, existing_alert=None)
        user = _make_current_user(user_id=10)
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        response = await add_idea_to_watchlist(
            idea_id=1,
            background_tasks=bg_tasks,
            current_user=user,
            db=db,
        )

        assert isinstance(response, AddToWatchlistResponse)
        assert response.ticker == "NVDA"
        assert response.watchlist_entry_created is True
        assert response.alert_rule_created is True
        assert response.idea_id == 1

    @pytest.mark.asyncio
    async def test_idempotent_when_watchlist_entry_already_exists(self):
        """
        If the ticker is already in user_watchlist, watchlist_entry_created=False.
        """
        from app.api.generated_ideas import add_idea_to_watchlist

        idea = _make_idea(id=2, ticker="AAPL")
        existing_wl = MagicMock()
        db = self._make_db_for_add_to_watchlist(
            idea=idea, existing_wl=existing_wl, existing_alert=None
        )
        user = _make_current_user()
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        response = await add_idea_to_watchlist(
            idea_id=2,
            background_tasks=bg_tasks,
            current_user=user,
            db=db,
        )

        assert response.watchlist_entry_created is False

    @pytest.mark.asyncio
    async def test_idempotent_when_alert_rule_already_exists(self):
        """
        If an entered_buy_zone alert already exists for the ticker, alert_rule_created=False.
        """
        from app.api.generated_ideas import add_idea_to_watchlist

        idea = _make_idea(id=3, ticker="MSFT")
        existing_alert = MagicMock()
        db = self._make_db_for_add_to_watchlist(
            idea=idea, existing_wl=None, existing_alert=existing_alert
        )
        user = _make_current_user()
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        response = await add_idea_to_watchlist(
            idea_id=3,
            background_tasks=bg_tasks,
            current_user=user,
            db=db,
        )

        assert response.alert_rule_created is False

    @pytest.mark.asyncio
    async def test_idea_added_to_watchlist_flag_set_true(self):
        """After add-to-watchlist, idea.added_to_watchlist must be set to True."""
        from app.api.generated_ideas import add_idea_to_watchlist

        idea = _make_idea(id=4, ticker="TSLA", added_to_watchlist=False)
        db = self._make_db_for_add_to_watchlist(idea=idea, existing_wl=None, existing_alert=None)
        user = _make_current_user()
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        await add_idea_to_watchlist(
            idea_id=4,
            background_tasks=bg_tasks,
            current_user=user,
            db=db,
        )

        assert idea.added_to_watchlist is True

    @pytest.mark.asyncio
    async def test_background_buy_zone_task_is_scheduled(self):
        """
        After a successful add-to-watchlist, a background task must be enqueued
        to trigger buy zone calculation.
        """
        from app.api.generated_ideas import add_idea_to_watchlist, _trigger_buy_zone_background

        idea = _make_idea(id=5, ticker="AMZN")
        db = self._make_db_for_add_to_watchlist(idea=idea, existing_wl=None, existing_alert=None)
        user = _make_current_user(user_id=99)
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        await add_idea_to_watchlist(
            idea_id=5,
            background_tasks=bg_tasks,
            current_user=user,
            db=db,
        )

        bg_tasks.add_task.assert_called_once_with(
            _trigger_buy_zone_background, "AMZN", 99
        )

    @pytest.mark.asyncio
    async def test_404_when_idea_not_found(self):
        """A missing idea_id must raise HTTP 404."""
        from fastapi import HTTPException
        from app.api.generated_ideas import add_idea_to_watchlist

        db = self._make_db_for_add_to_watchlist(idea=None)
        user = _make_current_user()
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            await add_idea_to_watchlist(
                idea_id=9999,
                background_tasks=bg_tasks,
                current_user=user,
                db=db,
            )

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_410_when_idea_expired(self):
        """An expired idea must raise HTTP 410 Gone."""
        from fastapi import HTTPException
        from app.api.generated_ideas import add_idea_to_watchlist

        # expires_in_hours < 0 means already expired
        expired_idea = _make_idea(id=7, ticker="XYZ", expires_in_hours=-2.0)
        db = self._make_db_for_add_to_watchlist(idea=expired_idea)
        user = _make_current_user()
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        with pytest.raises(HTTPException) as exc_info:
            await add_idea_to_watchlist(
                idea_id=7,
                background_tasks=bg_tasks,
                current_user=user,
                db=db,
            )

        assert exc_info.value.status_code == 410
        assert "expired" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_db_commit_is_called_on_success(self):
        """The session must be committed after a successful add-to-watchlist."""
        from app.api.generated_ideas import add_idea_to_watchlist

        idea = _make_idea(id=8, ticker="GOOG")
        db = self._make_db_for_add_to_watchlist(idea=idea, existing_wl=None, existing_alert=None)
        user = _make_current_user()
        bg_tasks = MagicMock()
        bg_tasks.add_task = MagicMock()

        await add_idea_to_watchlist(
            idea_id=8,
            background_tasks=bg_tasks,
            current_user=user,
            db=db,
        )

        db.commit.assert_called_once()


# ── Tests: run_idea_generator_now ────────────────────────────────────────────


class TestRunIdeaGeneratorNow:
    @pytest.mark.asyncio
    async def test_returns_generated_count_and_top_ticker(self):
        """
        POST /api/ideas/generated/run-now should call run_idea_generator and return
        {"generated": N, "top_ticker": "<ticker>"}.

        run_idea_generator is imported lazily inside the endpoint function body, so
        we must patch its definition in the source module rather than the caller.
        """
        from app.api.generated_ideas import run_idea_generator_now

        idea1 = _make_idea(id=1, ticker="NVDA")
        idea2 = _make_idea(id=2, ticker="AAPL")
        saved_ideas = [idea1, idea2]

        db = AsyncMock()
        user = _make_current_user()

        with patch(
            "app.services.v3_idea_generator_service.run_idea_generator",
            new_callable=AsyncMock,
            return_value=saved_ideas,
        ):
            result = await run_idea_generator_now(current_user=user, db=db)

        assert result["generated"] == 2
        assert result["top_ticker"] == "NVDA"

    @pytest.mark.asyncio
    async def test_empty_generator_returns_none_top_ticker(self):
        """
        If the generator produces no ideas, top_ticker must be None and
        generated must be 0.
        """
        from app.api.generated_ideas import run_idea_generator_now

        db = AsyncMock()
        user = _make_current_user()

        with patch(
            "app.services.v3_idea_generator_service.run_idea_generator",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await run_idea_generator_now(current_user=user, db=db)

        assert result["generated"] == 0
        assert result["top_ticker"] is None

    @pytest.mark.asyncio
    async def test_run_idea_generator_is_called_with_db(self):
        """run_idea_generator must receive the db session from the endpoint."""
        from app.api.generated_ideas import run_idea_generator_now

        db = AsyncMock()
        user = _make_current_user()

        with patch(
            "app.services.v3_idea_generator_service.run_idea_generator",
            new_callable=AsyncMock,
            return_value=[],
        ) as mock_gen:
            await run_idea_generator_now(current_user=user, db=db)

        mock_gen.assert_called_once_with(db)


# ── Tests: GeneratedIdeaOut schema validation ─────────────────────────────────


class TestGeneratedIdeaOutSchema:
    def test_schema_validates_full_idea(self):
        """GeneratedIdeaOut must accept a fully-populated idea dict."""
        now = datetime.now(timezone.utc)
        data = {
            "id": 1,
            "ticker": "NVDA",
            "company_name": "NVIDIA Corporation",
            "source": "technical",
            "reason_summary": "RSI pullback",
            "current_price": 487.2,
            "confidence_score": 0.71,
            "theme_tags": ["ai"],
            "megatrend_tags": ["ai"],
            "moat_score": 0.85,
            "financial_quality_score": 0.80,
            "financial_flags": [],
            "near_52w_low": False,
            "at_weekly_support": True,
            "entry_priority": "WEEKLY_SUPPORT",
            "idea_score": 0.82,
            "generated_at": now,
            "expires_at": now + timedelta(hours=12),
            "added_to_watchlist": False,
        }
        idea = GeneratedIdeaOut(**data)
        assert idea.ticker == "NVDA"
        assert idea.confidence_score == 0.71

    def test_source_values_are_allowed(self):
        """source field must accept news, theme, technical, and merged."""
        now = datetime.now(timezone.utc)
        base = dict(
            id=1, ticker="X", company_name="Co", reason_summary="reason",
            current_price=100.0, confidence_score=0.5,
            theme_tags=[], megatrend_tags=[], moat_score=0.5,
            financial_quality_score=0.5, financial_flags=[],
            near_52w_low=False, at_weekly_support=False,
            entry_priority="STANDARD", idea_score=0.5,
            generated_at=now, expires_at=now + timedelta(hours=12),
            added_to_watchlist=False,
        )
        for src in ("news", "theme", "technical", "merged"):
            idea = GeneratedIdeaOut(**{**base, "source": src})
            assert idea.source == src

    def test_optional_news_fields_can_be_none(self):
        """news_headline, news_url, news_source, and catalyst_type are all optional."""
        now = datetime.now(timezone.utc)
        idea = GeneratedIdeaOut(
            id=1, ticker="NVDA", company_name="NVIDIA",
            source="technical", reason_summary="RSI pullback",
            current_price=100.0, confidence_score=0.7,
            theme_tags=[], megatrend_tags=[], moat_score=0.8,
            financial_quality_score=0.75, financial_flags=[],
            near_52w_low=False, at_weekly_support=False,
            entry_priority="STANDARD", idea_score=0.9,
            generated_at=now, expires_at=now + timedelta(hours=12),
            added_to_watchlist=False,
        )
        assert idea.news_headline is None
        assert idea.news_url is None
        assert idea.catalyst_type is None


# ── Tests: LastScanOut schema validation ──────────────────────────────────────


class TestLastScanOutSchema:
    def test_null_last_scan_at_is_valid(self):
        scan = LastScanOut(last_scan_at=None, ideas_generated=0, next_scan_at=None)
        assert scan.last_scan_at is None
        assert scan.ideas_generated == 0

    def test_with_timestamps(self):
        now = datetime.now(timezone.utc)
        scan = LastScanOut(
            last_scan_at=now,
            ideas_generated=7,
            next_scan_at=now + timedelta(minutes=60),
        )
        assert scan.ideas_generated == 7
        assert scan.next_scan_at is not None
