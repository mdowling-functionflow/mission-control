"""Add goal_progress JSON field to weekly_reviews.

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-03-31

"""

from alembic import op
import sqlalchemy as sa

revision = "n7o8p9q0r1s2"
down_revision = "m6n7o8p9q0r1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("weekly_reviews", sa.Column("goal_progress", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("weekly_reviews", "goal_progress")
