"""Create the class section enrollment table.

Revision ID: 0003_enrollments
Revises: 0002_academic_groups
Create Date: 2026-09-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0003_enrollments"
down_revision: str | None = "0002_academic_groups"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "class_section_enrollments",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_class_section_enrollments_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["class_section_id"],
            ["class_sections.id"],
            name="fk_class_section_enrollments_class_section_id_class_sections",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "user_id", "class_section_id", name="pk_class_section_enrollments"
        ),
    )
    op.create_index(
        "ix_class_section_enrollments_class_section_id",
        "class_section_enrollments",
        ["class_section_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_class_section_enrollments_class_section_id",
        table_name="class_section_enrollments",
    )
    op.drop_table("class_section_enrollments")
