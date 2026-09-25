from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter, field_validator, model_validator


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


class PlanningCorrectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    group_id: UUID = Field(alias="groupId")
    scheduled_lesson_id: UUID | None = Field(default=None, alias="scheduledLessonId")
    lesson_occurrence_id: UUID | None = Field(default=None, alias="lessonOccurrenceId")
    kind: PlanningCorrectionKind
    proposed_patch: dict[str, Any] = Field(alias="proposedPatch")
    reason: str | None = None

    @model_validator(mode="after")
    def validate_single_target(self):
        if (self.scheduled_lesson_id is None) == (self.lesson_occurrence_id is None):
            raise ValueError("Informe exatamente uma aula prevista ou ocorrência como alvo.")
        return self


class PlanningCorrectionDecision(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    status: Literal["approved", "rejected"]
    decision_note: str | None = Field(default=None, alias="decisionNote")


class PlanningCorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    suggested_by: UUID = Field(serialization_alias="suggestedBy")
    scheduled_lesson_id: UUID | None = Field(default=None, serialization_alias="scheduledLessonId")
    lesson_occurrence_id: UUID | None = Field(default=None, serialization_alias="lessonOccurrenceId")
    kind: PlanningCorrectionKind
    original_snapshot: dict[str, Any] = Field(serialization_alias="originalSnapshot")
    proposed_patch: dict[str, Any] = Field(serialization_alias="proposedPatch")
    diff: dict[str, dict[str, Any]]
    reason: str | None
    status: PlanningCorrectionStatus
    decided_by: UUID | None = Field(default=None, serialization_alias="decidedBy")
    decided_at: AwareDatetime | None = Field(default=None, serialization_alias="decidedAt")
    decision_note: str | None = Field(default=None, serialization_alias="decisionNote")
    created_at: AwareDatetime = Field(serialization_alias="createdAt")


class MeetingFields(BaseModel):
    @field_validator("title", "location", "external_url", mode="before", check_fields=False)
    @classmethod
    def strip_meeting_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("external_url", check_fields=False)
    @classmethod
    def validate_external_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return str(TypeAdapter(HttpUrl).validate_python(value))

    @field_validator("channel_id", check_fields=False)
    @classmethod
    def defer_channel_link(cls, value: UUID | None) -> None:
        if value is not None:
            raise ValueError("O vínculo com canais ainda não está disponível; omita channelId.")
        return None


class MeetingCreate(MeetingFields):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    group_id: UUID = Field(alias="groupId")
    channel_id: UUID | None = Field(default=None, alias="channelId")
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    modality: MeetingModality
    location: str | None = Field(default=None, max_length=250)
    external_url: str | None = Field(default=None, alias="externalUrl")
    starts_at: AwareDatetime = Field(alias="startsAt")
    ends_at: AwareDatetime | None = Field(default=None, alias="endsAt")
    topic_ids: list[UUID] = Field(default_factory=list, alias="topicIds")

    @model_validator(mode="after")
    def validate_meeting(self):
        if self.ends_at is not None and self.starts_at >= self.ends_at:
            raise ValueError("O início deve ser anterior ao fim do encontro.")
        if self.modality == MeetingModality.IN_PERSON and not self.location:
            raise ValueError("Informe o local para encontros presenciais.")
        if self.modality == MeetingModality.ONLINE and not self.external_url:
            raise ValueError("Informe a URL para encontros online.")
        if self.modality == MeetingModality.HYBRID and (not self.location or not self.external_url):
            raise ValueError("Encontros híbridos exigem local e URL.")
        return self


class MeetingUpdate(MeetingFields):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    channel_id: UUID | None = Field(default=None, alias="channelId")
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    modality: MeetingModality | None = None
    location: str | None = Field(default=None, max_length=250)
    external_url: str | None = Field(default=None, alias="externalUrl")
    starts_at: AwareDatetime | None = Field(default=None, alias="startsAt")
    ends_at: AwareDatetime | None = Field(default=None, alias="endsAt")
    topic_ids: list[UUID] | None = Field(default=None, alias="topicIds")

    @model_validator(mode="after")
    def validate_meeting_update(self):
        if self.starts_at is not None and self.ends_at is not None and self.starts_at >= self.ends_at:
            raise ValueError("O início deve ser anterior ao fim do encontro.")
        for field in ("title", "modality", "starts_at"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} não aceita valor nulo.")
        return self


class MeetingOutcomeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    status: Literal["completed", "postponed", "cancelled"]
    starts_at: AwareDatetime | None = Field(default=None, alias="startsAt")
    ends_at: AwareDatetime | None = Field(default=None, alias="endsAt")

    @model_validator(mode="after")
    def validate_outcome(self):
        if self.status == "postponed":
            if self.starts_at is None or self.ends_at is None:
                raise ValueError("Informe os novos horários para adiar o encontro.")
            if self.starts_at >= self.ends_at:
                raise ValueError("O início deve ser anterior ao fim do encontro.")
        elif self.starts_at is not None or self.ends_at is not None:
            raise ValueError("Novos horários só podem ser informados ao adiar o encontro.")
        return self


class MeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    id: UUID
    group_id: UUID = Field(serialization_alias="groupId")
    channel_id: UUID | None = Field(serialization_alias="channelId")
    organizer_id: UUID = Field(serialization_alias="organizerId")
    title: str
    description: str | None
    modality: MeetingModality
    location: str | None
    external_url: str | None = Field(serialization_alias="externalUrl")
    starts_at: AwareDatetime = Field(serialization_alias="startsAt")
    ends_at: AwareDatetime | None = Field(serialization_alias="endsAt")
    status: MeetingStatus
    created_at: AwareDatetime = Field(serialization_alias="createdAt")
    updated_at: AwareDatetime = Field(serialization_alias="updatedAt")
    topic_ids: list[UUID] = Field(default_factory=list, serialization_alias="topicIds")
    confirmed_count: int = Field(default=0, serialization_alias="confirmedCount")
    participant_status: MeetingParticipantStatus | None = Field(default=None, serialization_alias="participantStatus")


class MeetingParticipantUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    status: MeetingParticipantStatus = MeetingParticipantStatus.INTERESTED


class MeetingParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    meeting_id: UUID = Field(serialization_alias="meetingId")
    user_id: UUID = Field(serialization_alias="userId")
    status: MeetingParticipantStatus
    updated_at: AwareDatetime = Field(serialization_alias="updatedAt")


class MeetingTopicCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    subject_topic_id: UUID = Field(alias="subjectTopicId")


class MeetingTopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    meeting_id: UUID = Field(serialization_alias="meetingId")
    subject_topic_id: UUID = Field(serialization_alias="subjectTopicId")


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
    subject_topic_ids: list[UUID] = Field(default_factory=list, alias="subjectTopicIds", max_length=100)

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
    subject_topic_ids: list[UUID] | None = Field(default=None, alias="subjectTopicIds", max_length=100)
    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "GroupUpdate":
        for field in ("name", "visibility", "join_policy", "subject_topic_ids"):
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
    topic_name: str | None = Field(default=None, serialization_alias="topicName")
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
    group_topic_id: UUID | None = Field(default=None, alias="groupTopicId")

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
            raise ValueError("O nome do canal não aceita valor nulo.")
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
    group_topic_id: UUID | None = Field(default=None, serialization_alias="groupTopicId")
    topic_name: str | None = Field(default=None, serialization_alias="topicName")
    name: str
    description: str | None = None
    created_by: UUID = Field(serialization_alias="createdBy")
    status: str
    created_at: datetime = Field(serialization_alias="createdAt")
    archived_at: datetime | None = Field(default=None, serialization_alias="archivedAt")
