"""Schemas for the executive agent binding system."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class ExecutiveAgentBind(SQLModel):
    """Bind an existing OpenClaw agent to an executive role."""

    openclaw_agent_id: str
    display_name: str
    executive_role: str
    role_description: str | None = None
    avatar_emoji: str | None = None


class ExecutiveAgentUpdate(SQLModel):
    """Partial update for an executive agent."""

    display_name: str | None = None
    executive_role: str | None = None
    role_description: str | None = None
    avatar_emoji: str | None = None
    current_focus: str | None = None
    current_risk: str | None = None
    status: str | None = None


class ExecutiveAgentRead(SQLModel):
    """Full read model for an executive agent."""

    id: UUID
    organization_id: UUID
    openclaw_agent_id: str
    openclaw_workspace: str | None = None
    display_name: str
    executive_role: str
    role_description: str | None = None
    avatar_emoji: str | None = None
    status: str
    current_focus: str | None = None
    last_seen_at: datetime | None = None
    pending_approvals_count: int = 0
    active_tasks_count: int = 0
    current_risk: str | None = None
    created_at: datetime
    updated_at: datetime


class DiscoveredAgent(SQLModel):
    """An agent found in openclaw.json that hasn't been bound yet."""

    openclaw_agent_id: str
    name: str | None = None
    workspace: str | None = None
    emoji: str | None = None
    already_bound: bool = False
