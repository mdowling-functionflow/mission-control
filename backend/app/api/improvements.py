"""API routes for the improvement proposal system."""

from __future__ import annotations

import time
from collections import defaultdict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

import httpx

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.config import settings
from app.core.logging import get_logger
from app.core.time import utcnow
from app.models.documents import Document
from app.models.executive_agents import ExecutiveAgent
from app.models.improvements import Improvement

logger = get_logger(__name__)
from app.schemas.improvements import (
    ImprovementCreate,
    ImprovementRead,
    ImprovementStats,
    ImprovementUpdate,
)
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/improvements", tags=["improvements"])

# Rate limit audits: max 5 per hour per org
_audit_timestamps: dict[str, list[float]] = defaultdict(list)
_AUDIT_LIMIT = 5
_AUDIT_WINDOW = 3600


def _check_audit_rate(org_id: str) -> None:
    now = time.time()
    ts = _audit_timestamps[org_id]
    _audit_timestamps[org_id] = [t for t in ts if now - t < _AUDIT_WINDOW]
    if len(_audit_timestamps[org_id]) >= _AUDIT_LIMIT:
        raise HTTPException(status_code=429, detail=f"Rate limit: max {_AUDIT_LIMIT} audits per hour")
    _audit_timestamps[org_id].append(now)


async def _resolve_agent_names(
    session: AsyncSession, items: list[Improvement], org_id: UUID,
) -> list[ImprovementRead]:
    """Resolve agent display names for a list of improvements."""
    agent_ids = {i.executive_agent_id for i in items if i.executive_agent_id}
    agent_map: dict[UUID, ExecutiveAgent] = {}
    if agent_ids:
        agents = await ExecutiveAgent.objects.filter_by(
            organization_id=org_id,
        ).all(session)
        agent_map = {a.id: a for a in agents if a.id in agent_ids}

    results = []
    for item in items:
        read = ImprovementRead.model_validate(item)
        if item.executive_agent_id and item.executive_agent_id in agent_map:
            ea = agent_map[item.executive_agent_id]
            read.agent_display_name = ea.display_name
            read.agent_avatar_emoji = ea.avatar_emoji
        results.append(read)
    return results


