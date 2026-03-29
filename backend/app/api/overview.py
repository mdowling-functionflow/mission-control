"""API route for the founder Overview page."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import func
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP
from app.core.time import utcnow
from app.models.activity_events import ActivityEvent
from app.models.approvals import Approval
from app.models.executive_agents import ExecutiveAgent
from app.models.improvements import Improvement
from app.schemas.executive_agents import ExecutiveAgentRead
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/overview", tags=["overview"])

# Noise event types filtered from "What Changed"
_NOISE_EVENTS = {"agent.heartbeat", "agent.checkin", "health_check", "ping", "agent.wake"}

_EVENT_LABELS = {
    "approval.created": "Approval requested",
    "approval.resolved": "Approval resolved",
    "task.created": "Task created",
    "task.status_changed": "Task updated",
    "task.assigned": "Task assigned",
    "agent.provisioned": "Agent started",
    "board.created": "Board created",
    "gateway.connected": "Gateway connected",
    "gateway.disconnected": "Gateway disconnected",
}


class OverviewItem(SQLModel):
    title: str
    agent: str | None = None
    agent_emoji: str | None = None
    why: str | None = None
    action: str | None = None
    needs_michael: bool = False
    urgency: str = "medium"  # high / medium / low
    link: str | None = None  # frontend route to drill into


class OverviewApproval(SQLModel):
    id: str
    action_type: str
    status: str
    confidence: float
    rationale: str | None = None
    agent_name: str | None = None
    agent_emoji: str | None = None
    created_at: str


class OverviewActivity(SQLModel):
    event_type: str
    label: str
    message: str | None = None
    agent_name: str | None = None
    created_at: str


class OverviewResponse(SQLModel):
    what_matters_now: list[OverviewItem] = []
    waiting_on_michael: list[OverviewApproval] = []
    agent_snapshots: list[ExecutiveAgentRead] = []
    risks_and_alerts: list[OverviewItem] = []
    what_changed: list[OverviewActivity] = []
    pending_approvals_count: int = 0
    active_improvements_count: int = 0


@router.get("", response_model=OverviewResponse)
async def get_overview(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> OverviewResponse:
    """Aggregated founder overview — powers the home page."""
    org_id = ctx.organization.id
    now = utcnow()

    # 1. Executive agents
    agents = await ExecutiveAgent.objects.filter_by(
        organization_id=org_id,
    ).all(session)
    agent_by_name: dict[str, ExecutiveAgent] = {a.openclaw_agent_id: a for a in agents}

    # 2. Pending approvals
    pending_approvals_stmt = (
        select(Approval)
        .where(col(Approval.status) == "pending")
        .order_by(col(Approval.created_at).desc())
        .limit(20)
    )
    result = await session.exec(pending_approvals_stmt)
    pending = result.all()

    # Build agent_id -> executive agent lookup for approvals
    from app.models.agents import Agent
    agent_id_to_exec: dict[str, ExecutiveAgent] = {}
    if pending:
        board_agent_ids = [a.agent_id for a in pending if a.agent_id]
        if board_agent_ids:
            stmt = select(Agent).where(col(Agent.id).in_(board_agent_ids))
            result = await session.exec(stmt)
            board_agents = result.all()
            for ba in board_agents:
                exec_agent = agent_by_name.get(ba.name)
                if exec_agent:
                    agent_id_to_exec[str(ba.id)] = exec_agent

    waiting_on_michael = []
    for a in pending:
        exec_agent = agent_id_to_exec.get(str(a.agent_id)) if a.agent_id else None
        rationale = _extract_rationale(a)
        waiting_on_michael.append(OverviewApproval(
            id=str(a.id),
            action_type=a.action_type,
            status=a.status,
            confidence=a.confidence,
            rationale=rationale,
            agent_name=exec_agent.display_name if exec_agent else None,
            agent_emoji=exec_agent.avatar_emoji if exec_agent else None,
            created_at=a.created_at.isoformat(),
        ))

    # 3. What changed (last 24h, filtered)
    cutoff = now - timedelta(hours=24)
    activity_stmt = (
        select(ActivityEvent)
        .where(
            col(ActivityEvent.created_at) >= cutoff,
            col(ActivityEvent.event_type).notin_(_NOISE_EVENTS),
        )
        .order_by(col(ActivityEvent.created_at).desc())
        .limit(20)
    )
    result = await session.exec(activity_stmt)
    recent_events = result.all()

    what_changed = []
    for e in recent_events:
        label = _EVENT_LABELS.get(
            e.event_type,
            e.event_type.replace(".", " ").replace("_", " ").title(),
        )
        # Resolve agent name if possible
        agent_name = None
        if e.agent_id:
            ba_stmt = select(Agent.name).where(col(Agent.id) == e.agent_id)
            ba_result = await session.exec(ba_stmt)
            ba_name = ba_result.first()
            if ba_name:
                exec_a = agent_by_name.get(ba_name)
                agent_name = exec_a.display_name if exec_a else ba_name

        what_changed.append(OverviewActivity(
            event_type=e.event_type,
            label=label,
            message=e.message,
            agent_name=agent_name,
            created_at=e.created_at.isoformat(),
        ))

    # 4. What matters now — ranked by urgency
    what_matters: list[OverviewItem] = []

    # Pending approvals = high urgency
    if pending:
        what_matters.append(OverviewItem(
            title=f"{len(pending)} approval{'s' if len(pending) != 1 else ''} waiting for review",
            action="Review approvals",
            needs_michael=True,
            urgency="high",
            link="/approvals",
        ))

    # Stale agents = high urgency
    for agent in agents:
        if agent.status == "stale":
            what_matters.append(OverviewItem(
                title=f"{agent.display_name} has not checked in recently",
                agent=agent.display_name,
                agent_emoji=agent.avatar_emoji,
                action="Check agent health",
                needs_michael=True,
                urgency="high",
                link="/ops",
            ))
        if agent.status == "error":
            what_matters.append(OverviewItem(
                title=f"{agent.display_name} is in error state",
                agent=agent.display_name,
                agent_emoji=agent.avatar_emoji,
                action="Investigate",
                needs_michael=True,
                urgency="high",
                link="/ops",
            ))

    # Agent risks = medium urgency
    for agent in agents:
        if agent.current_risk:
            what_matters.append(OverviewItem(
                title=agent.current_risk,
                agent=agent.display_name,
                agent_emoji=agent.avatar_emoji,
                needs_michael=False,
                urgency="medium",
            ))

    # High-priority proposed improvements = low urgency
    hi_improvements_stmt = (
        select(func.count())
        .select_from(Improvement)
        .where(
            col(Improvement.organization_id) == org_id,
            col(Improvement.status) == "proposed",
            col(Improvement.priority).in_(["high", "urgent"]),
        )
    )
    result = await session.exec(hi_improvements_stmt)
    hi_count = result.one()
    if hi_count:
        what_matters.append(OverviewItem(
            title=f"{hi_count} high-priority improvement{'s' if hi_count != 1 else ''} proposed",
            action="Review improvements",
            needs_michael=False,
            urgency="low",
            link="/improvements",
        ))

    # Sort: high > medium > low
    urgency_order = {"high": 0, "medium": 1, "low": 2}
    what_matters.sort(key=lambda x: urgency_order.get(x.urgency, 1))

    # 5. Risks and alerts
    risks: list[OverviewItem] = []
    for agent in agents:
        if agent.status == "error":
            risks.append(OverviewItem(
                title=f"{agent.display_name} is in error state",
                agent=agent.display_name,
                agent_emoji=agent.avatar_emoji,
                urgency="high",
            ))
        if agent.current_risk:
            risks.append(OverviewItem(
                title=agent.current_risk,
                agent=agent.display_name,
                agent_emoji=agent.avatar_emoji,
                urgency="medium",
            ))

    # 6. Improvement count
    improvements_stmt = select(func.count()).select_from(Improvement).where(
        col(Improvement.organization_id) == org_id,
        col(Improvement.status).in_(["proposed", "reviewing", "testing"]),
    )
    result = await session.exec(improvements_stmt)
    active_improvements = result.one()

    return OverviewResponse(
        what_matters_now=what_matters,
        waiting_on_michael=waiting_on_michael,
        agent_snapshots=[ExecutiveAgentRead.model_validate(a) for a in agents],
        risks_and_alerts=risks,
        what_changed=what_changed,
        pending_approvals_count=len(pending),
        active_improvements_count=active_improvements,
    )


def _extract_rationale(approval: Approval) -> str | None:
    if not approval.payload:
        return None
    for key in ("reason", "lead_reasoning", "rationale", "description"):
        val = approval.payload.get(key)
        if val and isinstance(val, str):
            return val[:200]  # Truncate for overview display
    return None
