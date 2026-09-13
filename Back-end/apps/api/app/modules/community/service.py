from collections.abc import Callable
from uuid import UUID

from app.modules.community.models import StudyGroup
from app.modules.community.errors import CommunityError
from app.modules.community.repository import CommunityUnitOfWork
from app.modules.community.schemas import (
    GroupCreate,
    GroupResponse,
    GroupStatus,
    GroupUpdate,
    GroupVisibility,
    JoinPolicy,
)

CommunityUnitOfWorkFactory = Callable[[], CommunityUnitOfWork]


class CommunityService:
    def __init__(self, unit_of_work_factory: CommunityUnitOfWorkFactory) -> None:
        self._uow_factory = unit_of_work_factory

    def create_group(self, data: GroupCreate, user_id: UUID) -> GroupResponse:
        with self._uow_factory() as uow:
            # 1. Validação de contexto acadêmico obrigatório
            if not uow.community.check_discipline_exists(data.discipline_id):
                raise CommunityError("Disciplina acadêmica inválida ou inexistente.", 400)

            # 2. Validação da turma/oferta (opcional, mas deve pertencer à disciplina)
            if data.offering_id is not None:
                if not uow.community.check_offering_belongs_to_discipline(
                    data.offering_id, data.discipline_id
                ):
                    raise CommunityError(
                        "A turma informada não pertence à disciplina selecionada.", 400
                    )

            # 3. Criação atômica (grupo + owner em memberships)
            group = uow.community.create_group(owner_id=user_id, data=data)
            uow.commit()

            return self._to_response(group, owner_id=user_id)

    def get_group(self, group_id: UUID, user_id: UUID) -> GroupResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)

            visibility = getattr(group.visibility, "value", group.visibility)
            if visibility == GroupVisibility.PRIVATE.value and not uow.community.is_active_member(
                group_id, user_id
            ):
                # Private groups are deliberately indistinguishable from missing groups.
                raise CommunityError("Grupo não encontrado.", 404)

            owner_id = uow.community.find_active_owner_id(group_id) or group.created_by
            return self._to_response(group, owner_id=owner_id)

    def update_group(
        self, group_id: UUID, data: GroupUpdate, user_id: UUID
    ) -> GroupResponse:
        updates = data.model_dump(exclude_unset=True)

        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise CommunityError("Grupo não encontrado.", 404)

            owner_id = uow.community.find_active_owner_id(group_id) or group.created_by
            if user_id != owner_id:
                raise CommunityError(
                    "Apenas o proprietário tem permissão para editar o grupo.", 403
                )

            if updates:
                group = uow.community.update_group(group, updates)
                uow.commit()

            return self._to_response(group, owner_id=owner_id)

    @staticmethod
    def _to_response(
        group: StudyGroup, owner_id: UUID
    ) -> GroupResponse:
        return GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            rules=group.rules,
            visibility=GroupVisibility(group.visibility),
            join_policy=JoinPolicy(group.join_policy),
            status=GroupStatus(group.status),
            discipline_id=group.subject_id,
            offering_id=group.class_section_id,
            owner_id=owner_id,
            capacity=group.capacity,
            created_at=group.created_at,
            updated_at=group.updated_at,
        )
