from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SqlEnum,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GroupVisibility(str, Enum):
    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


class GroupJoinPolicy(str, Enum):
    OPEN = "open"
    APPROVAL_REQUIRED = "approval_required"
    INVITE_ONLY = "invite_only"


class GroupStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    CLOSED = "closed"


class MembershipRole(str, Enum):
    OWNER = "owner"
    MODERATOR = "moderator"
    MEMBER = "member"


class MembershipStatus(str, Enum):
    ACTIVE = "active"
    LEFT = "left"
    REMOVED = "removed"


class JoinRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


GROUP_VISIBILITY = SqlEnum(
    GroupVisibility,
    name="group_visibility",
    values_callable=lambda enum: [item.value for item in enum],
)
GROUP_JOIN_POLICY = SqlEnum(
    GroupJoinPolicy,
    name="group_join_policy",
    values_callable=lambda enum: [item.value for item in enum],
)
GROUP_STATUS = SqlEnum(
    GroupStatus,
    name="group_status",
    values_callable=lambda enum: [item.value for item in enum],
)
MEMBERSHIP_ROLE = SqlEnum(
    MembershipRole,
    name="membership_role",
    values_callable=lambda enum: [item.value for item in enum],
)
MEMBERSHIP_STATUS = SqlEnum(
    MembershipStatus,
    name="membership_status",
    values_callable=lambda enum: [item.value for item in enum],
)
JOIN_REQUEST_STATUS = SqlEnum(
    JoinRequestStatus,
    name="join_request_status",
    values_callable=lambda enum: [item.value for item in enum],
)


class StudyGroup(Base):
    __tablename__ = "study_groups"
    __table_args__ = (
        ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(
            ["class_section_id", "subject_id"],
            ["class_sections.id", "class_sections.subject_id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint("id", "subject_id", name="uq_study_groups_id_subject_id"),
        CheckConstraint("capacity IS NULL OR capacity > 0", name="chk_study_groups_capacity"),
        Index("ix_study_groups_subject_id_status", "subject_id", "status"),
        Index("ix_study_groups_class_section_id", "class_section_id"),
        Index("ix_study_groups_lower_name", text("lower(name)")),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    class_section_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    rules: Mapped[str | None] = mapped_column(Text)
    visibility: Mapped[GroupVisibility] = mapped_column(
        GROUP_VISIBILITY, nullable=False, server_default=text("'public'::group_visibility")
    )
    join_policy: Mapped[GroupJoinPolicy] = mapped_column(
        GROUP_JOIN_POLICY,
        nullable=False,
        server_default=text("'approval_required'::group_join_policy"),
    )
    status: Mapped[GroupStatus] = mapped_column(
        GROUP_STATUS, nullable=False, server_default=text("'active'::group_status")
    )
    capacity: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["removed_by"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint("user_id", "group_id", name="uq_group_members_user_id_group_id"),
        CheckConstraint(
            "(status = 'active' AND ended_at IS NULL AND removed_by IS NULL) "
            "OR (status = 'left' AND ended_at IS NOT NULL AND removed_by IS NULL) "
            "OR (status = 'removed' AND ended_at IS NOT NULL AND removed_by IS NOT NULL)",
            name="chk_group_members_lifecycle",
        ),
        Index(
            "uq_group_members_active_owner",
            "group_id",
            unique=True,
            postgresql_where=text("role = 'owner' AND status = 'active'"),
        ),
        Index("ix_group_members_user_id_status", "user_id", "status"),
    )

    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    role: Mapped[MembershipRole] = mapped_column(
        MEMBERSHIP_ROLE, nullable=False, server_default=text("'member'::membership_role")
    )
    status: Mapped[MembershipStatus] = mapped_column(
        MEMBERSHIP_STATUS, nullable=False, server_default=text("'active'::membership_status")
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))


class GroupJoinRequest(Base):
    __tablename__ = "group_join_requests"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["resolved_by"], ["users.id"], ondelete="RESTRICT"),
        CheckConstraint(
            "(status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL) "
            "OR (status <> 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)",
            name="chk_join_requests_resolution",
        ),
        Index("ix_group_join_requests_group_user_status", "group_id", "user_id", "status"),
        Index("ix_group_join_requests_user_status", "user_id", "status"),
        Index(
            "uq_group_join_requests_pending",
            "group_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    status: Mapped[JoinRequestStatus] = mapped_column(
        JOIN_REQUEST_STATUS,
        nullable=False,
        server_default=text("'pending'::join_request_status"),
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_by: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_note: Mapped[str | None] = mapped_column(Text)


class GroupTopic(Base):
    __tablename__ = "group_topics"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["subject_topic_id"], ["subject_topics.id"], ondelete="RESTRICT"),
        UniqueConstraint("id", "group_id", name="uq_group_topics_id_group_id"),
        Index("ix_group_topics_group_id", "group_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    subject_topic_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    custom_title: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TeachingPlan(Base):
    __tablename__ = "teaching_plans"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint("group_id", "version", name="uq_group_teaching_plan_version"),
        UniqueConstraint("id", "group_id", name="uq_teaching_plans_id_group_id"),
        Index("ix_teaching_plans_group_id", "group_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    creator_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    source_file_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ScheduledLesson(Base):
    __tablename__ = "scheduled_lessons"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(
            ["plan_id", "group_id"],
            ["teaching_plans.id", "teaching_plans.group_id"],
            name="fk_scheduled_lessons_plan_group",
            ondelete="CASCADE",
        ),
        UniqueConstraint("id", "group_id", name="uq_scheduled_lessons_id_group_id"),
        Index("ix_scheduled_lessons_group_id_scheduled_at", "group_id", "scheduled_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    plan_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ScheduledLessonTopic(Base):
    __tablename__ = "scheduled_lesson_topics"
    __table_args__ = (
        ForeignKeyConstraint(["lesson_id"], ["scheduled_lessons.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["group_topic_id"], ["group_topics.id"], ondelete="CASCADE"),
    )

    lesson_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    group_topic_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)