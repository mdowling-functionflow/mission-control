"""API routes for chat threads — conversation management per agent."""

from __future__ import annotations

import os
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP
from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.agent_messages import AgentMessage
from app.models.chat_threads import ChatThread
from app.models.executive_agents import ExecutiveAgent
from app.services.organizations import OrganizationContext

logger = get_logger(__name__)

router = APIRouter(prefix="/chat-threads", tags=["chat-threads"])


# ─── Schemas ──────────────────────────────────────────────────────────

class ChatThreadCreate(SQLModel):
    executive_agent_id: UUID
    title: str | None = None


class ChatThreadRead(SQLModel):
    id: str
    executive_agent_id: str
    title: str | None = None
    session_id: str
    is_active: bool = True
    message_count: int = 0
    last_message_preview: str | None = None
    created_at: str
    updated_at: str


class ChatThreadUpdate(SQLModel):
    title: str | None = None
    is_active: bool | None = None


class ThreadMessageRead(SQLModel):
    id: str
    role: str
    content: str
    created_at: str
    attachment_name: str | None = None
    attachment_path: str | None = None
    attachment_mime: str | None = None
    attachment_size: int | None = None


class ThreadSendRequest(SQLModel):
    content: str


# ─── Helpers ──────────────────────────────────────────────────────────

def _generate_session_id() -> str:
    return f"mc-thread-{uuid4().hex[:12]}"


