"""API routes for per-agent chat — direct conversation with individual executive agents."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.agent_messages import AgentMessage
from app.models.agents import Agent
from app.models.boards import Board
from app.models.executive_agents import ExecutiveAgent
from app.services.openclaw.gateway_dispatch import GatewayDispatchService
from app.services.organizations import OrganizationContext

logger = get_logger(__name__)

router = APIRouter(prefix="/agent-chat", tags=["agent-chat"])


class ChatMessageRead(SQLModel):
    id: str
    role: str
    content: str
    created_at: str


class SendMessageRequest(SQLModel):
    content: str


@router.get("/{agent_id}/messages", response_model=list[ChatMessageRead])
async def list_messages(
    agent_id: UUID,
    limit: int = Query(default=50, le=200),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ChatMessageRead]:
    """List recent messages for an agent conversation."""
    stmt = (
        select(AgentMessage)
        .where(
            col(AgentMessage.organization_id) == ctx.organization.id,
            col(AgentMessage.executive_agent_id) == agent_id,
        )
        .order_by(col(AgentMessage.created_at).desc())
        .limit(limit)
    )
    result = await session.exec(stmt)
    messages = list(reversed(result.all()))  # Oldest first for display
    return [
        ChatMessageRead(
            id=str(m.id),
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]


@router.post("/{agent_id}/send", response_model=ChatMessageRead)
async def send_message(
    agent_id: UUID,
    body: SendMessageRequest,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ChatMessageRead:
    """Send a message to an agent and dispatch to their OpenClaw session."""
    exec_agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not exec_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Save user message
    user_msg = AgentMessage(
        organization_id=ctx.organization.id,
        executive_agent_id=agent_id,
        role="user",
        content=body.content,
    )
    session.add(user_msg)
    await session.commit()
    await session.refresh(user_msg)

    # Dispatch to agent via gateway (best-effort)
    try:
        await _dispatch_to_agent(session, exec_agent, body.content)
    except Exception as exc:
        logger.warning("agent_chat.dispatch.failed", agent=exec_agent.display_name, error=str(exc))
        # Save a system note about dispatch failure
        err_msg = AgentMessage(
            organization_id=ctx.organization.id,
            executive_agent_id=agent_id,
            role="system",
            content=f"Could not dispatch to {exec_agent.display_name}: {str(exc)[:200]}",
        )
        session.add(err_msg)
        await session.commit()

    return ChatMessageRead(
        id=str(user_msg.id),
        role=user_msg.role,
        content=user_msg.content,
        created_at=user_msg.created_at.isoformat(),
    )


@router.post("/{agent_id}/receive", response_model=ChatMessageRead)
async def receive_agent_message(
    agent_id: UUID,
    body: SendMessageRequest,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ChatMessageRead:
    """Record an agent response message.

    Called by:
    - Gateway webhook when agent responds
    - OpenClaw webhook worker
    - Manual testing / simulation
    """
    exec_agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not exec_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    agent_msg = AgentMessage(
        organization_id=ctx.organization.id,
        executive_agent_id=agent_id,
        role="agent",
        content=body.content,
    )
    session.add(agent_msg)
    await session.commit()
    await session.refresh(agent_msg)

    return ChatMessageRead(
        id=str(agent_msg.id),
        role=agent_msg.role,
        content=agent_msg.content,
        created_at=agent_msg.created_at.isoformat(),
    )


async def _dispatch_to_agent(
    session: AsyncSession,
    exec_agent: ExecutiveAgent,
    message: str,
) -> None:
    """Send a message to the agent's OpenClaw session via gateway."""
    stmt = select(Agent).where(col(Agent.name) == exec_agent.openclaw_agent_id)
    result = await session.exec(stmt)
    board_agents = result.all()

    target = None
    for ba in board_agents:
        if ba.openclaw_session_id:
            target = ba
            break

    if not target or not target.openclaw_session_id or not target.board_id:
        logger.info("agent_chat.no_session", agent=exec_agent.display_name)
        return

    board = await Board.objects.by_id(target.board_id).first(session)
    if not board:
        return

    dispatch = GatewayDispatchService(session)
    config = await dispatch.optional_gateway_config_for_board(board)
    if not config:
        return

    await dispatch.try_send_agent_message(
        session_key=target.openclaw_session_id,
        config=config,
        agent_name=target.name,
        message=f"[From Michael via Mission Control]\n\n{message}",
        deliver=True,
    )
    logger.info("agent_chat.dispatched", agent=exec_agent.display_name)
