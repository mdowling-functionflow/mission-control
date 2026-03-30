"""API routes for the document workspace."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

import httpx
import mimetypes
from pathlib import Path

from app.api.deps import ORG_MEMBER_DEP, SESSION_DEP, require_org_admin
from app.core.config import settings
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


@router.get("/discover")
async def discover_documents_route(
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> list[dict]:
    """Discover local files that can be imported."""
    if not settings.bridge_url:
        return []
    url = f"{settings.bridge_url.rstrip('/')}/documents/discover"
    headers = {"X-Bridge-Token": settings.bridge_token}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code >= 400:
        return []
    return resp.json()


class ImportRequest(SQLModel):
    file_path: str
    title: str | None = None
    doc_type: str | None = None
    source_agent_id: UUID | None = None


@router.post("/import", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def import_document_route(
    body: ImportRequest,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
) -> DocumentRead:
    """Import a local file as a document record."""
    fpath = Path(body.file_path)
    mime = mimetypes.guess_type(str(fpath))[0] or "application/octet-stream"
    doc_type = body.doc_type
    if not doc_type:
        if "pdf" in mime: doc_type = "pdf"
        elif "presentation" in mime or "pptx" in mime: doc_type = "slide"
        elif "word" in mime or "docx" in mime: doc_type = "report"
        else: doc_type = "markdown"

    title = body.title or fpath.stem.replace("-", " ").replace("_", " ").title()
    doc = Document(
        organization_id=ctx.organization.id,
        title=title, doc_type=doc_type, source_agent_id=body.source_agent_id,
        file_path=body.file_path, mime_type=mime,
        file_size=fpath.stat().st_size if fpath.exists() else None,
        status="published",
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


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: UUID,
    session: AsyncSession = SESSION_DEP,
    ctx: OrganizationContext = ORG_MEMBER_DEP,
):
    """Download/serve a file-backed document."""
    from fastapi.responses import StreamingResponse

    doc = await Document.objects.filter_by(
        id=doc_id,
        organization_id=ctx.organization.id,
    ).first(session)
    if not doc or not doc.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File-backed document not found")

    if not settings.bridge_url:
        raise HTTPException(status_code=503, detail="Bridge not configured")

    url = f"{settings.bridge_url.rstrip('/')}/documents/serve?path={doc.file_path}"
    headers = {"X-Bridge-Token": settings.bridge_token}
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="File not found on bridge")

    return StreamingResponse(
        iter([resp.content]),
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{Path(doc.file_path).name}"'},
    )
