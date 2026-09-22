"""persist teaching plans and lessons

Revision ID: 0008_teaching_plans_and_lessons
Revises: 0007_marketplace_simulation
Create Date: 2026-09-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0008_teaching_plans_and_lessons'
down_revision = '0007_marketplace_simulation'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('topics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('slug', sa.String(180), nullable=False, unique=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')))
    op.create_index('ix_topics_lower_name', 'topics', [sa.text('lower(name)')])
    op.create_table('subject_topics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subjects.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('topic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('topics.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('display_order', sa.Integer()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('subject_id', 'topic_id'),
        sa.UniqueConstraint('id', 'subject_id'),
        sa.CheckConstraint('display_order IS NULL OR display_order > 0', name='chk_subject_topics_display_order'))
    op.create_index('ix_subject_topics_topic_id', 'subject_topics', ['topic_id'])
    # 1. Tabela group_topics
    op.create_table(
        'group_topics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('study_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('subject_topic_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('custom_title', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('id', 'group_id', name='uq_group_topics_id_group_id'),
        sa.ForeignKeyConstraint(['group_id', 'subject_id'], ['study_groups.id', 'study_groups.subject_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_topic_id', 'subject_id'], ['subject_topics.id', 'subject_topics.subject_id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('group_id', 'subject_topic_id'),
        sa.CheckConstraint("(subject_topic_id IS NOT NULL AND custom_title IS NULL) OR (subject_topic_id IS NULL AND custom_title IS NOT NULL AND length(trim(custom_title)) > 0)", name='chk_group_topics_source')
    )
    op.create_index('ix_group_topics_group_id', 'group_topics', ['group_id'])

    # 2. Tabela teaching_plans
    op.create_table(
        'teaching_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('study_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('creator_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column('published_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT')),
        sa.Column('published_at', sa.DateTime(timezone=True)),
        sa.CheckConstraint('version > 0', name='chk_teaching_plans_positive_version'),
        sa.CheckConstraint("status IN ('draft', 'published', 'archived')", name='chk_teaching_plans_status'),
        sa.CheckConstraint("status = 'draft' OR (published_by IS NOT NULL AND published_at IS NOT NULL)", name='chk_teaching_plans_publication_data'),
        sa.CheckConstraint('source_file_id IS NULL', name='chk_teaching_plans_manual_source'),
        sa.Column('source_file_id' , postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('group_id', 'version', name='uq_group_teaching_plan_version'),
        sa.UniqueConstraint('id', 'group_id', name='uq_teaching_plans_id_group_id')
    )
    op.create_index('ix_teaching_plans_group_id', 'teaching_plans', ['group_id'])

    op.create_index('uq_teaching_plans_current_published', 'teaching_plans', ['group_id'], unique=True, postgresql_where=sa.text("status = 'published'"))

    # 3. Tabela scheduled_lessons com FK Composta impedindo plano/aula de grupos diferentes
    op.create_table(
        'scheduled_lessons',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('study_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(
            ['plan_id', 'group_id'],
            ['teaching_plans.id', 'teaching_plans.group_id'],
            name='fk_scheduled_lessons_plan_group',
            ondelete='CASCADE'
        ),
        sa.UniqueConstraint('id', 'group_id', name='uq_scheduled_lessons_id_group_id')
    )
    op.create_index('ix_scheduled_lessons_group_id_scheduled_at', 'scheduled_lessons', ['group_id', 'scheduled_at'])

    # 4. Tabela pivot scheduled_lesson_topics
    op.create_table(
        'scheduled_lesson_topics',
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group_topic_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id', 'group_id'], ['scheduled_lessons.id', 'scheduled_lessons.group_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_topic_id', 'group_id'], ['group_topics.id', 'group_topics.group_id'], ondelete='CASCADE')
    )


def downgrade() -> None:
    op.drop_table('scheduled_lesson_topics')
    op.drop_table('scheduled_lessons')
    op.drop_table('teaching_plans')
    op.drop_table('group_topics')
    op.drop_table('subject_topics')
    op.drop_table('topics')
