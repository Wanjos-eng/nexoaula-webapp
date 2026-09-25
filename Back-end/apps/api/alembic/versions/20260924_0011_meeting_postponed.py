"""Add postponed status to meetings.

Revision ID: 0011_meeting_postponed
Revises: 0010_meetings
Create Date: 2026-09-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0011_meeting_postponed"
down_revision = "0010_meetings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE meeting_status ADD VALUE IF NOT EXISTS 'postponed'")


def downgrade() -> None:
    bind = op.get_bind()
    op.execute("UPDATE meetings SET status = 'scheduled' WHERE status = 'postponed'")
    op.alter_column("meetings", "status", server_default=None)

    old_status = postgresql.ENUM(
        "scheduled", "completed", "cancelled", name="meeting_status_v2"
    )
    old_status.create(bind, checkfirst=True)
    op.execute(
        "ALTER TABLE meetings ALTER COLUMN status TYPE meeting_status_v2 "
        "USING status::text::meeting_status_v2"
    )
    op.execute("DROP TYPE meeting_status")
    op.execute("ALTER TYPE meeting_status_v2 RENAME TO meeting_status")
    op.alter_column(
        "meetings",
        "status",
        server_default=sa.text("'scheduled'::meeting_status"),
    )
