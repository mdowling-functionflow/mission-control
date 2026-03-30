"""Add file_path, mime_type, file_size to documents.

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-03-30

"""

from alembic import op
import sqlalchemy as sa

revision = "g8h9i0j1k2l3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("file_path", sa.Text(), nullable=True))
    op.add_column("documents", sa.Column("mime_type", sa.String(), nullable=True))
    op.add_column("documents", sa.Column("file_size", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "file_size")
    op.drop_column("documents", "mime_type")
    op.drop_column("documents", "file_path")
