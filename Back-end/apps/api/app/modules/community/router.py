from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.schemas import GroupCreate, GroupResponse, GroupUpdate
from app.modules.community.service import CommunityService

router = APIRouter(prefix="/api/v1/groups", tags=["Groups"])
UserId = Annotated[UUID, Depends(active_subject)]

MUTATION_SECURITY = {
    "parameters": [
        {
            "name": "X-NexoAula-CSRF",
            "in": "header",
            "required": True,
            "schema": {"type": "string", "enum": ["1"]},
        },
        {
            "name": "Origin",
            "in": "header",
            "required": False,
            "schema": {"type": "string"},
            "description": "Origem autorizada; Referer aceito apenas como fallback.",
        },
    ]
}


@router.post(
    "",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar grupo de estudos",
    description="Cria um novo grupo de estudos e define o criador como proprietário.",
    openapi_extra=MUTATION_SECURITY,
)
@router.post(
    "/",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_group(
    user_id: UserId,
    payload: GroupCreate,
    service: Annotated[CommunityService, Depends(get_community_service)],
) -> GroupResponse:
    return service.create_group(payload, user_id)


@router.get(
    "/{group_id}",
    response_model=GroupResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter dados do grupo",
    description="Retorna os dados públicos do grupo e o ID do proprietário.",
)
def get_group(
    group_id: UUID,
    user_id: UserId,
    service: Annotated[CommunityService, Depends(get_community_service)],
) -> GroupResponse:
    return service.get_group(group_id, user_id)


@router.patch(
    "/{group_id}",
    response_model=GroupResponse,
    status_code=status.HTTP_200_OK,
    summary="Editar grupo de estudos",
    description="Atualiza dados do grupo. Apenas o proprietário tem permissão.",
    openapi_extra=MUTATION_SECURITY,
)
def update_group(
    group_id: UUID,
    user_id: UserId,
    payload: GroupUpdate,
    service: Annotated[CommunityService, Depends(get_community_service)],
) -> GroupResponse:
    return service.update_group(group_id, payload, user_id)
