"""API routes for the executive agent binding system."""

from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.config import settings
from app.core.time import utcnow
from app.models.activity_events import ActivityEvent
from app.models.agents import Agent
from app.models.approvals import Approval
from app.models.agent_skill_mappings import AgentSkillMapping
from app.models.executive_agents import ExecutiveAgent
from app.models.improvements import Improvement
from app.schemas.executive_agents import (
    DiscoveredAgent,
    ExecutiveAgentBind,
    ExecutiveAgentRead,
    ExecutiveAgentUpdate,
)
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/executive-agents", tags=["executive-agents"])


# ---------------------------------------------------------------------------
# Core CRUD
# ---------------------------------------------------------------------------


@router.get("", response_model=list[ExecutiveAgentRead])
async def list_executive_agents(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ExecutiveAgent]:
    """List all bound executive agents for the current organization."""
    return await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
    ).all(session)


@router.post("/bind", response_model=ExecutiveAgentRead, status_code=status.HTTP_201_CREATED)
async def bind_executive_agent(
    body: ExecutiveAgentBind,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> ExecutiveAgent:
    """Bind an existing OpenClaw agent to an executive role."""
    existing = await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
        openclaw_agent_id=body.openclaw_agent_id,
    ).first(session)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent '{body.openclaw_agent_id}' is already bound.",
        )

    workspace = _find_agent_workspace(body.openclaw_agent_id)
    agent = ExecutiveAgent(
        organization_id=ctx.organization.id,
        openclaw_agent_id=body.openclaw_agent_id,
        openclaw_workspace=workspace,
        display_name=body.display_name,
        executive_role=body.executive_role,
        role_description=body.role_description,
        avatar_emoji=body.avatar_emoji,
        status="bound",
    )
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent


@router.get("/discover", response_model=list[DiscoveredAgent])
async def discover_agents(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[DiscoveredAgent]:
    """Discover agents from openclaw.json that haven't been bound yet."""
    agents_from_config = _read_openclaw_agents()
    bound = await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
    ).all(session)
    bound_ids = {a.openclaw_agent_id for a in bound}

    return [
        DiscoveredAgent(
            openclaw_agent_id=a["id"],
            name=a.get("name"),
            workspace=a.get("workspace"),
            emoji=a.get("emoji"),
            already_bound=a["id"] in bound_ids,
        )
        for a in agents_from_config
    ]


