"""Composed task model — tasks created from the founder command composer."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class ComposedTask(QueryModel, table=True):
    __tablename__ = "composed_tasks"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)

    title: str
    description: str | None = Field(default=None, sa_column=Column(Text))
    original_request: str | None = Field(default=None, sa_column=Column(Text))

    task_type: str = Field(default="single_agent", index=True)
    # single_agent / multi_agent / skill_improvement / research
    collaboration_mode: str | None = Field(default=None)
    # parallel / sequential / review (null for single-agent)

    status: str = Field(default="active", index=True)
    # draft / active / in_progress / completed / cancelled

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
