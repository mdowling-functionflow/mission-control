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
    ExecutiveAgentCreate,
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
    sidebar_visible: bool | None = Query(default=None),
    agent_type: str | None = Query(default=None),
    parent_agent_id: UUID | None = Query(default=None),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ExecutiveAgent]:
    """List executive agents with optional filters."""
    qs = ExecutiveAgent.objects.filter_by(organization_id=ctx.organization.id)
    if sidebar_visible is not None:
        qs = qs.filter(col(ExecutiveAgent.sidebar_visible) == sidebar_visible)
    if agent_type is not None:
        qs = qs.filter(col(ExecutiveAgent.agent_type) == agent_type)
    if parent_agent_id is not None:
        qs = qs.filter(col(ExecutiveAgent.parent_agent_id) == parent_agent_id)
    return await qs.all(session)


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
        persona_name=body.persona_name,
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
    """Seed the primary operating agents from the standard team definition."""
    EXEC_TEAM = [
        {
            "openclaw_agent_id": "main",
            "display_name": "Mario",
            "persona_name": "Mario",
            "executive_role": "Crew Captain",
            "avatar_emoji": "🍄",
            "role_description": "Front door and orchestrator for Michael's full agent bench. Connects dots across company, academic, and life lanes; delegates cleanly; synthesizes; protects follow-through.",
        },
        {
            "openclaw_agent_id": "sales",
            "display_name": "Sales (Piper)",
            "persona_name": "Piper",
            "executive_role": "Revenue Captain",
            "avatar_emoji": "💼",
            "role_description": "Sales execution specialist focused on pipeline truth, meeting prep, follow-up discipline, commercial signal, and deal momentum.",
        },
        {
            "openclaw_agent_id": "fundraising",
            "display_name": "Fundraising (Iris)",
            "persona_name": "Iris",
            "executive_role": "Fundraising Chief of Staff",
            "avatar_emoji": "📈",
            "role_description": "Investor readiness specialist focused on investor threads, diligence completeness, narrative coherence, and raise-readiness.",
        },
        {
            "openclaw_agent_id": "people",
            "display_name": "People (June)",
            "persona_name": "June",
            "executive_role": "People Steward",
            "avatar_emoji": "🤝",
            "role_description": "People and hiring operator focused on candidate momentum, interview prep, onboarding discipline, and humane process quality.",
        },
        {
            "openclaw_agent_id": "strategy",
            "display_name": "Strategy (Atlas)",
            "persona_name": "Atlas",
            "executive_role": "Strategy Cartographer",
            "avatar_emoji": "🧭",
            "role_description": "Strategy specialist focused on decision framing, board readiness, cross-functional patterns, and risk clarity.",
        },
        {
            "openclaw_agent_id": "dcu",
            "display_name": "DCU (Finch)",
            "persona_name": "Finch",
            "executive_role": "Academic Steward",
            "avatar_emoji": "🎓",
            "role_description": "DCU/academic lane specialist for professor inbox, taught-module admin, supervision visibility, deadlines, and clean academic follow-through.",
        },
        {
            "openclaw_agent_id": "life-admin",
            "display_name": "Life (Hazel)",
            "persona_name": "Hazel",
            "executive_role": "Life Concierge",
            "avatar_emoji": "🏡",
            "role_description": "Personal life-admin and logistics specialist focused on reminders, scheduling friction, errands, travel, and household/admin tidiness.",
        },
    ]

    created: list[ExecutiveAgent] = []
    for defn in EXEC_TEAM:
        existing = await ExecutiveAgent.objects.filter_by(
            organization_id=ctx.organization.id,
            openclaw_agent_id=defn["openclaw_agent_id"],
        ).first(session)
        if existing:
            updated = False
            # Update role_description if it was empty
            if not existing.role_description and defn.get("role_description"):
                existing.role_description = defn["role_description"]
                updated = True
            # Populate persona_name if missing
            if not existing.persona_name and defn.get("persona_name"):
                existing.persona_name = defn["persona_name"]
                updated = True
            if updated:
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


