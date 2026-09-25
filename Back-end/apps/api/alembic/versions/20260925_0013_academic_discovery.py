"""Persist teacher references for academic discovery.

Revision ID: 0013_academic_discovery
Revises: 0012_channels
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0013_academic_discovery"
down_revision = "0012_channels"
branch_labels = None
depends_on = None


def upgrade():
    role = postgresql.ENUM("lead", "assistant", "substitute", name="section_teacher_role", create_type=False)
    role.create(op.get_bind())
    op.create_table(
        "teachers",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("institution_id", sa.UUID(), sa.ForeignKey("institutions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("external_code", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("id", "institution_id", name="uq_teachers_id_institution"),
        sa.UniqueConstraint("institution_id", "user_id", name="uq_teachers_institution_user"),
        sa.UniqueConstraint("institution_id", "external_code", name="uq_teachers_institution_code"),
    )
    op.create_index("ix_teachers_lower_name", "teachers", [sa.text("lower(full_name)")])
    op.create_table(
        "class_section_teachers",
        sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("class_section_id", sa.UUID(), nullable=False),
        sa.Column("teacher_id", sa.UUID(), nullable=False),
        sa.Column("institution_id", sa.UUID(), nullable=False),
        sa.Column("role", role, nullable=False, server_default="lead"),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["class_section_id", "institution_id"], ["class_sections.id", "class_sections.institution_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["teacher_id", "institution_id"], ["teachers.id", "teachers.institution_id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("class_section_id", "teacher_id", "starts_on", name="uq_section_teacher_start"),
        sa.CheckConstraint("ends_on IS NULL OR ends_on >= starts_on", name="chk_section_teachers_date_range"),
    )
    op.create_index("ix_class_section_teachers_teacher_id", "class_section_teachers", ["teacher_id"])


def downgrade():
    op.drop_table("class_section_teachers")
    op.drop_table("teachers")
    op.execute("DROP TYPE section_teacher_role")
