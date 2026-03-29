"""Agent-skill mapping model — associates skills with executive agents."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class AgentSkillMapping(QueryModel, table=True):
    __tablename__ = "agent_skill_mappings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    executive_agent_id: UUID = Field(foreign_key="executive_agents.id", index=True)
    skill_path: str = Field(index=True)  # base64-encoded path matching installed-skills
    relevance: str = Field(default="core")  # core / related

    created_at: datetime = Field(default_factory=utcnow)