@router.post("/seed-allocations", status_code=status.HTTP_201_CREATED)
async def seed_skill_allocations(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> dict:
    """Seed skill-to-agent allocation mappings from the canonical allocation table."""
    ALLOCATIONS: dict[str, list[tuple[str, str]]] = {
        # agent_slug: [(skill_path, relevance), ...]
        "main": [
            ("orchestrator", "core"), ("delegation", "core"), ("cross-agent-synthesis", "core"),
            ("brand-voice", "shared"), ("email-tools", "shared"),
        ],
        "sales": [
            ("hubspot", "core"), ("sales-pipeline", "core"), ("meeting-prep-sales", "core"),
            ("brand-voice", "shared"), ("email-tools", "shared"), ("ai-meeting-notes", "shared"),
        ],
        "fundraising": [
            ("investor-pipeline", "core"), ("diligence-prep", "core"), ("pitch-narrative", "core"),
            ("brand-voice", "shared"), ("email-tools", "shared"),
        ],
        "people": [
            ("hiring-pipeline", "core"), ("candidate-research", "core"), ("onboarding", "core"),
            ("email-tools", "shared"),
        ],
        "strategy": [
            ("competitor-watch", "core"), ("market-news-analyst", "core"), ("strategy-framing", "core"),
            ("brand-voice", "shared"),
        ],
        "dcu": [
            ("academic-calendar", "core"), ("slides-gen", "core"), ("academic-email", "core"),
        ],
        "life-admin": [
            ("calendar-management", "core"), ("reminders", "core"), ("logistics", "core"),
            ("email-tools", "shared"),
        ],
        "narrative-sales": [
            ("linkedin-writer", "core"), ("brand-voice", "core"), ("content-calendar", "core"),
            ("email-tools", "shared"),
        ],
        "builder": [
            ("code-gen", "core"), ("automation", "core"), ("tooling", "core"),
        ],
    }

    agents = await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
    ).all(session)
    agent_map = {a.openclaw_agent_id: a for a in agents}

    created_count = 0
    for agent_slug, skills in ALLOCATIONS.items():
        agent = agent_map.get(agent_slug)
        if not agent:
            continue
        # Check existing mappings
        existing = await AgentSkillMapping.objects.filter_by(
            executive_agent_id=agent.id,
        ).all(session)
        existing_paths = {m.skill_path for m in existing}

        for skill_path, relevance in skills:
            if skill_path not in existing_paths:
                mapping = AgentSkillMapping(
                    executive_agent_id=agent.id,
                    skill_path=skill_path,
                    relevance=relevance,
                )
                session.add(mapping)
                created_count += 1

    await session.commit()
    return {"created": created_count, "message": f"Seeded {created_count} skill allocations"}


