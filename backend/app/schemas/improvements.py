"""Schemas for the improvement proposal system."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class ImprovementCreate(SQLModel):
    title: str
    description: str | None = None
    rationale: str | None = None
    executive_agent_id: UUID | None = None
    priority: str = "normal"
    category: str = "process"
    goal_relevance: str | None = None


class ImprovementUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    rationale: str | None = None
    status: str | None = None
    priority: str | None = None
    goal_relevance: str | None = None
    resolution_note: str | None = None


class ImprovementRead(SQLModel):
    id: UUID
    organization_id: UUID
    executive_agent_id: UUID | None = None
    agent_display_name: str | None = None
    agent_avatar_emoji: str | None = None
    title: str
    description: str | None = None
    rationale: str | None = None
    goal_relevance: str | None = None
    status: str
    priority: str
    category: str
    resolved_at: datetime | None = None
    resolution_note: str | None = None
    created_at: datetime
    updated_at: datetime


class ImprovementStats(SQLModel):
    proposed: int = 0
    reviewing: int = 0
    testing: int = 0
    adopted: int = 0
    rejected: int = 0
    total: int = 0
