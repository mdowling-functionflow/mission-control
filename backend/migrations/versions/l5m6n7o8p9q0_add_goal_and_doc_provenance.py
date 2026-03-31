"""Add goal to executive_agents, origin/source_thread_id to documents.

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-03-31

"""

from alembic import op
import sqlalchemy as sa

revision = "l5m6n7o8p9q0"
down_revision = "k4l5m6n7o8p9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agent goal
    op.add_column("executive_agents", sa.Column("goal", sa.Text(), nullable=True))

    # Document provenance
    op.add_column("documents", sa.Column("origin", sa.String(), nullable=False, server_default="manual"))
    op.add_column("documents", sa.Column("source_thread_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "source_thread_id")
    op.drop_column("documents", "origin")
    op.drop_column("executive_agents", "goal")