@router.get("", response_model=list[ImprovementRead])
async def list_improvements(
    status_filter: str | None = Query(default=None, alias="status"),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[ImprovementRead]:
    """List improvements, optionally filtered by status."""
    qs = Improvement.objects.filter_by(organization_id=ctx.organization.id)
    if status_filter:
        qs = qs.filter(col(Improvement.status) == status_filter)
    items = await qs.order_by(col(Improvement.created_at).desc()).all(session)
    return await _resolve_agent_names(session, items, ctx.organization.id)


@router.post("", response_model=ImprovementRead, status_code=status.HTTP_201_CREATED)
async def create_improvement(
    body: ImprovementCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ImprovementRead:
    improvement = Improvement(
        organization_id=ctx.organization.id,
        **body.model_dump(),
    )
    session.add(improvement)
    await session.commit()
    await session.refresh(improvement)
    resolved = await _resolve_agent_names(session, [improvement], ctx.organization.id)
    return resolved[0]


@router.get("/stats", response_model=ImprovementStats)
async def get_improvement_stats(
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ImprovementStats:
    """Get counts by status."""
    stmt = (
        select(Improvement.status, func.count())
        .where(col(Improvement.organization_id) == ctx.organization.id)
        .group_by(Improvement.status)
    )
    result = await session.exec(stmt)
    rows = result.all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    return ImprovementStats(
        proposed=counts.get("proposed", 0),
        reviewing=counts.get("reviewing", 0),
        testing=counts.get("testing", 0),
        adopted=counts.get("adopted", 0),
        rejected=counts.get("rejected", 0),
        total=total,
    )


from sqlmodel import SQLModel


class AuditResult(SQLModel):
    document_id: str | None = None
    document_title: str | None = None
    improvements_created: int = 0
    agent_response: str | None = None


@router.post("/audit/{agent_id}", response_model=AuditResult)
async def run_weekly_audit(
    agent_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> AuditResult:
    """Run a weekly audit for an agent — dispatches audit prompt, saves results as doc + improvements."""
    _check_audit_rate(str(ctx.organization.id))
    exec_agent = await ExecutiveAgent.objects.filter_by(
        id=agent_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not exec_agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Build audit prompt
    audit_prompt = f"""You are running your weekly self-audit as {exec_agent.display_name} ({exec_agent.executive_role}).

Review your recent work this week and produce a structured audit report covering:

1. **Tasks completed** — what did you accomplish this week?
2. **Key outputs** — what documents, briefs, or artifacts were produced?
3. **Risks identified** — what risks or bottlenecks are you seeing?
4. **Friction points** — what recurring friction or inefficiencies did you notice?
5. **Improvement suggestions** — what 2-3 specific things should we do better next week?

Format your response as a clear markdown document.

For each improvement suggestion, use this format:
### Improvement: [Title]
**Priority:** [high/normal/low]
**Category:** [process/tooling/communication/automation]
**Description:** [What should change and why]
"""

    # Dispatch to agent via bridge or CLI
    agent_response = await _dispatch_audit(exec_agent.openclaw_agent_id, audit_prompt)

    if not agent_response:
        return AuditResult(agent_response="Agent did not respond to audit prompt.")

    # Save as document
    doc = Document(
        organization_id=ctx.organization.id,
        title=f"Weekly Audit: {exec_agent.display_name} ({utcnow().strftime('%Y-%m-%d')})",
        content=agent_response,
        doc_type="memo",
        source_agent_id=agent_id,
        status="published",
    )
    session.add(doc)
    await session.flush()

    # Parse improvement suggestions from response
    improvements_created = 0
    lines = agent_response.split("\n")
    current_title = None
    current_desc = ""
    current_priority = "normal"
    current_category = "process"

    for line in lines:
        if line.strip().startswith("### Improvement:"):
            # Save previous if exists
            if current_title:
                imp = Improvement(
                    organization_id=ctx.organization.id,
                    executive_agent_id=agent_id,
                    title=current_title,
                    description=current_desc.strip(),
                    priority=current_priority,
                    category=current_category,
                    rationale=f"From weekly audit on {utcnow().strftime('%Y-%m-%d')}",
                )
                session.add(imp)
                improvements_created += 1

            current_title = line.strip().replace("### Improvement:", "").strip()
            current_desc = ""
            current_priority = "normal"
            current_category = "process"
        elif current_title:
            if line.strip().startswith("**Priority:**"):
                val = line.strip().replace("**Priority:**", "").strip().lower()
                if val in ("high", "normal", "low", "urgent"):
                    current_priority = val
            elif line.strip().startswith("**Category:**"):
                val = line.strip().replace("**Category:**", "").strip().lower()
                if val in ("process", "tooling", "communication", "automation"):
                    current_category = val
            elif line.strip().startswith("**Description:**"):
                current_desc = line.strip().replace("**Description:**", "").strip()
            else:
                current_desc += "\n" + line

    # Save last improvement
    if current_title:
        imp = Improvement(
            organization_id=ctx.organization.id,
            executive_agent_id=agent_id,
            title=current_title,
            description=current_desc.strip(),
            priority=current_priority,
            category=current_category,
            rationale=f"From weekly audit on {utcnow().strftime('%Y-%m-%d')}",
        )
        session.add(imp)
        improvements_created += 1

    await session.commit()
    await session.refresh(doc)

    return AuditResult(
        document_id=str(doc.id),
        document_title=doc.title,
        improvements_created=improvements_created,
        agent_response=agent_response[:500],
    )


async def _dispatch_audit(openclaw_agent_id: str, prompt: str) -> str | None:
    """Dispatch audit prompt to agent via bridge or CLI."""
    if settings.bridge_url:
        url = f"{settings.bridge_url.rstrip('/')}/chat"
        headers = {"X-Bridge-Token": settings.bridge_token}
        try:
            async with httpx.AsyncClient(timeout=130.0) as client:
                resp = await client.post(url, headers=headers, json={
                    "agent_id": openclaw_agent_id,
                    "message": prompt,
                })
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response")
        except Exception as exc:
            logger.warning("audit.bridge.failed", error=str(exc))
        return None

    # Local CLI fallback
    import asyncio
    try:
        proc = await asyncio.create_subprocess_exec(
            "openclaw", "agent", "--agent", openclaw_agent_id, "--message", prompt, "--json",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        import json
        output = stdout.decode("utf-8", errors="replace").strip()
        data = json.loads(output)
        payloads = data.get("result", {}).get("payloads", [])
        if payloads:
            return "\n\n".join(p.get("text", "") for p in payloads if p.get("text"))
    except Exception as exc:
        logger.warning("audit.cli.failed", error=str(exc))
    return None


@router.get("/{improvement_id}", response_model=ImprovementRead)
async def get_improvement(
    improvement_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> ImprovementRead:
    item = await Improvement.objects.filter_by(
        id=improvement_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    resolved = await _resolve_agent_names(session, [item], ctx.organization.id)
    return resolved[0]


@router.patch("/{improvement_id}", response_model=ImprovementRead)
async def update_improvement(
    improvement_id: UUID,
    body: ImprovementUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> ImprovementRead:
    item = await Improvement.objects.filter_by(
        id=improvement_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = body.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(item, key, val)

    if body.status in ("adopted", "rejected") and not item.resolved_at:
        item.resolved_at = utcnow()
    item.updated_at = utcnow()

    session.add(item)
    await session.commit()
    await session.refresh(item)
    resolved = await _resolve_agent_names(session, [item], ctx.organization.id)
    return resolved[0]
