"""API routes for daily proactive items — per-agent actionable intelligence."""

from __future__ import annotations

import json as json_lib
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP
from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.daily_items import DailyItem
from app.models.executive_agents import ExecutiveAgent
from app.services.organizations import OrganizationContext

logger = get_logger(__name__)

router = APIRouter(prefix="/daily-items", tags=["daily-items"])


# ─── Schemas ──────────────────────────────────────────────────────────

class DailyItemRead(SQLModel):
    id: str
    executive_agent_id: str
    date: str
    title: str
    description: str
    item_type: str
    urgency: str
    status: str
    source: str
    created_at: str


class DailyItemUpdate(SQLModel):
    status: str | None = None  # done / dismissed


# ─── Routes ───────────────────────────────────────────────────────────

@router.get("", response_model=list[DailyItemRead])
async def list_daily_items(
    agent_id: UUID | None = Query(default=None),
    target_date: date | None = Query(default=None, alias="date"),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[DailyItemRead]:
    """List daily items, optionally filtered by agent and date."""
    stmt = (
        select(DailyItem)
        .where(col(DailyItem.organization_id) == ctx.organization.id)
        .order_by(
            # high urgency first
            col(DailyItem.urgency).asc(),
            col(DailyItem.created_at).desc(),
        )
    )
    if agent_id:
        stmt = stmt.where(col(DailyItem.executive_agent_id) == agent_id)
    if target_date:
        stmt = stmt.where(col(DailyItem.item_date) == target_date)
    else:
        # Default to today
        stmt = stmt.where(col(DailyItem.item_date) == date.today())

    result = await session.exec(stmt)
    items = result.all()
    return [
        DailyItemRead(
            id=str(i.id),
            executive_agent_id=str(i.executive_agent_id),
            date=i.item_date.isoformat(),
            title=i.title,
            description=i.description,
            item_type=i.item_type,
            urgency=i.urgency,
            status=i.status,
            source=i.source,
            created_at=i.created_at.isoformat(),
        )
        for i in items
    ]


@router.patch("/{item_id}", response_model=DailyItemRead)
async def update_daily_item(
    item_id: UUID,
    body: DailyItemUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> DailyItemRead:
    """Update a daily item (mark done/dismissed)."""
    item = await DailyItem.objects.filter_by(
        id=item_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    if body.status is not None:
        item.status = body.status

    session.add(item)
    await session.commit()
    await session.refresh(item)

    return DailyItemRead(
        id=str(item.id),
        executive_agent_id=str(item.executive_agent_id),
        date=item.item_date.isoformat(),
        title=item.title,
        description=item.description,
        item_type=item.item_type,
        urgency=item.urgency,
        status=item.status,
        source=item.source,
        created_at=item.created_at.isoformat(),
    )


@router.post("/generate", response_model=list[DailyItemRead])
async def generate_daily_items(
    agent_id: UUID | None = Query(default=None),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[DailyItemRead]:
    """Generate proactive daily items for one agent (or all primary agents)."""
    from app.api.agent_chat import _exec_agent_cli

    if agent_id:
        agents = [await ExecutiveAgent.objects.filter_by(
            id=agent_id,
            organization_id=ctx.organization.id,
        ).first(session)]
        agents = [a for a in agents if a]
    else:
        agents = await ExecutiveAgent.objects.filter_by(
            organization_id=ctx.organization.id,
            agent_type="primary",
        ).all(session)

    if not agents:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No agents found")

    today = date.today()
    created_items: list[DailyItem] = []

    for agent in agents:
        # Skip if already generated for today
        existing = await DailyItem.objects.filter_by(
            organization_id=ctx.organization.id,
            executive_agent_id=agent.id,
        ).filter(col(DailyItem.item_date) == today).all(session)
        if existing:
            created_items.extend(existing)
            continue

        # Gather context: allocated skills + recent docs
        from app.models.agent_skill_mappings import AgentSkillMapping
        from app.models.documents import Document

        skill_mappings = await AgentSkillMapping.objects.filter_by(
            executive_agent_id=agent.id,
        ).all(session)
        skill_names = [m.skill_path for m in skill_mappings[:10]]

        recent_docs_stmt = (
            select(Document)
            .where(col(Document.source_agent_id) == agent.id)
            .order_by(col(Document.updated_at).desc())
            .limit(3)
        )
        recent_docs_result = await session.exec(recent_docs_stmt)
        recent_docs = recent_docs_result.all()
        doc_context = ", ".join(f"{d.title} ({d.doc_type})" for d in recent_docs) if recent_docs else "none"

        prompt = (
            f"You are {agent.persona_name or agent.display_name}, {agent.executive_role}.\n"
            f"Your goal: {agent.goal or 'Not set'}\n"
            f"Your capabilities: {', '.join(skill_names) if skill_names else 'general'}\n"
            f"Current focus: {agent.current_focus or 'Not set'}\n"
            f"Recent documents: {doc_context}\n"
            f"Today is {today.strftime('%A, %B %d, %Y')}.\n\n"
            f"Review your lane and surface 3-5 actionable items for today.\n"
            f"Prioritize items that advance your goal.\n"
            f"Consider: unread signals, stale follow-ups, upcoming deadlines, "
            f"open loops, meetings, and anything needing attention.\n\n"
            f"Respond ONLY with a JSON array. Each item must have:\n"
            f'- "title": short action label (5-10 words)\n'
            f'- "description": one sentence context\n'
            f'- "type": one of "action", "signal", "reminder", "risk"\n'
            f'- "urgency": one of "high", "medium", "low"\n\n'
            f"Example: "
            f'[{{"title":"Follow up with Acme Corp","description":"Deal has been stale for 5 days","type":"action","urgency":"high"}}]\n'
        )

        try:
            response_text = await _exec_agent_cli(
                agent.openclaw_agent_id,
                prompt,
                session_id=f"mc-daily-{agent.openclaw_agent_id}-{today.isoformat()}",
            )
            if not response_text:
                continue

            # Parse JSON from response — handle markdown code blocks
            text = response_text.strip()
            if "```" in text:
                # Extract JSON from code block
                parts = text.split("```")
                for part in parts:
                    stripped = part.strip().removeprefix("json").strip()
                    if stripped.startswith("["):
                        text = stripped
                        break

            # Find the JSON array in the response
            start = text.find("[")
            end = text.rfind("]")
            if start >= 0 and end > start:
                text = text[start:end + 1]

            items_data = json_lib.loads(text)
            if not isinstance(items_data, list):
                items_data = [items_data]

            for item_data in items_data[:5]:  # Max 5 items per agent
                if not isinstance(item_data, dict) or "title" not in item_data:
                    continue
                daily_item = DailyItem(
                    organization_id=ctx.organization.id,
                    executive_agent_id=agent.id,
                    item_date=today,
                    title=item_data["title"][:200],
                    description=item_data.get("description", "")[:500],
                    item_type=item_data.get("type", "action"),
                    urgency=item_data.get("urgency", "medium"),
                    source="cron",
                )
                session.add(daily_item)
                created_items.append(daily_item)

            # Update agent's current_focus from highest urgency item
            high_items = [i for i in items_data if i.get("urgency") == "high"]
            if high_items:
                agent.current_focus = high_items[0].get("title", "")[:200]
                agent.updated_at = utcnow()
                session.add(agent)

        except Exception as exc:
            logger.warning("daily_items.generate.failed", agent=agent.display_name, error=str(exc)[:200])
            continue

    await session.commit()
    for item in created_items:
        await session.refresh(item)

    return [
        DailyItemRead(
            id=str(i.id),
            executive_agent_id=str(i.executive_agent_id),
            date=i.item_date.isoformat(),
            title=i.title,
            description=i.description,
            item_type=i.item_type,
            urgency=i.urgency,
            status=i.status,
            source=i.source,
            created_at=i.created_at.isoformat(),
        )
        for i in created_items
    ]
