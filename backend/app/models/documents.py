"""Document model — generated artifacts from executive agents."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Column, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class Document(QueryModel, table=True):
    __tablename__ = "documents"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)

    title: str
    content: str | None = Field(default=None, sa_column=Column(Text))
    doc_type: str = Field(default="markdown", index=True)
    # markdown / pdf / memo / brief / report / slide

    source_agent_id: UUID | None = Field(
        default=None, foreign_key="executive_agents.id", index=True
    )
    origin: str = Field(default="manual")  # manual / uploaded / generated / imported / audit
    source_thread_id: UUID | None = Field(default=None, index=True)  # link back to chat thread

    # File-backed document fields
    file_path: str | None = Field(default=None, sa_column=Column(Text))
    mime_type: str | None = Field(default=None)
    file_size: int | None = Field(default=None, sa_column=Column(BigInteger))

    status: str = Field(default="draft", index=True)
    # draft / published / archived

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
