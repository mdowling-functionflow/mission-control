"""API routes for cron/schedule management — proxies to local bridge."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlmodel import SQLModel

from app.api.deps import ORG_MEMBER_DEP
from app.core.config import settings
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/schedules", tags=["schedules"])


class ScheduleCreate(SQLModel):
    name: str
    agent_id: str | None = None
    cron_expr: str | None = None
    every: str | None = None
    message: str = ""
    description: str | None = None
    tz: str = "Europe/Dublin"
    session: str = "isolated"
    model: str | None = None
    timeout_seconds: int | None = None
    thinking: str | None = None


class ScheduleEdit(SQLModel):
    name: str | None = None
    cron_expr: str | None = None
    every: str | None = None
    message: str | None = None
    description: str | None = None
    tz: str | None = None
    model: str | None = None
    timeout_seconds: int | None = None
    thinking: str | None = None
    enabled: bool | None = None


async def _bridge_request(method: str, path: str, json_body: dict | None = None) -> dict | list:
    if not settings.bridge_url:
        raise HTTPException(status_code=503, detail="Bridge not configured — schedules require local bridge")
    url = f"{settings.bridge_url.rstrip('/')}{path}"
    headers = {"X-Bridge-Token": settings.bridge_token}
    async with httpx.AsyncClient(timeout=120.0) as client:
        if method == "GET":
            resp = await client.get(url, headers=headers)
        elif method == "POST":
            resp = await client.post(url, headers=headers, json=json_body or {})
        elif method == "DELETE":
            resp = await client.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported: {method}")
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


@router.get("")
async def list_schedules(
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict | list:
    """List all cron jobs."""
    return await _bridge_request("GET", "/cron/list")


@router.get("/status")
async def schedule_status(
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Get cron scheduler status."""
    return await _bridge_request("GET", "/cron/status")


@router.post("")
async def create_schedule(
    body: ScheduleCreate,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Create a new cron job."""
    return await _bridge_request("POST", "/cron/add", body.model_dump(exclude_none=True))


@router.post("/{job_id}/edit")
async def edit_schedule(
    job_id: str,
    body: ScheduleEdit,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Edit an existing cron job."""
    return await _bridge_request("POST", f"/cron/edit/{job_id}", body.model_dump(exclude_none=True))


@router.delete("/{job_id}")
async def remove_schedule(
    job_id: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Remove a cron job."""
    return await _bridge_request("DELETE", f"/cron/remove/{job_id}")


@router.post("/{job_id}/run")
async def run_schedule(
    job_id: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Run a cron job now."""
    return await _bridge_request("POST", f"/cron/run/{job_id}")


@router.post("/{job_id}/enable")
async def enable_schedule(
    job_id: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Enable a cron job."""
    return await _bridge_request("POST", f"/cron/enable/{job_id}")


@router.post("/{job_id}/disable")
async def disable_schedule(
    job_id: str,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Disable a cron job."""
    return await _bridge_request("POST", f"/cron/disable/{job_id}")


@router.get("/runs")
async def schedule_runs(
    job_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict | list:
    """Get cron run history."""
    params = f"?limit={limit}"
    if job_id:
        params += f"&job_id={job_id}"
    return await _bridge_request("GET", f"/cron/runs{params}")
