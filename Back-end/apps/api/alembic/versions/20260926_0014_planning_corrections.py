"""Create auditable planning corrections.

Revision ID: 0014_planning_corrections
Revises: 0013_academic_discovery
Create Date: 2026-09-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0014_planning_corrections"
down_revision = "0013_academic_discovery"
branch_labels = None
depends_on = None


planning_correction_kind = postgresql.ENUM(
    "schedule", "topics", "status", "details", "other",
    name="planning_correction_kind", create_type=False,
)
correction_status = postgresql.ENUM(
    "pending", "approved", "rejected", name="correction_status", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    planning_correction_kind.create(bind, checkfirst=True)
    correction_status.create(bind, checkfirst=True)

    op.create_table(
        "planning_corrections",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("suggested_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scheduled_lesson_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("lesson_occurrence_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kind", planning_correction_kind, nullable=False),
        sa.Column("original_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("proposed_patch", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status", correction_status, nullable=False,
            server_default=sa.text("'pending'::correction_status"),
        ),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "(scheduled_lesson_id IS NOT NULL AND lesson_occurrence_id IS NULL) OR "
            "(scheduled_lesson_id IS NULL AND lesson_occurrence_id IS NOT NULL)",
            name="chk_planning_corrections_single_target",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(original_snapshot) = 'object'",
            name="chk_planning_corrections_snapshot_object",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(proposed_patch) = 'object'",
            name="chk_planning_corrections_patch_object",
        ),
        sa.CheckConstraint(
            "(status = 'pending' AND decided_by IS NULL AND decided_at IS NULL) OR "
            "(status IN ('approved', 'rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)",
            name="chk_planning_corrections_decision",
        ),
        sa.ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["group_id", "suggested_by"],
            ["group_members.group_id", "group_members.user_id"],
            name="fk_planning_corrections_author_membership",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["scheduled_lesson_id", "group_id"],
            ["scheduled_lessons.id", "scheduled_lessons.group_id"],
            name="fk_planning_corrections_scheduled_lesson_group",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["lesson_occurrence_id", "group_id"],
            ["lesson_occurrences.id", "lesson_occurrences.group_id"],
            name="fk_planning_corrections_occurrence_group",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_planning_corrections_status_created_at",
        "planning_corrections", ["status", "created_at"],
    )
    op.create_index(
        "ix_planning_corrections_suggested_by", "planning_corrections", ["suggested_by"]
    )
    op.create_index(
        "ix_planning_corrections_group_id", "planning_corrections", ["group_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_planning_corrections_group_id", table_name="planning_corrections")
    op.drop_index("ix_planning_corrections_suggested_by", table_name="planning_corrections")
    op.drop_index("ix_planning_corrections_status_created_at", table_name="planning_corrections")
    op.drop_table("planning_corrections")
    correction_status.drop(op.get_bind(), checkfirst=True)
    planning_correction_kind.drop(op.get_bind(), checkfirst=True)
