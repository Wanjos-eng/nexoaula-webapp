"""Reconcile the academic catalog with the approved group-oriented model.

Keep the shared 0003 revision intact. Refuse to discard any enrollment data.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_academic_context"
down_revision = "0003_enrollments"
branch_labels = None
depends_on = None


def upgrade():
    # This feature has not shipped. An unexpectedly populated shared database
    # requires an explicit data-retention decision, not automatic deletion.
    bind = op.get_bind()
    if not op.get_context().as_sql:
        if bind.scalar(
            sa.text("SELECT EXISTS (SELECT 1 FROM class_section_enrollments)")
        ):
            raise RuntimeError(
                "Existing enrollments require a reviewed retention plan before migration 0004."
            )
        if bind.scalar(
            sa.text(
                "SELECT EXISTS (SELECT 1 FROM user_profiles p WHERE "
                "p.course_id IS NOT NULL OR (p.institution_id IS NOT NULL AND NOT EXISTS "
                "(SELECT 1 FROM institutions i WHERE i.id=p.institution_id)))"
            )
        ):
            raise RuntimeError(
                "Existing academic profile references require reconciliation before migration 0004."
            )
    op.create_table(
        "courses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("code", sa.String(40)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_courses"),
        sa.ForeignKeyConstraint(
            ["institution_id"],
            ["institutions.id"],
            ondelete="RESTRICT",
            name="fk_courses_institution_id_institutions",
        ),
        sa.UniqueConstraint(
            "id", "institution_id", name="uq_courses_id_institution_id"
        ),
        sa.UniqueConstraint(
            "institution_id", "name", name="uq_courses_institution_id_name"
        ),
        sa.UniqueConstraint(
            "institution_id", "code", name="uq_courses_institution_id_code"
        ),
    )
    op.create_foreign_key(
        "fk_user_profiles_institution",
        "user_profiles",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_user_profiles_course_institution",
        "user_profiles",
        "courses",
        ["course_id", "institution_id"],
        ["id", "institution_id"],
        ondelete="RESTRICT",
    )
    op.drop_index(
        "ix_class_section_enrollments_class_section_id",
        table_name="class_section_enrollments",
    )
    op.drop_table("class_section_enrollments")


def downgrade():
    op.create_table(
        "class_section_enrollments",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("class_section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint(
            "user_id", "class_section_id", name="pk_class_section_enrollments"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_class_section_enrollments_user_id_users",
        ),
        sa.ForeignKeyConstraint(
            ["class_section_id"],
            ["class_sections.id"],
            ondelete="RESTRICT",
            name="fk_class_section_enrollments_class_section_id_class_sections",
        ),
    )
    op.create_index(
        "ix_class_section_enrollments_class_section_id",
        "class_section_enrollments",
        ["class_section_id"],
    )
    op.drop_constraint(
        "fk_user_profiles_course_institution", "user_profiles", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_user_profiles_institution", "user_profiles", type_="foreignkey"
    )
    op.drop_table("courses")
