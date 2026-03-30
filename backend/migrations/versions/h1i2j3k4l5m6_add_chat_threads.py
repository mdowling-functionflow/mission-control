"""Add chat_threads table and thread_id to agent_messages.

Revision ID: h1i2j3k4l5m6
Revises: g8h9i0j1k2l3
Create Date: 2026-03-30

"""

from alembic import op
import sqlalchemy as sa
from uuid import uuid4

revision = "h1i2j3k4l5m6"
down_revision = "g8h9i0j1k2l3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create chat_threads table
    op.create_table(
        "chat_threads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("executive_agent_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["executive_agent_id"], ["executive_agents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_threads_organization_id", "chat_threads", ["organization_id"])
    op.create_index("ix_chat_threads_executive_agent_id", "chat_threads", ["executive_agent_id"])
    op.create_index("ix_chat_threads_session_id", "chat_threads", ["session_id"])

    # Add thread_id to agent_messages
    op.add_column("agent_messages", sa.Column("thread_id", sa.Uuid(), nullable=True))
    op.create_index("ix_agent_messages_thread_id", "agent_messages", ["thread_id"])
    op.create_foreign_key(
        "fk_agent_messages_thread_id",
        "agent_messages",
        "chat_threads",
        ["thread_id"],
        ["id"],
    )

    # Backfill: create legacy threads for existing messages
    # This runs raw SQL for efficiency
    conn = op.get_bind()

    # Find distinct (org_id, agent_id) pairs with messages
    pairs = conn.execute(sa.text(
        "SELECT DISTINCT organization_id, executive_agent_id FROM agent_messages WHERE thread_id IS NULL"
    )).fetchall()

    for org_id, agent_id in pairs:
        thread_id = uuid4()
        session_id = f"mc-legacy-{thread_id.hex[:12]}"
        conn.execute(sa.text(
            "INSERT INTO chat_threads (id, organization_id, executive_agent_id, title, session_id, is_active, created_at, updated_at) "
            "VALUES (:id, :org_id, :agent_id, :title, :session_id, true, NOW(), NOW())"
        ), {
            "id": thread_id,
            "org_id": org_id,
            "agent_id": agent_id,
            "title": "Previous conversations",
            "session_id": session_id,
        })
        conn.execute(sa.text(
            "UPDATE agent_messages SET thread_id = :thread_id "
            "WHERE organization_id = :org_id AND executive_agent_id = :agent_id AND thread_id IS NULL"
        ), {"thread_id": thread_id, "org_id": org_id, "agent_id": agent_id})


def downgrade() -> None:
    op.drop_constraint("fk_agent_messages_thread_id", "agent_messages", type_="foreignkey")
    op.drop_index("ix_agent_messages_thread_id", "agent_messages")
    op.drop_column("agent_messages", "thread_id")
    op.drop_table("chat_threads")