@router.post("/seed", response_model=list[ExecutiveAgentRead], status_code=status.HTTP_201_CREATED)
async def seed_executive_team(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> list[ExecutiveAgent]:
    """Seed the 5 executive agents from the standard team definition."""
    EXEC_TEAM = [
        {
            "openclaw_agent_id": "main",
            "display_name": "Mario",
            "executive_role": "Chief of Staff",
            "avatar_emoji": "🎯",
            "role_description": "Executive orchestrator. Coordinates across all functions, synthesizes updates, manages priorities, and ensures nothing falls through the cracks.",
        },
        {
            "openclaw_agent_id": "sales",
            "display_name": "Sales",
            "executive_role": "Head of Sales",
            "avatar_emoji": "💰",
            "role_description": "Revenue execution. Pipeline hygiene, meeting prep, follow-up discipline, account intelligence, and commercial risk detection.",
        },
        {
            "openclaw_agent_id": "fundraising",
            "display_name": "Fundraising",
            "executive_role": "Head of Fundraising",
            "avatar_emoji": "🚀",
            "role_description": "Investor readiness. Pipeline management, diligence prep, narrative consistency, and raise-readiness analysis.",
        },
        {
            "openclaw_agent_id": "people",
            "display_name": "People",
            "executive_role": "Head of People",
            "avatar_emoji": "👥",
            "role_description": "Talent operations. Hiring pipeline, candidate research, onboarding discipline, and org-process hygiene.",
        },
        {
            "openclaw_agent_id": "strategy",
            "display_name": "Strategy",
            "executive_role": "Head of Strategy",
            "avatar_emoji": "🧭",
            "role_description": "Strategic clarity. Board readiness, KPI narrative, risk framing, market signals, and cross-functional synthesis.",
        },
    ]

    created: list[ExecutiveAgent] = []
    for defn in EXEC_TEAM:
        existing = await ExecutiveAgent.objects.filter_by(
            organization_id=ctx.organization.id,
            openclaw_agent_id=defn["openclaw_agent_id"],
        ).first(session)
        if existing:
            # Update role_description if it was empty
            if not existing.role_description and defn.get("role_description"):
                existing.role_description = defn["role_description"]
                existing.updated_at = utcnow()
                session.add(existing)
            created.append(existing)
            continue

        workspace = _find_agent_workspace(defn["openclaw_agent_id"])
        agent = ExecutiveAgent(
            organization_id=ctx.organization.id,
            openclaw_workspace=workspace,
            **defn,
        )
        session.add(agent)
        created.append(agent)

    await session.commit()
    for a in created:
        await session.refresh(a)
    return created


@router.get("/{agent_id}", response_model=ExecutiveAgentRead)
async def get_executive_agent(
    agent_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ExecutiveAgent:
    """Get a single executive agent by ID."""
    agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return agent


@router.patch("/{agent_id}", response_model=ExecutiveAgentRead)
async def update_executive_agent(
    agent_id: UUID,
    body: ExecutiveAgentUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> ExecutiveAgent:
    """Update an executive agent's display config or status."""
    agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = body.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(agent, key, val)
    agent.updated_at = utcnow()

    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unbind_executive_agent(
    agent_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> None:
    """Unbind an executive agent (does NOT delete the OpenClaw agent)."""
    agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await session.delete(agent)
    await session.commit()


# ---------------------------------------------------------------------------
# Sub-resource endpoints
# ---------------------------------------------------------------------------


@router.post("/refresh-all", response_model=list[ExecutiveAgentRead])
async def refresh_all_agents(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ExecutiveAgent]:
    """Refresh computed counts for all executive agents from live board data."""
    agents = await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
    ).all(session)

    for agent in agents:
        board_agent_ids = await _resolve_board_agent_ids(session, agent.openclaw_agent_id)
        agent.pending_approvals_count = await _count_pending_approvals(session, board_agent_ids)
        agent.active_tasks_count = await _count_active_tasks(session, board_agent_ids)
        agent.updated_at = utcnow()
        session.add(agent)

    await session.commit()
    for a in agents:
        await session.refresh(a)
    return agents


@router.get("/{agent_id}/activity")
async def get_agent_activity(
    agent_id: UUID,
    limit: int = Query(default=30, le=100),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[dict]:
    """Recent activity events for this executive agent's board-native counterparts."""
    agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    board_agent_ids = await _resolve_board_agent_ids(session, agent.openclaw_agent_id)
    if not board_agent_ids:
        return []

    stmt = (
        select(ActivityEvent)
        .where(col(ActivityEvent.agent_id).in_(board_agent_ids))
        .order_by(col(ActivityEvent.created_at).desc())
        .limit(limit)
    )
    result = await session.exec(stmt)
    events = result.all()
    return [
        {
            "id": str(e.id),
            "event_type": _humanize_event_type(e.event_type),
            "message": e.message,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]


@router.get("/{agent_id}/approvals")
async def get_agent_approvals(
    agent_id: UUID,
    status_filter: str | None = Query(default=None, alias="status"),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[dict]:
    """Approvals linked to this executive agent's board-native counterparts."""
    agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    board_agent_ids = await _resolve_board_agent_ids(session, agent.openclaw_agent_id)
    if not board_agent_ids:
        return []

    stmt = (
        select(Approval)
        .where(col(Approval.agent_id).in_(board_agent_ids))
        .order_by(col(Approval.created_at).desc())
        .limit(50)
    )
    if status_filter:
        stmt = stmt.where(col(Approval.status) == status_filter)

    result = await session.exec(stmt)
    approvals = result.all()
    return [
        {
            "id": str(a.id),
            "action_type": a.action_type,
            "status": a.status,
            "confidence": a.confidence,
            "rationale": _extract_rationale(a),
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        }
        for a in approvals
    ]


@router.get("/{agent_id}/improvements")
async def get_agent_improvements(
    agent_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[dict]:
    """Improvement proposals by this executive agent."""
    agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    items = await Improvement.objects.filter_by(
        organization_id=ctx.organization.id,
        executive_agent_id=agent_id,
    ).order_by(col(Improvement.created_at).desc()).all(session)

    return [
        {
            "id": str(i.id),
            "title": i.title,
            "description": i.description,
            "status": i.status,
            "priority": i.priority,
            "category": i.category,
            "created_at": i.created_at.isoformat(),
        }
        for i in items
    ]


# ---------------------------------------------------------------------------
# Skill Mappings
# ---------------------------------------------------------------------------


@router.get("/{agent_id}/skill-mappings")
async def list_skill_mappings(
    agent_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[dict]:
    """List skill mappings for an executive agent."""
    mappings = await AgentSkillMapping.objects.filter_by(
        executive_agent_id=agent_id,
    ).all(session)
    return [
        {
            "id": str(m.id),
            "executive_agent_id": str(m.executive_agent_id),
            "skill_path": m.skill_path,
            "relevance": m.relevance,
            "created_at": m.created_at.isoformat(),
        }
        for m in mappings
    ]


class SkillMappingCreate(SQLModel):
    skill_path: str
    relevance: str = "core"


@router.post("/{agent_id}/skill-mappings", status_code=status.HTTP_201_CREATED)
async def add_skill_mapping(
    agent_id: UUID,
    body: SkillMappingCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> dict:
    """Add a skill mapping for an executive agent."""
    mapping = AgentSkillMapping(
        executive_agent_id=agent_id,
        skill_path=body.skill_path,
        relevance=body.relevance,
    )
    session.add(mapping)
    await session.commit()
    await session.refresh(mapping)
    return {
        "id": str(mapping.id),
        "executive_agent_id": str(mapping.executive_agent_id),
        "skill_path": mapping.skill_path,
        "relevance": mapping.relevance,
        "created_at": mapping.created_at.isoformat(),
    }


@router.delete("/{agent_id}/skill-mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_skill_mapping(
    agent_id: UUID,
    mapping_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> None:
    """Remove a skill mapping."""
    mapping = await AgentSkillMapping.objects.filter_by(
        id=mapping_id,
        executive_agent_id=agent_id,
    ).first(session)
    if not mapping:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await session.delete(mapping)
    await session.commit()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

EVENT_TYPE_LABELS = {
    "approval.created": "Approval requested",
    "approval.resolved": "Approval resolved",
    "task.created": "Task created",
    "task.status_changed": "Task status changed",
    "task.assigned": "Task assigned",
    "agent.provisioned": "Agent provisioned",
    "agent.heartbeat": "Agent heartbeat",
    "agent.wake": "Agent wake",
    "agent.checkin": "Agent check-in",
    "board.created": "Board created",
    "gateway.connected": "Gateway connected",
}

NOISE_EVENT_TYPES = {"agent.heartbeat", "agent.checkin", "health_check", "ping"}


def _humanize_event_type(event_type: str) -> str:
    return EVENT_TYPE_LABELS.get(event_type, event_type.replace(".", " ").replace("_", " ").title())


def _extract_rationale(approval: Approval) -> str | None:
    """Extract human-readable rationale from approval payload."""
    if not approval.payload:
        return None
    payload = approval.payload
    for key in ("reason", "lead_reasoning", "rationale", "description"):
        val = payload.get(key)
        if val and isinstance(val, str):
            return val
    return None


async def _resolve_board_agent_ids(session: AsyncSession, openclaw_agent_id: str) -> list[UUID]:
    """Resolve an openclaw_agent_id to board-native Agent record IDs."""
    stmt = select(Agent.id).where(col(Agent.name) == openclaw_agent_id)
    result = await session.exec(stmt)
    return list(result.all())


async def _count_pending_approvals(session: AsyncSession, board_agent_ids: list[UUID]) -> int:
    if not board_agent_ids:
        return 0
    stmt = (
        select(func.count())
        .select_from(Approval)
        .where(
            col(Approval.agent_id).in_(board_agent_ids),
            col(Approval.status) == "pending",
        )
    )
    result = await session.exec(stmt)
    return result.one()


async def _count_active_tasks(session: AsyncSession, board_agent_ids: list[UUID]) -> int:
    if not board_agent_ids:
        return 0
    from app.models.tasks import Task
    stmt = (
        select(func.count())
        .select_from(Task)
        .where(
            col(Task.assigned_agent_id).in_(board_agent_ids),
            col(Task.status).in_(["inbox", "in_progress"]),
        )
    )
    result = await session.exec(stmt)
    return result.one()


def _read_openclaw_agents() -> list[dict]:
    """Read agent list from openclaw.json."""
    openclaw_dir = settings.openclaw_dir
    if not openclaw_dir:
        return []
    config_path = Path(openclaw_dir) / "openclaw.json"
    if not config_path.exists():
        return []
    try:
        with open(config_path) as f:
            config = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    agents_section = config.get("agents", {})
    raw_list = agents_section.get("list", [])
    result = []
    for entry in raw_list:
        agent_id = entry.get("id", "")
        if not agent_id:
            continue
        identity = entry.get("identity", {}) or {}
        result.append({
            "id": agent_id,
            "name": identity.get("name") or entry.get("name", agent_id),
            "workspace": entry.get("workspace"),
            "emoji": identity.get("emoji"),
        })
    return result


def _find_agent_workspace(agent_id: str) -> str | None:
    """Find workspace path for a given agent ID."""
    for agent in _read_openclaw_agents():
        if agent["id"] == agent_id:
            return agent.get("workspace")
    return None
