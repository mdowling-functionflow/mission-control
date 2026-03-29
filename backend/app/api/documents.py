"""API routes for the document workspace."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.time import utcnow
from app.models.documents import Document
from app.models.executive_agents import ExecutiveAgent
from app.schemas.documents import DocumentCreate, DocumentRead, DocumentUpdate
from app.services.organizations import OrganizationContext

router = APIRouter(prefix="/documents", tags=["documents"])


async def _resolve_agent(
    session: AsyncSession, doc: Document, org_id: UUID,
) -> DocumentRead:
    """Build a DocumentRead with resolved agent display info."""
    read = DocumentRead.model_validate(doc)
    if doc.source_agent_id:
        agent = await ExecutiveAgent.objects.filter_by(
            id=doc.source_agent_id,
            organization_id=org_id,
        ).first(session)
        if agent:
            read.agent_display_name = agent.display_name
            read.agent_avatar_emoji = agent.avatar_emoji
    return read


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    source_agent_id: UUID | None = Query(default=None),
    doc_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, le=200),
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[DocumentRead]:
    stmt = (
        select(Document)
        .where(col(Document.organization_id) == ctx.organization.id)
        .where(col(Document.status) != "archived")
        .order_by(col(Document.updated_at).desc())
        .limit(limit)
    )
    if source_agent_id:
        stmt = stmt.where(col(Document.source_agent_id) == source_agent_id)
    if doc_type:
        stmt = stmt.where(col(Document.doc_type) == doc_type)
    if status_filter:
        stmt = stmt.where(col(Document.status) == status_filter)

    result = await session.exec(stmt)
    docs = result.all()
    return [await _resolve_agent(session, d, ctx.organization.id) for d in docs]


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> DocumentRead:
    doc = Document(
        organization_id=ctx.organization.id,
        **body.model_dump(),
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return await _resolve_agent(session, doc, ctx.organization.id)


@router.get("/{doc_id}", response_model=DocumentRead)
async def get_document(
    doc_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> DocumentRead:
    doc = await Document.objects.filter_by(
        id=doc_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return await _resolve_agent(session, doc, ctx.organization.id)


@router.patch("/{doc_id}", response_model=DocumentRead)
async def update_document(
    doc_id: UUID,
    body: DocumentUpdate,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> DocumentRead:
    doc = await Document.objects.filter_by(
        id=doc_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(doc, key, val)
    doc.updated_at = utcnow()

    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return await _resolve_agent(session, doc, ctx.organization.id)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_document(
    doc_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = Depends(require_org_admin),
) -> None:
    doc = await Document.objects.filter_by(
        id=doc_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    doc.status = "archived"
    doc.updated_at = utcnow()
    session.add(doc)
    await session.commit()
