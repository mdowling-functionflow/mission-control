"""Global cross-board approval listing for the founder approvals page."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP
from app.models.agents import Agent
from app.models.approvals import Approval
from app.models.boards import Board
from app.models.executive_agents import ExecutiveAgent
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/approvals", tags=["global-approvals"])


@router.get("/global")
async def list_global_approvals(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[dict]:
    """List all approvals across all boards in the organization."""
    org_id = ctx.organization.id

    # Get all boards in this org
    boards = await Board.objects.filter_by(organization_id=org_id).all(session)
    board_ids = [b.id for b in boards]
    board_names = {str(b.id): b.name for b in boards}

    if not board_ids:
        return []

    # Query approvals across all boards
    stmt = (
        select(Approval)
        .where(col(Approval.board_id).in_(board_ids))
        .order_by(col(Approval.created_at).desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(col(Approval.status) == status_filter)

    result = await session.exec(stmt)
    approvals = result.all()

    # Build agent_id -> executive agent lookup
    exec_agents = await ExecutiveAgent.objects.filter_by(organization_id=org_id).all(session)
    exec_by_name = {a.openclaw_agent_id: a for a in exec_agents}

    agent_ids = [a.agent_id for a in approvals if a.agent_id]
    agent_id_to_exec: dict[str, ExecutiveAgent] = {}
    if agent_ids:
        ba_stmt = select(Agent).where(col(Agent.id).in_(agent_ids))
        ba_result = await session.exec(ba_stmt)
        for ba in ba_result.all():
            exec_a = exec_by_name.get(ba.name)
            if exec_a:
                agent_id_to_exec[str(ba.id)] = exec_a

    results = []
    for a in approvals:
        exec_agent = agent_id_to_exec.get(str(a.agent_id)) if a.agent_id else None
        rationale = None
        if a.payload:
            for key in ("reason", "lead_reasoning", "rationale", "description"):
                val = a.payload.get(key)
                if val and isinstance(val, str):
                    rationale = val[:300]
                    break

        results.append({
            "id": str(a.id),
            "board_id": str(a.board_id),
            "board_name": board_names.get(str(a.board_id), "Unknown"),
            "agent_id": str(a.agent_id) if a.agent_id else None,
            "agent_name": exec_agent.display_name if exec_agent else None,
            "agent_emoji": exec_agent.avatar_emoji if exec_agent else None,
            "action_type": a.action_type,
            "status": a.status,
            "confidence": a.confidence,
            "rationale": rationale,
            "payload": a.payload,
            "created_at": a.created_at.isoformat(),
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
        })

    return results
