"""API routes for the composed task system with multi-agent collaboration."""

from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.time import utcnow
from app.models.composed_tasks import ComposedTask
from app.models.executive_agents import ExecutiveAgent
from app.models.task_assignments import TaskAssignment
from app.schemas.composed_tasks import (
    AgentSuggestion,
    AgentUpdateInput,
    ComposedTaskCreate,
    ComposedTaskRead,
    ComposedTaskUpdate,
    SuggestAgentsResponse,
    TaskAssignmentRead,
)
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/composed-tasks", tags=["composed-tasks"])


# ─── CRUD ─────────────────────────────────────────────────────────────


@router.post("", response_model=ComposedTaskRead, status_code=status.HTTP_201_CREATED)
async def create_composed_task(
    body: ComposedTaskCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ComposedTaskRead:
    """Create a composed task with agent assignments in one call."""
    # Auto-detect task type from assignments
    task_type = body.task_type
    if len(body.assignments) > 1 and task_type == "single_agent":
        task_type = "multi_agent"

    task = ComposedTask(
        organization_id=ctx.organization.id,
        title=body.title,
        description=body.description,
        original_request=body.original_request,
        task_type=task_type,
        collaboration_mode=body.collaboration_mode,
        status="active",
    )
    session.add(task)
    await session.flush()  # Get task.id

    assignments: list[TaskAssignment] = []
    for i, a in enumerate(body.assignments):
        assignment = TaskAssignment(
            task_id=task.id,
            executive_agent_id=a.executive_agent_id,
            role=a.role,
            order_index=a.order_index or i,
        )
        session.add(assignment)
        assignments.append(assignment)

    await session.commit()
    await session.refresh(task)
    for a in assignments:
        await session.refresh(a)

    return await _build_task_read(session, task, assignments, ctx.organization.id)


@router.get("", response_model=list[ComposedTaskRead])
async def list_composed_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    task_type: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ComposedTaskRead]:
    """List composed tasks with optional filters."""
    stmt = (
        select(ComposedTask)
        .where(col(ComposedTask.organization_id) == ctx.organization.id)
        .order_by(col(ComposedTask.created_at).desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(col(ComposedTask.status) == status_filter)
    if task_type:
        stmt = stmt.where(col(ComposedTask.task_type) == task_type)

    result = await session.exec(stmt)
    tasks = result.all()

    reads = []
    for task in tasks:
        assignments = await TaskAssignment.objects.filter_by(task_id=task.id).all(session)
        reads.append(await _build_task_read(session, task, assignments, ctx.organization.id))
    return reads


@router.get("/suggest-agents", response_model=SuggestAgentsResponse)
async def suggest_agents_for_task(
    description: str = Query(..., min_length=1),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> SuggestAgentsResponse:
    """Suggest suitable agents based on task description keywords."""
    agents = await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
    ).all(session)
    agent_map = {a.openclaw_agent_id: a for a in agents}

    desc_lower = description.lower()
    matches: dict[str, list[str]] = {}
    for agent_key, keywords in _AGENT_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in desc_lower]
        if matched:
            matches[agent_key] = matched

    suggestions: list[AgentSuggestion] = []
    for agent_key, matched_keywords in matches.items():
        agent = agent_map.get(agent_key)
        if agent:
            suggestions.append(AgentSuggestion(
                executive_agent_id=agent.id,
                display_name=agent.display_name,
                avatar_emoji=agent.avatar_emoji,
                reason=f"Matched: {', '.join(matched_keywords)}",
            ))

    if not suggestions and "main" in agent_map:
        mario = agent_map["main"]
        suggestions.append(AgentSuggestion(
            executive_agent_id=mario.id,
            display_name=mario.display_name,
            avatar_emoji=mario.avatar_emoji,
            reason="General task — routed to Mario for coordination",
        ))

    mode = None
    reason = ""
    if len(suggestions) >= 2:
        mode = "parallel"
        reason = f"{len(suggestions)} agents matched — parallel collaboration recommended"
    elif len(suggestions) == 1:
        reason = f"Single agent match: {suggestions[0].display_name}"

    return SuggestAgentsResponse(suggestions=suggestions, recommended_mode=mode, reason=reason)


@router.get("/{task_id}", response_model=ComposedTaskRead)
async def get_composed_task(
    task_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ComposedTaskRead:
    task = await ComposedTask.objects.filter_by(
        id=task_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    assignments = await TaskAssignment.objects.filter_by(task_id=task.id).all(session)
    return await _build_task_read(session, task, assignments, ctx.organization.id)


@router.patch("/{task_id}", response_model=ComposedTaskRead)
async def update_composed_task(
    task_id: UUID,
    body: ComposedTaskUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ComposedTaskRead:
    task = await ComposedTask.objects.filter_by(
        id=task_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(task, key, val)
    task.updated_at = utcnow()

    session.add(task)
    await session.commit()
    await session.refresh(task)

    assignments = await TaskAssignment.objects.filter_by(task_id=task.id).all(session)
    return await _build_task_read(session, task, assignments, ctx.organization.id)


@router.post("/{task_id}/agent-update", response_model=ComposedTaskRead)
async def add_agent_update(
    task_id: UUID,
    body: AgentUpdateInput,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ComposedTaskRead:
    """Add a progress update from a specific agent on this task."""
    task = await ComposedTask.objects.filter_by(
        id=task_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    assignment = await TaskAssignment.objects.filter_by(
        task_id=task.id,
        executive_agent_id=body.executive_agent_id,
    ).first(session)
    if not assignment:
        raise HTTPException(status_code=404, detail="Agent not assigned to this task")

    assignment.last_update = body.message
    assignment.last_update_at = utcnow()
    if assignment.status == "pending":
        assignment.status = "active"
    session.add(assignment)

    # Update task status if needed
    if task.status == "active":
        task.status = "in_progress"
        task.updated_at = utcnow()
        session.add(task)

    await session.commit()
    await session.refresh(task)

    assignments = await TaskAssignment.objects.filter_by(task_id=task.id).all(session)
    for a in assignments:
        await session.refresh(a)
    return await _build_task_read(session, task, assignments, ctx.organization.id)


_AGENT_KEYWORDS: dict[str, list[str]] = {
    "sales": ["sales", "pipeline", "deal", "customer", "revenue", "prospect", "crm", "hubspot", "follow-up", "meeting prep"],
    "fundraising": ["fundraising", "investor", "raise", "deck", "memo", "diligence", "data room", "valuation", "term sheet"],
    "people": ["hire", "hiring", "onboarding", "candidate", "people", "team", "role", "interview", "hr", "org"],
    "strategy": ["strategy", "board", "market", "risk", "competitive", "positioning", "kpi", "narrative", "analysis"],
    "main": ["skill", "improve", "workflow", "coordinate", "prioritize", "synthesize", "review"],
}


# ─── Helpers ──────────────────────────────────────────────────────────

async def _build_task_read(
    session: AsyncSession,
    task: ComposedTask,
    assignments: list[TaskAssignment],
    org_id: UUID,
) -> ComposedTaskRead:
    """Build a full task read model with resolved agent names."""
    agent_ids = {a.executive_agent_id for a in assignments}
    agents = await ExecutiveAgent.objects.filter_by(organization_id=org_id).all(session)
    agent_map = {a.id: a for a in agents if a.id in agent_ids}

    assignment_reads = []
    for a in sorted(assignments, key=lambda x: x.order_index):
        ea = agent_map.get(a.executive_agent_id)
        assignment_reads.append(TaskAssignmentRead(
            id=a.id,
            task_id=a.task_id,
            executive_agent_id=a.executive_agent_id,
            agent_display_name=ea.display_name if ea else None,
            agent_avatar_emoji=ea.avatar_emoji if ea else None,
            agent_executive_role=ea.executive_role if ea else None,
            role=a.role,
            status=a.status,
            order_index=a.order_index,
            last_update=a.last_update,
            last_update_at=a.last_update_at,
            created_at=a.created_at,
        ))

    return ComposedTaskRead(
        id=task.id,
        organization_id=task.organization_id,
        title=task.title,
        description=task.description,
        original_request=task.original_request,
        task_type=task.task_type,
        collaboration_mode=task.collaboration_mode,
        status=task.status,
        assignments=assignment_reads,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
