"""Task assignment model — links composed tasks to executive agents."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class TaskAssignment(QueryModel, table=True):
    __tablename__ = "task_assignments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    task_id: UUID = Field(foreign_key="composed_tasks.id", index=True)
    executive_agent_id: UUID = Field(foreign_key="executive_agents.id", index=True)

    role: str = Field(default="primary")  # primary / collaborator / reviewer
    status: str = Field(default="pending", index=True)  # pending / active / completed / blocked
    order_index: int = Field(default=0)  # for sequential mode ordering

    last_update: str | None = Field(default=None, sa_column=Column(Text))
    last_update_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)
