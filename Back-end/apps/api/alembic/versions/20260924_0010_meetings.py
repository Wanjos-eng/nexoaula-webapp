"""Create meetings and meeting associations.

Revision ID: 0010_meetings
Revises: 0009_occurrences_attendance
Create Date: 2026-09-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0010_meetings"
down_revision = "0009_occurrences_attendance"
branch_labels = None
depends_on = None

meeting_modality = postgresql.ENUM("in_person", "online", "hybrid", name="meeting_modality", create_type=False)
meeting_status = postgresql.ENUM("scheduled", "completed", "cancelled", name="meeting_status", create_type=False)
participant_status = postgresql.ENUM("interested", "confirmed", "cancelled", "attended", name="meeting_participant_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    meeting_modality.create(bind, checkfirst=True)
    meeting_status.create(bind, checkfirst=True)
    participant_status.create(bind, checkfirst=True)

    op.create_table(
        "meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        # No FK by design: channel relation is deferred due to issue #120.
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("organizer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("modality", meeting_modality, nullable=False),
        sa.Column("location", sa.String(250), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", meeting_status, server_default=sa.text("'scheduled'::meeting_status"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("ends_at IS NULL OR ends_at > starts_at", name="chk_meetings_time_range"),
        sa.CheckConstraint(
            "(modality = 'in_person' AND location IS NOT NULL) OR "
            "(modality = 'online' AND external_url IS NOT NULL) OR "
            "(modality = 'hybrid' AND location IS NOT NULL AND external_url IS NOT NULL)",
            name="chk_meetings_modality_fields",
        ),
        sa.ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organizer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meetings_group_id_starts_at", "meetings", ["group_id", "starts_at"])
    op.create_index("ix_meetings_status_starts_at", "meetings", ["status", "starts_at"])

    op.create_table(
        "meeting_participants",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", participant_status, server_default=sa.text("'interested'::meeting_participant_status"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("meeting_id", "user_id"),
        sa.UniqueConstraint("user_id", "meeting_id", name="uq_meeting_participants_user_id_meeting_id"),
    )
    op.create_index("ix_meeting_participants_user_id_status", "meeting_participants", ["user_id", "status"])

    op.create_table(
        "meeting_topics",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_topic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subject_topic_id"], ["subject_topics.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("meeting_id", "subject_topic_id"),
    )
    op.create_index("ix_meeting_topics_subject_topic_id", "meeting_topics", ["subject_topic_id"])


def downgrade() -> None:
    op.drop_index("ix_meeting_topics_subject_topic_id", table_name="meeting_topics")
    op.drop_table("meeting_topics")
    op.drop_index("ix_meeting_participants_user_id_status", table_name="meeting_participants")
    op.drop_table("meeting_participants")
    op.drop_index("ix_meetings_status_starts_at", table_name="meetings")
    op.drop_index("ix_meetings_group_id_starts_at", table_name="meetings")
    op.drop_table("meetings")
    participant_status.drop(op.get_bind(), checkfirst=True)
    meeting_status.drop(op.get_bind(), checkfirst=True)
    meeting_modality.drop(op.get_bind(), checkfirst=True)
