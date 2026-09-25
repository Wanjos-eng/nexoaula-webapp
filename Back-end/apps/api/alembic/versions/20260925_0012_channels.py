"""create channels table

Revision ID: 0012_channels
Revises: 0011_meeting_postponed
Create Date: 2026-09-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0012_channels'
down_revision = '0011_meeting_postponed'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE channel_status AS ENUM ('active', 'archived');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """)

    channel_status = postgresql.ENUM('active', 'archived', name='channel_status', create_type=False)

    op.create_table(
        'channels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('group_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('study_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('group_topic_id', postgresql.UUID(as_uuid=True),
                  nullable=True),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', channel_status, nullable=False,
                  server_default=sa.text("'active'::channel_status")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['group_topic_id', 'group_id'], ['group_topics.id', 'group_topics.group_id'], name='fk_channels_topic_group', ondelete='RESTRICT'),
        sa.UniqueConstraint('group_id', 'name', name='uq_channels_group_name'),
        sa.UniqueConstraint('id', 'group_id', name='uq_channels_id_group_id'),
        sa.CheckConstraint(
            "(status = 'active' AND archived_at IS NULL) OR "
            "(status = 'archived' AND archived_at IS NOT NULL)",
            name='chk_channels_archive_state',
        ),
    )
    op.create_index('ix_channels_group_id', 'channels', ['group_id'])
    op.create_index('ix_channels_group_topic_id', 'channels', ['group_topic_id'])


def downgrade() -> None:
    op.drop_table('channels')
    op.execute('DROP TYPE IF EXISTS channel_status')
