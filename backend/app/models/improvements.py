"""Improvement proposal model."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class Improvement(QueryModel, table=True):
    __tablename__ = "improvements"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    executive_agent_id: UUID | None = Field(
        default=None, foreign_key="executive_agents.id", index=True
    )

    title: str
    description: str | None = Field(default=None, sa_column=Column(Text))
    rationale: str | None = Field(default=None, sa_column=Column(Text))

    # Lifecycle
    status: str = Field(default="proposed", index=True)
    # proposed / reviewing / testing / adopted / rejected
    priority: str = Field(default="normal")  # low / normal / high / urgent
    category: str = Field(default="process")  # process / tooling / communication / automation
    goal_relevance: str | None = Field(default=None, sa_column=Column(Text))

    resolved_at: datetime | None = Field(default=None)
    resolution_note: str | None = Field(default=None, sa_column=Column(Text))

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
