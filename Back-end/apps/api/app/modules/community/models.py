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
from sqlalchemy.dialects.postgresql import JSONB
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


class LessonOccurrenceStatus(str, Enum):
    HELD = "held"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"


class AttendanceAdjustmentOutcome(str, Enum):
    TRANSFERRED = "transferred"
    INVALIDATED = "invalidated"
    KEPT_EXISTING = "kept_existing"


class TopicProgressStatus(str, Enum):
    PENDING = "pending"
    REVIEWING = "reviewing"
    MASTERED = "mastered"


class MeetingModality(str, Enum):
    IN_PERSON = "in_person"
    ONLINE = "online"
    HYBRID = "hybrid"


class MeetingStatus(str, Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class MeetingParticipantStatus(str, Enum):
    INTERESTED = "interested"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    ATTENDED = "attended"


class PlanningCorrectionKind(str, Enum):
    SCHEDULE = "schedule"
    TOPICS = "topics"
    STATUS = "status"
    DETAILS = "details"
    OTHER = "other"


class PlanningCorrectionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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
LESSON_OCCURRENCE_STATUS = SqlEnum(
    LessonOccurrenceStatus,
    name="lesson_occurrence_status",
    values_callable=lambda enum: [item.value for item in enum],
)
ATTENDANCE_STATUS = SqlEnum(
    AttendanceStatus,
    name="attendance_status",
    values_callable=lambda enum: [item.value for item in enum],
)
ATTENDANCE_ADJUSTMENT_OUTCOME = SqlEnum(
    AttendanceAdjustmentOutcome,
    name="attendance_adjustment_outcome",
    values_callable=lambda enum: [item.value for item in enum],
)
TOPIC_PROGRESS_STATUS = SqlEnum(
    TopicProgressStatus,
    name="topic_progress_status",
    values_callable=lambda enum: [item.value for item in enum],
)
MEETING_MODALITY = SqlEnum(MeetingModality, name="meeting_modality", values_callable=lambda enum: [item.value for item in enum])
MEETING_STATUS = SqlEnum(MeetingStatus, name="meeting_status", values_callable=lambda enum: [item.value for item in enum])
MEETING_PARTICIPANT_STATUS = SqlEnum(MeetingParticipantStatus, name="meeting_participant_status", values_callable=lambda enum: [item.value for item in enum])
PLANNING_CORRECTION_KIND = SqlEnum(PlanningCorrectionKind, name="planning_correction_kind", values_callable=lambda enum: [item.value for item in enum])
CORRECTION_STATUS = SqlEnum(PlanningCorrectionStatus, name="correction_status", values_callable=lambda enum: [item.value for item in enum])



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


class GroupInvitation(Base):
    __tablename__ = "group_invitations"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["invited_user_id"], ["users.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint("token_hash", name="uq_group_invitations_token_hash"),
        CheckConstraint(
            "status IN ('pending','accepted','cancelled','expired')",
            name="chk_group_invitations_status",
        ),
        CheckConstraint(
            "(status = 'pending' AND accepted_at IS NULL AND cancelled_at IS NULL) OR "
            "(status = 'accepted' AND accepted_at IS NOT NULL AND cancelled_at IS NULL) OR "
            "(status = 'cancelled' AND accepted_at IS NULL AND cancelled_at IS NOT NULL) OR "
            "(status = 'expired' AND accepted_at IS NULL AND cancelled_at IS NULL)",
            name="chk_group_invitations_lifecycle",
        ),
        CheckConstraint(
            "invited_user_id <> created_by",
            name="chk_group_invitations_distinct_users",
        ),
        Index(
            "uq_group_invitations_pending_user",
            "group_id",
            "invited_user_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
        Index("ix_group_invitations_group_status", "group_id", "status"),
        Index("ix_group_invitations_invited_status", "invited_user_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    invited_user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'pending'")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (Index("ix_topics_lower_name", func.lower(text("name"))),)
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    slug: Mapped[str] = mapped_column(String(180), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SubjectTopic(Base):
    __tablename__ = "subject_topics"
    __table_args__ = (
        ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="RESTRICT"),
        UniqueConstraint("subject_id", "topic_id"),
        UniqueConstraint("id", "subject_id"),
        CheckConstraint("display_order IS NULL OR display_order > 0", name="chk_subject_topics_display_order"),
        Index("ix_subject_topics_topic_id", "topic_id"),
    )
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    subject_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    topic_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    display_order: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GroupTopic(Base):
    __tablename__ = "group_topics"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        UniqueConstraint("id", "group_id", name="uq_group_topics_id_group_id"),
        Index("ix_group_topics_group_id", "group_id"),
        ForeignKeyConstraint(["group_id", "subject_id"], ["study_groups.id", "study_groups.subject_id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["subject_topic_id", "subject_id"], ["subject_topics.id", "subject_topics.subject_id"], ondelete="RESTRICT"),
        UniqueConstraint("group_id", "subject_topic_id"),
        CheckConstraint("(subject_topic_id IS NOT NULL AND custom_title IS NULL) OR (subject_topic_id IS NULL AND custom_title IS NOT NULL AND length(trim(custom_title)) > 0)", name="chk_group_topics_source"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    subject_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
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
        ForeignKeyConstraint(["published_by"], ["users.id"], ondelete="RESTRICT"),
        CheckConstraint("version > 0", name="chk_teaching_plans_positive_version"),
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="chk_teaching_plans_status"),
        CheckConstraint("status = 'draft' OR (published_by IS NOT NULL AND published_at IS NOT NULL)", name="chk_teaching_plans_publication_data"),
        CheckConstraint("source_file_id IS NULL", name="chk_teaching_plans_manual_source"),
        Index("uq_teaching_plans_current_published", "group_id", unique=True, postgresql_where=text("status = 'published'")),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    creator_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'draft'"))
    published_by: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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
        ForeignKeyConstraint(["lesson_id", "group_id"], ["scheduled_lessons.id", "scheduled_lessons.group_id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["group_topic_id", "group_id"], ["group_topics.id", "group_topics.group_id"], ondelete="CASCADE"),
    )

    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    lesson_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    group_topic_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)


class LessonOccurrence(Base):
    __tablename__ = "lesson_occurrences"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(
            ["scheduled_lesson_id", "group_id"],
            ["scheduled_lessons.id", "scheduled_lessons.group_id"],
            name="fk_lesson_occurrences_scheduled_lesson",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["supersedes_occurrence_id", "group_id"],
            ["lesson_occurrences.id", "lesson_occurrences.group_id"],
            name="fk_lesson_occurrences_supersedes",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["group_id", "recorded_by"],
            ["group_members.group_id", "group_members.user_id"],
            name="fk_lesson_occurrences_recorded_by",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("id", "group_id", name="uq_lesson_occurrences_id_group_id"),
        UniqueConstraint("id", "status", name="uq_lesson_occurrences_id_status"),
        CheckConstraint(
            "actual_ended_at IS NULL OR (actual_started_at IS NOT NULL AND actual_ended_at > actual_started_at)",
            name="chk_lesson_occurrences_time_range",
        ),
        CheckConstraint(
            "(status = 'held' AND actual_started_at IS NOT NULL AND actual_ended_at IS NOT NULL AND actual_ended_at <= created_at AND rescheduled_to IS NULL) OR (status = 'cancelled' AND actual_started_at IS NULL AND actual_ended_at IS NULL AND rescheduled_to IS NULL) OR (status = 'postponed' AND actual_started_at IS NULL AND actual_ended_at IS NULL AND rescheduled_to IS NOT NULL)",
            name="chk_lesson_occurrences_status_fields",
        ),
        CheckConstraint(
            "supersedes_occurrence_id IS NULL OR supersedes_occurrence_id <> id",
            name="chk_lesson_occurrences_not_self_superseding",
        ),
        Index("ix_lesson_occurrences_group_id_created_at", "group_id", "created_at"),
        Index("ix_lesson_occurrences_scheduled_lesson_id_created_at", "scheduled_lesson_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    scheduled_lesson_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    supersedes_occurrence_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True), unique=True)
    status: Mapped[LessonOccurrenceStatus] = mapped_column(LESSON_OCCURRENCE_STATUS, nullable=False)
    actual_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rescheduled_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class OccurrenceTopic(Base):
    __tablename__ = "occurrence_topics"
    __table_args__ = (
        ForeignKeyConstraint(["lesson_occurrence_id"], ["lesson_occurrences.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["group_topic_id"], ["group_topics.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["subject_topic_id"], ["subject_topics.id"], ondelete="RESTRICT"),
        Index("ix_occurrence_topics_group_topic_id", "group_topic_id"),
    )

    lesson_occurrence_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    group_topic_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    subject_topic_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))


class StudentLessonAttendance(Base):
    __tablename__ = "student_lesson_attendance"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(
            ["lesson_occurrence_id", "occurrence_status"],
            ["lesson_occurrences.id", "lesson_occurrences.status"],
            name="fk_student_lesson_attendance_occurrence",
            ondelete="RESTRICT",
        ),
        CheckConstraint("occurrence_status = 'held'", name="chk_attendance_held_only"),
        Index("ix_student_lesson_attendance_lesson_occurrence_id", "lesson_occurrence_id"),
    )

    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    lesson_occurrence_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    occurrence_status: Mapped[LessonOccurrenceStatus] = mapped_column(
        LESSON_OCCURRENCE_STATUS, nullable=False, server_default=text("'held'::lesson_occurrence_status")
    )
    status: Mapped[AttendanceStatus] = mapped_column(ATTENDANCE_STATUS, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class StudentAttendanceAdjustment(Base):
    __tablename__ = "student_attendance_adjustments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "source_occurrence_id"],
            ["student_lesson_attendance.user_id", "student_lesson_attendance.lesson_occurrence_id"],
            name="fk_student_attendance_adjustments_source",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["target_occurrence_id", "target_status"],
            ["lesson_occurrences.id", "lesson_occurrences.status"],
            name="fk_student_attendance_adjustments_target",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("user_id", "target_occurrence_id", name="uq_student_attendance_adjustments_user_target"),
        CheckConstraint("source_occurrence_id <> target_occurrence_id", name="chk_attendance_adjustment_distinct_occurrences"),
        CheckConstraint(
            "(outcome = 'invalidated' AND target_status IN ('cancelled', 'postponed')) OR (outcome IN ('transferred', 'kept_existing') AND target_status = 'held')",
            name="chk_attendance_adjustment_outcome",
        ),
        CheckConstraint("notice_seen_at IS NULL OR notice_seen_at >= created_at", name="chk_attendance_adjustment_notice_time"),
        Index("ix_student_attendance_adjustments_user_seen", "user_id", "notice_seen_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    source_occurrence_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    target_occurrence_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    target_status: Mapped[LessonOccurrenceStatus] = mapped_column(LESSON_OCCURRENCE_STATUS, nullable=False)
    outcome: Mapped[AttendanceAdjustmentOutcome] = mapped_column(ATTENDANCE_ADJUSTMENT_OUTCOME, nullable=False)
    previous_status: Mapped[AttendanceStatus] = mapped_column(ATTENDANCE_STATUS, nullable=False)
    previous_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    notice_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StudentTopicProgress(Base):
    __tablename__ = "student_topic_progress"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["group_topic_id"], ["group_topics.id"], ondelete="RESTRICT"),
        Index("ix_student_topic_progress_user_status", "user_id", "status"),
        Index("ix_student_topic_progress_group_topic_id", "group_topic_id"),
    )

    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    group_topic_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    status: Mapped[TopicProgressStatus] = mapped_column(
        TOPIC_PROGRESS_STATUS, nullable=False, server_default=text("'pending'::topic_progress_status")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )



# --- TASK #120: Canais por assunto (sem channel_messages nesta entrega) ---


class ChannelStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


CHANNEL_STATUS = SqlEnum(
    ChannelStatus,
    name="channel_status",
    values_callable=lambda enum: [item.value for item in enum],
)


class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["group_topic_id", "group_id"], ["group_topics.id", "group_topics.group_id"], name="fk_channels_topic_group", ondelete="RESTRICT"),
        ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint("group_id", "name", name="uq_channels_group_name"),
        UniqueConstraint("id", "group_id", name="uq_channels_id_group_id"),
        CheckConstraint(
            "(status = 'active' AND archived_at IS NULL) OR "
            "(status = 'archived' AND archived_at IS NOT NULL)",
            name="chk_channels_archive_state",
        ),
        Index("ix_channels_group_id", "group_id"),
        Index("ix_channels_group_topic_id", "group_topic_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    group_topic_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    status: Mapped[ChannelStatus] = mapped_column(
        CHANNEL_STATUS, nullable=False, server_default=text("'active'::channel_status")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChannelMessage(Base):
    __tablename__ = "channel_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["channel_id"],
            ["channels.id"],
            name="fk_channel_messages_channel",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name="fk_channel_messages_author",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["reply_to_message_id"],
            ["channel_messages.id"],
            name="fk_channel_messages_reply_target",
            ondelete="SET NULL",
        ),
        ForeignKeyConstraint(
            ["reply_to_message_id", "channel_id"],
            ["channel_messages.id", "channel_messages.channel_id"],
            name="fk_channel_messages_reply_same_channel",
            ondelete="NO ACTION",
        ),
        UniqueConstraint(
            "id", "channel_id", name="uq_channel_messages_id_channel_id"
        ),
        CheckConstraint(
            "reply_to_message_id IS NULL OR reply_to_message_id <> id",
            name="chk_channel_messages_not_self_reply",
        ),
        Index(
            "ix_channel_messages_channel_created_at", "channel_id", "created_at"
        ),
        Index(
            "ix_channel_messages_author_created_at", "author_id", "created_at"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    channel_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    author_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    reply_to_message_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["organizer_id"], ["users.id"], ondelete="RESTRICT"),
        CheckConstraint("ends_at IS NULL OR ends_at > starts_at", name="chk_meetings_time_range"),
        CheckConstraint(
            "(modality = 'in_person' AND location IS NOT NULL) OR "
            "(modality = 'online' AND external_url IS NOT NULL) OR "
            "(modality = 'hybrid' AND location IS NOT NULL AND external_url IS NOT NULL)",
            name="chk_meetings_modality_fields",
        ),
        Index("ix_meetings_group_id_starts_at", "group_id", "starts_at"),
        Index("ix_meetings_status_starts_at", "status", "starts_at"),
    )
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    # Optional identifier with deliberately no FK to channels (issue #120).
    channel_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    organizer_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    modality: Mapped[MeetingModality] = mapped_column(MEETING_MODALITY, nullable=False)
    location: Mapped[str | None] = mapped_column(String(250))
    external_url: Mapped[str | None] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[MeetingStatus] = mapped_column(MEETING_STATUS, nullable=False, server_default=text("'scheduled'::meeting_status"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"
    __table_args__ = (
        ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint("user_id", "meeting_id", name="uq_meeting_participants_user_id_meeting_id"),
        Index("ix_meeting_participants_user_id_status", "user_id", "status"),
    )
    meeting_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    status: Mapped[MeetingParticipantStatus] = mapped_column(MEETING_PARTICIPANT_STATUS, nullable=False, server_default=text("'interested'::meeting_participant_status"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MeetingTopic(Base):
    __tablename__ = "meeting_topics"
    __table_args__ = (
        ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        ForeignKeyConstraint(["subject_topic_id"], ["subject_topics.id"], ondelete="RESTRICT"),
        Index("ix_meeting_topics_subject_topic_id", "subject_topic_id"),
    )
    meeting_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    subject_topic_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)


class PlanningCorrection(Base):
    __tablename__ = "planning_corrections"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["study_groups.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(
            ["group_id", "suggested_by"],
            ["group_members.group_id", "group_members.user_id"],
            name="fk_planning_corrections_author_membership",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["scheduled_lesson_id", "group_id"],
            ["scheduled_lessons.id", "scheduled_lessons.group_id"],
            name="fk_planning_corrections_scheduled_lesson_group",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["lesson_occurrence_id", "group_id"],
            ["lesson_occurrences.id", "lesson_occurrences.group_id"],
            name="fk_planning_corrections_occurrence_group",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(["decided_by"], ["users.id"], ondelete="RESTRICT"),
        CheckConstraint(
            "(scheduled_lesson_id IS NOT NULL AND lesson_occurrence_id IS NULL) OR "
            "(scheduled_lesson_id IS NULL AND lesson_occurrence_id IS NOT NULL)",
            name="chk_planning_corrections_single_target",
        ),
        CheckConstraint(
            "jsonb_typeof(original_snapshot) = 'object'",
            name="chk_planning_corrections_snapshot_object",
        ),
        CheckConstraint(
            "jsonb_typeof(proposed_patch) = 'object'",
            name="chk_planning_corrections_patch_object",
        ),
        CheckConstraint(
            "(status = 'pending' AND decided_by IS NULL AND decided_at IS NULL) OR "
            "(status IN ('approved', 'rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)",
            name="chk_planning_corrections_decision",
        ),
        Index("ix_planning_corrections_status_created_at", "status", "created_at"),
        Index("ix_planning_corrections_suggested_by", "suggested_by"),
        Index("ix_planning_corrections_group_id", "group_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    group_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    suggested_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    scheduled_lesson_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    lesson_occurrence_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    kind: Mapped[PlanningCorrectionKind] = mapped_column(PLANNING_CORRECTION_KIND, nullable=False)
    original_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    proposed_patch: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PlanningCorrectionStatus] = mapped_column(
        CORRECTION_STATUS, nullable=False, server_default=text("'pending'::correction_status")
    )
    decided_by: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    @property
    def diff(self) -> dict[str, dict[str, object]]:
        return {
            field: {"before": self.original_snapshot.get(field), "after": value}
            for field, value in self.proposed_patch.items()
            if self.original_snapshot.get(field) != value
        }

