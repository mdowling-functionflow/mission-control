"""Add goal_relevance to improvements.

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-03-31

"""

from alembic import op
import sqlalchemy as sa

revision = "m6n7o8p9q0r1"
down_revision = "l5m6n7o8p9q0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("improvements", sa.Column("goal_relevance", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("improvements", "goal_relevance")
