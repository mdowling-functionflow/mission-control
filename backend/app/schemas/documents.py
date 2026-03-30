"""Schemas for the document system."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class DocumentCreate(SQLModel):
    title: str
    content: str | None = None
    doc_type: str = "markdown"
    source_agent_id: UUID | None = None
    file_path: str | None = None
    mime_type: str | None = None
    file_size: int | None = None


class DocumentUpdate(SQLModel):
    title: str | None = None
    content: str | None = None
    doc_type: str | None = None
    status: str | None = None
    file_path: str | None = None


class DocumentRead(SQLModel):
    id: UUID
    organization_id: UUID
    title: str
    content: str | None = None
    doc_type: str
    source_agent_id: UUID | None = None
    agent_display_name: str | None = None
    agent_avatar_emoji: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class DiscoveredFile(SQLModel):
    path: str
    name: str
    mime_type: str
    size: int
    last_modified: str | None = None
