"""Add persona_name to executive_agents, attachment fields to agent_messages.

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-03-30

"""

from alembic import op
import sqlalchemy as sa

revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # persona_name on executive_agents
    op.add_column("executive_agents", sa.Column("persona_name", sa.String(), nullable=True))

    # Attachment fields on agent_messages
    op.add_column("agent_messages", sa.Column("attachment_name", sa.String(), nullable=True))
    op.add_column("agent_messages", sa.Column("attachment_path", sa.String(), nullable=True))
    op.add_column("agent_messages", sa.Column("attachment_mime", sa.String(), nullable=True))
    op.add_column("agent_messages", sa.Column("attachment_size", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("agent_messages", "attachment_size")
    op.drop_column("agent_messages", "attachment_mime")
    op.drop_column("agent_messages", "attachment_path")
    op.drop_column("agent_messages", "attachment_name")
    op.drop_column("executive_agents", "persona_name")
