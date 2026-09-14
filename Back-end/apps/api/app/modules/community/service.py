from collections.abc import Callable
from uuid import UUID

from app.modules.community.errors import CommunityError
from app.modules.community.models import (
    GroupJoinPolicy,
    GroupMember,
    GroupStatus as ModelGroupStatus,
    GroupVisibility as ModelGroupVisibility,
    JoinRequestStatus,
    MembershipRole,
    MembershipStatus,
    StudyGroup,
)
from app.modules.community.repository import CommunityUnitOfWork, GroupDiscoveryRecord
from app.modules.community.schemas import (
    ParticipationResponse,
    ParticipantResponse,
    GroupCreate,
    GroupDiscoveryResponse,
    GroupResponse,
    GroupStatus,
    GroupUpdate,
    GroupVisibility,
    JoinPolicy,
    MembershipAction,
    MembershipActionType,
    MembershipResponse,
    MembershipResultStatus,
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
