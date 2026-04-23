from __future__ import annotations

"""
Cron job management API.

Endpoints:
  GET    /api/v1/crons/jobs              — list registered jobs + their state
  GET    /api/v1/crons/templates         — list addable job templates
  PATCH  /api/v1/crons/jobs/{id}         — reschedule (change interval/cron)
  DELETE /api/v1/crons/jobs/{id}         — remove the job from the scheduler
  POST   /api/v1/crons/jobs              — re-add a job from a known template
  POST   /api/v1/crons/jobs/{id}/pause   — pause (stop firing, keep registered)
  POST   /api/v1/crons/jobs/{id}/resume  — resume a paused job
  POST   /api/v1/crons/jobs/{id}/run-now — trigger one immediate run

All mutations apply to the in-memory APScheduler instance. They are lost on
process restart (the `register_jobs()` startup will re-add every template job
with its default cadence).

Auth: every route requires a valid Supabase Bearer token.
"""

import logging
from typing import Annotated, Any

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.scheduler.jobs import JOB_TEMPLATES, get_job_template, scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crons", tags=["crons"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CronJobOut(BaseModel):
    id: str
    name: str
    trigger: str
    trigger_type: str  # "interval" | "cron" | "other"
    interval_minutes: int | None = None
    cron_hour: int | str | None = None
    cron_minute: int | str | None = None
    cron_day_of_week: str | None = None
    next_run_time: str | None
    status: str  # "running" | "paused" | "unknown"


class CronTemplateOut(BaseModel):
    id: str
    description: str
    trigger_type: str
    interval_minutes: int | None = None
    cron_hour: int | None = None
    cron_minute: int | None = None
    cron_day_of_week: str | None = None
    already_registered: bool


class RescheduleRequest(BaseModel):
    """Either interval_minutes OR (at least one of) cron_* fields must be set."""
    interval_minutes: int | None = Field(default=None, ge=1, le=1440 * 7)
    cron_hour: int | None = Field(default=None, ge=0, le=23)
    cron_minute: int | None = Field(default=None, ge=0, le=59)
    cron_day_of_week: str | None = Field(default=None, max_length=32)

    @model_validator(mode="after")
    def _exactly_one_trigger(self) -> "RescheduleRequest":
        has_interval = self.interval_minutes is not None
        has_cron = any(
            v is not None
            for v in (self.cron_hour, self.cron_minute, self.cron_day_of_week)
        )
        if has_interval and has_cron:
            raise ValueError("Provide either interval_minutes or cron fields, not both.")
        if not has_interval and not has_cron:
            raise ValueError("Must provide interval_minutes or at least one cron field.")
        return self


class AddJobRequest(BaseModel):
    """Re-add a job from the registered templates, optionally overriding cadence."""
    job_id: str
    interval_minutes: int | None = Field(default=None, ge=1, le=1440 * 7)
    cron_hour: int | None = Field(default=None, ge=0, le=23)
    cron_minute: int | None = Field(default=None, ge=0, le=59)
    cron_day_of_week: str | None = Field(default=None, max_length=32)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _describe_trigger(job) -> str:
    """Return a short human-readable description of a job's trigger."""
    trigger = job.trigger
    if isinstance(trigger, IntervalTrigger):
        try:
            total_seconds = int(trigger.interval.total_seconds())
            if total_seconds % 3600 == 0:
                return f"every {total_seconds // 3600}h"
            if total_seconds % 60 == 0:
                return f"every {total_seconds // 60} min"
            return f"every {total_seconds}s"
        except Exception:
            return "interval"
    if isinstance(trigger, CronTrigger):
        try:
            fields = {f.name: str(f) for f in trigger.fields if not f.is_default}
            parts = []
            if "day_of_week" in fields:
                parts.append(f"dow={fields['day_of_week']}")
            if "hour" in fields:
                parts.append(f"{fields['hour']}h")
            if "minute" in fields:
                parts.append(f"{fields['minute']}m")
            return "cron " + " ".join(parts) if parts else "cron"
        except Exception:
            return "cron"
    return str(trigger)


