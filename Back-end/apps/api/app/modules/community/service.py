from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from app.modules.community.errors import CommunityError
from app.modules.community.models import (
    GroupJoinPolicy,
    GroupMember,
    GroupStatus as ModelGroupStatus,
    GroupVisibility as ModelGroupVisibility,
    JoinRequestStatus,
    LessonOccurrence,
    MembershipRole,
    MembershipStatus,
    ScheduledLesson,
    StudentAttendanceAdjustment,
    StudentLessonAttendance,
    StudentTopicProgress,
    StudyGroup,
    TeachingPlan,
)
from app.modules.community.repository import CommunityUnitOfWork, GroupDiscoveryRecord
from app.modules.community.schemas import (
    AttendanceAdjustmentResponse,
    GroupCreate,
    GroupDiscoveryResponse,
    GroupResponse,
    GroupStatus,
    GroupTopicCreate,
    GroupTopicResponse,
    GroupUpdate,
    GroupVisibility,
    JoinPolicy,
    LessonOccurrenceCreate,
    LessonOccurrenceResponse,
    MembershipAction,
    MembershipActionType,
    MembershipResponse,
    MembershipResultStatus,
    ParticipantResponse,
    ParticipationResponse,
    ScheduledLessonCreate,
    ScheduledLessonResponse,
    ScheduledLessonUpdate,
    StudentAttendanceCreate,
    StudentAttendanceResponse,
    StudentTopicProgressResponse,
    StudentTopicProgressUpdate,
    TeachingPlanCreate,
    TeachingPlanResponse,
)

CommunityUnitOfWorkFactory = Callable[[], CommunityUnitOfWork]


