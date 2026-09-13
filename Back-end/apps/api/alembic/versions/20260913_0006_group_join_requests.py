"""Persist the lifecycle of study-group join requests.

Revision ID: 0006_group_join_requests
Revises: 0005_group_rules
Create Date: 2026-09-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_group_join_requests"
down_revision = "0005_group_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    join_request_status = postgresql.ENUM(
        "pending", "approved", "rejected", "cancelled",
        name="join_request_status", create_type=False,
    )
    join_request_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "group_join_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", join_request_status,
                  server_default=sa.text("'pending'::join_request_status"), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "(status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL) "
            "OR (status <> 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)",
            name="chk_join_requests_resolution",
        ),
        sa.ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_group_join_requests_group_user_status", "group_join_requests",
                    ["group_id", "user_id", "status"])
    op.create_index("ix_group_join_requests_user_status", "group_join_requests",
                    ["user_id", "status"])
    op.create_index("uq_group_join_requests_pending", "group_join_requests",
                    ["group_id", "user_id"], unique=True,
                    postgresql_where=sa.text("status = 'pending'"))


def downgrade() -> None:
    op.drop_table("group_join_requests")
    postgresql.ENUM(name="join_request_status").drop(op.get_bind(), checkfirst=True)
