from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator


class GroupVisibility(str, Enum):
    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


class JoinPolicy(str, Enum):
    OPEN = "open"
    APPROVAL_REQUIRED = "approval_required"
    INVITE_ONLY = "invite_only"


class GroupStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    CLOSED = "closed"


class MembershipActionType(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REMOVE = "remove"


class MembershipResultStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    REJECTED = "rejected"
    REMOVED = "removed"


class GroupCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str = Field(min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    rules: str | None = Field(default=None, max_length=2000)
    visibility: GroupVisibility = Field(default=GroupVisibility.PUBLIC)
    join_policy: JoinPolicy = Field(default=JoinPolicy.OPEN, alias="joinPolicy")
    discipline_id: UUID = Field(alias="disciplineId")
    offering_id: UUID | None = Field(default=None, alias="offeringId")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("O nome deve ter pelo menos 3 caracteres.")
        if len(normalized) > 100:
            raise ValueError("O nome deve ter no máximo 100 caracteres.")
        return normalized

    @field_validator("description", "rules")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GroupUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    rules: str | None = Field(default=None, max_length=2000)
    visibility: GroupVisibility | None = None
    join_policy: JoinPolicy | None = Field(default=None, alias="joinPolicy")
    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "GroupUpdate":
        for field in ("name", "visibility", "join_policy"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} não aceita valor nulo.")
        return self

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("O nome deve ter pelo menos 3 caracteres.")
        if len(normalized) > 100:
            raise ValueError("O nome deve ter no máximo 100 caracteres.")
        return normalized

    @field_validator("description", "rules")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GroupResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    rules: str | None = None
    visibility: GroupVisibility
    join_policy: JoinPolicy = Field(serialization_alias="joinPolicy")
    status: GroupStatus
    discipline_id: UUID = Field(serialization_alias="disciplineId")
    offering_id: UUID | None = Field(default=None, serialization_alias="offeringId")
    owner_id: UUID = Field(serialization_alias="ownerId")
    capacity: int | None = None
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")


class GroupDiscoveryResponse(GroupResponse):
    subject_name: str = Field(serialization_alias="subjectName")
    subject_code: str | None = Field(default=None, serialization_alias="subjectCode")
    period: str | None = None


class MembershipAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: MembershipActionType
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class MembershipResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    group_id: UUID = Field(serialization_alias="groupId")
    user_id: UUID = Field(serialization_alias="userId")
    status: MembershipResultStatus
    requested_at: datetime | None = Field(default=None, serialization_alias="requestedAt")
    joined_at: datetime | None = Field(default=None, serialization_alias="joinedAt")
    resolved_at: datetime | None = Field(default=None, serialization_alias="resolvedAt")


class ParticipationResponse(BaseModel):
    status: str
    role: str | None = None
    canManage: bool
    memberCount: int


class ParticipantResponse(BaseModel):
    userId: UUID
    displayName: str
    status: str
    role: str | None = None


# --- TASK #112: Schemas para Tópicos, Plano de Aulas e Cronograma ---


class GroupTopicCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    subject_topic_id: UUID | None = Field(default=None, alias="subjectTopicId")
    custom_title: str | None = Field(default=None, max_length=255, alias="customTitle")

    @field_validator("custom_title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def require_source(self):
        if bool(self.subject_topic_id) == bool(self.custom_title):
            raise ValueError("Informe um assunto do catálogo ou um título próprio.")
        return self


class GroupTopicResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    subject_topic_id: UUID | None = Field(default=None, serialization_alias="subjectTopicId")
    custom_title: str | None = Field(default=None, serialization_alias="customTitle")
    created_at: datetime = Field(serialization_alias="createdAt")


class ScheduledLessonCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None)
    scheduled_at: AwareDatetime = Field(alias="scheduledAt")
    topic_ids: list[UUID] = Field(default_factory=list, alias="topicIds")

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("O título não pode ser vazio.")
        return normalized


class ScheduledLessonUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None)
    scheduled_at: AwareDatetime | None = Field(default=None, alias="scheduledAt")
    topic_ids: list[UUID] | None = Field(default=None, alias="topicIds")

    @model_validator(mode="after")
    def validate_updates(self):
        for field in ("title", "scheduled_at", "topic_ids"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} não pode ser nulo.")
        if self.title is not None:
            self.title = self.title.strip()
            if not self.title:
                raise ValueError("O título não pode ser vazio.")
        return self


class ScheduledLessonResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    plan_id: UUID = Field(serialization_alias="planId")
    title: str
    description: str | None = None
    scheduled_at: AwareDatetime = Field(serialization_alias="scheduledAt")
    created_at: datetime = Field(serialization_alias="createdAt")
    topic_ids: list[UUID] = Field(default_factory=list, serialization_alias="topicIds")


class TeachingPlanCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    source_file_id: None = Field(default=None, alias="sourceFileId")
    lessons: list[ScheduledLessonCreate] = Field(default_factory=list)


class TeachingPlanResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    version: int
    status: str
    published_by: UUID | None = Field(default=None, serialization_alias="publishedBy")
    published_at: datetime | None = Field(default=None, serialization_alias="publishedAt")
    creator_id: UUID = Field(serialization_alias="creatorId")
    source_file_id: UUID | None = Field(default=None, serialization_alias="sourceFileId")
    created_at: datetime = Field(serialization_alias="createdAt")
    lessons: list[ScheduledLessonResponse] = Field(default_factory=list)


class LessonOccurrenceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    status: Literal["held", "cancelled", "postponed"]
    scheduled_lesson_id: UUID | None = Field(default=None, alias="scheduledLessonId")
    actual_started_at: AwareDatetime | None = Field(default=None, alias="actualStartedAt")
    actual_ended_at: AwareDatetime | None = Field(default=None, alias="actualEndedAt")
    rescheduled_to: AwareDatetime | None = Field(default=None, alias="rescheduledTo")
    notes: str | None = Field(default=None)
    topic_ids: list[UUID] | None = Field(default=None, alias="topicIds")
    supersedes_occurrence_id: UUID | None = Field(default=None, alias="supersedesOccurrenceId")

    @model_validator(mode="after")
    def validate_status_rules(self):
        if self.status == "held":
            if self.actual_started_at is None or self.actual_ended_at is None:
                raise ValueError("Aula realizada exige início e fim reais.")
            if self.actual_ended_at <= self.actual_started_at:
                raise ValueError("Término da aula deve ser posterior ao início.")
            if self.rescheduled_to is not None:
                raise ValueError("Aula realizada não pode ter data de reagendamento.")
        elif self.status == "cancelled":
            if self.actual_started_at is not None or self.actual_ended_at is not None:
                raise ValueError("Aula cancelada não pode ter início ou término real.")
            if self.rescheduled_to is not None:
                raise ValueError("Aula cancelada não pode ter data de reagendamento.")
        elif self.status == "postponed":
            if self.actual_started_at is not None or self.actual_ended_at is not None:
                raise ValueError("Aula adiada não pode ter início ou término real.")
            if self.rescheduled_to is None:
                raise ValueError("Aula adiada exige nova data de reagendamento.")
        return self


class LessonOccurrenceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    scheduled_lesson_id: UUID | None = Field(default=None, serialization_alias="scheduledLessonId")
    supersedes_occurrence_id: UUID | None = Field(default=None, serialization_alias="supersedesOccurrenceId")
    status: str
    actual_started_at: datetime | None = Field(default=None, serialization_alias="actualStartedAt")
    actual_ended_at: datetime | None = Field(default=None, serialization_alias="actualEndedAt")
    rescheduled_to: datetime | None = Field(default=None, serialization_alias="rescheduledTo")
    notes: str | None = None
    recorded_by: UUID = Field(serialization_alias="recordedBy")
    created_at: datetime = Field(serialization_alias="createdAt")
    topic_ids: list[UUID] = Field(default_factory=list, serialization_alias="topicIds")


class StudentAttendanceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    lesson_occurrence_id: UUID = Field(alias="lessonOccurrenceId")
    status: Literal["present", "absent"]
    notes: str | None = None


class StudentAttendanceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    lesson_occurrence_id: UUID = Field(serialization_alias="lessonOccurrenceId")
    group_id: UUID = Field(serialization_alias="groupId")
    status: str
    notes: str | None = None
    updated_at: datetime = Field(serialization_alias="updatedAt")


class StudentTopicProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    status: Literal["pending", "reviewing", "mastered"]
    notes: str | None = None


class StudentTopicProgressResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    group_topic_id: UUID = Field(serialization_alias="groupTopicId")
    group_id: UUID = Field(serialization_alias="groupId")
    status: str
    notes: str | None = None
    updated_at: datetime = Field(serialization_alias="updatedAt")


class AttendanceAdjustmentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    user_id: UUID = Field(serialization_alias="userId")
    source_occurrence_id: UUID = Field(serialization_alias="sourceOccurrenceId")
    target_occurrence_id: UUID = Field(serialization_alias="targetOccurrenceId")
    target_status: str = Field(serialization_alias="targetStatus")
    outcome: str
    previous_status: str = Field(serialization_alias="previousStatus")
    previous_notes: str | None = Field(default=None, serialization_alias="previousNotes")
    created_at: datetime = Field(serialization_alias="createdAt")
    notice_seen_at: datetime | None = Field(default=None, serialization_alias="noticeSeenAt")



# --- TASK #120: Schemas de Canais ---


class ChannelCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    subject_topic_id: UUID | None = Field(default=None, alias="subjectTopicId")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("O nome do canal não pode ser vazio.")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ChannelUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_at_least_one(self) -> "ChannelUpdate":
        if not self.model_fields_set:
            raise ValueError("Informe pelo menos um campo para atualizar.")
        return self

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("O nome do canal não pode ser vazio.")
        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ChannelResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True, from_attributes=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    subject_topic_id: UUID | None = Field(default=None, serialization_alias="subjectTopicId")
    name: str
    description: str | None = None
    created_by: UUID = Field(serialization_alias="createdBy")
    status: str
    created_at: datetime = Field(serialization_alias="createdAt")
    archived_at: datetime | None = Field(default=None, serialization_alias="archivedAt")