def _job_to_out(job) -> CronJobOut:
    trigger = job.trigger
    trigger_type = "other"
    interval_minutes: int | None = None
    cron_hour: int | str | None = None
    cron_minute: int | str | None = None
    cron_dow: str | None = None

    if isinstance(trigger, IntervalTrigger):
        trigger_type = "interval"
        try:
            interval_minutes = int(trigger.interval.total_seconds() // 60)
        except Exception:
            interval_minutes = None
    elif isinstance(trigger, CronTrigger):
        trigger_type = "cron"
        for f in trigger.fields:
            if f.is_default:
                continue
            if f.name == "hour":
                cron_hour = str(f)
            elif f.name == "minute":
                cron_minute = str(f)
            elif f.name == "day_of_week":
                cron_dow = str(f)

    next_run = job.next_run_time
    if next_run is not None:
        job_status = "running"
        next_run_str = next_run.isoformat()
    else:
        job_status = "paused"
        next_run_str = None

    return CronJobOut(
        id=job.id,
        name=job.name,
        trigger=_describe_trigger(job),
        trigger_type=trigger_type,
        interval_minutes=interval_minutes,
        cron_hour=cron_hour,
        cron_minute=cron_minute,
        cron_day_of_week=cron_dow,
        next_run_time=next_run_str,
        status=job_status,
    )


def _build_trigger_kwargs(req: RescheduleRequest | AddJobRequest, *, default: dict[str, Any] | None = None) -> tuple[str, dict[str, Any]]:
    """Return (trigger_name, kwargs) from a reschedule/add request.

    If `default` is provided and the request is empty cron-wise, we fall back
    to the default trigger from the template (used by AddJobRequest).
    """
    if req.interval_minutes is not None:
        return "interval", {"minutes": req.interval_minutes}
    cron_kwargs: dict[str, Any] = {}
    if req.cron_hour is not None:
        cron_kwargs["hour"] = req.cron_hour
    if req.cron_minute is not None:
        cron_kwargs["minute"] = req.cron_minute
    if req.cron_day_of_week is not None:
        cron_kwargs["day_of_week"] = req.cron_day_of_week
    if cron_kwargs:
        return "cron", cron_kwargs
    # Empty request — fall back to default (only used by AddJobRequest)
    if default:
        trigger = default.get("trigger", "interval")
        kw = {k: v for k, v in default.items() if k not in ("func", "trigger", "description")}
        return trigger, kw
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Must provide interval_minutes or cron fields.",
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/jobs", response_model=list[CronJobOut])
async def list_cron_jobs(
    _current_user: Annotated[User, Depends(get_current_user)],
) -> list[CronJobOut]:
    """Return all registered APScheduler jobs and their current state."""
    return [_job_to_out(job) for job in scheduler.get_jobs()]


@router.get("/templates", response_model=list[CronTemplateOut])
async def list_cron_templates(
    _current_user: Annotated[User, Depends(get_current_user)],
) -> list[CronTemplateOut]:
    """Return all addable job templates with a flag marking which are live."""
    registered_ids = {job.id for job in scheduler.get_jobs()}
    out: list[CronTemplateOut] = []
    for job_id, tmpl in JOB_TEMPLATES.items():
        out.append(
            CronTemplateOut(
                id=job_id,
                description=tmpl.get("description", ""),
                trigger_type=tmpl.get("trigger", "interval"),
                interval_minutes=tmpl.get("minutes"),
                cron_hour=tmpl.get("hour"),
                cron_minute=tmpl.get("minute"),
                cron_day_of_week=tmpl.get("day_of_week"),
                already_registered=(job_id in registered_ids),
            )
        )
    return out


@router.patch("/jobs/{job_id}", response_model=CronJobOut)
async def reschedule_cron_job(
    job_id: str,
    body: RescheduleRequest,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> CronJobOut:
    """Reschedule an existing job. Trigger type may change (interval ↔ cron)."""
    if scheduler.get_job(job_id) is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    trigger_name, trigger_kwargs = _build_trigger_kwargs(body)
    try:
        scheduler.reschedule_job(job_id, trigger=trigger_name, **trigger_kwargs)
    except Exception as e:
        logger.exception("Failed to reschedule job %s", job_id)
        raise HTTPException(status_code=400, detail=f"Reschedule failed: {e}")
    logger.info("Rescheduled job %s: trigger=%s kwargs=%s", job_id, trigger_name, trigger_kwargs)
    return _job_to_out(scheduler.get_job(job_id))


@router.delete("/jobs/{job_id}")
async def delete_cron_job(
    job_id: str,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Remove a job from the scheduler. It can be re-added via POST /crons/jobs."""
    if scheduler.get_job(job_id) is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    try:
        scheduler.remove_job(job_id)
    except Exception as e:
        logger.exception("Failed to remove job %s", job_id)
        raise HTTPException(status_code=400, detail=f"Delete failed: {e}")
    logger.info("Removed job %s from scheduler", job_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/jobs", response_model=CronJobOut, status_code=status.HTTP_201_CREATED)
async def add_cron_job(
    body: AddJobRequest,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> CronJobOut:
    """Re-add a job from the template registry, optionally overriding cadence."""
    template = get_job_template(body.job_id)
    if template is None:
        raise HTTPException(
            status_code=404,
            detail=f"No template registered for job_id={body.job_id!r}. "
                   "See GET /crons/templates for valid ids.",
        )
    if scheduler.get_job(body.job_id) is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Job {body.job_id!r} is already registered. "
                   "Use PATCH to change its schedule or DELETE first.",
        )
    func = template["func"]
    trigger_name, trigger_kwargs = _build_trigger_kwargs(body, default=template)
    try:
        scheduler.add_job(
            func,
            trigger_name,
            id=body.job_id,
            coalesce=True,
            max_instances=1,
            replace_existing=False,
            **trigger_kwargs,
        )
    except Exception as e:
        logger.exception("Failed to add job %s", body.job_id)
        raise HTTPException(status_code=400, detail=f"Add failed: {e}")
    logger.info("Added job %s: trigger=%s kwargs=%s", body.job_id, trigger_name, trigger_kwargs)
    return _job_to_out(scheduler.get_job(body.job_id))


@router.post("/jobs/{job_id}/pause", response_model=CronJobOut)
async def pause_cron_job(
    job_id: str,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> CronJobOut:
    """Pause a job — stops it from firing but keeps it registered."""
    if scheduler.get_job(job_id) is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    scheduler.pause_job(job_id)
    logger.info("Paused job %s", job_id)
    return _job_to_out(scheduler.get_job(job_id))


@router.post("/jobs/{job_id}/resume", response_model=CronJobOut)
async def resume_cron_job(
    job_id: str,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> CronJobOut:
    """Resume a paused job."""
    if scheduler.get_job(job_id) is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    scheduler.resume_job(job_id)
    logger.info("Resumed job %s", job_id)
    return _job_to_out(scheduler.get_job(job_id))


@router.post("/jobs/{job_id}/run-now", response_model=CronJobOut)
async def run_cron_job_now(
    job_id: str,
    _current_user: Annotated[User, Depends(get_current_user)],
) -> CronJobOut:
    """Trigger one immediate run by advancing next_run_time to now.

    The actual job callable is run asynchronously by APScheduler; this endpoint
    returns as soon as the schedule is adjusted. The regular cadence is
    preserved — only the next fire is accelerated.
    """
    from datetime import datetime, timezone
    job = scheduler.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.")
    try:
        job.modify(next_run_time=datetime.now(timezone.utc))
    except Exception as e:
        logger.exception("Failed to trigger run-now for %s", job_id)
        raise HTTPException(status_code=400, detail=f"Run-now failed: {e}")
    logger.info("Triggered immediate run for job %s", job_id)
    return _job_to_out(scheduler.get_job(job_id))
