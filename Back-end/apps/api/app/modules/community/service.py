from collections.abc import Callable
from uuid import UUID

from fastapi import HTTPException, status

from app.modules.community.models import StudyGroup
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
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Disciplina acadêmica inválida ou inexistente.",
                )

            # 2. Validação da turma/oferta (opcional, mas deve pertencer à disciplina)
            if data.offering_id is not None:
                if not uow.community.check_offering_belongs_to_discipline(
                    data.offering_id, data.discipline_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A turma informada não pertence à disciplina selecionada.",
                    )

            # 3. Criação atômica (grupo + owner em memberships)
            group = uow.community.create_group(owner_id=user_id, data=data)
            uow.commit()

            return self._to_response(group, owner_id=user_id, rules=data.rules)

    def get_group(self, group_id: UUID) -> GroupResponse:
        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Grupo não encontrado.",
                )

            owner_id = uow.community.find_active_owner_id(group_id) or group.created_by
            return self._to_response(group, owner_id=owner_id)

    def update_group(
        self, group_id: UUID, data: GroupUpdate, user_id: UUID
    ) -> GroupResponse:
        updates = data.model_dump(exclude_unset=True)

        with self._uow_factory() as uow:
            group = uow.community.find_by_id(group_id)
            if group is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Grupo não encontrado.",
                )

            owner_id = uow.community.find_active_owner_id(group_id) or group.created_by
            if user_id != owner_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Apenas o proprietário tem permissão para editar o grupo.",
                )

            rules = updates.pop("rules", None)
            if updates:
                group = uow.community.update_group(group, updates)
                uow.commit()

            return self._to_response(group, owner_id=owner_id, rules=rules)

    @staticmethod
    def _to_response(
        group: StudyGroup, owner_id: UUID, rules: str | None = None
    ) -> GroupResponse:
        return GroupResponse(
            id=group.id,
            name=group.name,
            description=group.description,
            rules=rules,
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
