"""simulated marketplace

Revision ID: 0007_marketplace_simulation
Revises: 0006_group_join_requests
Create Date: 2026-09-14 08:48:13.741452

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007_marketplace_simulation'
down_revision: Union[str, Sequence[str], None] = '0006_group_join_requests'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('tutor_profiles',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('headline', sa.String(length=200), nullable=True),
    sa.Column('bio', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("status IN ('active', 'paused', 'suspended')", name='chk_tutor_profiles_status'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_tutor_profiles_user_id_users'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('user_id', name=op.f('pk_tutor_profiles'))
    )
    op.create_table('tutor_subjects',
    sa.Column('tutor_user_id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], name=op.f('fk_tutor_subjects_subject_id_subjects'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['tutor_user_id'], ['tutor_profiles.user_id'], name=op.f('fk_tutor_subjects_tutor_user_id_tutor_profiles'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('tutor_user_id', 'subject_id', name=op.f('pk_tutor_subjects'))
    )
    op.create_index('ix_tutor_subjects_subject_id', 'tutor_subjects', ['subject_id'], unique=False)
    op.create_table('tutor_sessions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('tutor_user_id', sa.UUID(), nullable=False),
    sa.Column('subject_id', sa.UUID(), nullable=False),
    sa.Column('class_section_id', sa.UUID(), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('modality', sa.String(length=20), nullable=False),
    sa.Column('location', sa.String(length=250), nullable=True),
    sa.Column('external_url', sa.Text(), nullable=True),
    sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('capacity', sa.Integer(), nullable=False),
    sa.Column('price_cents', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=3), server_default='BRL', nullable=False),
    sa.Column('simulated', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(modality = 'in_person' AND NULLIF(btrim(location), '') IS NOT NULL) OR (modality = 'online' AND NULLIF(btrim(external_url), '') IS NOT NULL) OR (modality = 'hybrid' AND NULLIF(btrim(location), '') IS NOT NULL AND NULLIF(btrim(external_url), '') IS NOT NULL)", name='chk_tutor_sessions_modality_fields'),
    sa.CheckConstraint("currency = 'BRL'", name='chk_tutor_sessions_currency'),
    sa.CheckConstraint("modality IN ('online', 'in_person', 'hybrid')", name='chk_tutor_sessions_modality'),
    sa.CheckConstraint("status IN ('draft', 'scheduled', 'completed', 'cancelled')", name='chk_tutor_sessions_status'),
    sa.CheckConstraint('capacity > 0', name='chk_tutor_sessions_capacity'),
    sa.CheckConstraint('ends_at > starts_at', name='chk_tutor_sessions_time_range'),
    sa.CheckConstraint('length(btrim(title)) > 0', name='chk_tutor_sessions_title'),
    sa.CheckConstraint('price_cents >= 0', name='chk_tutor_sessions_price'),
    sa.CheckConstraint('simulated', name='chk_tutor_sessions_simulated'),
    sa.ForeignKeyConstraint(['class_section_id', 'subject_id'], ['class_sections.id', 'class_sections.subject_id'], name=op.f('fk_tutor_sessions_class_section_id_subject_id_class_sections'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['tutor_user_id', 'subject_id'], ['tutor_subjects.tutor_user_id', 'tutor_subjects.subject_id'], name=op.f('fk_tutor_sessions_tutor_user_id_subject_id_tutor_subjects'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tutor_sessions'))
    )
    op.create_index('ix_tutor_sessions_class_section_id', 'tutor_sessions', ['class_section_id'], unique=False)
    op.create_index('ix_tutor_sessions_subject_status_start', 'tutor_sessions', ['subject_id', 'status', 'starts_at'], unique=False)
    op.create_index('ix_tutor_sessions_tutor_start', 'tutor_sessions', ['tutor_user_id', 'starts_at'], unique=False)
    op.create_table('session_bookings',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='confirmed', nullable=False),
    sa.Column('booked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("(status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status = 'confirmed' AND cancelled_at IS NULL)", name='chk_session_bookings_cancellation'),
    sa.CheckConstraint("status IN ('confirmed', 'cancelled')", name='chk_session_bookings_status'),
    sa.CheckConstraint('cancelled_at IS NULL OR cancelled_at >= booked_at', name='chk_session_bookings_cancellation_time'),
    sa.ForeignKeyConstraint(['session_id'], ['tutor_sessions.id'], name=op.f('fk_session_bookings_session_id_tutor_sessions'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_session_bookings_user_id_users'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_session_bookings')),
    sa.UniqueConstraint('id', 'user_id', name='uq_session_bookings_id_user_id')
    )
    op.create_index('ix_session_bookings_session_status', 'session_bookings', ['session_id', 'status'], unique=False)
    op.create_index('ix_session_bookings_user_status', 'session_bookings', ['user_id', 'status'], unique=False)
    op.create_index('uq_session_bookings_non_cancelled', 'session_bookings', ['session_id', 'user_id'], unique=True, postgresql_where=sa.text("status <> 'cancelled'"))
    op.create_table('transactions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('buyer_id', sa.UUID(), nullable=False),
    sa.Column('session_booking_id', sa.UUID(), nullable=False),
    sa.Column('amount_cents', sa.Integer(), nullable=False),
    sa.Column('commission_cents', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=3), server_default='BRL', nullable=False),
    sa.Column('status', sa.String(length=20), server_default='completed', nullable=False),
    sa.Column('simulated', sa.Boolean(), server_default=sa.text('true'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("currency = 'BRL'", name='chk_transactions_currency'),
    sa.CheckConstraint("status = 'completed'", name='chk_transactions_status'),
    sa.CheckConstraint('amount_cents >= 0', name='chk_transactions_amount'),
    sa.CheckConstraint('commission_cents = round(amount_cents::numeric * 0.15)', name='chk_transactions_commission'),
    sa.CheckConstraint('simulated', name='chk_transactions_simulated'),
    sa.ForeignKeyConstraint(['session_booking_id', 'buyer_id'], ['session_bookings.id', 'session_bookings.user_id'], name=op.f('fk_transactions_session_booking_id_buyer_id_session_bookings'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_transactions')),
    sa.UniqueConstraint('session_booking_id', name='uq_transactions_booking')
    )
    op.create_index('ix_transactions_buyer_created', 'transactions', ['buyer_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_transactions_buyer_created', table_name='transactions')
    op.drop_table('transactions')
    op.drop_index('uq_session_bookings_non_cancelled', table_name='session_bookings', postgresql_where=sa.text("status <> 'cancelled'"))
    op.drop_index('ix_session_bookings_user_status', table_name='session_bookings')
    op.drop_index('ix_session_bookings_session_status', table_name='session_bookings')
    op.drop_table('session_bookings')
    op.drop_index('ix_tutor_sessions_tutor_start', table_name='tutor_sessions')
    op.drop_index('ix_tutor_sessions_subject_status_start', table_name='tutor_sessions')
    op.drop_index('ix_tutor_sessions_class_section_id', table_name='tutor_sessions')
    op.drop_table('tutor_sessions')
    op.drop_index('ix_tutor_subjects_subject_id', table_name='tutor_subjects')
    op.drop_table('tutor_subjects')
    op.drop_table('tutor_profiles')
