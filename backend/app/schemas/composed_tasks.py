"""Schemas for the composed task system."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class TaskAssignmentInput(SQLModel):
    executive_agent_id: UUID
    role: str = "primary"  # primary / collaborator / reviewer
    order_index: int = 0


class ComposedTaskCreate(SQLModel):
    title: str
    description: str | None = None
    original_request: str | None = None
    task_type: str = "single_agent"
    collaboration_mode: str | None = None
    assignments: list[TaskAssignmentInput] = []


class ComposedTaskUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    collaboration_mode: str | None = None


class TaskAssignmentRead(SQLModel):
    id: UUID
    task_id: UUID
    executive_agent_id: UUID
    agent_display_name: str | None = None
    agent_avatar_emoji: str | None = None
    agent_executive_role: str | None = None
    role: str
    status: str
    order_index: int
    last_update: str | None = None
    last_update_at: datetime | None = None
    created_at: datetime


class ComposedTaskRead(SQLModel):
    id: UUID
    organization_id: UUID
    title: str
    description: str | None = None
    original_request: str | None = None
    task_type: str
    collaboration_mode: str | None = None
    status: str
    assignments: list[TaskAssignmentRead] = []
    created_at: datetime
    updated_at: datetime


class AgentUpdateInput(SQLModel):
    executive_agent_id: UUID
    message: str


class AgentSuggestion(SQLModel):
    executive_agent_id: UUID
    display_name: str
    avatar_emoji: str | None = None
    reason: str


class SuggestAgentsResponse(SQLModel):
    suggestions: list[AgentSuggestion] = []
    recommended_mode: str | None = None  # parallel / sequential / review
    reason: str = ""