class CommunityService:
    def __init__(self, unit_of_work_factory: CommunityUnitOfWorkFactory) -> None:
        self._uow_factory = unit_of_work_factory

    def list_mine(self, user_id: UUID, offset: int, limit: int) -> list[GroupResponse]:
        with self._uow_factory() as uow:
            return [self._to_response(group, uow.community.find_active_owner_id(group.id) or group.created_by)
                    for group in uow.community.list_mine(user_id, offset, limit)]

    def participation(self, group_id: UUID, user_id: UUID) -> ParticipationResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            member = uow.community.find_member(group_id, user_id)
            active = member is not None and self._value(member.status) == MembershipStatus.ACTIVE.value
            pending = uow.community.find_pending_request(group_id, user_id) is not None
            return ParticipationResponse(status="active" if active else "pending" if pending else "none",
                role=self._value(member.role) if active else None,
                canManage=uow.community.is_active_organizer(group_id, user_id),
                memberCount=uow.community.count_active_members(group_id))

    def list_participants(self, group_id: UUID, user_id: UUID, pending: bool,
                          offset: int, limit: int) -> list[ParticipantResponse]:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar participantes.", 403)
            return uow.community.list_participants(group_id, pending, offset, limit)

    def create_group(self, data: GroupCreate, user_id: UUID) -> GroupResponse:
        with self._uow_factory() as uow:
            if not uow.community.check_discipline_exists(data.discipline_id):
                raise CommunityError("Disciplina acadêmica inválida ou inexistente.", 400)
            if data.offering_id is not None and not uow.community.check_offering_belongs_to_discipline(
                data.offering_id, data.discipline_id
            ):
                raise CommunityError("A turma informada não pertence à disciplina selecionada.", 400)
            group = uow.community.create_group(owner_id=user_id, data=data)
            uow.commit()
            return self._to_response(group, owner_id=user_id)

    def search_groups(self, subject: str | None, period: str | None,
                      topic: str | None, offset: int,
                      limit: int) -> list[GroupDiscoveryResponse]:
        with self._uow_factory() as uow:
            records = uow.community.search_public_groups(subject, period, topic, offset, limit)
            return [self._to_discovery_response(record) for record in records]

    def get_group(self, group_id: UUID, user_id: UUID) -> GroupResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if self._value(group.visibility) == GroupVisibility.PRIVATE.value and not uow.community.is_active_member(
                group_id, user_id
            ):
                raise CommunityError("Grupo não encontrado.", 404)
            owner_id = uow.community.find_active_owner_id(group_id) or group.created_by
            return self._to_response(group, owner_id=owner_id)

    def update_group(self, group_id: UUID, data: GroupUpdate,
                      user_id: UUID) -> GroupResponse:
        updates = data.model_dump(exclude_unset=True)
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            owner_id = uow.community.find_active_owner_id(group_id) or group.created_by
            if user_id != owner_id:
                raise CommunityError("Apenas o proprietário tem permissão para editar o grupo.", 403)
            if updates:
                group = uow.community.update_group(group, updates)
                uow.commit()
            return self._to_response(group, owner_id=owner_id)

    def join_group(self, group_id: UUID, user_id: UUID) -> MembershipResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("Este grupo não aceita novos participantes.", 409)
            if self._value(group.visibility) == ModelGroupVisibility.PRIVATE.value:
                raise CommunityError("Este grupo só aceita participantes por convite.", 403)
            if uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Você já participa deste grupo.", 409)
            if uow.community.find_pending_request(group_id, user_id) is not None:
                raise CommunityError("Já existe uma solicitação pendente para este grupo.", 409)

            policy = self._value(group.join_policy)
            if policy == GroupJoinPolicy.INVITE_ONLY.value:
                raise CommunityError("Este grupo só aceita participantes por convite.", 403)
            if policy == GroupJoinPolicy.OPEN.value:
                self._ensure_capacity(uow.community, group)
                member = uow.community.activate_member(group_id, user_id)
                uow.commit()
                return self._member_response(member, MembershipResultStatus.ACTIVE)

            request = uow.community.create_join_request(group_id, user_id)
            uow.commit()
            return MembershipResponse(group_id=group_id, user_id=user_id,
                                      status=MembershipResultStatus.PENDING,
                                      requested_at=request.requested_at)

    def manage_membership(self, group_id: UUID, organizer_id: UUID,
                          target_user_id: UUID,
                          data: MembershipAction) -> MembershipResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if not uow.community.is_active_organizer(group_id, organizer_id):
                raise CommunityError("Apenas organizadores podem gerenciar participantes.", 403)

            if data.action in (MembershipActionType.APPROVE, MembershipActionType.REJECT):
                request = uow.community.find_pending_request(group_id, target_user_id)
                if request is None:
                    raise CommunityError("Solicitação pendente não encontrada.", 409)
                if data.action == MembershipActionType.APPROVE:
                    self._ensure_capacity(uow.community, group)
                    request = uow.community.resolve_join_request(
                        request, JoinRequestStatus.APPROVED, organizer_id, data.note
                    )
                    member = uow.community.activate_member(group_id, target_user_id)
                    uow.commit()
                    return MembershipResponse(
                        group_id=group_id, user_id=target_user_id,
                        status=MembershipResultStatus.ACTIVE,
                        joined_at=member.joined_at, resolved_at=request.resolved_at,
                    )
                request = uow.community.resolve_join_request(
                    request, JoinRequestStatus.REJECTED, organizer_id, data.note
                )
                uow.commit()
                return MembershipResponse(
                    group_id=group_id, user_id=target_user_id,
                    status=MembershipResultStatus.REJECTED,
                    requested_at=request.requested_at, resolved_at=request.resolved_at,
                )

            member = uow.community.find_member(group_id, target_user_id)
            if member is None or self._value(member.status) != MembershipStatus.ACTIVE.value:
                raise CommunityError("Participante ativo não encontrado.", 409)
            if self._value(member.role) == MembershipRole.OWNER.value:
                raise CommunityError("O proprietário não pode ser removido do próprio grupo.", 409)
            member = uow.community.remove_member(member, organizer_id)
            uow.commit()
            return self._member_response(member, MembershipResultStatus.REMOVED)

    # --- TASK #112: Métodos de Regras de Negócio para Tópicos, Plano de Aulas e Cronograma ---

    def create_topic(self, group_id: UUID, user_id: UUID, data: GroupTopicCreate) -> GroupTopicResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar tópicos.", 403)
            topic = uow.community.create_group_topic(group_id, data)
            uow.commit()
            return GroupTopicResponse.model_validate(topic)

    def list_topics(self, group_id: UUID, user_id: UUID) -> list[GroupTopicResponse]:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros do grupo podem ver os tópicos.", 403)
            topics = uow.community.list_group_topics(group_id)
            return [GroupTopicResponse.model_validate(t) for t in topics]

    def create_teaching_plan(self, group_id: UUID, user_id: UUID, data: TeachingPlanCreate) -> TeachingPlanResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem cadastrar o plano de aulas.", 403)
            plan = uow.community.create_teaching_plan(group_id, creator_id=user_id, data=data)
            uow.commit()
            return self._to_teaching_plan_response(uow, plan)

    def get_latest_teaching_plan(self, group_id: UUID, user_id: UUID) -> TeachingPlanResponse | None:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros podem visualizar o plano de aulas.", 403)
            plan = uow.community.find_latest_teaching_plan(group_id)
            if plan is None:
                return None
            return self._to_teaching_plan_response(uow, plan)

    def create_lesson(self, group_id: UUID, user_id: UUID, data: ScheduledLessonCreate) -> ScheduledLessonResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem agendar aulas.", 403)
            
            plan = uow.community.find_latest_teaching_plan(group_id)
            if plan is None:
                raise CommunityError("É necessário criar um plano de aulas antes de agendar uma aula.", 400)

            lesson = uow.community.create_scheduled_lesson(group_id, plan.id, data)
            uow.commit()
            return ScheduledLessonResponse(
                id=lesson.id,
                group_id=lesson.group_id,
                plan_id=lesson.plan_id,
                title=lesson.title,
                description=lesson.description,
                scheduled_at=lesson.scheduled_at,
                created_at=lesson.created_at,
                topic_ids=data.topic_ids,
            )

    def list_lessons(self, group_id: UUID, user_id: UUID, plan_id: UUID | None = None) -> list[ScheduledLessonResponse]:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros do grupo podem ver as aulas agendadas.", 403)
            if plan_id is None:
                plan = uow.community.find_published_teaching_plan(group_id)
                if plan is None:
                    return []
                plan_id = plan.id
            else:
                plan = uow.community.find_teaching_plan_by_id(plan_id)
                if plan is None or plan.group_id != group_id:
                    raise CommunityError("Plano não encontrado.", 404)
            lessons_data = uow.community.list_scheduled_lessons(group_id, plan_id)
            return [
                ScheduledLessonResponse(
                    id=lesson.id,
                    group_id=lesson.group_id,
                    plan_id=lesson.plan_id,
                    title=lesson.title,
                    description=lesson.description,
                    scheduled_at=lesson.scheduled_at,
                    created_at=lesson.created_at,
                    topic_ids=topic_ids,
                )
                for lesson, topic_ids in lessons_data
            ]

    def update_lesson(
        self, group_id: UUID, lesson_id: UUID, user_id: UUID, data: ScheduledLessonUpdate
    ) -> ScheduledLessonResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem editar aulas.", 403)

            lesson = uow.community.find_scheduled_lesson_by_id(lesson_id)
            if lesson is None or lesson.group_id != group_id:
                raise CommunityError("Aula não encontrada.", 404)

            lesson = uow.community.update_scheduled_lesson(lesson, data)
            uow.commit()

            lessons_data = uow.community.list_scheduled_lessons(group_id, lesson.plan_id)
            topic_ids = next((t_ids for l, t_ids in lessons_data if l.id == lesson_id), [])

            return ScheduledLessonResponse(
                id=lesson.id,
                group_id=lesson.group_id,
                plan_id=lesson.plan_id,
                title=lesson.title,
                description=lesson.description,
                scheduled_at=lesson.scheduled_at,
                created_at=lesson.created_at,
                topic_ids=topic_ids,
            )

    def delete_lesson(self, group_id: UUID, lesson_id: UUID, user_id: UUID) -> None:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem remover aulas.", 403)

            lesson = uow.community.find_scheduled_lesson_by_id(lesson_id)
            if lesson is None or lesson.group_id != group_id:
                raise CommunityError("Aula não encontrada.", 404)

            uow.community.delete_scheduled_lesson(lesson)
            uow.commit()

    def _to_teaching_plan_response(self, uow: CommunityUnitOfWork, plan: TeachingPlan) -> TeachingPlanResponse:
        lessons_data = uow.community.list_scheduled_lessons(plan.group_id, plan.id)
        lessons_responses = [
            ScheduledLessonResponse(
                id=lesson.id,
                group_id=lesson.group_id,
                plan_id=lesson.plan_id,
                title=lesson.title,
                description=lesson.description,
                scheduled_at=lesson.scheduled_at,
                created_at=lesson.created_at,
                topic_ids=topic_ids,
            )
            for lesson, topic_ids in lessons_data
        ]
        return TeachingPlanResponse(
            id=plan.id,
            group_id=plan.group_id,
            version=plan.version,
            status=plan.status,
            published_by=plan.published_by,
            published_at=plan.published_at,
            creator_id=plan.creator_id,
            source_file_id=plan.source_file_id,
            created_at=plan.created_at,
            lessons=lessons_responses,
        )

    def list_plans(self, group_id: UUID, user_id: UUID, offset: int, limit: int):
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros podem visualizar os planos.", 403)
            return [self._to_teaching_plan_response(uow, plan) for plan in
                    uow.community.list_teaching_plans(group_id, offset, limit)]

    def publish_plan(self, group_id: UUID, plan_id: UUID, user_id: UUID):
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem publicar planos.", 403)
            plan = uow.community.publish_teaching_plan(group_id, plan_id, user_id)
            response = self._to_teaching_plan_response(uow, plan)
            uow.commit()
            return response

    def replace_plan(self, group_id: UUID, plan_id: UUID, user_id: UUID, data: TeachingPlanCreate):
        if "lessons" not in data.model_fields_set:
            raise CommunityError("Informe as aulas do rascunho.", 422)
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem editar planos.", 403)
            plan = uow.community.replace_draft(group_id, plan_id, data)
            response = self._to_teaching_plan_response(uow, plan)
            uow.commit()
            return response

    def user_calendar(self, user_id: UUID, start: datetime | None, end: datetime | None,
                      period: str | None, offset: int, limit: int):
        if start is not None and end is not None and end <= start:
            raise CommunityError("O fim do intervalo deve ser posterior ao início.", 422)
        with self._uow_factory() as uow:
            return [ScheduledLessonResponse.model_validate(lesson).model_copy(update={"topic_ids": topics})
                    for lesson, topics in uow.community.list_user_lessons(user_id, start, end, period, offset, limit)]

    def create_occurrence(
        self, group_id: UUID, user_id: UUID, data: LessonOccurrenceCreate
    ) -> LessonOccurrenceResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem registrar ocorrência de aula.", 403)
            occ, topic_ids = uow.community.create_lesson_occurrence(group_id, user_id, data)
            uow.commit()
            return self._to_occurrence_response(occ, topic_ids)

    def list_occurrences(
        self, group_id: UUID, user_id: UUID, current_only: bool = True, scheduled_lesson_id: UUID | None = None
    ) -> list[LessonOccurrenceResponse]:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros podem visualizar ocorrências de aula.", 403)
            occurrences = uow.community.list_lesson_occurrences(
                group_id, current_only=current_only, scheduled_lesson_id=scheduled_lesson_id
            )
            return [self._to_occurrence_response(occ, topic_ids) for occ, topic_ids in occurrences]

    def get_occurrence(
        self, group_id: UUID, occurrence_id: UUID, user_id: UUID
    ) -> LessonOccurrenceResponse:
        self.get_group(group_id, user_id)
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros podem visualizar ocorrências de aula.", 403)
            res = uow.community.find_lesson_occurrence_by_id(occurrence_id)
            if not res or res[0].group_id != group_id:
                raise CommunityError("Ocorrência não encontrada.", 404)
            return self._to_occurrence_response(res[0], res[1])

    def record_attendance(
        self, user_id: UUID, data: StudentAttendanceCreate
    ) -> StudentAttendanceResponse:
        with self._uow_factory() as uow:
            att, group_id = uow.community.record_student_attendance(
                user_id, data.lesson_occurrence_id, data.status, data.notes
            )
            uow.commit()
            return self._to_attendance_response(att, group_id)

    def delete_attendance(self, user_id: UUID, occurrence_id: UUID) -> None:
        with self._uow_factory() as uow:
            uow.community.delete_student_attendance(user_id, occurrence_id)
            uow.commit()

    def list_attendance(
        self, user_id: UUID, group_id: UUID | None = None
    ) -> list[StudentAttendanceResponse]:
        with self._uow_factory() as uow:
            results = uow.community.list_student_attendance(user_id, group_id=group_id)
            return [self._to_attendance_response(att, gid) for att, gid in results]

    def update_topic_progress(
        self, user_id: UUID, group_topic_id: UUID, data: StudentTopicProgressUpdate
    ) -> StudentTopicProgressResponse:
        with self._uow_factory() as uow:
            prog, group_id = uow.community.update_topic_progress(
                user_id, group_topic_id, data.status, data.notes
            )
            uow.commit()
            return self._to_progress_response(prog, group_id)

    def list_topic_progress(
        self, user_id: UUID, group_id: UUID | None = None
    ) -> list[StudentTopicProgressResponse]:
        with self._uow_factory() as uow:
            results = uow.community.list_topic_progress(user_id, group_id=group_id)
            return [self._to_progress_response(prog, gid) for prog, gid in results]

    def list_student_adjustments(
        self, user_id: UUID, unread_only: bool = False
    ) -> list[AttendanceAdjustmentResponse]:
        with self._uow_factory() as uow:
            adjustments = uow.community.list_student_adjustments(user_id, unread_only=unread_only)
            return [self._to_adjustment_response(adj) for adj in adjustments]

    def mark_adjustment_seen(
        self, user_id: UUID, adjustment_id: UUID
    ) -> AttendanceAdjustmentResponse:
        with self._uow_factory() as uow:
            adj = uow.community.mark_adjustment_seen(user_id, adjustment_id)
            uow.commit()
            return self._to_adjustment_response(adj)

    @classmethod
    def _to_occurrence_response(
        cls, occ: LessonOccurrence, topic_ids: list[UUID]
    ) -> LessonOccurrenceResponse:
        return LessonOccurrenceResponse(
            id=occ.id,
            group_id=occ.group_id,
            scheduled_lesson_id=occ.scheduled_lesson_id,
            supersedes_occurrence_id=occ.supersedes_occurrence_id,
            status=cls._value(occ.status),
            actual_started_at=occ.actual_started_at,
            actual_ended_at=occ.actual_ended_at,
            rescheduled_to=occ.rescheduled_to,
            notes=occ.notes,
            recorded_by=occ.recorded_by,
            created_at=occ.created_at,
            topic_ids=topic_ids,
        )

    @classmethod
    def _to_attendance_response(
        cls, att: StudentLessonAttendance, group_id: UUID
    ) -> StudentAttendanceResponse:
        return StudentAttendanceResponse(
            lesson_occurrence_id=att.lesson_occurrence_id,
            group_id=group_id,
            status=cls._value(att.status),
            notes=att.notes,
            updated_at=att.updated_at,
        )

    @classmethod
    def _to_progress_response(
        cls, prog: StudentTopicProgress, group_id: UUID
    ) -> StudentTopicProgressResponse:
        return StudentTopicProgressResponse(
            group_topic_id=prog.group_topic_id,
            group_id=group_id,
            status=cls._value(prog.status),
            notes=prog.notes,
            updated_at=prog.updated_at,
        )

    @classmethod
    def _to_adjustment_response(
        cls, adj: StudentAttendanceAdjustment
    ) -> AttendanceAdjustmentResponse:
        return AttendanceAdjustmentResponse(
            id=adj.id,
            user_id=adj.user_id,
            source_occurrence_id=adj.source_occurrence_id,
            target_occurrence_id=adj.target_occurrence_id,
            target_status=cls._value(adj.target_status),
            outcome=cls._value(adj.outcome),
            previous_status=cls._value(adj.previous_status),
            previous_notes=adj.previous_notes,
            created_at=adj.created_at,
            notice_seen_at=adj.notice_seen_at,
        )

    @staticmethod
    def _ensure_capacity(repository, group: StudyGroup) -> None:
        if group.capacity is not None and repository.count_active_members(group.id) >= group.capacity:
            raise CommunityError("O grupo atingiu sua capacidade máxima.", 409)

    @staticmethod
    def _value(value):
        return getattr(value, "value", value)

    @classmethod
    def _to_response(cls, group: StudyGroup, owner_id: UUID) -> GroupResponse:
        return GroupResponse(
            id=group.id, name=group.name, description=group.description, rules=group.rules,
            visibility=GroupVisibility(cls._value(group.visibility)),
            join_policy=JoinPolicy(cls._value(group.join_policy)),
            status=GroupStatus(cls._value(group.status)), discipline_id=group.subject_id,
            offering_id=group.class_section_id, owner_id=owner_id, capacity=group.capacity,
            created_at=group.created_at, updated_at=group.updated_at,
        )

    @classmethod
    def _to_discovery_response(cls, record: GroupDiscoveryRecord) -> GroupDiscoveryResponse:
        base = cls._to_response(record.group, record.group.created_by)
        return GroupDiscoveryResponse(**base.model_dump(by_alias=False), subject_name=record.subject_name,
                                      subject_code=record.subject_code, period=record.period)

    @staticmethod
    def _member_response(member: GroupMember,
                          status: MembershipResultStatus) -> MembershipResponse:
        return MembershipResponse(group_id=member.group_id, user_id=member.user_id,
                                  status=status, joined_at=member.joined_at)

    # --- TASK #120: Canais ---

    def list_channels(self, group_id: UUID, user_id: UUID) -> list["ChannelResponse"]:
        from app.modules.community.schemas import ChannelResponse
        with self._uow as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas participantes do grupo podem ver os canais.", 403)
            channels = uow.community.list_channels(group_id)
            return [ChannelResponse.model_validate(c) for c in channels]

    def create_channel(self, group_id: UUID, user_id: UUID, data: "ChannelCreate") -> "ChannelResponse":
        from app.modules.community.schemas import ChannelResponse
        with self._uow as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar canais.", 403)
            channel = uow.community.create_channel(group_id, user_id, data)
            uow.commit()
            return ChannelResponse.model_validate(channel)

    def update_channel(self, group_id: UUID, channel_id: UUID, user_id: UUID, data: "ChannelUpdate") -> "ChannelResponse":
        from app.modules.community.schemas import ChannelResponse
        with self._uow as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar canais.", 403)
            channel = uow.community.find_channel_by_id(channel_id)
            if channel is None or channel.group_id != group_id:
                raise CommunityError("Canal não encontrado.", 404)
            updated = uow.community.update_channel(channel, data)
            uow.commit()
            return ChannelResponse.model_validate(updated)

    def archive_channel(self, group_id: UUID, channel_id: UUID, user_id: UUID) -> "ChannelResponse":
        from app.modules.community.schemas import ChannelResponse
        with self._uow as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar canais.", 403)
            channel = uow.community.find_channel_by_id(channel_id)
            if channel is None or channel.group_id != group_id:
                raise CommunityError("Canal não encontrado.", 404)
            archived = uow.community.archive_channel(channel)
            uow.commit()
            return ChannelResponse.model_validate(archived)
