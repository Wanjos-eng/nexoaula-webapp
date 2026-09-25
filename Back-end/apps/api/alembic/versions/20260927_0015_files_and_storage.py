"""Create files table, file_purpose enum, and wire avatar/teaching_plan foreign keys.

Revision ID: 0015_files_and_storage
Revises: 0014_planning_corrections
Create Date: 2026-09-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0015_files_and_storage"
down_revision = "0014_planning_corrections"
branch_labels = None
depends_on = None

file_purpose = postgresql.ENUM(
    "avatar",
    "group_cover",
    "teaching_plan_source",
    "material_content",
    name="file_purpose",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    file_purpose.create(bind, checkfirst=True)

    op.create_table(
        "files",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("purpose", file_purpose, nullable=False),
        sa.Column(
            "storage_provider",
            sa.String(40),
            nullable=False,
            server_default=sa.text("'local'"),
        ),
        sa.Column("storage_key", sa.Text(), nullable=False, unique=True),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("mime_type", sa.String(150), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("checksum_sha256", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("size_bytes > 0", name="chk_files_positive_size"),
    )

    op.create_index("ix_files_owner_id", "files", ["owner_id"])
    op.create_index("ix_files_purpose", "files", ["purpose"])

    # Wire user_profiles.avatar_file_id -> files.id
    op.create_foreign_key(
        "fk_user_profiles_avatar_file",
        "user_profiles",
        "files",
        ["avatar_file_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Replace chk_teaching_plans_manual_source with FK teaching_plans.source_file_id -> files.id
    op.drop_constraint(
        "chk_teaching_plans_manual_source", "teaching_plans", type_="check"
    )
    op.create_foreign_key(
        "fk_teaching_plans_source_file",
        "teaching_plans",
        "files",
        ["source_file_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    bind = op.get_bind()

    # Drop teaching_plans FK and restore chk_teaching_plans_manual_source
    op.drop_constraint(
        "fk_teaching_plans_source_file", "teaching_plans", type_="foreignkey"
    )
    op.create_check_constraint(
        "chk_teaching_plans_manual_source",
        "teaching_plans",
        "source_file_id IS NULL",
    )

    # Drop user_profiles avatar FK
    op.drop_constraint(
        "fk_user_profiles_avatar_file", "user_profiles", type_="foreignkey"
    )

    op.drop_index("ix_files_purpose", table_name="files")
    op.drop_index("ix_files_owner_id", table_name="files")
    op.drop_table("files")

    file_purpose.drop(bind, checkfirst=True)
