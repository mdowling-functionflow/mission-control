"""Add daily_items table for proactive daily workflow.

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-03-31

"""

from alembic import op
import sqlalchemy as sa

revision = "k4l5m6n7o8p9"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("executive_agent_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("item_type", sa.String(), nullable=False, server_default="action"),
        sa.Column("urgency", sa.String(), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("source", sa.String(), nullable=False, server_default="cron"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["executive_agent_id"], ["executive_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_daily_items_organization_id", "daily_items", ["organization_id"])
    op.create_index("ix_daily_items_executive_agent_id", "daily_items", ["executive_agent_id"])
    op.create_index("ix_daily_items_date", "daily_items", ["date"])
    op.create_index("ix_daily_items_status", "daily_items", ["status"])
    op.create_index("ix_daily_items_item_type", "daily_items", ["item_type"])


def downgrade() -> None:
    op.drop_index("ix_daily_items_item_type", "daily_items")
    op.drop_index("ix_daily_items_status", "daily_items")
    op.drop_index("ix_daily_items_date", "daily_items")
    op.drop_index("ix_daily_items_executive_agent_id", "daily_items")
    op.drop_index("ix_daily_items_organization_id", "daily_items")
    op.drop_table("daily_items")
