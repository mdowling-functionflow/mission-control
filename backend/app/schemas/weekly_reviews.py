"""Schemas for the weekly review system."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from sqlmodel import SQLModel


class WeeklyReviewCreate(SQLModel):
    week_start: date
    week_end: date


class WeeklyReviewUpdate(SQLModel):
    wins: list[dict] | None = None
    risks: list[dict] | None = None
    friction_points: list[dict] | None = None
    improvements: list[dict] | None = None
    next_week_priorities: list[dict] | None = None
    agent_summaries: dict | None = None
    goal_progress: dict | None = None
    status: str | None = None


class WeeklyReviewRead(SQLModel):
    id: UUID
    organization_id: UUID
    week_start: date
    week_end: date
    status: str
    wins: list[dict] | None = None
    risks: list[dict] | None = None
    friction_points: list[dict] | None = None
    improvements: list[dict] | None = None
    next_week_priorities: list[dict] | None = None
    agent_summaries: dict | None = None
    goal_progress: dict | None = None
    created_at: datetime
    updated_at: datetime