async def _generate_ai_title(user_message: str, agent_response: str | None = None) -> str | None:
    """One-shot AI title generation. Called exactly once per thread, never again."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key, timeout=10.0)

        exchange = f"User: {user_message[:300]}"
        if agent_response:
            exchange += f"\nAssistant: {agent_response[:300]}"

        resp = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a very short title (3-6 words) for this conversation. "
                    "Capture the core topic. No quotes, no trailing punctuation. "
                    "Just the title, nothing else.",
                },
                {"role": "user", "content": exchange},
            ],
            max_tokens=20,
            temperature=0.3,
        )
        title = resp.choices[0].message.content.strip().strip('"\'.')
        return title[:60] if title else None
    except Exception as exc:
        logger.warning("ai_title.failed", error=str(exc))
        return None


def _fallback_title(content: str) -> str:
    """Quick fallback title if AI call fails."""
    text = content.strip()[:50]
    if len(content.strip()) > 50:
        # Truncate at word boundary
        if " " in text[30:]:
            text = text[:text.rindex(" ", 0, 50)]
        text += "…"
    return text or "New conversation"


async def _thread_to_read(session: AsyncSession, thread: ChatThread) -> ChatThreadRead:
    """Convert a ChatThread to a read model with message count and preview."""
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(AgentMessage).where(
        col(AgentMessage.thread_id) == thread.id,
    )
    count_result = await session.exec(count_stmt)
    count = count_result.one()

    # Get last message preview
    last_stmt = (
        select(AgentMessage)
        .where(col(AgentMessage.thread_id) == thread.id)
        .order_by(col(AgentMessage.created_at).desc())
        .limit(1)
    )
    last_result = await session.exec(last_stmt)
    last_msg = last_result.first()
    preview = last_msg.content[:80] if last_msg else None

    return ChatThreadRead(
        id=str(thread.id),
        executive_agent_id=str(thread.executive_agent_id),
        title=thread.title,
        session_id=thread.session_id,
        is_active=thread.is_active,
        message_count=count,
        last_message_preview=preview,
        created_at=thread.created_at.isoformat(),
        updated_at=thread.updated_at.isoformat(),
    )


# ─── Routes ───────────────────────────────────────────────────────────

@router.get("", response_model=list[ChatThreadRead])
async def list_threads(
    agent_id: UUID = Query(...),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ChatThreadRead]:
    """List conversation threads for an agent, newest first."""
    threads = await ChatThread.objects.filter_by(
        organization_id=ctx.organization.id,
        executive_agent_id=agent_id,
        is_active=True,
    ).order_by(col(ChatThread.updated_at).desc()).all(session)

    return [await _thread_to_read(session, t) for t in threads]


@router.post("", response_model=ChatThreadRead, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ChatThreadCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ChatThreadRead:
    """Create a new conversation thread."""
    thread = ChatThread(
        organization_id=ctx.organization.id,
        executive_agent_id=body.executive_agent_id,
        title=body.title,
        session_id=_generate_session_id(),
    )
    session.add(thread)
    await session.commit()
    await session.refresh(thread)
    return await _thread_to_read(session, thread)


@router.get("/{thread_id}/messages", response_model=list[ThreadMessageRead])
async def list_thread_messages(
    thread_id: UUID,
    limit: int = Query(default=100, le=500),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ThreadMessageRead]:
    """List messages in a thread, oldest first."""
    # Verify thread belongs to this org
    thread = await ChatThread.objects.filter_by(
        id=thread_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    stmt = (
        select(AgentMessage)
        .where(col(AgentMessage.thread_id) == thread_id)
        .order_by(col(AgentMessage.created_at).asc())
        .limit(limit)
    )
    result = await session.exec(stmt)
    messages = result.all()

    return [
        ThreadMessageRead(
            id=str(m.id),
            role=m.role,
            content=m.content,
            created_at=m.created_at.isoformat(),
            attachment_name=m.attachment_name,
            attachment_path=m.attachment_path,
            attachment_mime=m.attachment_mime,
            attachment_size=m.attachment_size,
        )
        for m in messages
    ]


@router.post("/{thread_id}/send", response_model=ThreadMessageRead)
async def send_thread_message(
    thread_id: UUID,
    body: ThreadSendRequest,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ThreadMessageRead:
    """Send a message in a thread and get the agent's response."""
    from app.api.agent_chat import _exec_agent_cli, _check_send_rate

    _check_send_rate(str(ctx.organization.id))

    thread = await ChatThread.objects.filter_by(
        id=thread_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # Resolve the executive agent
    exec_agent = await ExecutiveAgent.objects.by_id(thread.executive_agent_id).first(session)
    if not exec_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Save user message
    user_msg = AgentMessage(
        organization_id=ctx.organization.id,
        executive_agent_id=thread.executive_agent_id,
        thread_id=thread_id,
        role="user",
        content=body.content,
    )
    session.add(user_msg)

    # Auto-title: quick fallback now, AI title after agent responds
    needs_ai_title = not thread.title
    if not thread.title:
        thread.title = _fallback_title(body.content)

    thread.updated_at = utcnow()
    session.add(thread)
    await session.commit()
    await session.refresh(user_msg)

    # Execute agent inline — Vercel serverless kills background tasks on exit
    from app.api.agent_chat import _exec_agent_cli

    response_text: str | None = None
    try:
        response_text = await _exec_agent_cli(
            exec_agent.openclaw_agent_id,
            body.content,
            session_id=thread.session_id,
        )
        if response_text:
            agent_msg = AgentMessage(
                organization_id=ctx.organization.id,
                executive_agent_id=thread.executive_agent_id,
                thread_id=thread_id,
                role="agent",
                content=response_text,
            )
            session.add(agent_msg)
            thread.updated_at = utcnow()
            session.add(thread)
            await session.commit()
    except Exception as exc:
        logger.warning("chat_thread.exec.failed", error=str(exc))
        err_msg = AgentMessage(
            organization_id=ctx.organization.id,
            executive_agent_id=thread.executive_agent_id,
            thread_id=thread_id,
            role="system",
            content=f"Could not reach {exec_agent.display_name}: {str(exc)[:200]}",
        )
        session.add(err_msg)
        await session.commit()

    # One-shot AI title — only for brand new threads, never retried
    if needs_ai_title:
        try:
            ai_title = await _generate_ai_title(body.content, response_text)
            if ai_title:
                thread.title = ai_title
                session.add(thread)
                await session.commit()
        except Exception:
            pass  # Keep fallback title

    return ThreadMessageRead(
        id=str(user_msg.id),
        role=user_msg.role,
        content=user_msg.content,
        created_at=user_msg.created_at.isoformat(),
    )


@router.post("/{thread_id}/upload", response_model=ThreadMessageRead)
async def upload_thread_attachment(
    thread_id: UUID,
    file: UploadFile,
    caption: str = "",
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ThreadMessageRead:
    """Upload a file attachment to a chat thread."""
    thread = await ChatThread.objects.filter_by(
        id=thread_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    # Proxy upload to bridge
    attachment_meta = None
    if settings.bridge_url:
        import httpx
        try:
            file_content = await file.read()
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{settings.bridge_url.rstrip('/')}/chat/upload",
                    headers={"X-Bridge-Token": settings.bridge_token},
                    files={"file": (file.filename, file_content, file.content_type or "application/octet-stream")},
                )
            if resp.status_code == 200:
                attachment_meta = resp.json()
        except Exception as exc:
            logger.warning("chat_thread.upload.failed", error=str(exc))

    # Save message with attachment
    msg = AgentMessage(
        organization_id=ctx.organization.id,
        executive_agent_id=thread.executive_agent_id,
        thread_id=thread_id,
        role="user",
        content=caption or f"📎 {file.filename}",
        attachment_name=attachment_meta.get("name") if attachment_meta else file.filename,
        attachment_path=attachment_meta.get("path") if attachment_meta else None,
        attachment_mime=attachment_meta.get("mime") if attachment_meta else file.content_type,
        attachment_size=attachment_meta.get("size") if attachment_meta else None,
    )
    session.add(msg)
    thread.updated_at = utcnow()
    session.add(thread)
    await session.commit()
    await session.refresh(msg)

    return ThreadMessageRead(
        id=str(msg.id),
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at.isoformat(),
        attachment_name=msg.attachment_name,
        attachment_path=msg.attachment_path,
        attachment_mime=msg.attachment_mime,
        attachment_size=msg.attachment_size,
    )


@router.patch("/{thread_id}", response_model=ChatThreadRead)
async def update_thread(
    thread_id: UUID,
    body: ChatThreadUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ChatThreadRead:
    """Update thread title or active status."""
    thread = await ChatThread.objects.filter_by(
        id=thread_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if body.title is not None:
        thread.title = body.title
    if body.is_active is not None:
        thread.is_active = body.is_active
    thread.updated_at = utcnow()

    session.add(thread)
    await session.commit()
    await session.refresh(thread)
    return await _thread_to_read(session, thread)
