from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

from app.modules.community.errors import CommunityError
from app.modules.community.models import (
    GroupJoinPolicy,
    GroupMember,
    GroupStatus as ModelGroupStatus,
    GroupVisibility as ModelGroupVisibility,
    JoinRequestStatus,
    LessonOccurrence,
    Meeting,
    MeetingStatus as ModelMeetingStatus,
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
    MeetingCreate,
    MeetingOutcomeUpdate,
    MeetingParticipantResponse,
    MeetingParticipantStatus,
    MeetingResponse,
    MeetingUpdate,
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

    def create_meeting(self, group_id: UUID, user_id: UUID, data: MeetingCreate) -> MeetingResponse:
        if data.group_id != group_id:
            raise CommunityError("O grupo do encontro não corresponde à URL.", 422)
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("Não é possível agendar encontros em um grupo inativo.", 409)
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores ativos podem criar encontros.", 403)
            if data.starts_at <= datetime.now(UTC):
                raise CommunityError("O início do encontro deve estar no futuro.", 422)
            meeting = uow.community.create_meeting(group_id, user_id, data)
            uow.commit()
            return self._meeting_response(uow, meeting, user_id)

    def list_group_meetings(self, group_id: UUID, user_id: UUID,
                            start: datetime | None, end: datetime | None) -> list[MeetingResponse]:
        self._validate_meeting_window(start, end)
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("Grupo inativo.", 409)
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros ativos podem consultar os encontros.", 403)
            return self._meeting_responses(
                uow, uow.community.list_group_meetings(group_id, start, end), user_id
            )

    def user_meeting_calendar(self, user_id: UUID, start: datetime | None,
                              end: datetime | None) -> list[MeetingResponse]:
        self._validate_meeting_window(start, end)
        with self._uow_factory() as uow:
            return self._meeting_responses(
                uow, uow.community.list_user_meetings(user_id, start, end), user_id
            )

    def get_meeting(self, meeting_id: UUID, user_id: UUID) -> MeetingResponse:
        with self._uow_factory() as uow:
            meeting = uow.community.find_meeting(meeting_id)
            if meeting is None:
                raise CommunityError("Encontro não encontrado.", 404)
            group = uow.community.find_by_id(meeting.group_id)
            if group is None or self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("Encontro não encontrado.", 404)
            if not uow.community.is_active_member(meeting.group_id, user_id):
                raise CommunityError("Apenas membros ativos podem consultar este encontro.", 403)
            return self._meeting_response(uow, meeting, user_id)

    def update_meeting(self, meeting_id: UUID, user_id: UUID, data: MeetingUpdate) -> MeetingResponse:
        with self._uow_factory() as uow:
            meeting = uow.community.find_meeting(meeting_id, lock=True)
            if meeting is None:
                raise CommunityError("Encontro não encontrado.", 404)
            group = uow.community.find_by_id(meeting.group_id)
            if group is None:
                raise CommunityError("Encontro não encontrado.", 404)
            if not uow.community.is_active_organizer(meeting.group_id, user_id):
                raise CommunityError("Apenas o organizador ou moderador ativo pode editar o encontro.", 403)
            self._require_active_meeting_group(uow, meeting)
            self._ensure_meeting_mutable(meeting)
            updates = data.model_dump(exclude_unset=True)
            starts_at = updates.get("starts_at", meeting.starts_at)
            ends_at = updates.get("ends_at", meeting.ends_at)
            if starts_at != meeting.starts_at and starts_at <= datetime.now(UTC):
                raise CommunityError("O novo início deve estar no futuro.", 422)
            if ends_at is not None and starts_at >= ends_at:
                raise CommunityError("O início deve ser anterior ao fim do encontro.", 422)
            modality = self._value(updates.get("modality", meeting.modality))
            location = updates.get("location", meeting.location)
            external_url = updates.get("external_url", meeting.external_url)
            self._validate_meeting_modality(modality, location, external_url)
            if updates:
                meeting = uow.community.update_meeting(meeting, data)
                uow.commit()
            return self._meeting_response(uow, meeting, user_id)

    def cancel_meeting(self, meeting_id: UUID, user_id: UUID) -> MeetingResponse:
        with self._uow_factory() as uow:
            meeting = uow.community.find_meeting(meeting_id, lock=True)
            if meeting is None:
                raise CommunityError("Encontro não encontrado.", 404)
            if not uow.community.is_active_organizer(meeting.group_id, user_id):
                raise CommunityError("Apenas o organizador ou moderador ativo pode cancelar o encontro.", 403)
            self._require_active_meeting_group(uow, meeting)
            status_value = self._value(meeting.status)
            if status_value == ModelMeetingStatus.CANCELLED.value:
                return self._meeting_response(uow, meeting, user_id)
            if status_value == ModelMeetingStatus.COMPLETED.value:
                raise CommunityError("Encontros encerrados não podem ser cancelados.", 409)
            meeting = uow.community.cancel_meeting(meeting)
            uow.commit()
            return self._meeting_response(uow, meeting, user_id)

    def report_meeting_outcome(self, meeting_id: UUID, user_id: UUID,
                               data: MeetingOutcomeUpdate) -> MeetingResponse:
        now = datetime.now(UTC)
        with self._uow_factory() as uow:
            meeting = uow.community.find_meeting(meeting_id, lock=True)
            if meeting is None:
                raise CommunityError("Encontro não encontrado.", 404)
            if (meeting.organizer_id != user_id
                    or not uow.community.is_active_organizer(meeting.group_id, user_id)):
                raise CommunityError("Somente o criador com papel de organizador ativo pode registrar o resultado.", 403)
            self._require_active_meeting_group(uow, meeting)
            status_value = self._value(meeting.status)
            if status_value not in (ModelMeetingStatus.SCHEDULED.value, ModelMeetingStatus.POSTPONED.value):
                raise CommunityError("O resultado deste encontro já foi registrado.", 409)

            if data.status == "completed":
                end_time = meeting.ends_at or meeting.starts_at
                if now < end_time:
                    raise CommunityError("O encontro só pode ser marcado como realizado após o horário de término.", 409)
                meeting.status = ModelMeetingStatus.COMPLETED
            elif data.status == "postponed":
                if data.starts_at <= now:
                    raise CommunityError("O novo início deve estar no futuro.", 422)
                meeting.starts_at = data.starts_at
                meeting.ends_at = data.ends_at
                meeting.status = ModelMeetingStatus.POSTPONED
            else:
                meeting.status = ModelMeetingStatus.CANCELLED
            meeting.updated_at = now
            uow.commit()
            return self._meeting_response(uow, meeting, user_id)

    def put_meeting_participant(self, meeting_id: UUID, user_id: UUID,
                                participant_status: MeetingParticipantStatus) -> MeetingParticipantResponse:
        with self._uow_factory() as uow:
            meeting = uow.community.find_meeting(meeting_id, lock=True)
            if meeting is None:
                raise CommunityError("Encontro não encontrado.", 404)
            group = uow.community.find_by_id(meeting.group_id)
            if not uow.community.is_active_member(meeting.group_id, user_id):
                raise CommunityError("É necessário ser membro ativo do grupo para participar.", 403)
            if group is None or self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("O grupo do encontro não está ativo.", 409)
            if participant_status == MeetingParticipantStatus.ATTENDED:
                if self._value(meeting.status) == ModelMeetingStatus.CANCELLED.value:
                    raise CommunityError("Não é possível registrar presença em encontro cancelado.", 409)
                if datetime.now(UTC) < meeting.starts_at:
                    raise CommunityError("A presença só pode ser registrada após o início do encontro.", 409)
            else:
                self._ensure_meeting_mutable(meeting)
            participant = uow.community.upsert_meeting_participant(meeting_id, user_id, participant_status)
            uow.commit()
            return MeetingParticipantResponse.model_validate(participant)

    @staticmethod
    def _require_active_meeting_group(uow: CommunityUnitOfWork, meeting: Meeting) -> None:
        group = uow.community.find_by_id(meeting.group_id)
        if group is None or CommunityService._value(group.status) != ModelGroupStatus.ACTIVE.value:
            raise CommunityError("O grupo do encontro não está ativo.", 409)

    @staticmethod
    def _validate_meeting_window(start: datetime | None, end: datetime | None) -> None:
        if start is not None and end is not None and end <= start:
            raise CommunityError("O fim do intervalo deve ser posterior ao início.", 422)

    @staticmethod
    def _meeting_responses(uow, meetings: list[Meeting], user_id: UUID) -> list[MeetingResponse]:
        if not meetings:
            return []
        meeting_ids = [meeting.id for meeting in meetings]
        topics = uow.community.list_meeting_topic_ids(meeting_ids)
        summaries = uow.community.meeting_participant_summary(meeting_ids, user_id)
        return [
            MeetingResponse.model_validate(meeting).model_copy(update={
                "topic_ids": topics[meeting.id],
                "confirmed_count": summaries[meeting.id][0],
                "participant_status": (MeetingParticipantStatus(summaries[meeting.id][1])
                                       if summaries[meeting.id][1] else None),
            })
            for meeting in meetings
        ]

    @classmethod
    def _meeting_response(cls, uow, meeting: Meeting, user_id: UUID) -> MeetingResponse:
        return cls._meeting_responses(uow, [meeting], user_id)[0]

    @staticmethod
    def _validate_meeting_modality(modality: str, location: str | None,
                                   external_url: str | None) -> None:
        valid = ((modality == "in_person" and bool(location)) or
                 (modality == "online" and bool(external_url)) or
                 (modality == "hybrid" and bool(location) and bool(external_url)))
        if not valid:
            raise CommunityError("Local e URL devem ser compatíveis com a modalidade do encontro.", 422)

    @staticmethod
    def _ensure_meeting_mutable(meeting: Meeting) -> None:
        if CommunityService._value(meeting.status) not in (
            ModelMeetingStatus.SCHEDULED.value, ModelMeetingStatus.POSTPONED.value
        ):
            raise CommunityError("Encontros cancelados ou encerrados não podem ser alterados.", 409)
        end_time = meeting.ends_at or meeting.starts_at
        if datetime.now(UTC) >= end_time:
            raise CommunityError("O prazo para alterar a participação deste encontro terminou.", 409)

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
            return [GroupTopicResponse.model_validate(topic).model_copy(update={"topic_name": name})
                    for topic, name in topics]

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
