"""Add agent_type, parent_agent_id, sidebar_visible to executive_agents.

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-03-30

"""

from alembic import op
import sqlalchemy as sa

revision = "i2j3k4l5m6n7"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("executive_agents", sa.Column("agent_type", sa.String(), nullable=False, server_default="primary"))
    op.add_column("executive_agents", sa.Column("parent_agent_id", sa.Uuid(), nullable=True))
    op.add_column("executive_agents", sa.Column("sidebar_visible", sa.Boolean(), nullable=False, server_default="true"))
    op.create_index("ix_executive_agents_agent_type", "executive_agents", ["agent_type"])
    op.create_index("ix_executive_agents_parent_agent_id", "executive_agents", ["parent_agent_id"])
    op.create_foreign_key(
        "fk_executive_agents_parent_agent_id",
        "executive_agents",
        "executive_agents",
        ["parent_agent_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_executive_agents_parent_agent_id", "executive_agents", type_="foreignkey")
    op.drop_index("ix_executive_agents_parent_agent_id", "executive_agents")
    op.drop_index("ix_executive_agents_agent_type", "executive_agents")
    op.drop_column("executive_agents", "sidebar_visible")
    op.drop_column("executive_agents", "parent_agent_id")
    op.drop_column("executive_agents", "agent_type")
