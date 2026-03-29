"""Add executive_agents, weekly_reviews, and improvements tables.

Revision ID: b1c2d3e4f5a6
Revises: a9b1c2d3e4f7
Create Date: 2026-03-29

"""

from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5a6"
down_revision = "a9b1c2d3e4f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- executive_agents ---
    op.create_table(
        "executive_agents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("openclaw_agent_id", sa.String(), nullable=False),
        sa.Column("openclaw_workspace", sa.Text(), nullable=True),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("executive_role", sa.String(), nullable=False),
        sa.Column("role_description", sa.Text(), nullable=True),
        sa.Column("avatar_emoji", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="bound"),
        sa.Column("current_focus", sa.Text(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("pending_approvals_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active_tasks_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current_risk", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_executive_agents_organization_id", "executive_agents", ["organization_id"])
    op.create_index("ix_executive_agents_openclaw_agent_id", "executive_agents", ["openclaw_agent_id"])
    op.create_index("ix_executive_agents_status", "executive_agents", ["status"])

    # --- weekly_reviews ---
    op.create_table(
        "weekly_reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="draft"),
        sa.Column("wins", sa.JSON(), nullable=True),
        sa.Column("risks", sa.JSON(), nullable=True),
        sa.Column("friction_points", sa.JSON(), nullable=True),
        sa.Column("improvements", sa.JSON(), nullable=True),
        sa.Column("next_week_priorities", sa.JSON(), nullable=True),
        sa.Column("agent_summaries", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_weekly_reviews_organization_id", "weekly_reviews", ["organization_id"])
    op.create_index("ix_weekly_reviews_status", "weekly_reviews", ["status"])

    # --- improvements ---
    op.create_table(
        "improvements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("executive_agent_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="proposed"),
        sa.Column("priority", sa.String(), nullable=False, server_default="normal"),
        sa.Column("category", sa.String(), nullable=False, server_default="process"),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["executive_agent_id"], ["executive_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_improvements_organization_id", "improvements", ["organization_id"])
    op.create_index("ix_improvements_executive_agent_id", "improvements", ["executive_agent_id"])
    op.create_index("ix_improvements_status", "improvements", ["status"])


def downgrade() -> None:
    op.drop_table("improvements")
    op.drop_table("weekly_reviews")
    op.drop_table("executive_agents")
