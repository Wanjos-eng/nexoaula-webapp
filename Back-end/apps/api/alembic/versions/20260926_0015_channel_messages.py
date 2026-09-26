"""Persist channel messages.

Revision ID: 0015_channel_messages
Revises: 0014_planning_corrections
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0015_channel_messages"
down_revision = "0014_planning_corrections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "channel_messages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reply_to_message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "reply_to_message_id IS NULL OR reply_to_message_id <> id",
            name="chk_channel_messages_not_self_reply",
        ),
        sa.ForeignKeyConstraint(
            ["channel_id"],
            ["channels.id"],
            name="fk_channel_messages_channel",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name="fk_channel_messages_author",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["reply_to_message_id"],
            ["channel_messages.id"],
            name="fk_channel_messages_reply_target",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["reply_to_message_id", "channel_id"],
            ["channel_messages.id", "channel_messages.channel_id"],
            name="fk_channel_messages_reply_same_channel",
            ondelete="NO ACTION",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "id",
            "channel_id",
            name="uq_channel_messages_id_channel_id",
        ),
    )
    op.create_index(
        "ix_channel_messages_channel_created_at",
        "channel_messages",
        ["channel_id", "created_at"],
    )
    op.create_index(
        "ix_channel_messages_author_created_at",
        "channel_messages",
        ["author_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_channel_messages_author_created_at",
        table_name="channel_messages",
    )
    op.drop_index(
        "ix_channel_messages_channel_created_at",
        table_name="channel_messages",
    )
    op.drop_table("channel_messages")
