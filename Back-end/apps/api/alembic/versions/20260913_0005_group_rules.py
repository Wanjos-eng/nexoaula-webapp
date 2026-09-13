"""Persist the optional rules configured for study groups.

Revision ID: 0005_group_rules
Revises: 0004_academic_context
Create Date: 2026-09-13
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_group_rules"
down_revision = "0004_academic_context"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("study_groups", sa.Column("rules", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("study_groups", "rules")
