"""Daily proactive item model — per-agent actionable items for the day."""

from __future__ import annotations

import datetime as dt
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, Date, Text
from sqlmodel import Field

from app.core.time import utcnow
from app.models.base import QueryModel


class DailyItem(QueryModel, table=True):
    __tablename__ = "daily_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    executive_agent_id: UUID = Field(foreign_key="executive_agents.id", index=True)

    item_date: dt.date = Field(sa_column=Column("date", Date, index=True))  # which day
    title: str
    description: str = Field(sa_column=Column(Text))
    item_type: str = Field(default="action", index=True)  # action / signal / reminder / risk
    urgency: str = Field(default="medium")  # high / medium / low
    status: str = Field(default="pending", index=True)  # pending / done / dismissed
    source: str = Field(default="cron")  # cron / manual / system

    created_at: datetime = Field(default_factory=utcnow)
