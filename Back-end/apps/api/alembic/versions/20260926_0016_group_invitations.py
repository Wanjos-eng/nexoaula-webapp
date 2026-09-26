"""Add group invitations for invite-only participation.

Revision ID: 0016_group_invitations
Revises: 0015_channel_messages
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0016_group_invitations"
down_revision = "0015_channel_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "group_invitations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('pending','accepted','cancelled','expired')",
            name="chk_group_invitations_status",
        ),
        sa.CheckConstraint(
            "(status = 'pending' AND accepted_at IS NULL AND cancelled_at IS NULL) OR "
            "(status = 'accepted' AND accepted_at IS NOT NULL AND cancelled_at IS NULL) OR "
            "(status = 'cancelled' AND accepted_at IS NULL AND cancelled_at IS NOT NULL) OR "
            "(status = 'expired' AND accepted_at IS NULL AND cancelled_at IS NULL)",
            name="chk_group_invitations_lifecycle",
        ),
        sa.CheckConstraint(
            "invited_user_id <> created_by",
            name="chk_group_invitations_distinct_users",
        ),
        sa.ForeignKeyConstraint(
            ["group_id"], ["study_groups.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "token_hash", name="uq_group_invitations_token_hash"
        ),
    )
    op.create_index(
        "uq_group_invitations_pending_user",
        "group_invitations",
        ["group_id", "invited_user_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index(
        "ix_group_invitations_group_status",
        "group_invitations",
        ["group_id", "status"],
    )
    op.create_index(
        "ix_group_invitations_invited_status",
        "group_invitations",
        ["invited_user_id", "status"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_group_invitations_invited_status",
        table_name="group_invitations",
    )
    op.drop_index(
        "ix_group_invitations_group_status",
        table_name="group_invitations",
    )
    op.drop_index(
        "uq_group_invitations_pending_user",
        table_name="group_invitations",
    )
    op.drop_table("group_invitations")
