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
    # 1. Tabela group_topics
    op.create_table(
        'group_topics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('study_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subject_topic_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('custom_title', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('id', 'group_id', name='uq_group_topics_id_group_id')
    )
    op.create_index('ix_group_topics_group_id', 'group_topics', ['group_id'])

    # 2. Tabela teaching_plans
    op.create_table(
        'teaching_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('study_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('creator_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('source_file_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('group_id', 'version', name='uq_group_teaching_plan_version'),
        sa.UniqueConstraint('id', 'group_id', name='uq_teaching_plans_id_group_id')
    )
    op.create_index('ix_teaching_plans_group_id', 'teaching_plans', ['group_id'])

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
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scheduled_lessons.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('group_topic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('group_topics.id', ondelete='CASCADE'), primary_key=True)
    )


def downgrade() -> None:
    op.drop_table('scheduled_lesson_topics')
    op.drop_table('scheduled_lessons')
    op.drop_table('teaching_plans')
    op.drop_table('group_topics')