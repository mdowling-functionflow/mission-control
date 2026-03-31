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
    goal: str | None = None
    avatar_emoji: str | None = None
    persona_name: str | None = None


class ExecutiveAgentCreate(SQLModel):
    """Create a new agent (syncs to OpenClaw)."""

    display_name: str
    openclaw_agent_id: str  # slug like "research-assistant"
    executive_role: str
    role_description: str | None = None
    goal: str | None = None
    avatar_emoji: str | None = None
    persona_name: str | None = None
    agent_type: str = "primary"  # primary / helper
    parent_agent_id: UUID | None = None  # required if helper


class ExecutiveAgentUpdate(SQLModel):
    """Partial update for an executive agent."""

    display_name: str | None = None
    executive_role: str | None = None
    role_description: str | None = None
    avatar_emoji: str | None = None
    persona_name: str | None = None
    goal: str | None = None
    current_focus: str | None = None
    current_risk: str | None = None
    status: str | None = None
    agent_type: str | None = None
    parent_agent_id: UUID | None = None
    sidebar_visible: bool | None = None


class ExecutiveAgentRead(SQLModel):
    """Full read model for an executive agent."""

    id: UUID
    organization_id: UUID
    openclaw_agent_id: str
    openclaw_workspace: str | None = None
    display_name: str
    executive_role: str
    role_description: str | None = None
    goal: str | None = None
    avatar_emoji: str | None = None
    persona_name: str | None = None
    agent_type: str = "primary"
    parent_agent_id: UUID | None = None
    sidebar_visible: bool = True
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
