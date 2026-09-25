from dataclasses import dataclass
from datetime import UTC, datetime
from types import TracebackType
from typing import Any, Protocol, Self
from uuid import UUID, uuid4

from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, aliased, sessionmaker
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.modules.academic.models import AcademicTerm, ClassSection, Subject, Teacher, ClassSectionTeacher
from app.modules.community.errors import CommunityError, CommunityPersistenceError
from app.modules.community.models import (
    AttendanceAdjustmentOutcome,
    AttendanceStatus,
    Channel,
    ChannelMessage,
    ChannelStatus,
    GroupJoinRequest,
    GroupMember,
    GroupStatus,
    GroupTopic,
    GroupVisibility,
    JoinRequestStatus,
    LessonOccurrence,
    LessonOccurrenceStatus,
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    MeetingTopic,
    MembershipRole,
    MembershipStatus,
    OccurrenceTopic,
    PlanningCorrection,
    PlanningCorrectionKind,
    PlanningCorrectionStatus,
    ScheduledLesson,
    ScheduledLessonTopic,
    StudentAttendanceAdjustment,
    StudentLessonAttendance,
    StudentTopicProgress,
    StudyGroup,
    SubjectTopic,
    TeachingPlan,
    Topic,
    TopicProgressStatus,
)
from app.modules.community.schemas import (
    ChannelCreate,
    ChannelUpdate,
    GroupCreate,
    GroupTopicCreate,
    MeetingCreate,
    MeetingParticipantStatus,
    MeetingUpdate,
    LessonOccurrenceCreate,
    PlanningCorrectionCreate,
    ParticipantResponse,
    ScheduledLessonCreate,
    ScheduledLessonUpdate,
    TeachingPlanCreate,
)
from app.modules.users.infrastructure.models import UserProfile


@dataclass(frozen=True)
class GroupDiscoveryRecord:
    group: StudyGroup
    subject_name: str
    subject_code: str | None
    period: str | None


@dataclass(frozen=True)
class ChannelMessageRecord:
    message: ChannelMessage
    author_name: str
    reply_author_name: str | None
    reply_content: str | None
    reply_deleted_at: datetime | None


class CommunityRepository(Protocol):
    def list_mine(self, user_id: UUID, offset: int, limit: int) -> list[StudyGroup]: ...
    def list_participants(self, group_id: UUID, pending: bool, offset: int, limit: int) -> list[ParticipantResponse]: ...
    def find_by_id(self, group_id: UUID) -> StudyGroup | None: ...
    def find_active_owner_id(self, group_id: UUID) -> UUID | None: ...
    def is_active_member(self, group_id: UUID, user_id: UUID) -> bool: ...
    def is_active_organizer(self, group_id: UUID, user_id: UUID) -> bool: ...
    def find_member(self, group_id: UUID, user_id: UUID) -> GroupMember | None: ...
    def find_pending_request(self, group_id: UUID, user_id: UUID) -> GroupJoinRequest | None: ...
    def count_active_members(self, group_id: UUID) -> int: ...
    def search_public_groups(self, subject: str | None, period: str | None,
                             topic: str | None, offset: int,
                             limit: int, subject_id: UUID | None = None, class_section_id: UUID | None = None,
                             teacher_id: UUID | None = None, subject_topic_id: UUID | None = None) -> list[GroupDiscoveryRecord]: ...
    def create_group(self, owner_id: UUID, data: GroupCreate) -> StudyGroup: ...
    def set_group_subject_topics(self, group: StudyGroup, topic_ids: list[UUID]) -> None: ...
    def update_group(self, group: StudyGroup, updates: dict[str, Any]) -> StudyGroup: ...
    def activate_member(self, group_id: UUID, user_id: UUID) -> GroupMember: ...
    def create_join_request(self, group_id: UUID, user_id: UUID) -> GroupJoinRequest: ...
    def resolve_join_request(self, request: GroupJoinRequest, status: JoinRequestStatus,
                             resolver_id: UUID, note: str | None) -> GroupJoinRequest: ...
    def remove_member(self, member: GroupMember, remover_id: UUID) -> GroupMember: ...
    def check_discipline_exists(self, discipline_id: UUID) -> bool: ...
    def check_offering_belongs_to_discipline(self, offering_id: UUID,
                                             discipline_id: UUID) -> bool: ...

    def create_meeting(self, group_id: UUID, organizer_id: UUID, data: MeetingCreate) -> Meeting: ...
    def list_group_meetings(self, group_id: UUID, start: datetime | None, end: datetime | None) -> list[Meeting]: ...
    def list_user_meetings(self, user_id: UUID, start: datetime | None, end: datetime | None) -> list[Meeting]: ...
    def find_meeting(self, meeting_id: UUID, lock: bool = False) -> Meeting | None: ...
    def update_meeting(self, meeting: Meeting, data: MeetingUpdate) -> Meeting: ...
    def cancel_meeting(self, meeting: Meeting) -> Meeting: ...
    def upsert_meeting_participant(self, meeting_id: UUID, user_id: UUID, status: MeetingParticipantStatus) -> MeetingParticipant: ...
    def set_meeting_topics(self, group_id: UUID, meeting_id: UUID, topic_ids: list[UUID]) -> None: ...
    def list_meeting_topic_ids(self, meeting_ids: list[UUID]) -> dict[UUID, list[UUID]]: ...
    def meeting_participant_summary(self, meeting_ids: list[UUID], user_id: UUID) -> dict[UUID, tuple[int, str | None]]: ...

    def planning_correction_target_snapshot(self, group_id: UUID,
                                            scheduled_lesson_id: UUID | None,
                                            lesson_occurrence_id: UUID | None,
                                            lock: bool = False) -> dict[str, Any] | None: ...
    def create_planning_correction(self, suggested_by: UUID, data: PlanningCorrectionCreate,
                                   snapshot: dict[str, Any]) -> PlanningCorrection: ...
    def list_planning_corrections(self, group_id: UUID, status: str | None,
                                  suggested_by: UUID | None) -> list[PlanningCorrection]: ...
    def find_planning_correction(self, correction_id: UUID,
                                 lock: bool = False) -> PlanningCorrection | None: ...
    def has_occurrence_successor(self, occurrence_id: UUID) -> bool: ...

    # --- TASK #112: Tópicos, Plano de Aulas e Cronograma ---
    def create_group_topic(self, group_id: UUID, data: GroupTopicCreate) -> GroupTopic: ...
    def list_group_topics(self, group_id: UUID) -> list[tuple[GroupTopic, str | None]]: ...
    def create_teaching_plan(self, group_id: UUID, creator_id: UUID, data: TeachingPlanCreate) -> TeachingPlan: ...
    def find_latest_teaching_plan(self, group_id: UUID) -> TeachingPlan | None: ...
    def find_teaching_plan_by_id(self, plan_id: UUID) -> TeachingPlan | None: ...
    def create_scheduled_lesson(self, group_id: UUID, plan_id: UUID, data: ScheduledLessonCreate) -> ScheduledLesson: ...
    def list_scheduled_lessons(self, group_id: UUID, plan_id: UUID | None = None) -> list[tuple[ScheduledLesson, list[UUID]]]: ...
    def find_scheduled_lesson_by_id(self, lesson_id: UUID, lock: bool = False) -> ScheduledLesson | None: ...
    def update_scheduled_lesson(self, lesson: ScheduledLesson, data: ScheduledLessonUpdate,
                                allow_published: bool = False) -> ScheduledLesson: ...
    def delete_scheduled_lesson(self, lesson: ScheduledLesson) -> None: ...

    def list_teaching_plans(self, group_id: UUID, offset: int, limit: int) -> list[TeachingPlan]: ...
    def find_published_teaching_plan(self, group_id: UUID) -> TeachingPlan | None: ...
    def publish_teaching_plan(self, group_id: UUID, plan_id: UUID, user_id: UUID) -> TeachingPlan: ...
    def replace_draft(self, group_id: UUID, plan_id: UUID, data: TeachingPlanCreate) -> TeachingPlan: ...
    def list_user_lessons(self, user_id: UUID, start: datetime | None, end: datetime | None,
                         period: str | None, offset: int, limit: int) -> list[tuple[ScheduledLesson, list[UUID]]]: ...

    # --- TASK #114: Ocorrências de Aula, Frequência e Progresso ---
    def create_lesson_occurrence(self, group_id: UUID, recorded_by: UUID, data: LessonOccurrenceCreate) -> tuple[LessonOccurrence, list[UUID]]: ...
    def list_lesson_occurrences(self, group_id: UUID, current_only: bool = True, scheduled_lesson_id: UUID | None = None) -> list[tuple[LessonOccurrence, list[UUID]]]: ...
    def find_lesson_occurrence_by_id(self, occurrence_id: UUID) -> tuple[LessonOccurrence, list[UUID]] | None: ...
    def record_student_attendance(self, user_id: UUID, occurrence_id: UUID, status: str, notes: str | None) -> tuple[StudentLessonAttendance, UUID]: ...
    def delete_student_attendance(self, user_id: UUID, occurrence_id: UUID) -> None: ...
    def list_student_attendance(self, user_id: UUID, group_id: UUID | None = None) -> list[tuple[StudentLessonAttendance, UUID]]: ...
    def update_topic_progress(self, user_id: UUID, group_topic_id: UUID, status: str, notes: str | None) -> tuple[StudentTopicProgress, UUID]: ...
    def list_topic_progress(self, user_id: UUID, group_id: UUID | None = None) -> list[tuple[StudentTopicProgress, UUID]]: ...
    def list_student_adjustments(self, user_id: UUID, unread_only: bool = False) -> list[StudentAttendanceAdjustment]: ...
    def mark_adjustment_seen(self, user_id: UUID, adjustment_id: UUID) -> StudentAttendanceAdjustment: ...

    # --- TASK #120: Canais por assunto ---
    def channel_topic_name(self, channel: Channel) -> str | None: ...
    def list_channels(self, group_id: UUID) -> list[Channel]: ...
    def create_channel(self, group_id: UUID, created_by: UUID, data: ChannelCreate) -> Channel: ...
    def find_channel_by_id(self, channel_id: UUID, lock: bool = False) -> Channel | None: ...
    def update_channel(self, channel: Channel, data: ChannelUpdate) -> Channel: ...
    def archive_channel(self, channel: Channel) -> Channel: ...

    def list_channel_messages(
        self, channel_id: UUID, offset: int, limit: int
    ) -> list[ChannelMessageRecord]: ...
    def create_channel_message(
        self, channel_id: UUID, author_id: UUID, content: str,
        reply_to_message_id: UUID | None,
    ) -> ChannelMessage: ...
    def find_channel_message_by_id(
        self, message_id: UUID, lock: bool = False
    ) -> ChannelMessage | None: ...
    def find_channel_message_record(
        self, message_id: UUID
    ) -> ChannelMessageRecord | None: ...
    def update_channel_message(
        self, message: ChannelMessage, content: str
    ) -> ChannelMessage: ...
    def soft_delete_channel_message(
        self, message: ChannelMessage
    ) -> ChannelMessage: ...


