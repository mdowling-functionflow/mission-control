"""SSE event stream — real-time updates for the Mission Control frontend."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Request
from sqlmodel import col, func, select
from sse_starlette.sse import EventSourceResponse

from app.api.deps import ORG_MEMBER_DEP
from app.core.time import utcnow
from app.db.session import async_session_maker
from app.models.activity_events import ActivityEvent
from app.models.agent_messages import AgentMessage
from app.models.approvals import Approval
from app.models.composed_tasks import ComposedTask
from app.models.executive_agents import ExecutiveAgent
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/events", tags=["events"])

POLL_INTERVAL = 3  # seconds


@router.get("/stream")
async def stream_events(
    request: Request,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> EventSourceResponse:
    """Stream real-time events for tasks, agents, approvals, and messages."""
    org_id = ctx.organization.id
    last_seen = utcnow()

    async def event_generator():
        nonlocal last_seen
        while True:
            if await request.is_disconnected():
                break

            events = []
            async with async_session_maker() as session:
                # 1. New/updated composed tasks
                tasks_stmt = (
                    select(ComposedTask)
                    .where(
                        col(ComposedTask.organization_id) == org_id,
                        col(ComposedTask.updated_at) > last_seen,
                    )
                    .order_by(col(ComposedTask.updated_at).asc())
                    .limit(20)
                )
                result = await session.exec(tasks_stmt)
                for task in result.all():
                    events.append({
                        "event": "task.updated",
                        "data": json.dumps({
                            "id": str(task.id),
                            "title": task.title,
                            "status": task.status,
                            "updated_at": task.updated_at.isoformat(),
                        }),
                    })

                # 2. New agent messages
                msgs_stmt = (
                    select(AgentMessage)
                    .where(
                        col(AgentMessage.organization_id) == org_id,
                        col(AgentMessage.created_at) > last_seen,
                    )
                    .order_by(col(AgentMessage.created_at).asc())
                    .limit(20)
                )
                result = await session.exec(msgs_stmt)
                for msg in result.all():
                    events.append({
                        "event": "agent.message",
                        "data": json.dumps({
                            "id": str(msg.id),
                            "agent_id": str(msg.executive_agent_id),
                            "role": msg.role,
                            "content": msg.content[:200],
                            "created_at": msg.created_at.isoformat(),
                        }),
                    })

                # 3. New/resolved approvals
                approvals_stmt = (
                    select(Approval)
                    .where(col(Approval.created_at) > last_seen)
                    .order_by(col(Approval.created_at).asc())
                    .limit(10)
                )
                result = await session.exec(approvals_stmt)
                for appr in result.all():
                    events.append({
                        "event": "approval.updated",
                        "data": json.dumps({
                            "id": str(appr.id),
                            "action_type": appr.action_type,
                            "status": appr.status,
                            "created_at": appr.created_at.isoformat(),
                        }),
                    })

                # 4. Agent status changes
                agents_stmt = (
                    select(ExecutiveAgent)
                    .where(
                        col(ExecutiveAgent.organization_id) == org_id,
                        col(ExecutiveAgent.updated_at) > last_seen,
                    )
                    .limit(10)
                )
                result = await session.exec(agents_stmt)
                for agent in result.all():
                    events.append({
                        "event": "agent.status",
                        "data": json.dumps({
                            "id": str(agent.id),
                            "display_name": agent.display_name,
                            "status": agent.status,
                            "updated_at": agent.updated_at.isoformat(),
                        }),
                    })

            # Emit events
            for event in events:
                yield event

            last_seen = utcnow()
            await asyncio.sleep(POLL_INTERVAL)

    return EventSourceResponse(event_generator(), ping=15)
