"""Weekly executive review model."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class WeeklyReview(QueryModel, table=True):
    __tablename__ = "weekly_reviews"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)

    week_start: date
    week_end: date
    status: str = Field(default="draft", index=True)  # draft / finalized

    wins: list[dict] | None = Field(default=None, sa_column=Column(JSON))
    risks: list[dict] | None = Field(default=None, sa_column=Column(JSON))
    friction_points: list[dict] | None = Field(default=None, sa_column=Column(JSON))
    improvements: list[dict] | None = Field(default=None, sa_column=Column(JSON))
    next_week_priorities: list[dict] | None = Field(default=None, sa_column=Column(JSON))

    # Per-agent summaries
    agent_summaries: dict | None = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