class CommunityUnitOfWork(Protocol):
    community: CommunityRepository

    def __enter__(self) -> Self: ...
    def __exit__(self, exc_type: type[BaseException] | None,
                  exc_value: BaseException | None,
                  traceback: TracebackType | None) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...


class SqlAlchemyCommunityRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_mine(self, user_id: UUID, offset: int, limit: int) -> list[StudyGroup]:
        stmt = select(StudyGroup).join(GroupMember, GroupMember.group_id == StudyGroup.id).where(
            GroupMember.user_id == user_id, GroupMember.status == MembershipStatus.ACTIVE,
            StudyGroup.deleted_at.is_(None),
        ).order_by(StudyGroup.created_at.desc(), StudyGroup.id).offset(offset).limit(limit)
        return list(self._session.scalars(stmt))

    def list_participants(self, group_id: UUID, pending: bool, offset: int, limit: int) -> list[ParticipantResponse]:
        model = GroupJoinRequest if pending else GroupMember
        status = JoinRequestStatus.PENDING if pending else MembershipStatus.ACTIVE
        stmt = select(model, UserProfile.display_name).outerjoin(
            UserProfile, UserProfile.user_id == model.user_id
        ).where(model.group_id == group_id, model.status == status).order_by(model.user_id).offset(offset).limit(limit)
        return [ParticipantResponse(userId=row.user_id, displayName=name or "Estudante",
                                    status="pending" if pending else "active",
                                    role=None if pending else row.role.value)
                for row, name in self._session.execute(stmt)]

    def find_by_id(self, group_id: UUID) -> StudyGroup | None:
        group = self._session.get(StudyGroup, group_id)
        return group if group is not None and group.deleted_at is None else None

    def create_meeting(self, group_id: UUID, organizer_id: UUID, data: MeetingCreate) -> Meeting:
        values = data.model_dump(exclude={"group_id", "topic_ids"})
        values["modality"] = data.modality.value
        meeting = Meeting(group_id=group_id, organizer_id=organizer_id, **values)
        self._session.add(meeting)
        self._session.flush()
        if data.topic_ids:
            self.set_meeting_topics(group_id, meeting.id, data.topic_ids)
        return meeting

    def planning_correction_target_snapshot(
        self,
        group_id: UUID,
        scheduled_lesson_id: UUID | None,
        lesson_occurrence_id: UUID | None,
        lock: bool = False,
    ) -> dict[str, Any] | None:
        if lock:
            self._session.execute(
                select(StudyGroup.id).where(StudyGroup.id == group_id).with_for_update()
            )
        if scheduled_lesson_id is not None:
            stmt = select(ScheduledLesson).where(ScheduledLesson.id == scheduled_lesson_id)
            if lock:
                stmt = stmt.with_for_update()
            lesson = self._session.scalar(stmt)
            if lesson is None or lesson.group_id != group_id:
                return None
            topic_ids = list(self._session.scalars(
                select(ScheduledLessonTopic.group_topic_id)
                .where(ScheduledLessonTopic.lesson_id == lesson.id)
                .order_by(ScheduledLessonTopic.group_topic_id)
            ))
            return {
                "title": lesson.title,
                "description": lesson.description,
                "scheduledAt": lesson.scheduled_at.isoformat(),
                "topicIds": [str(topic_id) for topic_id in topic_ids],
            }

        if lesson_occurrence_id is not None:
            stmt = select(LessonOccurrence).where(LessonOccurrence.id == lesson_occurrence_id)
            if lock:
                stmt = stmt.with_for_update()
            occurrence = self._session.scalar(stmt)
            if occurrence is None or occurrence.group_id != group_id:
                return None
            topic_ids = list(self._session.scalars(
                select(OccurrenceTopic.group_topic_id)
                .where(OccurrenceTopic.lesson_occurrence_id == occurrence.id)
                .order_by(OccurrenceTopic.group_topic_id)
            ))
            return {
                "scheduledLessonId": str(occurrence.scheduled_lesson_id) if occurrence.scheduled_lesson_id else None,
                "status": occurrence.status.value,
                "actualStartedAt": occurrence.actual_started_at.isoformat() if occurrence.actual_started_at else None,
                "actualEndedAt": occurrence.actual_ended_at.isoformat() if occurrence.actual_ended_at else None,
                "rescheduledTo": occurrence.rescheduled_to.isoformat() if occurrence.rescheduled_to else None,
                "notes": occurrence.notes,
                "topicIds": [str(topic_id) for topic_id in topic_ids],
            }
        return None

    def create_planning_correction(
        self, suggested_by: UUID, data: PlanningCorrectionCreate,
        snapshot: dict[str, Any],
    ) -> PlanningCorrection:
        correction = PlanningCorrection(
            group_id=data.group_id,
            suggested_by=suggested_by,
            scheduled_lesson_id=data.scheduled_lesson_id,
            lesson_occurrence_id=data.lesson_occurrence_id,
            kind=PlanningCorrectionKind(data.kind.value),
            original_snapshot=snapshot,
            proposed_patch=data.proposed_patch,
            reason=data.reason,
        )
        self._session.add(correction)
        self._session.flush()
        return correction

    def list_planning_corrections(
        self, group_id: UUID, status: str | None,
        suggested_by: UUID | None,
    ) -> list[PlanningCorrection]:
        stmt = select(PlanningCorrection).where(PlanningCorrection.group_id == group_id)
        if status is not None:
            stmt = stmt.where(PlanningCorrection.status == PlanningCorrectionStatus(status))
        if suggested_by is not None:
            stmt = stmt.where(PlanningCorrection.suggested_by == suggested_by)
        return list(self._session.scalars(
            stmt.order_by(PlanningCorrection.created_at.desc(), PlanningCorrection.id)
        ))

    def find_planning_correction(
        self, correction_id: UUID, lock: bool = False
    ) -> PlanningCorrection | None:
        stmt = select(PlanningCorrection).where(PlanningCorrection.id == correction_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def has_occurrence_successor(self, occurrence_id: UUID) -> bool:
        return self._session.scalar(
            select(LessonOccurrence.id)
            .where(LessonOccurrence.supersedes_occurrence_id == occurrence_id)
            .limit(1)
        ) is not None

    def list_group_meetings(self, group_id: UUID, start: datetime | None, end: datetime | None) -> list[Meeting]:
        stmt = select(Meeting).where(Meeting.group_id == group_id)
        if start is not None:
            stmt = stmt.where(Meeting.starts_at >= start)
        if end is not None:
            stmt = stmt.where(Meeting.starts_at < end)
        return list(self._session.scalars(stmt.order_by(Meeting.starts_at, Meeting.id)))

    def list_user_meetings(self, user_id: UUID, start: datetime | None, end: datetime | None) -> list[Meeting]:
        stmt = (select(Meeting).join(GroupMember, GroupMember.group_id == Meeting.group_id)
            .join(StudyGroup, StudyGroup.id == Meeting.group_id)
            .where(GroupMember.user_id == user_id, GroupMember.status == MembershipStatus.ACTIVE,
                   StudyGroup.status == GroupStatus.ACTIVE, StudyGroup.deleted_at.is_(None)))
        if start is not None:
            stmt = stmt.where(Meeting.starts_at >= start)
        if end is not None:
            stmt = stmt.where(Meeting.starts_at < end)
        return list(self._session.scalars(stmt.order_by(Meeting.starts_at, Meeting.id)))

    def find_meeting(self, meeting_id: UUID, lock: bool = False) -> Meeting | None:
        stmt = select(Meeting).where(Meeting.id == meeting_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def update_meeting(self, meeting: Meeting, data: MeetingUpdate) -> Meeting:
        updates = data.model_dump(exclude_unset=True, exclude={"topic_ids"})
        for field, value in updates.items():
            setattr(meeting, field, value.value if hasattr(value, "value") else value)
        if "topic_ids" in data.model_fields_set:
            self.set_meeting_topics(meeting.group_id, meeting.id, data.topic_ids or [])
        meeting.updated_at = datetime.now(UTC)
        self._session.flush()
        return meeting

    def set_meeting_topics(self, group_id: UUID, meeting_id: UUID, topic_ids: list[UUID]) -> None:
        self._session.execute(select(StudyGroup.id).where(StudyGroup.id == group_id).with_for_update())
        if len(topic_ids) != len(set(topic_ids)):
            raise CommunityError("Não repita tópicos no encontro.", 422)
        if topic_ids:
            valid = set(self._session.scalars(select(GroupTopic.subject_topic_id).where(
                GroupTopic.group_id == group_id,
                GroupTopic.subject_topic_id.in_(topic_ids),
            )))
            if valid != set(topic_ids):
                raise CommunityError("Selecione tópicos vinculados ao grupo.", 422)
        for existing in self._session.scalars(select(MeetingTopic).where(MeetingTopic.meeting_id == meeting_id)):
            self._session.delete(existing)
        self._session.flush()
        self._session.add_all(MeetingTopic(meeting_id=meeting_id, subject_topic_id=topic_id)
                              for topic_id in topic_ids)
        self._session.flush()

    def list_meeting_topic_ids(self, meeting_ids: list[UUID]) -> dict[UUID, list[UUID]]:
        result = {meeting_id: [] for meeting_id in meeting_ids}
        if not meeting_ids:
            return result
        rows = self._session.execute(select(MeetingTopic.meeting_id, MeetingTopic.subject_topic_id)
                                     .where(MeetingTopic.meeting_id.in_(meeting_ids))
                                     .order_by(MeetingTopic.subject_topic_id))
        for meeting_id, topic_id in rows:
            result[meeting_id].append(topic_id)
        return result

    def meeting_participant_summary(self, meeting_ids: list[UUID], user_id: UUID) -> dict[UUID, tuple[int, str | None]]:
        summary = {meeting_id: (0, None) for meeting_id in meeting_ids}
        if not meeting_ids:
            return summary
        counts = dict(self._session.execute(
            select(MeetingParticipant.meeting_id, func.count())
            .where(MeetingParticipant.meeting_id.in_(meeting_ids), MeetingParticipant.status == "confirmed")
            .group_by(MeetingParticipant.meeting_id)
        ).all())
        own_status = dict(self._session.execute(
            select(MeetingParticipant.meeting_id, MeetingParticipant.status)
            .where(MeetingParticipant.meeting_id.in_(meeting_ids), MeetingParticipant.user_id == user_id)
        ).all())
        return {meeting_id: (int(counts.get(meeting_id, 0)),
                             getattr(own_status.get(meeting_id), "value", own_status.get(meeting_id)))
                for meeting_id in meeting_ids}

    def cancel_meeting(self, meeting: Meeting) -> Meeting:
        meeting.status = MeetingStatus.CANCELLED
        meeting.updated_at = datetime.now(UTC)
        self._session.flush()
        return meeting

    def upsert_meeting_participant(self, meeting_id: UUID, user_id: UUID,
                                   status: MeetingParticipantStatus) -> MeetingParticipant:
        table = MeetingParticipant.__table__
        statement = pg_insert(MeetingParticipant).values(
            meeting_id=meeting_id, user_id=user_id, status=status.value,
            updated_at=datetime.now(UTC),
        )
        statement = statement.on_conflict_do_update(
            index_elements=[table.c.meeting_id, table.c.user_id],
            set_={"status": statement.excluded.status, "updated_at": statement.excluded.updated_at},
            where=table.c.status != statement.excluded.status,
        ).returning(MeetingParticipant)
        participant = self._session.scalars(statement).one_or_none()
        if participant is not None:
            return participant
        existing = self._session.get(MeetingParticipant, (meeting_id, user_id))
        if existing is None:
            raise CommunityError("Não foi possível registrar a participação.", 409)
        return existing

    def find_active_owner_id(self, group_id: UUID) -> UUID | None:
        stmt = select(GroupMember.user_id).where(
            GroupMember.group_id == group_id,
            GroupMember.role == MembershipRole.OWNER,
            GroupMember.status == MembershipStatus.ACTIVE,
        ).limit(1)
        owner_id = self._session.execute(stmt).scalar_one_or_none()
        if owner_id is not None:
            return owner_id
        group = self._session.get(StudyGroup, group_id)
        return group.created_by if group else None

    def is_active_member(self, group_id: UUID, user_id: UUID) -> bool:
        member = self.find_member(group_id, user_id)
        return member is not None and member.status == MembershipStatus.ACTIVE

    def is_active_organizer(self, group_id: UUID, user_id: UUID) -> bool:
        stmt = select(GroupMember.user_id).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role.in_((MembershipRole.OWNER, MembershipRole.MODERATOR)),
            GroupMember.status == MembershipStatus.ACTIVE,
        )
        return self._session.execute(stmt).scalar_one_or_none() is not None

    def find_member(self, group_id: UUID, user_id: UUID) -> GroupMember | None:
        return self._session.get(GroupMember, (group_id, user_id))

    def find_pending_request(self, group_id: UUID,
                             user_id: UUID) -> GroupJoinRequest | None:
        stmt = select(GroupJoinRequest).where(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == user_id,
            GroupJoinRequest.status == JoinRequestStatus.PENDING,
        ).limit(1)
        return self._session.execute(stmt).scalar_one_or_none()

    def count_active_members(self, group_id: UUID) -> int:
        stmt = select(func.count()).select_from(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.status == MembershipStatus.ACTIVE,
        )
        return int(self._session.execute(stmt).scalar_one())

    @staticmethod
    def _pattern(value: str) -> str:
        escaped = value.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        return f"%{escaped}%"

    def search_public_groups(self, subject: str | None, period: str | None,
                             topic: str | None, offset: int,
                             limit: int, subject_id: UUID | None = None, class_section_id: UUID | None = None,
                             teacher_id: UUID | None = None, subject_topic_id: UUID | None = None) -> list[GroupDiscoveryRecord]:
        stmt = (
            select(StudyGroup, Subject.name, Subject.code, AcademicTerm.label)
            .join(Subject, Subject.id == StudyGroup.subject_id)
            .outerjoin(ClassSection, ClassSection.id == StudyGroup.class_section_id)
            .outerjoin(AcademicTerm, AcademicTerm.id == ClassSection.academic_term_id)
            .where(
                StudyGroup.deleted_at.is_(None),
                StudyGroup.status == GroupStatus.ACTIVE,
                StudyGroup.visibility == GroupVisibility.PUBLIC,
            )
            .order_by(StudyGroup.created_at.desc(), StudyGroup.id)
        )
        if subject and subject.strip():
            pattern = self._pattern(subject)
            stmt = stmt.where(or_(Subject.name.ilike(pattern, escape="\\"),
                                  Subject.code.ilike(pattern, escape="\\")))
        if period and period.strip():
            stmt = stmt.where(AcademicTerm.label.ilike(self._pattern(period), escape="\\"))
        if topic and topic.strip():
            pattern = self._pattern(topic)
            linked_topic = exists(select(GroupTopic.id)
                .outerjoin(SubjectTopic, SubjectTopic.id == GroupTopic.subject_topic_id)
                .outerjoin(Topic, Topic.id == SubjectTopic.topic_id)
                .where(GroupTopic.group_id == StudyGroup.id, or_(
                    GroupTopic.custom_title.ilike(pattern, escape="\\"),
                    Topic.name.ilike(pattern, escape="\\"),
                )))
            stmt = stmt.where(or_(StudyGroup.name.ilike(pattern, escape="\\"),
                                  StudyGroup.description.ilike(pattern, escape="\\"), linked_topic))
        self._validate_discovery_filters(subject_id, class_section_id, teacher_id, subject_topic_id)
        if subject_id is not None:
            stmt = stmt.where(StudyGroup.subject_id == subject_id)
        if class_section_id is not None:
            stmt = stmt.where(StudyGroup.class_section_id == class_section_id)
        if teacher_id is not None:
            # Include historical assignments: discovery also supports past academic terms.
            stmt = stmt.where(exists(select(ClassSectionTeacher.id).where(
                ClassSectionTeacher.class_section_id == StudyGroup.class_section_id,
                ClassSectionTeacher.teacher_id == teacher_id,
            )))
        if subject_topic_id is not None:
            stmt = stmt.where(exists(select(GroupTopic.id).where(
                GroupTopic.group_id == StudyGroup.id,
                GroupTopic.subject_topic_id == subject_topic_id,
            )))
        rows = self._session.execute(stmt.offset(offset).limit(limit)).all()
        return [GroupDiscoveryRecord(group, subject_name, subject_code, term_label)
                for group, subject_name, subject_code, term_label in rows]

    def _validate_discovery_filters(self, subject_id, section_id, teacher_id, subject_topic_id):
        def required(model, item_id):
            item = self._session.get(model, item_id) if item_id is not None else None
            if item_id is not None and item is None:
                raise CommunityError("Filtro acadêmico inexistente. Atualize as opções e tente novamente.", 422)
            return item

        required(Subject, subject_id)
        section = required(ClassSection, section_id)
        teacher = required(Teacher, teacher_id)
        topic = required(SubjectTopic, subject_topic_id)
        disciplines = {item for item in (subject_id, section.subject_id if section else None,
                                        topic.subject_id if topic else None) if item is not None}
        if len(disciplines) > 1:
            raise CommunityError("Disciplina, turma e assunto devem pertencer à mesma disciplina.", 422)
        if teacher is not None and (section is not None or disciplines):
            assignment = select(ClassSectionTeacher.id).join(
                ClassSection, ClassSection.id == ClassSectionTeacher.class_section_id
            ).where(ClassSectionTeacher.teacher_id == teacher_id)
            if section is not None:
                assignment = assignment.where(ClassSection.id == section.id)
            elif disciplines:
                assignment = assignment.where(ClassSection.subject_id == next(iter(disciplines)))
            if self._session.scalar(assignment.limit(1)) is None:
                raise CommunityError("O professor não está vinculado à turma ou disciplina selecionada.", 422)

    def set_group_subject_topics(self, group: StudyGroup, topic_ids: list[UUID]) -> None:
        # Serialize changes with creation of group topics and preserve referenced history.
        self._session.execute(select(StudyGroup.id).where(StudyGroup.id == group.id).with_for_update())
        if len(topic_ids) != len(set(topic_ids)):
            raise CommunityError("Não repita assuntos na seleção.", 422)
        valid = set(self._session.scalars(select(SubjectTopic.id).where(
            SubjectTopic.subject_id == group.subject_id, SubjectTopic.id.in_(topic_ids))))
        if valid != set(topic_ids):
            raise CommunityError("Selecione assuntos pertencentes à disciplina do grupo.", 422)
        existing = list(self._session.scalars(select(GroupTopic).where(
            GroupTopic.group_id == group.id, GroupTopic.subject_topic_id.is_not(None)).with_for_update()))
        for item in existing:
            if item.subject_topic_id in valid:
                continue
            referenced = any(self._session.scalar(select(model.group_topic_id).where(
                model.group_topic_id == item.id).limit(1)) is not None
                for model in (Channel, ScheduledLessonTopic, OccurrenceTopic, StudentTopicProgress))
            meeting_reference = self._session.scalar(select(MeetingTopic.meeting_id).join(
                Meeting, Meeting.id == MeetingTopic.meeting_id).where(
                    Meeting.group_id == group.id, MeetingTopic.subject_topic_id == item.subject_topic_id).limit(1))
            if referenced or meeting_reference is not None:
                raise CommunityError("Um assunto selecionado já é usado em canais, aulas, encontros ou progresso e não pode ser removido.", 409)
            self._session.delete(item)
        existing_ids = {item.subject_topic_id for item in existing}
        for topic_id in valid - existing_ids:
            self._session.add(GroupTopic(group_id=group.id, subject_id=group.subject_id, subject_topic_id=topic_id))
        try:
            self._session.flush()
        except IntegrityError:
            raise CommunityError("Os assuntos estão em uso ou foram alterados. Atualize o grupo antes de tentar novamente.", 409) from None

    def create_group(self, owner_id: UUID, data: GroupCreate) -> StudyGroup:
        group_id = uuid4()
        now = datetime.now(UTC)
        group = StudyGroup(
            id=group_id, created_by=owner_id, subject_id=data.discipline_id,
            class_section_id=data.offering_id, name=data.name,
            description=data.description, rules=data.rules,
            visibility=data.visibility.value, join_policy=data.join_policy.value,
            status=GroupStatus.ACTIVE.value, created_at=now, updated_at=now,
        )
        self._session.add(group)
        self._session.flush()
        self._session.add(GroupMember(
            group_id=group_id, user_id=owner_id, role=MembershipRole.OWNER.value,
            status=MembershipStatus.ACTIVE.value, joined_at=now,
        ))
        
        # --- TASK #120: Default channel ---
        self._session.add(Channel(
            id=uuid4(),
            group_id=group_id,
            name="geral",
            description="Canal principal do grupo.",
            created_by=owner_id,
            status=ChannelStatus.ACTIVE.value,
            created_at=now,
        ))
        
        self._session.flush()
        return group

    def update_group(self, group: StudyGroup, updates: dict[str, Any]) -> StudyGroup:
        for field, value in updates.items():
            setattr(group, field, value.value if hasattr(value, "value") else value)
        group.updated_at = datetime.now(UTC)
        self._session.flush()
        return group

    def activate_member(self, group_id: UUID, user_id: UUID) -> GroupMember:
        now = datetime.now(UTC)
        member = self.find_member(group_id, user_id)
        if member is None:
            member = GroupMember(group_id=group_id, user_id=user_id,
                                   role=MembershipRole.MEMBER.value)
            self._session.add(member)
        member.status = MembershipStatus.ACTIVE.value
        member.joined_at = now
        member.ended_at = None
        member.removed_by = None
        self._session.flush()
        return member

    def create_join_request(self, group_id: UUID, user_id: UUID) -> GroupJoinRequest:
        request = GroupJoinRequest(id=uuid4(), group_id=group_id, user_id=user_id,
                                   status=JoinRequestStatus.PENDING.value,
                                   requested_at=datetime.now(UTC))
        self._session.add(request)
        self._session.flush()
        return request

    def resolve_join_request(self, request: GroupJoinRequest, status: JoinRequestStatus,
                             resolver_id: UUID, note: str | None) -> GroupJoinRequest:
        request.status = status.value
        request.resolved_by = resolver_id
        request.resolved_at = datetime.now(UTC)
        request.resolution_note = note
        self._session.flush()
        return request

    def remove_member(self, member: GroupMember, remover_id: UUID) -> GroupMember:
        member.status = MembershipStatus.REMOVED.value
        member.ended_at = datetime.now(UTC)
        member.removed_by = remover_id
        self._session.flush()
        return member

    def check_discipline_exists(self, discipline_id: UUID) -> bool:
        return self._session.get(Subject, discipline_id) is not None

    def check_offering_belongs_to_discipline(self, offering_id: UUID,
                                             discipline_id: UUID) -> bool:
        section = self._session.get(ClassSection, offering_id)
        return section is not None and section.subject_id == discipline_id

    # --- TASK #112: Implementação de Tópicos, Plano de Aulas e Cronograma ---

    def create_group_topic(self, group_id: UUID, data: GroupTopicCreate) -> GroupTopic:
        group = self._session.scalar(select(StudyGroup).where(StudyGroup.id == group_id).with_for_update())
        if data.subject_topic_id is not None:
            catalog_topic = self._session.get(SubjectTopic, data.subject_topic_id)
            if catalog_topic is None or catalog_topic.subject_id != group.subject_id:
                raise CommunityError("Assunto inválido para a disciplina do grupo.", 422)
            existing = self._session.scalar(select(GroupTopic.id).where(
                GroupTopic.group_id == group_id, GroupTopic.subject_topic_id == data.subject_topic_id))
            if existing is not None:
                raise CommunityError("Esse assunto já está no grupo.", 409)
        topic = GroupTopic(
            subject_id=group.subject_id,
            id=uuid4(),
            group_id=group_id,
            subject_topic_id=data.subject_topic_id,
            custom_title=data.custom_title,
            created_at=datetime.now(UTC),
        )
        self._session.add(topic)
        self._session.flush()
        return topic

    def list_group_topics(self, group_id: UUID) -> list[tuple[GroupTopic, str | None]]:
        stmt = (select(GroupTopic, Topic.name)
                .outerjoin(SubjectTopic, SubjectTopic.id == GroupTopic.subject_topic_id)
                .outerjoin(Topic, Topic.id == SubjectTopic.topic_id)
                .where(GroupTopic.group_id == group_id)
                .order_by(GroupTopic.created_at))
        return [(topic, name) for topic, name in self._session.execute(stmt)]

    def create_teaching_plan(self, group_id: UUID, creator_id: UUID, data: TeachingPlanCreate) -> TeachingPlan:
        # Serialize version allocation, publication and lesson edits per group.
        self._session.execute(select(StudyGroup.id).where(StudyGroup.id == group_id).with_for_update())
        latest = self.find_latest_teaching_plan(group_id)
        next_version = (latest.version + 1) if latest else 1

        plan = TeachingPlan(
            id=uuid4(),
            group_id=group_id,
            version=next_version,
            creator_id=creator_id,
            source_file_id=data.source_file_id,
            created_at=datetime.now(UTC),
        )
        self._session.add(plan)
        self._session.flush()

        for lesson_data in data.lessons:
            self.create_scheduled_lesson(group_id=group_id, plan_id=plan.id, data=lesson_data)

        return plan

    def find_latest_teaching_plan(self, group_id: UUID) -> TeachingPlan | None:
        stmt = (
            select(TeachingPlan)
            .where(TeachingPlan.group_id == group_id)
            .order_by(TeachingPlan.version.desc())
            .limit(1)
        )
        return self._session.execute(stmt).scalar_one_or_none()

    def find_teaching_plan_by_id(self, plan_id: UUID) -> TeachingPlan | None:
        return self._session.get(TeachingPlan, plan_id)

    def create_scheduled_lesson(self, group_id: UUID, plan_id: UUID, data: ScheduledLessonCreate) -> ScheduledLesson:
        self._ensure_draft(group_id, plan_id)
        self._validate_topic_ids(group_id, data.topic_ids)
        lesson = ScheduledLesson(
            id=uuid4(),
            group_id=group_id,
            plan_id=plan_id,
            title=data.title,
            description=data.description,
            scheduled_at=data.scheduled_at.astimezone(UTC),
            created_at=datetime.now(UTC),
        )
        self._session.add(lesson)
        self._session.flush()

        for topic_id in data.topic_ids:
            self._session.add(
                ScheduledLessonTopic(
                    lesson_id=lesson.id,
                    group_topic_id=topic_id,
                    group_id=lesson.group_id,
                )
            )
        self._session.flush()
        return lesson

    def list_scheduled_lessons(self, group_id: UUID, plan_id: UUID | None = None) -> list[tuple[ScheduledLesson, list[UUID]]]:
        stmt = select(ScheduledLesson).where(ScheduledLesson.group_id == group_id)
        if plan_id:
            stmt = stmt.where(ScheduledLesson.plan_id == plan_id)
        stmt = stmt.order_by(ScheduledLesson.scheduled_at)

        lessons = list(self._session.scalars(stmt))
        result: list[tuple[ScheduledLesson, list[UUID]]] = []

        for lesson in lessons:
            topic_stmt = select(ScheduledLessonTopic.group_topic_id).where(
                ScheduledLessonTopic.lesson_id == lesson.id
            )
            topic_ids = list(self._session.scalars(topic_stmt))
            result.append((lesson, topic_ids))

        return result

    def find_scheduled_lesson_by_id(self, lesson_id: UUID, lock: bool = False) -> ScheduledLesson | None:
        stmt = select(ScheduledLesson).where(ScheduledLesson.id == lesson_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def update_scheduled_lesson(
        self, lesson: ScheduledLesson, data: ScheduledLessonUpdate,
        allow_published: bool = False,
    ) -> ScheduledLesson:
        if allow_published:
            self._session.execute(
                select(StudyGroup.id).where(StudyGroup.id == lesson.group_id).with_for_update()
            )
            lesson = self.find_scheduled_lesson_by_id(lesson.id, lock=True) or lesson
        else:
            self._ensure_draft(lesson.group_id, lesson.plan_id)
        if data.topic_ids is not None:
            self._validate_topic_ids(lesson.group_id, data.topic_ids)
        if data.title is not None:
            lesson.title = data.title
        if "description" in data.model_fields_set:
            lesson.description = data.description
        if data.scheduled_at is not None:
            lesson.scheduled_at = data.scheduled_at.astimezone(UTC)

        if data.topic_ids is not None:
            self._session.query(ScheduledLessonTopic).filter(
                ScheduledLessonTopic.lesson_id == lesson.id
            ).delete()
            for topic_id in data.topic_ids:
                self._session.add(
                    ScheduledLessonTopic(
                        lesson_id=lesson.id,
                        group_topic_id=topic_id,
                        group_id=lesson.group_id,
                    )
                )

        self._session.flush()
        return lesson

    def delete_scheduled_lesson(self, lesson: ScheduledLesson) -> None:
        self._ensure_draft(lesson.group_id, lesson.plan_id)
        self._session.delete(lesson)
        self._session.flush()

    def _ensure_draft(self, group_id: UUID, plan_id: UUID) -> TeachingPlan:
        self._session.execute(select(StudyGroup.id).where(StudyGroup.id == group_id).with_for_update())
        plan = self._session.get(TeachingPlan, plan_id, populate_existing=True)
        if plan is None or plan.group_id != group_id:
            raise CommunityError("Plano não encontrado.", 404)
        if plan.status != "draft":
            raise CommunityError("Plano publicado não pode ser alterado. Crie uma nova versão.", 409)
        return plan

    def _validate_topic_ids(self, group_id: UUID, topic_ids: list[UUID]) -> None:
        if len(topic_ids) != len(set(topic_ids)):
            raise CommunityError("Não repita assuntos na mesma aula.", 422)
        found = set(self._session.scalars(select(GroupTopic.id).where(
            GroupTopic.group_id == group_id, GroupTopic.id.in_(topic_ids))))
        if found != set(topic_ids):
            raise CommunityError("Os assuntos devem pertencer ao grupo da aula.", 422)

    def list_teaching_plans(self, group_id: UUID, offset: int, limit: int) -> list[TeachingPlan]:
        return list(self._session.scalars(select(TeachingPlan).where(
            TeachingPlan.group_id == group_id).order_by(TeachingPlan.version.desc()).offset(offset).limit(limit)))

    def find_published_teaching_plan(self, group_id: UUID) -> TeachingPlan | None:
        return self._session.scalar(select(TeachingPlan).where(
            TeachingPlan.group_id == group_id, TeachingPlan.status == "published"))

    def publish_teaching_plan(self, group_id: UUID, plan_id: UUID, user_id: UUID) -> TeachingPlan:
        plan = self._ensure_draft(group_id, plan_id)
        current = self.find_published_teaching_plan(group_id)
        if current:
            if current.version >= plan.version:
                raise CommunityError("Publique uma versão mais recente que a vigente.", 409)
            current.status = "archived"
            self._session.flush()
        plan.status = "published"
        plan.published_by = user_id
        plan.published_at = datetime.now(UTC)
        self._session.flush()
        return plan

    def replace_draft(self, group_id: UUID, plan_id: UUID, data: TeachingPlanCreate) -> TeachingPlan:
        plan = self._ensure_draft(group_id, plan_id)
        for lesson in list(self._session.scalars(select(ScheduledLesson).where(ScheduledLesson.plan_id == plan_id))):
            self._session.delete(lesson)
        self._session.flush()
        for lesson in data.lessons:
            self.create_scheduled_lesson(group_id, plan_id, lesson)
        return plan

    def list_user_lessons(self, user_id: UUID, start: datetime | None, end: datetime | None,
                          period: str | None, offset: int, limit: int):
        stmt = (select(ScheduledLesson).join(TeachingPlan, TeachingPlan.id == ScheduledLesson.plan_id)
            .join(StudyGroup, StudyGroup.id == ScheduledLesson.group_id)
            .join(GroupMember, GroupMember.group_id == StudyGroup.id)
            .where(GroupMember.user_id == user_id, GroupMember.status == MembershipStatus.ACTIVE.value,
                   StudyGroup.deleted_at.is_(None), TeachingPlan.status == "published"))
        if start is not None:
            stmt = stmt.where(ScheduledLesson.scheduled_at >= start)
        if end is not None:
            stmt = stmt.where(ScheduledLesson.scheduled_at < end)
        now = datetime.now(UTC)
        if period == "past":
            stmt = stmt.where(ScheduledLesson.scheduled_at < now)
        elif period == "future":
            stmt = stmt.where(ScheduledLesson.scheduled_at >= now)
        lessons = list(self._session.scalars(stmt.order_by(ScheduledLesson.scheduled_at, ScheduledLesson.id).offset(offset).limit(limit)))
        return [(lesson, list(self._session.scalars(select(ScheduledLessonTopic.group_topic_id).where(
            ScheduledLessonTopic.lesson_id == lesson.id)))) for lesson in lessons]

    def create_lesson_occurrence(
        self, group_id: UUID, recorded_by: UUID, data: LessonOccurrenceCreate
    ) -> tuple[LessonOccurrence, list[UUID]]:
        self._session.execute(
            select(StudyGroup.id).where(StudyGroup.id == group_id).with_for_update()
        )
        if not self.is_active_organizer(group_id, recorded_by):
            raise CommunityError("Apenas organizadores podem registrar ocorrência de aula.", 403)

        now = datetime.now(UTC)
        if data.status == "held":
            if data.actual_ended_at is None or data.actual_ended_at > now:
                raise CommunityError("Aulas futuras ou em andamento não podem ser registradas como realizadas.", 422)

        prev: LessonOccurrence | None = None
        if data.supersedes_occurrence_id:
            prev = self._session.scalar(
                select(LessonOccurrence)
                .where(LessonOccurrence.id == data.supersedes_occurrence_id)
                .with_for_update()
            )
            if not prev or prev.group_id != group_id:
                raise CommunityError("A ocorrência a ser corrigida não pertence a este grupo.", 422)
            already_superseded = self._session.scalar(
                select(LessonOccurrence.id).where(
                    LessonOccurrence.supersedes_occurrence_id == prev.id
                )
            )
            if already_superseded:
                raise CommunityError("Esta ocorrência já foi retificada.", 409)

        scheduled_lesson_id = data.scheduled_lesson_id
        if scheduled_lesson_id is None and prev is not None:
            scheduled_lesson_id = prev.scheduled_lesson_id

        if scheduled_lesson_id:
            lesson = self._session.get(ScheduledLesson, scheduled_lesson_id)
            if not lesson or lesson.group_id != group_id:
                raise CommunityError("A aula informada não pertence ao grupo.", 422)

        effective_topic_ids = data.topic_ids
        if effective_topic_ids is None and scheduled_lesson_id:
            effective_topic_ids = list(
                self._session.scalars(
                    select(ScheduledLessonTopic.group_topic_id).where(
                        ScheduledLessonTopic.lesson_id == scheduled_lesson_id
                    )
                )
            )
        elif effective_topic_ids is None and prev is not None:
            effective_topic_ids = list(
                self._session.scalars(
                    select(OccurrenceTopic.group_topic_id).where(
                        OccurrenceTopic.lesson_occurrence_id == prev.id
                    )
                )
            )

        if effective_topic_ids:
            self._validate_topic_ids(group_id, effective_topic_ids)

        occurrence = LessonOccurrence(
            group_id=group_id,
            scheduled_lesson_id=scheduled_lesson_id,
            supersedes_occurrence_id=data.supersedes_occurrence_id,
            status=LessonOccurrenceStatus(data.status),
            actual_started_at=data.actual_started_at,
            actual_ended_at=data.actual_ended_at,
            rescheduled_to=data.rescheduled_to,
            notes=data.notes,
            recorded_by=recorded_by,
        )
        self._session.add(occurrence)
        self._session.flush()

        saved_topic_ids: list[UUID] = []
        if effective_topic_ids:
            for t_id in effective_topic_ids:
                gt = self._session.get(GroupTopic, t_id)
                self._session.add(
                    OccurrenceTopic(
                        lesson_occurrence_id=occurrence.id,
                        group_topic_id=t_id,
                        subject_topic_id=gt.subject_topic_id if gt else None,
                    )
                )
                saved_topic_ids.append(t_id)
            self._session.flush()

        if data.supersedes_occurrence_id:
            prev_attendances = list(
                self._session.scalars(
                    select(StudentLessonAttendance).where(
                        StudentLessonAttendance.lesson_occurrence_id == data.supersedes_occurrence_id
                    )
                )
            )
            for prev_att in prev_attendances:
                if occurrence.status == LessonOccurrenceStatus.HELD:
                    existing = self._session.get(
                        StudentLessonAttendance, (prev_att.user_id, occurrence.id)
                    )
                    if existing:
                        outcome = AttendanceAdjustmentOutcome.KEPT_EXISTING
                    else:
                        outcome = AttendanceAdjustmentOutcome.TRANSFERRED
                        self._session.add(
                            StudentLessonAttendance(
                                user_id=prev_att.user_id,
                                lesson_occurrence_id=occurrence.id,
                                occurrence_status=LessonOccurrenceStatus.HELD,
                                status=prev_att.status,
                                notes=prev_att.notes,
                            )
                        )
                    self._session.add(
                        StudentAttendanceAdjustment(
                            user_id=prev_att.user_id,
                            source_occurrence_id=prev_att.lesson_occurrence_id,
                            target_occurrence_id=occurrence.id,
                            target_status=occurrence.status,
                            outcome=outcome,
                            previous_status=prev_att.status,
                            previous_notes=prev_att.notes,
                        )
                    )
                else:
                    self._session.add(
                        StudentAttendanceAdjustment(
                            user_id=prev_att.user_id,
                            source_occurrence_id=prev_att.lesson_occurrence_id,
                            target_occurrence_id=occurrence.id,
                            target_status=occurrence.status,
                            outcome=AttendanceAdjustmentOutcome.INVALIDATED,
                            previous_status=prev_att.status,
                            previous_notes=prev_att.notes,
                        )
                    )
            self._session.flush()

        return (occurrence, saved_topic_ids)

    def list_lesson_occurrences(
        self, group_id: UUID, current_only: bool = True, scheduled_lesson_id: UUID | None = None
    ) -> list[tuple[LessonOccurrence, list[UUID]]]:
        stmt = select(LessonOccurrence).where(LessonOccurrence.group_id == group_id)
        if current_only:
            successor_alias = LessonOccurrence.__table__.alias("successor")
            stmt = stmt.where(
                ~exists(
                    select(1).select_from(successor_alias).where(
                        successor_alias.c.supersedes_occurrence_id == LessonOccurrence.id
                    )
                )
            )
        if scheduled_lesson_id:
            stmt = stmt.where(LessonOccurrence.scheduled_lesson_id == scheduled_lesson_id)
        stmt = stmt.order_by(LessonOccurrence.created_at.desc())
        occurrences = list(self._session.scalars(stmt))
        result = []
        for occ in occurrences:
            topic_ids = list(
                self._session.scalars(
                    select(OccurrenceTopic.group_topic_id).where(
                        OccurrenceTopic.lesson_occurrence_id == occ.id
                    )
                )
            )
            result.append((occ, topic_ids))
        return result

    def find_lesson_occurrence_by_id(
        self, occurrence_id: UUID
    ) -> tuple[LessonOccurrence, list[UUID]] | None:
        occ = self._session.get(LessonOccurrence, occurrence_id)
        if not occ:
            return None
        topic_ids = list(
            self._session.scalars(
                select(OccurrenceTopic.group_topic_id).where(
                    OccurrenceTopic.lesson_occurrence_id == occ.id
                )
            )
        )
        return (occ, topic_ids)

    def record_student_attendance(
        self, user_id: UUID, occurrence_id: UUID, status: str, notes: str | None
    ) -> tuple[StudentLessonAttendance, UUID]:
        occ = self._session.get(LessonOccurrence, occurrence_id)
        if not occ:
            raise CommunityError("Ocorrência não encontrada.", 404)
        if not self.is_active_member(occ.group_id, user_id):
            raise CommunityError("Apenas participantes ativos podem registrar presença.", 403)
        if occ.status != LessonOccurrenceStatus.HELD or occ.actual_ended_at is None:
            raise CommunityError("Apenas aulas realizadas podem receber frequência.", 422)

        now = datetime.now(UTC)
        if occ.actual_ended_at > now:
            raise CommunityError("Aulas em andamento ou futuras não podem receber frequência.", 422)

        is_superseded = self._session.scalar(
            select(1).where(LessonOccurrence.supersedes_occurrence_id == occ.id)
        )
        if is_superseded:
            raise CommunityError("Não é permitido registrar presença em aula superada por retificação.", 422)

        att = self._session.get(StudentLessonAttendance, (user_id, occ.id))
        if att:
            att.status = AttendanceStatus(status)
            att.notes = notes
            att.updated_at = now
        else:
            att = StudentLessonAttendance(
                user_id=user_id,
                lesson_occurrence_id=occ.id,
                occurrence_status=LessonOccurrenceStatus.HELD,
                status=AttendanceStatus(status),
                notes=notes,
                updated_at=now,
            )
            self._session.add(att)
        self._session.flush()
        return (att, occ.group_id)

    def delete_student_attendance(self, user_id: UUID, occurrence_id: UUID) -> None:
        occ = self._session.get(LessonOccurrence, occurrence_id)
        if not occ:
            raise CommunityError("Ocorrência não encontrada.", 404)
        if not self.is_active_member(occ.group_id, user_id):
            raise CommunityError("Apenas participantes ativos podem remover presença.", 403)
        att = self._session.get(StudentLessonAttendance, (user_id, occ.id))
        if att:
            self._session.delete(att)
            self._session.flush()

    def list_student_attendance(
        self, user_id: UUID, group_id: UUID | None = None
    ) -> list[tuple[StudentLessonAttendance, UUID]]:
        successor_alias = LessonOccurrence.__table__.alias("successor")
        stmt = (
            select(StudentLessonAttendance, LessonOccurrence.group_id)
            .join(LessonOccurrence, LessonOccurrence.id == StudentLessonAttendance.lesson_occurrence_id)
            .join(
                GroupMember,
                (GroupMember.group_id == LessonOccurrence.group_id)
                & (GroupMember.user_id == user_id)
                & (GroupMember.status == MembershipStatus.ACTIVE.value),
            )
            .where(
                StudentLessonAttendance.user_id == user_id,
                LessonOccurrence.status == LessonOccurrenceStatus.HELD,
                ~exists(
                    select(1).select_from(successor_alias).where(
                        successor_alias.c.supersedes_occurrence_id == LessonOccurrence.id
                    )
                ),
            )
        )
        if group_id:
            stmt = stmt.where(LessonOccurrence.group_id == group_id)
        return list(self._session.execute(stmt).all())

    def update_topic_progress(
        self, user_id: UUID, group_topic_id: UUID, status: str, notes: str | None
    ) -> tuple[StudentTopicProgress, UUID]:
        gt = self._session.get(GroupTopic, group_topic_id)
        if not gt:
            raise CommunityError("Tópico não encontrado.", 404)
        if not self.is_active_member(gt.group_id, user_id):
            raise CommunityError("Apenas participantes ativos podem atualizar o progresso de tópicos.", 403)

        prog = self._session.get(StudentTopicProgress, (user_id, group_topic_id))
        now = datetime.now(UTC)
        if prog:
            prog.status = TopicProgressStatus(status)
            prog.notes = notes
            prog.updated_at = now
        else:
            prog = StudentTopicProgress(
                user_id=user_id,
                group_topic_id=group_topic_id,
                status=TopicProgressStatus(status),
                notes=notes,
                updated_at=now,
            )
            self._session.add(prog)
        self._session.flush()
        return (prog, gt.group_id)

    def list_topic_progress(
        self, user_id: UUID, group_id: UUID | None = None
    ) -> list[tuple[StudentTopicProgress, UUID]]:
        stmt = (
            select(StudentTopicProgress, GroupTopic.group_id)
            .join(GroupTopic, GroupTopic.id == StudentTopicProgress.group_topic_id)
            .join(
                GroupMember,
                (GroupMember.group_id == GroupTopic.group_id)
                & (GroupMember.user_id == user_id)
                & (GroupMember.status == MembershipStatus.ACTIVE.value),
            )
            .where(StudentTopicProgress.user_id == user_id)
        )
        if group_id:
            stmt = stmt.where(GroupTopic.group_id == group_id)
        return list(self._session.execute(stmt).all())

    def list_student_adjustments(
        self, user_id: UUID, unread_only: bool = False
    ) -> list[StudentAttendanceAdjustment]:
        stmt = select(StudentAttendanceAdjustment).where(
            StudentAttendanceAdjustment.user_id == user_id
        )
        if unread_only:
            stmt = stmt.where(StudentAttendanceAdjustment.notice_seen_at.is_(None))
        stmt = stmt.order_by(StudentAttendanceAdjustment.created_at.desc())
        return list(self._session.scalars(stmt))

    def mark_adjustment_seen(
        self, user_id: UUID, adjustment_id: UUID
    ) -> StudentAttendanceAdjustment:
        adj = self._session.get(StudentAttendanceAdjustment, adjustment_id)
        if not adj or adj.user_id != user_id:
            raise CommunityError("Aviso não encontrado.", 404)
        adj.notice_seen_at = datetime.now(UTC)
        self._session.flush()
        return adj

    # --- TASK #120: Implementação de canais ---

    def list_channels(self, group_id: UUID) -> list[Channel]:
        stmt = (
            select(Channel)
            .where(Channel.group_id == group_id)
            .order_by(Channel.created_at)
        )
        return list(self._session.scalars(stmt))

    def create_channel(self, group_id: UUID, created_by: UUID, data: ChannelCreate) -> Channel:
        if data.group_topic_id is not None:
            topic = self._session.get(GroupTopic, data.group_topic_id)
            if topic is None or topic.group_id != group_id:
                raise CommunityError("Escolha um assunto pertencente a este grupo.", 422)
        existing = self._session.scalar(
            select(Channel.id).where(
                Channel.group_id == group_id,
                Channel.name == data.name,
            )
        )
        if existing is not None:
            raise CommunityError(
                f"Já existe um canal com o nome '{data.name}' neste grupo.", 409
            )
        channel = Channel(
            id=uuid4(),
            group_id=group_id,
            group_topic_id=data.group_topic_id,
            name=data.name,
            description=data.description,
            created_by=created_by,
            status=ChannelStatus.ACTIVE.value,
            created_at=datetime.now(UTC),
        )
        self._session.add(channel)
        self._flush_channel()
        return channel

    def find_channel_by_id(self, channel_id: UUID, lock: bool = False) -> Channel | None:
        stmt = select(Channel).where(Channel.id == channel_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def update_channel(self, channel: Channel, data: ChannelUpdate) -> Channel:
        if channel.status == ChannelStatus.ARCHIVED:
            raise CommunityError("Canais arquivados não podem ser alterados.", 409)
        if data.name is not None and data.name != channel.name:
            existing = self._session.scalar(
                select(Channel.id).where(
                    Channel.group_id == channel.group_id,
                    Channel.name == data.name,
                    Channel.id != channel.id,
                )
            )
            if existing is not None:
                raise CommunityError(
                    f"Já existe um canal com o nome '{data.name}' neste grupo.", 409
                )
            channel.name = data.name
        if "description" in data.model_fields_set:
            channel.description = data.description
        self._flush_channel()
        return channel

    def archive_channel(self, channel: Channel) -> Channel:
        if channel.status == ChannelStatus.ARCHIVED.value:
            raise CommunityError("Canal já está arquivado.", 409)
        channel.status = ChannelStatus.ARCHIVED.value
        channel.archived_at = datetime.now(UTC)
        self._flush_channel()
        return channel

    def channel_topic_name(self, channel: Channel) -> str | None:
        if channel.group_topic_id is None:
            return None
        return self._session.scalar(
            select(func.coalesce(GroupTopic.custom_title, Topic.name))
            .outerjoin(SubjectTopic, SubjectTopic.id == GroupTopic.subject_topic_id)
            .outerjoin(Topic, Topic.id == SubjectTopic.topic_id)
            .where(GroupTopic.id == channel.group_topic_id)
        )

    def list_channel_messages(
        self, channel_id: UUID, offset: int, limit: int
    ) -> list[ChannelMessageRecord]:
        author_profile = aliased(UserProfile)
        reply_message = aliased(ChannelMessage)
        reply_profile = aliased(UserProfile)
        stmt = (
            select(
                ChannelMessage,
                author_profile.display_name,
                reply_profile.display_name,
                reply_message.content,
                reply_message.deleted_at,
            )
            .outerjoin(
                author_profile,
                author_profile.user_id == ChannelMessage.author_id,
            )
            .outerjoin(
                reply_message,
                reply_message.id == ChannelMessage.reply_to_message_id,
            )
            .outerjoin(
                reply_profile,
                reply_profile.user_id == reply_message.author_id,
            )
            .where(ChannelMessage.channel_id == channel_id)
            .order_by(ChannelMessage.created_at.desc(), ChannelMessage.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return [
            ChannelMessageRecord(
                message=message,
                author_name=author_name or "Estudante",
                reply_author_name=(
                    reply_author_name or "Estudante"
                    if message.reply_to_message_id is not None
                    else None
                ),
                reply_content=reply_content,
                reply_deleted_at=reply_deleted_at,
            )
            for (
                message,
                author_name,
                reply_author_name,
                reply_content,
                reply_deleted_at,
            ) in self._session.execute(stmt)
        ]

    def create_channel_message(
        self,
        channel_id: UUID,
        author_id: UUID,
        content: str,
        reply_to_message_id: UUID | None,
    ) -> ChannelMessage:
        message = ChannelMessage(
            id=uuid4(),
            channel_id=channel_id,
            author_id=author_id,
            reply_to_message_id=reply_to_message_id,
            content=content,
            created_at=datetime.now(UTC),
        )
        self._session.add(message)
        self._session.flush()
        return message

    def find_channel_message_by_id(
        self, message_id: UUID, lock: bool = False
    ) -> ChannelMessage | None:
        stmt = select(ChannelMessage).where(ChannelMessage.id == message_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def find_channel_message_record(
        self, message_id: UUID
    ) -> ChannelMessageRecord | None:
        author_profile = aliased(UserProfile)
        reply_message = aliased(ChannelMessage)
        reply_profile = aliased(UserProfile)
        stmt = (
            select(
                ChannelMessage,
                author_profile.display_name,
                reply_profile.display_name,
                reply_message.content,
                reply_message.deleted_at,
            )
            .outerjoin(
                author_profile,
                author_profile.user_id == ChannelMessage.author_id,
            )
            .outerjoin(
                reply_message,
                reply_message.id == ChannelMessage.reply_to_message_id,
            )
            .outerjoin(
                reply_profile,
                reply_profile.user_id == reply_message.author_id,
            )
            .where(ChannelMessage.id == message_id)
        )
        row = self._session.execute(stmt).one_or_none()
        if row is None:
            return None
        message, author_name, reply_author_name, reply_content, reply_deleted_at = row
        return ChannelMessageRecord(
            message=message,
            author_name=author_name or "Estudante",
            reply_author_name=(
                reply_author_name or "Estudante"
                if message.reply_to_message_id is not None
                else None
            ),
            reply_content=reply_content,
            reply_deleted_at=reply_deleted_at,
        )

    def update_channel_message(
        self, message: ChannelMessage, content: str
    ) -> ChannelMessage:
        message.content = content
        message.edited_at = datetime.now(UTC)
        self._session.flush()
        return message

    def soft_delete_channel_message(
        self, message: ChannelMessage
    ) -> ChannelMessage:
        message.deleted_at = datetime.now(UTC)
        self._session.flush()
        return message

    def _flush_channel(self) -> None:
        try:
            self._session.flush()
        except IntegrityError as exc:
            if getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "uq_channels_group_name":
                raise CommunityError("Já existe um canal com este nome no grupo.", 409) from None
            raise


class SqlAlchemyCommunityUnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self._session: Session | None = None
        self.community: CommunityRepository | None = None

    def __enter__(self) -> Self:
        self._session = self._session_factory()
        self.community = SqlAlchemyCommunityRepository(self._session)
        return self

    def __exit__(self, exc_type: type[BaseException] | None,
                  exc_value: BaseException | None,
                  traceback: TracebackType | None) -> None:
        if self._session is None:
            return
        database_failure = isinstance(exc_value, SQLAlchemyError)
        if self._session.in_transaction():
            self._session.rollback()
        self._session.close()
        self._session = None
        if database_failure:
            raise CommunityPersistenceError() from None

    def commit(self) -> None:
        if self._session is None:
            raise RuntimeError("Unidade de trabalho não iniciada.")
        try:
            self._session.commit()
        except SQLAlchemyError:
            self._session.rollback()
            raise CommunityPersistenceError() from None

    def rollback(self) -> None:
        if self._session is not None:
            self._session.rollback()
