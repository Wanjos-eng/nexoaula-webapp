from dataclasses import dataclass
from datetime import UTC, datetime
from types import TracebackType
from typing import Any, Protocol, Self
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.modules.academic.models import AcademicTerm, ClassSection, Subject
from app.modules.community.errors import CommunityError, CommunityPersistenceError
from app.modules.community.models import (
    GroupJoinRequest,
    GroupMember,
    GroupStatus,
    GroupTopic,
    GroupVisibility,
    JoinRequestStatus,
    MembershipRole,
    MembershipStatus,
    ScheduledLesson,
    ScheduledLessonTopic,
    StudyGroup,
    SubjectTopic,
    TeachingPlan,
)
from app.modules.community.schemas import (
    GroupCreate,
    GroupTopicCreate,
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
                             limit: int) -> list[GroupDiscoveryRecord]: ...
    def create_group(self, owner_id: UUID, data: GroupCreate) -> StudyGroup: ...
    def update_group(self, group: StudyGroup, updates: dict[str, Any]) -> StudyGroup: ...
    def activate_member(self, group_id: UUID, user_id: UUID) -> GroupMember: ...
    def create_join_request(self, group_id: UUID, user_id: UUID) -> GroupJoinRequest: ...
    def resolve_join_request(self, request: GroupJoinRequest, status: JoinRequestStatus,
                             resolver_id: UUID, note: str | None) -> GroupJoinRequest: ...
    def remove_member(self, member: GroupMember, remover_id: UUID) -> GroupMember: ...
    def check_discipline_exists(self, discipline_id: UUID) -> bool: ...
    def check_offering_belongs_to_discipline(self, offering_id: UUID,
                                             discipline_id: UUID) -> bool: ...

    # --- TASK #112: Tópicos, Plano de Aulas e Cronograma ---
    def create_group_topic(self, group_id: UUID, data: GroupTopicCreate) -> GroupTopic: ...
    def list_group_topics(self, group_id: UUID) -> list[GroupTopic]: ...
    def create_teaching_plan(self, group_id: UUID, creator_id: UUID, data: TeachingPlanCreate) -> TeachingPlan: ...
    def find_latest_teaching_plan(self, group_id: UUID) -> TeachingPlan | None: ...
    def find_teaching_plan_by_id(self, plan_id: UUID) -> TeachingPlan | None: ...
    def create_scheduled_lesson(self, group_id: UUID, plan_id: UUID, data: ScheduledLessonCreate) -> ScheduledLesson: ...
    def list_scheduled_lessons(self, group_id: UUID, plan_id: UUID | None = None) -> list[tuple[ScheduledLesson, list[UUID]]]: ...
    def find_scheduled_lesson_by_id(self, lesson_id: UUID) -> ScheduledLesson | None: ...
    def update_scheduled_lesson(self, lesson: ScheduledLesson, data: ScheduledLessonUpdate) -> ScheduledLesson: ...
    def delete_scheduled_lesson(self, lesson: ScheduledLesson) -> None: ...

    def list_teaching_plans(self, group_id: UUID, offset: int, limit: int) -> list[TeachingPlan]: ...
    def find_published_teaching_plan(self, group_id: UUID) -> TeachingPlan | None: ...
    def publish_teaching_plan(self, group_id: UUID, plan_id: UUID, user_id: UUID) -> TeachingPlan: ...
    def replace_draft(self, group_id: UUID, plan_id: UUID, data: TeachingPlanCreate) -> TeachingPlan: ...
    def list_user_lessons(self, user_id: UUID, start: datetime | None, end: datetime | None,
                         period: str | None, offset: int, limit: int) -> list[tuple[ScheduledLesson, list[UUID]]]: ...


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
                             limit: int) -> list[GroupDiscoveryRecord]:
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
            stmt = stmt.where(or_(StudyGroup.name.ilike(pattern, escape="\\"),
                                  StudyGroup.description.ilike(pattern, escape="\\")))
        rows = self._session.execute(stmt.offset(offset).limit(limit)).all()
        return [GroupDiscoveryRecord(group, subject_name, subject_code, term_label)
                for group, subject_name, subject_code, term_label in rows]

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

    def list_group_topics(self, group_id: UUID) -> list[GroupTopic]:
        stmt = select(GroupTopic).where(GroupTopic.group_id == group_id).order_by(GroupTopic.created_at)
        return list(self._session.scalars(stmt))

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

    def find_scheduled_lesson_by_id(self, lesson_id: UUID) -> ScheduledLesson | None:
        return self._session.get(ScheduledLesson, lesson_id)

    def update_scheduled_lesson(self, lesson: ScheduledLesson, data: ScheduledLessonUpdate) -> ScheduledLesson:
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
