"""Executive agent model – binds existing OpenClaw agents to Mission Control."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class ExecutiveAgent(QueryModel, table=True):
    __tablename__ = "executive_agents"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)

    # Binding to existing OpenClaw agent
    openclaw_agent_id: str = Field(index=True)  # e.g. "sales", "main"
    openclaw_workspace: str | None = Field(default=None, sa_column=Column(Text))

    # Display
    display_name: str  # e.g. "Sales"
    executive_role: str  # e.g. "Head of Sales"
    role_description: str | None = Field(default=None, sa_column=Column(Text))
    goal: str | None = Field(default=None, sa_column=Column(Text))  # current operating goal
    avatar_emoji: str | None = Field(default=None)
    persona_name: str | None = Field(default=None)  # e.g. "Piper" — friendly identity name

    # Agent hierarchy
    agent_type: str = Field(default="primary", index=True)  # primary / helper
    parent_agent_id: UUID | None = Field(default=None, foreign_key="executive_agents.id", index=True)
    sidebar_visible: bool = Field(default=True)

    # Runtime state
    status: str = Field(default="bound", index=True)  # bound / active / stale / error
    current_focus: str | None = Field(default=None, sa_column=Column(Text))
    last_seen_at: datetime | None = Field(default=None)

    # Denormalized counts for the Overview page
    pending_approvals_count: int = Field(default=0)
    active_tasks_count: int = Field(default=0)
    current_risk: str | None = Field(default=None, sa_column=Column(Text))

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
