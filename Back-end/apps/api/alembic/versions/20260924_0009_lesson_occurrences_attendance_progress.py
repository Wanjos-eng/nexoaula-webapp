"""persist lesson occurrences, private attendance, and topic progress

Revision ID: 0009_occurrences_attendance_progress
Revises: 0008_teaching_plans_and_lessons
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0009_occurrences_attendance'
down_revision = '0008_teaching_plans_and_lessons'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Enums
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE lesson_occurrence_status AS ENUM ('held', 'cancelled', 'postponed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
            CREATE TYPE attendance_status AS ENUM ('present', 'absent');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
            CREATE TYPE attendance_adjustment_outcome AS ENUM ('transferred', 'invalidated', 'kept_existing');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        DO $$ BEGIN
            CREATE TYPE topic_progress_status AS ENUM ('pending', 'reviewing', 'mastered');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)

    lesson_occurrence_status = postgresql.ENUM(
        'held', 'cancelled', 'postponed', name='lesson_occurrence_status', create_type=False
    )
    attendance_status = postgresql.ENUM(
        'present', 'absent', name='attendance_status', create_type=False
    )
    attendance_adjustment_outcome = postgresql.ENUM(
        'transferred', 'invalidated', 'kept_existing', name='attendance_adjustment_outcome', create_type=False
    )
    topic_progress_status = postgresql.ENUM(
        'pending', 'reviewing', 'mastered', name='topic_progress_status', create_type=False
    )

    # 2. Table lesson_occurrences
    op.create_table(
        'lesson_occurrences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('study_groups.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('scheduled_lesson_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('supersedes_occurrence_id', postgresql.UUID(as_uuid=True), nullable=True, unique=True),
        sa.Column('status', lesson_occurrence_status, nullable=False),
        sa.Column('actual_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rescheduled_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('id', 'group_id', name='uq_lesson_occurrences_id_group_id'),
        sa.UniqueConstraint('id', 'status', name='uq_lesson_occurrences_id_status'),
        sa.ForeignKeyConstraint(
            ['scheduled_lesson_id', 'group_id'],
            ['scheduled_lessons.id', 'scheduled_lessons.group_id'],
            name='fk_lesson_occurrences_scheduled_lesson',
            ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['supersedes_occurrence_id', 'group_id'],
            ['lesson_occurrences.id', 'lesson_occurrences.group_id'],
            name='fk_lesson_occurrences_supersedes',
            ondelete='RESTRICT'
        ),
        sa.ForeignKeyConstraint(
            ['group_id', 'recorded_by'],
            ['group_members.group_id', 'group_members.user_id'],
            name='fk_lesson_occurrences_recorded_by',
            ondelete='RESTRICT'
        ),
        sa.CheckConstraint(
            'actual_ended_at IS NULL OR (actual_started_at IS NOT NULL AND actual_ended_at > actual_started_at)',
            name='chk_lesson_occurrences_time_range'
        ),
        sa.CheckConstraint(
            "(status = 'held' AND actual_started_at IS NOT NULL AND actual_ended_at IS NOT NULL AND actual_ended_at <= created_at AND rescheduled_to IS NULL) OR (status = 'cancelled' AND actual_started_at IS NULL AND actual_ended_at IS NULL AND rescheduled_to IS NULL) OR (status = 'postponed' AND actual_started_at IS NULL AND actual_ended_at IS NULL AND rescheduled_to IS NOT NULL)",
            name='chk_lesson_occurrences_status_fields'
        ),
        sa.CheckConstraint(
            'supersedes_occurrence_id IS NULL OR supersedes_occurrence_id <> id',
            name='chk_lesson_occurrences_not_self_superseding'
        )
    )
    op.create_index('ix_lesson_occurrences_group_id_created_at', 'lesson_occurrences', ['group_id', 'created_at'])
    op.create_index('ix_lesson_occurrences_scheduled_lesson_id_created_at', 'lesson_occurrences', ['scheduled_lesson_id', 'created_at'])

    # 3. Table occurrence_topics
    op.create_table(
        'occurrence_topics',
        sa.Column('lesson_occurrence_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lesson_occurrences.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('group_topic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('group_topics.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('subject_topic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subject_topics.id', ondelete='RESTRICT'), nullable=True)
    )
    op.create_index('ix_occurrence_topics_group_topic_id', 'occurrence_topics', ['group_topic_id'])

    # 4. Table student_lesson_attendance (NO group_id!)
    op.create_table(
        'student_lesson_attendance',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('lesson_occurrence_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('occurrence_status', lesson_occurrence_status, nullable=False, server_default=sa.text("'held'::lesson_occurrence_status")),
        sa.Column('status', attendance_status, nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(
            ['lesson_occurrence_id', 'occurrence_status'],
            ['lesson_occurrences.id', 'lesson_occurrences.status'],
            name='fk_student_lesson_attendance_occurrence',
            ondelete='RESTRICT'
        ),
        sa.CheckConstraint("occurrence_status = 'held'", name='chk_attendance_held_only')
    )
    op.create_index('ix_student_lesson_attendance_lesson_occurrence_id', 'student_lesson_attendance', ['lesson_occurrence_id'])

    # 5. Table student_attendance_adjustments
    op.create_table(
        'student_attendance_adjustments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_occurrence_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_occurrence_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_status', lesson_occurrence_status, nullable=False),
        sa.Column('outcome', attendance_adjustment_outcome, nullable=False),
        sa.Column('previous_status', attendance_status, nullable=False),
        sa.Column('previous_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('notice_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'target_occurrence_id', name='uq_student_attendance_adjustments_user_target'),
        sa.ForeignKeyConstraint(
            ['user_id', 'source_occurrence_id'],
            ['student_lesson_attendance.user_id', 'student_lesson_attendance.lesson_occurrence_id'],
            name='fk_student_attendance_adjustments_source',
            ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(
            ['target_occurrence_id', 'target_status'],
            ['lesson_occurrences.id', 'lesson_occurrences.status'],
            name='fk_student_attendance_adjustments_target',
            ondelete='RESTRICT'
        ),
        sa.CheckConstraint('source_occurrence_id <> target_occurrence_id', name='chk_attendance_adjustment_distinct_occurrences'),
        sa.CheckConstraint(
            "(outcome = 'invalidated' AND target_status IN ('cancelled', 'postponed')) OR (outcome IN ('transferred', 'kept_existing') AND target_status = 'held')",
            name='chk_attendance_adjustment_outcome'
        ),
        sa.CheckConstraint(
            'notice_seen_at IS NULL OR notice_seen_at >= created_at',
            name='chk_attendance_adjustment_notice_time'
        )
    )
    op.create_index('ix_student_attendance_adjustments_user_seen', 'student_attendance_adjustments', ['user_id', 'notice_seen_at'])

    # 6. Table student_topic_progress
    op.create_table(
        'student_topic_progress',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('group_topic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('group_topics.id', ondelete='RESTRICT'), primary_key=True),
        sa.Column('status', topic_progress_status, nullable=False, server_default=sa.text("'pending'::topic_progress_status")),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'))
    )
    op.create_index('ix_student_topic_progress_user_status', 'student_topic_progress', ['user_id', 'status'])
    op.create_index('ix_student_topic_progress_group_topic_id', 'student_topic_progress', ['group_topic_id'])


def downgrade() -> None:
    op.drop_table('student_topic_progress')
    op.drop_table('student_attendance_adjustments')
    op.drop_table('student_lesson_attendance')
    op.drop_table('occurrence_topics')
    op.drop_table('lesson_occurrences')

    op.execute('DROP TYPE IF EXISTS topic_progress_status')
    op.execute('DROP TYPE IF EXISTS attendance_adjustment_outcome')
    op.execute('DROP TYPE IF EXISTS attendance_status')
    op.execute('DROP TYPE IF EXISTS lesson_occurrence_status')