@router.post("/create", response_model=ExecutiveAgentRead, status_code=status.HTTP_201_CREATED)
async def create_executive_agent(
    body: ExecutiveAgentCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> ExecutiveAgent:
    """Create a new agent — syncs to OpenClaw via bridge, then creates DB record."""
    # Check slug uniqueness
    existing = await ExecutiveAgent.objects.filter_by(
        organization_id=ctx.organization.id,
        openclaw_agent_id=body.openclaw_agent_id,
    ).first(session)
    if existing:
        raise HTTPException(status_code=409, detail=f"Agent '{body.openclaw_agent_id}' already exists")

    # Validate helper has parent
    if body.agent_type == "helper" and not body.parent_agent_id:
        raise HTTPException(status_code=400, detail="Helper agents must have a parent_agent_id")

    # Create in OpenClaw via bridge
    if settings.bridge_url:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{settings.bridge_url.rstrip('/')}/agents/create",
                    headers={"X-Bridge-Token": settings.bridge_token},
                    json={"agent_id": body.openclaw_agent_id},
                )
            if resp.status_code == 200:
                data = resp.json()
                if not data.get("success"):
                    raise HTTPException(status_code=502, detail=f"OpenClaw agent creation failed: {data.get('error', 'unknown')}")
                workspace = data.get("workspace")
            else:
                raise HTTPException(status_code=502, detail=f"Bridge error: {resp.text[:200]}")
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Bridge unreachable: {str(exc)[:200]}")
    else:
        workspace = _find_agent_workspace(body.openclaw_agent_id)

    agent = ExecutiveAgent(
        organization_id=ctx.organization.id,
        openclaw_agent_id=body.openclaw_agent_id,
        openclaw_workspace=workspace,
        display_name=body.display_name,
        executive_role=body.executive_role,
        role_description=body.role_description,
        avatar_emoji=body.avatar_emoji,
        persona_name=body.persona_name,
        agent_type=body.agent_type,
        parent_agent_id=body.parent_agent_id,
        sidebar_visible=(body.agent_type == "primary"),
        status="bound",
    )
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent


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
    """Update an executive agent's display config or status. Syncs identity back to OpenClaw."""
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

    # Sync identity fields back to OpenClaw IDENTITY.md via bridge
    identity_fields = {"display_name", "executive_role", "avatar_emoji", "persona_name", "role_description"}
    if identity_fields & set(update_data.keys()):
        await _sync_identity_to_openclaw(agent)

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


async def _sync_identity_to_openclaw(agent: ExecutiveAgent) -> None:
    """Write agent identity back to OpenClaw's IDENTITY.md via bridge.

    This ensures changes made in Mission Control propagate to the filesystem
    so OpenClaw and Mission Control stay in sync.
    """
    from app.core.logging import get_logger
    logger = get_logger(__name__)

    # Build IDENTITY.md content from current agent state
    lines = ["# IDENTITY.md - Who Am I?", ""]
    lines.append(f"- **Name:** {agent.persona_name or agent.display_name}")
    lines.append(f"- **Display Label:** {agent.display_name}")
    if agent.executive_role:
        lines.append(f"- **Role:** {agent.executive_role}")
    if agent.avatar_emoji:
        lines.append(f"- **Emoji:** {agent.avatar_emoji}")
    if agent.role_description:
        lines.append(f"- **Description:** {agent.role_description}")
    lines.append("")

    content = "\n".join(lines)

    # Try to read existing IDENTITY.md first — preserve any extra content below
    if settings.bridge_url:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Read existing content
                read_resp = await client.get(
                    f"{settings.bridge_url.rstrip('/')}/agent-files/{agent.openclaw_agent_id}/IDENTITY.md",
                    headers={"X-Bridge-Token": settings.bridge_token},
                )
                if read_resp.status_code == 200:
                    existing = read_resp.json().get("content", "")
                    # Find where the structured header ends and preserve the rest
                    # Look for a blank line after the last "- **" line
                    existing_lines = existing.split("\n")
                    extra_start = None
                    for i, line in enumerate(existing_lines):
                        if line.strip() == "" and i > 0 and not existing_lines[i - 1].startswith("- **"):
                            if any(existing_lines[j].strip() for j in range(i + 1, len(existing_lines))):
                                extra_start = i
                                break
                    if extra_start is not None:
                        content = "\n".join(lines) + "\n".join(existing_lines[extra_start:])

                # Write back
                write_resp = await client.put(
                    f"{settings.bridge_url.rstrip('/')}/agent-files/{agent.openclaw_agent_id}/IDENTITY.md",
                    headers={"X-Bridge-Token": settings.bridge_token},
                    json={"content": content},
                )
                if write_resp.status_code == 200:
                    logger.info("identity.synced", agent=agent.openclaw_agent_id)
                else:
                    logger.warning("identity.sync_failed", agent=agent.openclaw_agent_id, status=write_resp.status_code)
        except Exception as exc:
            logger.warning("identity.sync_error", agent=agent.openclaw_agent_id, error=str(exc)[:200])
