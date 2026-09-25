from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from app.modules.community.errors import CommunityError
from app.modules.community.models import (
    ChannelStatus as ModelChannelStatus,
    GroupInvitation,
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
    PlanningCorrection,
    PlanningCorrectionStatus as ModelPlanningCorrectionStatus,
    ScheduledLesson,
    StudentAttendanceAdjustment,
    StudentLessonAttendance,
    StudentTopicProgress,
    StudyGroup,
    TeachingPlan,
)
from app.modules.community.repository import (
    ChannelMessageRecord,
    CommunityUnitOfWork,
    GroupDiscoveryRecord,
    GroupInvitationRecord,
)
from app.modules.community.schemas import (
    AttendanceAdjustmentResponse,
    ChannelCreate,
    ChannelMessageCreate,
    ChannelMessageReplyPreview,
    ChannelMessageResponse,
    ChannelMessageUpdate,
    ChannelUpdate,
    ChannelResponse,
    GroupCreate,
    GroupDiscoveryResponse,
    GroupInvitationCreate,
    GroupInvitationCreatedResponse,
    GroupInvitationResponse,
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
    PlanningCorrectionCreate,
    PlanningCorrectionDecision,
    PlanningCorrectionResponse,
    PlanningCorrectionStatus,
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
            if data.subject_topic_ids:
                uow.community.set_group_subject_topics(group, data.subject_topic_ids)
            uow.commit()
            return self._to_response(group, owner_id=user_id)

    def search_groups(self, subject: str | None, period: str | None,
                      topic: str | None, offset: int,
                      limit: int, **academic_filters: UUID) -> list[GroupDiscoveryResponse]:
        with self._uow_factory() as uow:
            records = uow.community.search_public_groups(subject, period, topic, offset, limit, **academic_filters)
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
            if "subject_topic_ids" in updates:
                if not uow.community.is_active_organizer(group_id, user_id):
                    raise CommunityError("Apenas organizadores ativos podem configurar assuntos.", 403)
                if self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                    raise CommunityError("Grupos inativos não podem alterar assuntos.", 409)
                uow.community.set_group_subject_topics(group, updates.pop("subject_topic_ids"))
            if updates or "subject_topic_ids" in data.model_fields_set:
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

    def leave_group(self, group_id: UUID, user_id: UUID) -> MembershipResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            member = uow.community.find_member(group_id, user_id)
            if member is None or self._value(member.status) != MembershipStatus.ACTIVE.value:
                raise CommunityError("Você não participa ativamente deste grupo.", 409)
            if self._value(member.role) == MembershipRole.OWNER.value:
                raise CommunityError(
                    "Transfira a propriedade antes de sair da comunidade.", 409
                )
            member = uow.community.leave_member(member)
            uow.commit()
            return self._member_response(member, MembershipResultStatus.LEFT)

    def cancel_join_request(
        self, group_id: UUID, user_id: UUID
    ) -> MembershipResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            request = uow.community.find_pending_request(group_id, user_id)
            if request is None:
                raise CommunityError("Solicitação pendente não encontrada.", 409)
            request = uow.community.resolve_join_request(
                request,
                JoinRequestStatus.CANCELLED,
                user_id,
                "Cancelada pelo solicitante.",
            )
            uow.commit()
            return MembershipResponse(
                group_id=group_id,
                user_id=user_id,
                status=MembershipResultStatus.CANCELLED,
                requested_at=request.requested_at,
                resolved_at=request.resolved_at,
            )

    @staticmethod
    def _invitation_hash(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _invitation_response(
        record: GroupInvitationRecord,
    ) -> GroupInvitationResponse:
        invitation = record.invitation
        return GroupInvitationResponse(
            id=invitation.id,
            group_id=invitation.group_id,
            group_name=record.group_name,
            invited_user_id=invitation.invited_user_id,
            invited_email=record.invited_email,
            invited_display_name=record.invited_display_name,
            status=invitation.status,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            accepted_at=invitation.accepted_at,
            cancelled_at=invitation.cancelled_at,
        )

    def create_invitation(
        self, group_id: UUID, organizer_id: UUID, data: GroupInvitationCreate
    ) -> GroupInvitationCreatedResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("A comunidade não aceita novos convites.", 409)
            if not uow.community.is_active_organizer(group_id, organizer_id):
                raise CommunityError("Apenas organizadores podem criar convites.", 403)

            invited = uow.community.find_user_by_email(data.email)
            if invited is None:
                raise CommunityError(
                    "Nenhuma conta NexoAula ativa foi encontrada com este e-mail.", 404
                )
            if invited.id == organizer_id:
                raise CommunityError("Você já participa desta comunidade.", 409)
            if uow.community.is_active_member(group_id, invited.id):
                raise CommunityError("Esta pessoa já participa da comunidade.", 409)
            if uow.community.find_pending_request(group_id, invited.id) is not None:
                raise CommunityError(
                    "Esta pessoa já solicitou entrada. Aprove a solicitação existente.", 409
                )

            uow.community.expire_invitations(group_id, invited.id)
            token = token_urlsafe(32)
            invitation = uow.community.create_group_invitation(
                group_id,
                invited.id,
                organizer_id,
                self._invitation_hash(token),
                datetime.now(UTC) + timedelta(days=7),
            )
            record = uow.community.invitation_record(invitation)
            uow.commit()
            response = self._invitation_response(record)
            return GroupInvitationCreatedResponse(
                **response.model_dump(by_alias=False),
                token=token,
            )

    def list_invitations(
        self, group_id: UUID, organizer_id: UUID
    ) -> list[GroupInvitationResponse]:
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, organizer_id):
                raise CommunityError("Apenas organizadores podem ver convites.", 403)
            uow.community.expire_invitations(group_id)
            records = uow.community.list_group_invitations(group_id)
            uow.commit()
            return [self._invitation_response(record) for record in records]

    def get_invitation(
        self, token: str, user_id: UUID
    ) -> GroupInvitationResponse:
        with self._uow_factory() as uow:
            invitation = uow.community.find_invitation_by_token_hash(
                self._invitation_hash(token)
            )
            if invitation is None or invitation.invited_user_id != user_id:
                raise CommunityError("Convite não encontrado.", 404)
            if invitation.status == "pending" and invitation.expires_at <= datetime.now(UTC):
                invitation.status = "expired"
                uow.commit()
            return self._invitation_response(
                uow.community.invitation_record(invitation)
            )

    def accept_invitation(
        self, token: str, user_id: UUID
    ) -> MembershipResponse:
        with self._uow_factory() as uow:
            invitation = uow.community.find_invitation_by_token_hash(
                self._invitation_hash(token), lock=True
            )
            if invitation is None or invitation.invited_user_id != user_id:
                raise CommunityError("Convite não encontrado.", 404)
            if invitation.status != "pending":
                raise CommunityError("Este convite não está mais disponível.", 409)
            if invitation.expires_at <= datetime.now(UTC):
                invitation.status = "expired"
                uow.commit()
                raise CommunityError("Este convite expirou.", 410)

            group = uow.community.find_by_id(invitation.group_id)
            if group is None or self._value(group.status) != ModelGroupStatus.ACTIVE.value:
                raise CommunityError("Esta comunidade não aceita novos participantes.", 409)
            if uow.community.is_active_member(group.id, user_id):
                raise CommunityError("Você já participa desta comunidade.", 409)

            self._ensure_capacity(uow.community, group)
            pending_request = uow.community.find_pending_request(group.id, user_id)
            if pending_request is not None:
                uow.community.resolve_join_request(
                    pending_request,
                    JoinRequestStatus.CANCELLED,
                    user_id,
                    "Entrada concluída por convite.",
                )
            member = uow.community.activate_member(group.id, user_id)
            uow.community.accept_invitation(invitation)
            uow.commit()
            return self._member_response(member, MembershipResultStatus.ACTIVE)

    def cancel_invitation(
        self, group_id: UUID, invitation_id: UUID, organizer_id: UUID
    ) -> GroupInvitationResponse:
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, organizer_id):
                raise CommunityError("Apenas organizadores podem cancelar convites.", 403)
            invitation = uow.community.find_invitation_by_id(invitation_id, lock=True)
            if invitation is None or invitation.group_id != group_id:
                raise CommunityError("Convite não encontrado.", 404)
            if invitation.status != "pending":
                raise CommunityError("Este convite não está mais pendente.", 409)
            if invitation.expires_at <= datetime.now(UTC):
                invitation.status = "expired"
                uow.commit()
                raise CommunityError("Este convite já expirou.", 409)
            uow.community.cancel_invitation(invitation)
            record = uow.community.invitation_record(invitation)
            uow.commit()
            return self._invitation_response(record)

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

    def create_planning_correction(
        self, group_id: UUID, user_id: UUID, data: PlanningCorrectionCreate
    ) -> PlanningCorrectionResponse:
        if data.group_id != group_id:
            raise CommunityError("O grupo da sugestão não corresponde à URL.", 422)
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros ativos podem sugerir correções.", 403)
            snapshot = uow.community.planning_correction_target_snapshot(
                group_id, data.scheduled_lesson_id, data.lesson_occurrence_id, lock=True
            )
            if snapshot is None:
                raise CommunityError("O alvo informado não pertence a este grupo ou não existe.", 422)
            if data.lesson_occurrence_id and uow.community.has_occurrence_successor(data.lesson_occurrence_id):
                raise CommunityError("A ocorrência informada já foi retificada.", 409)
            self._validate_correction_patch(data, snapshot)
            correction = uow.community.create_planning_correction(user_id, data, snapshot)
            uow.commit()
            return PlanningCorrectionResponse.model_validate(correction)

    def list_planning_corrections(
        self, group_id: UUID, user_id: UUID,
        status: PlanningCorrectionStatus | None = None,
    ) -> list[PlanningCorrectionResponse]:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas membros ativos podem consultar sugestões.", 403)
            organizer = uow.community.is_active_organizer(group_id, user_id)
            corrections = uow.community.list_planning_corrections(
                group_id,
                status.value if status is not None else None,
                None if organizer else user_id,
            )
            return [PlanningCorrectionResponse.model_validate(item) for item in corrections]

    def decide_planning_correction(
        self, group_id: UUID, correction_id: UUID, user_id: UUID,
        data: PlanningCorrectionDecision,
    ) -> PlanningCorrectionResponse:
        with self._uow_factory() as uow:
            correction = uow.community.find_planning_correction(correction_id, lock=True)
            if correction is None or correction.group_id != group_id:
                raise CommunityError("Sugestão de correção não encontrada.", 404)
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores ativos podem decidir correções.", 403)
            if correction.status != ModelPlanningCorrectionStatus.PENDING:
                raise CommunityError("Esta sugestão já foi decidida.", 409)

            if data.status == "approved":
                current_snapshot = uow.community.planning_correction_target_snapshot(
                    group_id, correction.scheduled_lesson_id,
                    correction.lesson_occurrence_id, lock=True,
                )
                if current_snapshot is None or current_snapshot != correction.original_snapshot:
                    raise CommunityError(
                        "O recurso foi alterado desde a criação da sugestão. Atualize e envie uma nova correção.",
                        409,
                    )
                if correction.lesson_occurrence_id and uow.community.has_occurrence_successor(
                    correction.lesson_occurrence_id
                ):
                    raise CommunityError("A ocorrência já foi retificada por outra decisão.", 409)
                self._apply_planning_correction(uow, group_id, user_id, correction)

            correction.status = ModelPlanningCorrectionStatus(data.status)
            correction.decided_by = user_id
            correction.decided_at = datetime.now(UTC)
            correction.decision_note = data.decision_note
            uow.commit()
            return PlanningCorrectionResponse.model_validate(correction)

    @staticmethod
    def _normalize_correction_patch(patch: dict[str, Any], allowed: dict[str, str]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for field, value in patch.items():
            canonical = allowed.get(field)
            if canonical is None:
                raise CommunityError(f"Campo '{field}' não pode ser corrigido.", 422)
            if canonical in normalized:
                raise CommunityError(f"Campo '{canonical}' foi informado mais de uma vez.", 422)
            normalized[canonical] = value
        if not normalized:
            raise CommunityError("Informe ao menos uma alteração proposta.", 422)
        return normalized

    @classmethod
    def _validate_correction_patch(
        cls, data: PlanningCorrectionCreate, snapshot: dict[str, Any]
    ) -> None:
        if data.scheduled_lesson_id is not None:
            allowed = {
                "title": "title", "description": "description",
                "scheduledAt": "scheduled_at", "scheduled_at": "scheduled_at",
                "topicIds": "topic_ids", "topic_ids": "topic_ids",
            }
            normalized = cls._normalize_correction_patch(data.proposed_patch, allowed)
            try:
                ScheduledLessonUpdate.model_validate(normalized)
            except ValidationError as exc:
                raise CommunityError("Patch proposto inválido para a aula prevista.", 422) from exc
        else:
            allowed = {
                "status": "status", "actualStartedAt": "actual_started_at",
                "actual_started_at": "actual_started_at", "actualEndedAt": "actual_ended_at",
                "actual_ended_at": "actual_ended_at", "rescheduledTo": "rescheduled_to",
                "rescheduled_to": "rescheduled_to", "notes": "notes",
                "topicIds": "topic_ids", "topic_ids": "topic_ids",
            }
            normalized = cls._normalize_correction_patch(data.proposed_patch, allowed)
            current = {
                "status": snapshot["status"],
                "actual_started_at": snapshot["actualStartedAt"],
                "actual_ended_at": snapshot["actualEndedAt"],
                "rescheduled_to": snapshot["rescheduledTo"],
                "notes": snapshot["notes"],
                "topic_ids": snapshot["topicIds"],
                "scheduled_lesson_id": snapshot["scheduledLessonId"],
            }
            current.update(normalized)
            if current["status"] == "held":
                current["rescheduled_to"] = None
            elif current["status"] == "cancelled":
                current["actual_started_at"] = None
                current["actual_ended_at"] = None
                current["rescheduled_to"] = None
            elif current["status"] == "postponed":
                current["actual_started_at"] = None
                current["actual_ended_at"] = None
            current["supersedes_occurrence_id"] = UUID(int=0)
            try:
                LessonOccurrenceCreate.model_validate(current)
            except ValidationError as exc:
                raise CommunityError("Patch proposto inválido para a ocorrência.", 422) from exc

    @classmethod
    def _apply_planning_correction(
        cls, uow: CommunityUnitOfWork, group_id: UUID, decider_id: UUID,
        correction: PlanningCorrection,
    ) -> None:
        if correction.scheduled_lesson_id is not None:
            lesson = uow.community.find_scheduled_lesson_by_id(
                correction.scheduled_lesson_id, lock=True
            )
            if lesson is None or lesson.group_id != group_id:
                raise CommunityError("Aula do cronograma não encontrada.", 409)
            allowed = {
                "title": "title", "description": "description",
                "scheduledAt": "scheduled_at", "scheduled_at": "scheduled_at",
                "topicIds": "topic_ids", "topic_ids": "topic_ids",
            }
            patch = cls._normalize_correction_patch(correction.proposed_patch, allowed)
            try:
                update = ScheduledLessonUpdate.model_validate(patch)
            except ValidationError as exc:
                raise CommunityError("Patch armazenado inválido para a aula prevista.", 422) from exc
            uow.community.update_scheduled_lesson(lesson, update, allow_published=True)
            return

        occurrence_id = correction.lesson_occurrence_id
        if occurrence_id is None:
            raise CommunityError("Sugestão sem alvo válido.", 409)
        result = uow.community.find_lesson_occurrence_by_id(occurrence_id)
        if result is None or result[0].group_id != group_id:
            raise CommunityError("Ocorrência não encontrada.", 409)
        occurrence, topic_ids = result
        snapshot = correction.original_snapshot
        allowed = {
            "status": "status", "actualStartedAt": "actual_started_at",
            "actual_started_at": "actual_started_at", "actualEndedAt": "actual_ended_at",
            "actual_ended_at": "actual_ended_at", "rescheduledTo": "rescheduled_to",
            "rescheduled_to": "rescheduled_to", "notes": "notes",
            "topicIds": "topic_ids", "topic_ids": "topic_ids",
        }
        patch = cls._normalize_correction_patch(correction.proposed_patch, allowed)
        values: dict[str, Any] = {
            "status": snapshot["status"],
            "actual_started_at": snapshot["actualStartedAt"],
            "actual_ended_at": snapshot["actualEndedAt"],
            "rescheduled_to": snapshot["rescheduledTo"],
            "notes": snapshot["notes"],
            "topic_ids": [str(topic_id) for topic_id in topic_ids],
        }
        values.update(patch)
        if values["status"] == "held":
            values["rescheduled_to"] = None
        elif values["status"] == "cancelled":
            values["actual_started_at"] = None
            values["actual_ended_at"] = None
            values["rescheduled_to"] = None
        elif values["status"] == "postponed":
            values["actual_started_at"] = None
            values["actual_ended_at"] = None
        else:
            raise CommunityError("Status de ocorrência inválido no patch.", 422)
        values.update({
            "scheduled_lesson_id": occurrence.scheduled_lesson_id,
            "supersedes_occurrence_id": occurrence.id,
        })
        try:
            occurrence_data = LessonOccurrenceCreate.model_validate(values)
        except ValidationError as exc:
            raise CommunityError("Patch armazenado inválido para a ocorrência.", 422) from exc
        uow.community.create_lesson_occurrence(group_id, decider_id, occurrence_data)

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
        with self._uow_factory() as uow:
            if not uow.community.is_active_member(group_id, user_id):
                raise CommunityError("Apenas participantes do grupo podem ver os canais.", 403)
            self._require_channel_group(uow, group_id)
            channels = uow.community.list_channels(group_id)
            return [self._channel_response(uow, c) for c in channels]

    def create_channel(self, group_id: UUID, user_id: UUID, data: "ChannelCreate") -> "ChannelResponse":
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar canais.", 403)
            self._require_channel_group(uow, group_id)
            channel = uow.community.create_channel(group_id, user_id, data)
            uow.commit()
            return self._channel_response(uow, channel)

    def update_channel(self, group_id: UUID, channel_id: UUID, user_id: UUID, data: "ChannelUpdate") -> "ChannelResponse":
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar canais.", 403)
            self._require_channel_group(uow, group_id)
            channel = uow.community.find_channel_by_id(channel_id, lock=True)
            if channel is None or channel.group_id != group_id:
                raise CommunityError("Canal não encontrado.", 404)
            updated = uow.community.update_channel(channel, data)
            uow.commit()
            return self._channel_response(uow, updated)

    def archive_channel(self, group_id: UUID, channel_id: UUID, user_id: UUID) -> "ChannelResponse":
        with self._uow_factory() as uow:
            if not uow.community.is_active_organizer(group_id, user_id):
                raise CommunityError("Apenas organizadores podem gerenciar canais.", 403)
            self._require_channel_group(uow, group_id)
            channel = uow.community.find_channel_by_id(channel_id, lock=True)
            if channel is None or channel.group_id != group_id:
                raise CommunityError("Canal não encontrado.", 404)
            archived = uow.community.archive_channel(channel)
            uow.commit()
            return self._channel_response(uow, archived)

    @staticmethod
    def _require_channel_group(uow: CommunityUnitOfWork, group_id: UUID) -> None:
        group = uow.community.find_by_id(group_id)
        if group is None:
            raise CommunityError("Grupo não encontrado.", 404)
        if CommunityService._value(group.status) != ModelGroupStatus.ACTIVE.value:
            raise CommunityError("O grupo não está ativo.", 409)

    @staticmethod
    def _channel_response(uow, channel) -> ChannelResponse:
        return ChannelResponse.model_validate(channel).model_copy(
            update={"topic_name": uow.community.channel_topic_name(channel)}
        )


    def list_channel_messages(self, group_id: UUID, channel_id: UUID, user_id: UUID,
                              offset: int = 0, limit: int = 50) -> list[ChannelMessageResponse]:
        with self._uow_factory() as uow:
            self._require_message_access(uow, group_id, channel_id, user_id)
            records = uow.community.list_channel_messages(channel_id, offset, limit)
            return [self._message_response(record) for record in reversed(records)]

    def create_channel_message(self, group_id: UUID, channel_id: UUID, user_id: UUID,
                               data: ChannelMessageCreate) -> ChannelMessageResponse:
        with self._uow_factory() as uow:
            channel = self._require_message_access(
                uow, group_id, channel_id, user_id, require_active_group=True
            )
            if self._value(channel.status) != ModelChannelStatus.ACTIVE.value:
                raise CommunityError("Não é possível enviar mensagens em um canal arquivado.", 409)
            if data.reply_to_message_id is not None:
                target = uow.community.find_channel_message_by_id(data.reply_to_message_id)
                if target is None or target.channel_id != channel_id:
                    raise CommunityError("A mensagem respondida deve pertencer ao mesmo canal.", 422)
            message = uow.community.create_channel_message(
                channel_id, user_id, data.content, data.reply_to_message_id
            )
            record = uow.community.find_channel_message_record(message.id)
            if record is None:
                raise CommunityError("Mensagem não encontrada.", 404)
            uow.commit()
            return self._message_response(record)

    def update_channel_message(self, group_id: UUID, channel_id: UUID, message_id: UUID,
                               user_id: UUID, data: ChannelMessageUpdate) -> ChannelMessageResponse:
        with self._uow_factory() as uow:
            self._require_message_access(uow, group_id, channel_id, user_id)
            message = uow.community.find_channel_message_by_id(message_id, lock=True)
            self._require_owned_message(message, channel_id, user_id)
            if message.deleted_at is not None:
                raise CommunityError("Mensagens removidas não podem ser editadas.", 409)
            uow.community.update_channel_message(message, data.content)
            record = uow.community.find_channel_message_record(message.id)
            if record is None:
                raise CommunityError("Mensagem não encontrada.", 404)
            uow.commit()
            return self._message_response(record)

    def delete_channel_message(self, group_id: UUID, channel_id: UUID, message_id: UUID,
                               user_id: UUID) -> ChannelMessageResponse:
        with self._uow_factory() as uow:
            self._require_message_access(uow, group_id, channel_id, user_id)
            message = uow.community.find_channel_message_by_id(message_id, lock=True)
            self._require_owned_message(message, channel_id, user_id)
            if message.deleted_at is not None:
                raise CommunityError("Mensagem já foi removida.", 409)
            uow.community.soft_delete_channel_message(message)
            record = uow.community.find_channel_message_record(message.id)
            if record is None:
                raise CommunityError("Mensagem não encontrada.", 404)
            uow.commit()
            return self._message_response(record)

    @staticmethod
    def _require_owned_message(message, channel_id: UUID, user_id: UUID) -> None:
        if message is None or message.channel_id != channel_id:
            raise CommunityError("Mensagem não encontrada.", 404)
        if message.author_id != user_id:
            raise CommunityError("Apenas o autor pode alterar esta mensagem.", 403)

    @staticmethod
    def _require_message_access(uow: CommunityUnitOfWork, group_id: UUID, channel_id: UUID,
                                user_id: UUID, require_active_group: bool = False):
        group = uow.community.find_by_id(group_id)
        if group is None:
            raise CommunityError("Grupo não encontrado.", 404)
        if not uow.community.is_active_member(group_id, user_id):
            raise CommunityError("Apenas participantes ativos do grupo podem acessar as mensagens.", 403)
        if require_active_group and CommunityService._value(group.status) != ModelGroupStatus.ACTIVE.value:
            raise CommunityError("O grupo não está ativo.", 409)
        channel = uow.community.find_channel_by_id(channel_id)
        if channel is None or channel.group_id != group_id:
            raise CommunityError("Canal não encontrado.", 404)
        return channel

    @staticmethod
    def _message_response(record: ChannelMessageRecord) -> ChannelMessageResponse:
        message = record.message
        deleted = message.deleted_at is not None
        reply_preview = None
        if message.reply_to_message_id is not None:
            reply_deleted = record.reply_deleted_at is not None
            reply_preview = ChannelMessageReplyPreview(
                id=message.reply_to_message_id,
                author_name=record.reply_author_name or "Estudante",
                content=None if reply_deleted else record.reply_content,
                deleted=reply_deleted,
            )
        return ChannelMessageResponse(
            id=message.id, channel_id=message.channel_id, author_id=message.author_id,
            author_name=record.author_name, reply_to_message_id=message.reply_to_message_id,
            reply_preview=reply_preview, content=None if deleted else message.content,
            created_at=message.created_at, edited_at=message.edited_at, deleted_at=message.deleted_at,
        )
