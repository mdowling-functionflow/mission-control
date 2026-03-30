"""Chat thread model — conversation threads per executive agent."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class ChatThread(QueryModel, table=True):
    __tablename__ = "chat_threads"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    executive_agent_id: UUID = Field(foreign_key="executive_agents.id", index=True)

    title: str | None = Field(default=None)
    session_id: str = Field(index=True)  # OpenClaw session identifier: "mc-thread-{uuid_hex[:12]}"
    is_active: bool = Field(default=True)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
