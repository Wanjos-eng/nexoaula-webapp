"""Create the minimal academic context and study-group schema.

Revision ID: 0002_academic_groups
Revises: 0001_identity
Create Date: 2026-09-10
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0002_academic_groups"
down_revision: str | None = "0001_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


group_visibility = postgresql.ENUM("public", "unlisted", "private", name="group_visibility", create_type=False)
group_join_policy = postgresql.ENUM("open", "approval_required", "invite_only", name="group_join_policy", create_type=False)
group_status = postgresql.ENUM("active", "archived", "closed", name="group_status", create_type=False)
membership_role = postgresql.ENUM("owner", "moderator", "member", name="membership_role", create_type=False)
membership_status = postgresql.ENUM("active", "left", "removed", name="membership_status", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in (group_visibility, group_join_policy, group_status, membership_role, membership_status):
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "institutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("short_name", sa.String(length=50)),
        sa.Column("timezone", sa.String(length=64), server_default=sa.text("'America/Sao_Paulo'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_institutions"),
    )
    op.create_index("ix_institutions_lower_name", "institutions", [sa.text("lower(name)")])

    op.create_table(
        "subjects",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("code", sa.String(length=40)),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], name="fk_subjects_institution_id_institutions", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_subjects"),
        sa.UniqueConstraint("id", "institution_id", name="uq_subjects_id_institution_id"),
        sa.UniqueConstraint("institution_id", "name", name="uq_subjects_institution_id_name"),
        sa.UniqueConstraint("institution_id", "code", name="uq_subjects_institution_id_code"),
    )
    op.create_index("ix_subjects_lower_name", "subjects", [sa.text("lower(name)")])

    op.create_table(
        "academic_terms",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(length=30), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.CheckConstraint("end_date >= start_date", name="chk_academic_terms_date_range"),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], name="fk_academic_terms_institution_id_institutions", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_academic_terms"),
        sa.UniqueConstraint("id", "institution_id", name="uq_academic_terms_id_institution_id"),
        sa.UniqueConstraint("institution_id", "label", name="uq_academic_terms_institution_id_label"),
    )

    op.create_table(
        "class_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_term_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["subject_id", "institution_id"], ["subjects.id", "subjects.institution_id"], name="fk_class_sections_subject_institution_subjects", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["academic_term_id", "institution_id"], ["academic_terms.id", "academic_terms.institution_id"], name="fk_class_sections_term_institution_academic_terms", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_class_sections_created_by_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_class_sections"),
        sa.UniqueConstraint("id", "institution_id", name="uq_class_sections_id_institution_id"),
        sa.UniqueConstraint("id", "subject_id", name="uq_class_sections_id_subject_id"),
        sa.UniqueConstraint("subject_id", "academic_term_id", "label", name="uq_class_sections_subject_term_label"),
    )
    op.create_index("ix_class_sections_academic_term_id", "class_sections", ["academic_term_id"])

    op.create_table(
        "study_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_section_id", postgresql.UUID(as_uuid=True)),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("visibility", group_visibility, server_default=sa.text("'public'::group_visibility"), nullable=False),
        sa.Column("join_policy", group_join_policy, server_default=sa.text("'approval_required'::group_join_policy"), nullable=False),
        sa.Column("status", group_status, server_default=sa.text("'active'::group_status"), nullable=False),
        sa.Column("capacity", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("capacity IS NULL OR capacity > 0", name="chk_study_groups_capacity"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_study_groups_created_by_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], name="fk_study_groups_subject_id_subjects", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["class_section_id", "subject_id"], ["class_sections.id", "class_sections.subject_id"], name="fk_study_groups_section_subject_class_sections", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name="pk_study_groups"),
        sa.UniqueConstraint("id", "subject_id", name="uq_study_groups_id_subject_id"),
    )
    op.create_index("ix_study_groups_subject_id_status", "study_groups", ["subject_id", "status"])
    op.create_index("ix_study_groups_class_section_id", "study_groups", ["class_section_id"])
    op.create_index("ix_study_groups_lower_name", "study_groups", [sa.text("lower(name)")])

    op.create_table(
        "group_members",
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", membership_role, server_default=sa.text("'member'::membership_role"), nullable=False),
        sa.Column("status", membership_status, server_default=sa.text("'active'::membership_status"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("removed_by", postgresql.UUID(as_uuid=True)),
        sa.CheckConstraint("(status = 'active' AND ended_at IS NULL AND removed_by IS NULL) OR (status = 'left' AND ended_at IS NOT NULL AND removed_by IS NULL) OR (status = 'removed' AND ended_at IS NOT NULL AND removed_by IS NOT NULL)", name="chk_group_members_lifecycle"),
        sa.ForeignKeyConstraint(["group_id"], ["study_groups.id"], name="fk_group_members_group_id_study_groups", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_group_members_user_id_users", ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["removed_by"], ["users.id"], name="fk_group_members_removed_by_users", ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("group_id", "user_id", name="pk_group_members"),
        sa.UniqueConstraint("user_id", "group_id", name="uq_group_members_user_id_group_id"),
    )
    op.create_index(
        "uq_group_members_active_owner",
        "group_members",
        ["group_id"],
        unique=True,
        postgresql_where=sa.text("role = 'owner' AND status = 'active'"),
    )
    op.create_index("ix_group_members_user_id_status", "group_members", ["user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_group_members_user_id_status", table_name="group_members")
    op.drop_index("uq_group_members_active_owner", table_name="group_members")
    op.drop_table("group_members")
    op.drop_index("ix_study_groups_lower_name", table_name="study_groups")
    op.drop_index("ix_study_groups_class_section_id", table_name="study_groups")
    op.drop_index("ix_study_groups_subject_id_status", table_name="study_groups")
    op.drop_table("study_groups")
    op.drop_index("ix_class_sections_academic_term_id", table_name="class_sections")
    op.drop_table("class_sections")
    op.drop_table("academic_terms")
    op.drop_index("ix_subjects_lower_name", table_name="subjects")
    op.drop_table("subjects")
    op.drop_index("ix_institutions_lower_name", table_name="institutions")
    op.drop_table("institutions")

    bind = op.get_bind()
    for enum_type in (membership_status, membership_role, group_status, group_join_policy, group_visibility):
        enum_type.drop(bind, checkfirst=True)
