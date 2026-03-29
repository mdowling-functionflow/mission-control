"""Add agent_skill_mappings table.

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-03-29

"""

from alembic import op
import sqlalchemy as sa

revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_skill_mappings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("executive_agent_id", sa.Uuid(), nullable=False),
        sa.Column("skill_path", sa.String(), nullable=False),
        sa.Column("relevance", sa.String(), nullable=False, server_default="core"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["executive_agent_id"], ["executive_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_skill_mappings_executive_agent_id", "agent_skill_mappings", ["executive_agent_id"])
    op.create_index("ix_agent_skill_mappings_skill_path", "agent_skill_mappings", ["skill_path"])


def downgrade() -> None:
    op.drop_table("agent_skill_mappings")
