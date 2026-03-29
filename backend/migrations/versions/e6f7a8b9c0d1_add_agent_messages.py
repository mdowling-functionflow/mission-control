"""Add agent_messages table.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-03-29

"""

from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("executive_agent_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["executive_agent_id"], ["executive_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_messages_organization_id", "agent_messages", ["organization_id"])
    op.create_index("ix_agent_messages_executive_agent_id", "agent_messages", ["executive_agent_id"])
    op.create_index("ix_agent_messages_role", "agent_messages", ["role"])


def downgrade() -> None:
    op.drop_table("agent_messages")
