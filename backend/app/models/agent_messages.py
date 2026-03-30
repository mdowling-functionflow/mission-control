"""Agent message model — conversation history per executive agent."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class AgentMessage(QueryModel, table=True):
    __tablename__ = "agent_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    executive_agent_id: UUID = Field(foreign_key="executive_agents.id", index=True)

    thread_id: UUID | None = Field(default=None, foreign_key="chat_threads.id", index=True)

    role: str = Field(index=True)  # user / agent / system
    content: str = Field(sa_column=Column(Text))

    # Attachments (optional)
    attachment_name: str | None = Field(default=None)
    attachment_path: str | None = Field(default=None)  # path on bridge filesystem
    attachment_mime: str | None = Field(default=None)
    attachment_size: int | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)
