from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Institution(Base):
    __tablename__ = "institutions"
    __table_args__ = (Index("ix_institutions_lower_name", text("lower(name)")),)

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    short_name: Mapped[str | None] = mapped_column(String(50))
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default=text("'America/Sao_Paulo'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (
        ForeignKeyConstraint(
            ["institution_id"], ["institutions.id"], ondelete="RESTRICT"
        ),
        UniqueConstraint("id", "institution_id", name="uq_subjects_id_institution_id"),
        UniqueConstraint(
            "institution_id", "name", name="uq_subjects_institution_id_name"
        ),
        UniqueConstraint(
            "institution_id", "code", name="uq_subjects_institution_id_code"
        ),
        Index("ix_subjects_lower_name", text("lower(name)")),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    institution_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(40))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AcademicTerm(Base):
    __tablename__ = "academic_terms"
    __table_args__ = (
        ForeignKeyConstraint(
            ["institution_id"], ["institutions.id"], ondelete="RESTRICT"
        ),
        UniqueConstraint(
            "id", "institution_id", name="uq_academic_terms_id_institution_id"
        ),
        UniqueConstraint(
            "institution_id", "label", name="uq_academic_terms_institution_id_label"
        ),
        CheckConstraint("end_date >= start_date", name="chk_academic_terms_date_range"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    institution_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    label: Mapped[str] = mapped_column(String(30), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)


class ClassSection(Base):
    __tablename__ = "class_sections"
    __table_args__ = (
        ForeignKeyConstraint(
            ["subject_id", "institution_id"],
            ["subjects.id", "subjects.institution_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["academic_term_id", "institution_id"],
            ["academic_terms.id", "academic_terms.institution_id"],
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint(
            "id", "institution_id", name="uq_class_sections_id_institution_id"
        ),
        UniqueConstraint("id", "subject_id", name="uq_class_sections_id_subject_id"),
        UniqueConstraint(
            "subject_id",
            "academic_term_id",
            "label",
            name="uq_class_sections_subject_term_label",
        ),
        Index("ix_class_sections_academic_term_id", "academic_term_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    institution_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    subject_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    academic_term_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    created_by: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        ForeignKeyConstraint(
            ["institution_id"], ["institutions.id"], ondelete="RESTRICT"
        ),
        UniqueConstraint("id", "institution_id", name="uq_courses_id_institution_id"),
        UniqueConstraint(
            "institution_id", "name", name="uq_courses_institution_id_name"
        ),
        UniqueConstraint(
            "institution_id", "code", name="uq_courses_institution_id_code"
        ),
    )
    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    institution_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Teacher(Base):
    __tablename__ = "teachers"
    __table_args__ = (
        ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        UniqueConstraint("id", "institution_id", name="uq_teachers_id_institution"),
        UniqueConstraint("institution_id", "user_id", name="uq_teachers_institution_user"),
        UniqueConstraint("institution_id", "external_code", name="uq_teachers_institution_code"),
        Index("ix_teachers_lower_name", text("lower(full_name)")),
    )
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    institution_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    external_code: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClassSectionTeacher(Base):
    __tablename__ = "class_section_teachers"
    __table_args__ = (
        ForeignKeyConstraint(["class_section_id", "institution_id"], ["class_sections.id", "class_sections.institution_id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["teacher_id", "institution_id"], ["teachers.id", "teachers.institution_id"], ondelete="RESTRICT"),
        UniqueConstraint("class_section_id", "teacher_id", "starts_on", name="uq_section_teacher_start"),
        CheckConstraint("ends_on IS NULL OR ends_on >= starts_on", name="chk_section_teachers_date_range"),
        Index("ix_class_section_teachers_teacher_id", "teacher_id"),
    )
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    class_section_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    teacher_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    institution_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    role: Mapped[str] = mapped_column(Enum("lead", "assistant", "substitute", name="section_teacher_role"), server_default="lead")
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
