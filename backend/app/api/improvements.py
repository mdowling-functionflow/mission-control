"""API routes for the improvement proposal system."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.time import utcnow
from app.models.executive_agents import ExecutiveAgent
from app.models.improvements import Improvement
from app.schemas.improvements import (
    ImprovementCreate,
    ImprovementRead,
    ImprovementStats,
    ImprovementUpdate,
)
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/improvements", tags=["improvements"])


async def _resolve_agent_names(
    session: AsyncSession, items: list[Improvement], org_id: UUID,
) -> list[ImprovementRead]:
    """Resolve agent display names for a list of improvements."""
    agent_ids = {i.executive_agent_id for i in items if i.executive_agent_id}
    agent_map: dict[UUID, ExecutiveAgent] = {}
    if agent_ids:
        agents = await ExecutiveAgent.objects.filter_by(
            organization_id=org_id,
        ).all(session)
        agent_map = {a.id: a for a in agents if a.id in agent_ids}

    results = []
    for item in items:
        read = ImprovementRead.model_validate(item)
        if item.executive_agent_id and item.executive_agent_id in agent_map:
            ea = agent_map[item.executive_agent_id]
            read.agent_display_name = ea.display_name
            read.agent_avatar_emoji = ea.avatar_emoji
        results.append(read)
    return results


@router.get("", response_model=list[ImprovementRead])
async def list_improvements(
    status_filter: str | None = Query(default=None, alias="status"),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ImprovementRead]:
    """List improvements, optionally filtered by status."""
    qs = Improvement.objects.filter_by(organization_id=ctx.organization.id)
    if status_filter:
        qs = qs.filter(col(Improvement.status) == status_filter)
    items = await qs.order_by(col(Improvement.created_at).desc()).all(session)
    return await _resolve_agent_names(session, items, ctx.organization.id)


@router.post("", response_model=ImprovementRead, status_code=status.HTTP_201_CREATED)
async def create_improvement(
    body: ImprovementCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ImprovementRead:
    improvement = Improvement(
        organization_id=ctx.organization.id,
        **body.model_dump(),
    )
    session.add(improvement)
    await session.commit()
    await session.refresh(improvement)
    resolved = await _resolve_agent_names(session, [improvement], ctx.organization.id)
    return resolved[0]


@router.get("/stats", response_model=ImprovementStats)
async def get_improvement_stats(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ImprovementStats:
    """Get counts by status."""
    stmt = (
        select(Improvement.status, func.count())
        .where(col(Improvement.organization_id) == ctx.organization.id)
        .group_by(Improvement.status)
    )
    result = await session.exec(stmt)
    rows = result.all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    return ImprovementStats(
        proposed=counts.get("proposed", 0),
        reviewing=counts.get("reviewing", 0),
        testing=counts.get("testing", 0),
        adopted=counts.get("adopted", 0),
        rejected=counts.get("rejected", 0),
        total=total,
    )


@router.get("/{improvement_id}", response_model=ImprovementRead)
async def get_improvement(
    improvement_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ImprovementRead:
    item = await Improvement.objects.filter_by(
        id=improvement_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    resolved = await _resolve_agent_names(session, [item], ctx.organization.id)
    return resolved[0]


@router.patch("/{improvement_id}", response_model=ImprovementRead)
async def update_improvement(
    improvement_id: UUID,
    body: ImprovementUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> ImprovementRead:
    item = await Improvement.objects.filter_by(
        id=improvement_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = body.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(item, key, val)

    if body.status in ("adopted", "rejected") and not item.resolved_at:
        item.resolved_at = utcnow()
    item.updated_at = utcnow()

    session.add(item)
    await session.commit()
    await session.refresh(item)
    resolved = await _resolve_agent_names(session, [item], ctx.organization.id)
    return resolved[0]
