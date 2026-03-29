"""Add composed_tasks and task_assignments tables.

Revision ID: c3d4e5f6a7b8
Revises: b1c2d3e4f5a6
Create Date: 2026-03-29

"""

from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "composed_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("original_request", sa.Text(), nullable=True),
        sa.Column("task_type", sa.String(), nullable=False, server_default="single_agent"),
        sa.Column("collaboration_mode", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_composed_tasks_organization_id", "composed_tasks", ["organization_id"])
    op.create_index("ix_composed_tasks_status", "composed_tasks", ["status"])
    op.create_index("ix_composed_tasks_task_type", "composed_tasks", ["task_type"])

    op.create_table(
        "task_assignments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=False),
        sa.Column("executive_agent_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="primary"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_update", sa.Text(), nullable=True),
        sa.Column("last_update_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["composed_tasks.id"]),
        sa.ForeignKeyConstraint(["executive_agent_id"], ["executive_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_assignments_task_id", "task_assignments", ["task_id"])
    op.create_index("ix_task_assignments_executive_agent_id", "task_assignments", ["executive_agent_id"])
    op.create_index("ix_task_assignments_status", "task_assignments", ["status"])


def downgrade() -> None:
    op.drop_table("task_assignments")
    op.drop_table("composed_tasks")
