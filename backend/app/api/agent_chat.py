"""API routes for per-agent chat — direct conversation with individual executive agents."""

from __future__ import annotations

import asyncio
import json as json_lib
import subprocess
import time
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP
from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.agent_messages import AgentMessage
from app.models.executive_agents import ExecutiveAgent
from app.services.organizations import OrganizationContext

logger = get_logger(__name__)

router = APIRouter(prefix="/agent-chat", tags=["agent-chat"])

# Simple in-memory rate limiting: max 10 sends per minute per org
_send_timestamps: dict[str, list[float]] = defaultdict(list)
_SEND_LIMIT = 10
_SEND_WINDOW = 60  # seconds


def _check_send_rate(org_id: str) -> None:
    now = time.time()
    timestamps = _send_timestamps[org_id]
    # Clean old entries
    _send_timestamps[org_id] = [t for t in timestamps if now - t < _SEND_WINDOW]
    if len(_send_timestamps[org_id]) >= _SEND_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit: max {_SEND_LIMIT} messages per minute",
        )
    _send_timestamps[org_id].append(now)


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
    messages = list(reversed(result.all()))
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
    """Send a message to an agent via OpenClaw CLI and return the response."""
    _check_send_rate(str(ctx.organization.id))
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

    # Execute agent via OpenClaw CLI and capture response
    try:
        response_text = await _exec_agent_cli(exec_agent.openclaw_agent_id, body.content)
        if response_text:
            agent_msg = AgentMessage(
                organization_id=ctx.organization.id,
                executive_agent_id=agent_id,
                role="agent",
                content=response_text,
            )
            session.add(agent_msg)
            await session.commit()
    except Exception as exc:
        logger.warning("agent_chat.exec.failed", agent=exec_agent.display_name, error=str(exc))
        err_msg = AgentMessage(
            organization_id=ctx.organization.id,
            executive_agent_id=agent_id,
            role="system",
            content=f"Could not reach {exec_agent.display_name}: {str(exc)[:200]}",
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
    """Record an agent response message (manual or webhook)."""
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


async def _exec_agent_cli(openclaw_agent_id: str, message: str) -> str | None:
    """Execute an agent turn. Routes through local bridge if BRIDGE_URL is set, else CLI."""
    # Bridge mode: proxy to local bridge (for cloud/Vercel deployments)
    if settings.bridge_url:
        return await _exec_via_bridge(openclaw_agent_id, message)

    # Local mode: use OpenClaw CLI directly
    return await _exec_via_cli(openclaw_agent_id, message)


async def _exec_via_bridge(openclaw_agent_id: str, message: str) -> str | None:
    """Execute agent via the local bridge's /chat endpoint."""
    import httpx
    url = f"{settings.bridge_url.rstrip('/')}/chat"
    headers = {"X-Bridge-Token": settings.bridge_token}
    try:
        async with httpx.AsyncClient(timeout=130.0) as client:
            resp = await client.post(url, headers=headers, json={
                "agent_id": openclaw_agent_id,
                "message": message,
            })
        if resp.status_code != 200:
            logger.warning("agent_chat.bridge.error", status=resp.status_code, body=resp.text[:200])
            return f"Bridge error: {resp.text[:200]}"
        data = resp.json()
        if data.get("error"):
            return f"Agent error: {data['error']}"
        return data.get("response")
    except Exception as exc:
        logger.error("agent_chat.bridge.failed", error=str(exc))
        return f"Could not reach local bridge: {str(exc)[:200]}"


async def _exec_via_cli(openclaw_agent_id: str, message: str) -> str | None:
    """Execute agent via local OpenClaw CLI."""
    cmd = [
        "openclaw", "agent",
        "--agent", openclaw_agent_id,
        "--message", message,
        "--session-id", f"mc-{openclaw_agent_id}",
        "--json",
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    except asyncio.TimeoutError:
        logger.warning("agent_chat.cli.timeout", agent=openclaw_agent_id)
        return "Agent is taking too long to respond. The request has been submitted and may complete in the background."
    except FileNotFoundError:
        logger.error("agent_chat.cli.not_found")
        return None

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        logger.warning("agent_chat.cli.error", agent=openclaw_agent_id, error=err[:200])
        return f"Agent error: {err[:500]}" if err else None

    output = stdout.decode("utf-8", errors="replace").strip()
    if not output:
        return None

    # Parse JSON response from openclaw agent --json
    try:
        data = json_lib.loads(output)
        if isinstance(data, dict):
            # OpenClaw format: { result: { payloads: [{ text: "..." }] } }
            result = data.get("result", {})
            payloads = result.get("payloads", [])
            if payloads:
                texts = [p.get("text", "") for p in payloads if p.get("text")]
                if texts:
                    return "\n\n".join(texts)

            # Fallback: check other common fields
            for key in ("response", "reply", "message", "content", "text", "output"):
                if key in data and isinstance(data[key], str):
                    return data[key]

            # Check messages array
            if "messages" in data and isinstance(data["messages"], list):
                agent_msgs = [m for m in data["messages"] if m.get("role") == "assistant"]
                if agent_msgs:
                    return agent_msgs[-1].get("content", str(agent_msgs[-1]))

        return output
    except json_lib.JSONDecodeError:
        return output
