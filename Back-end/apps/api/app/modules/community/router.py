from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.schemas import (
    GroupCreate,
    GroupDiscoveryResponse,
    GroupResponse,
    GroupUpdate,
    MembershipAction,
    MembershipResponse,
)
from app.modules.community.service import CommunityService

router = APIRouter(prefix="/api/v1/groups", tags=["Groups"])
UserId = Annotated[UUID, Depends(active_subject)]
Service = Annotated[CommunityService, Depends(get_community_service)]

MUTATION_SECURITY = {
    "parameters": [
        {"name": "X-NexoAula-CSRF", "in": "header", "required": True,
         "schema": {"type": "string", "enum": ["1"]}},
        {"name": "Origin", "in": "header", "required": False,
         "schema": {"type": "string"},
         "description": "Origem autorizada; Referer aceito apenas como fallback."},
    ]
}


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED,
             summary="Criar grupo de estudos", openapi_extra=MUTATION_SECURITY)
@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED,
             include_in_schema=False)
def create_group(user_id: UserId, payload: GroupCreate, service: Service) -> GroupResponse:
    return service.create_group(payload, user_id)


@router.get("", response_model=list[GroupDiscoveryResponse], summary="Descobrir grupos públicos")
def search_groups(
    user_id: UserId,
    service: Service,
    subject: str | None = Query(default=None, max_length=200),
    period: str | None = Query(default=None, max_length=80),
    topic: str | None = Query(default=None, max_length=200),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[GroupDiscoveryResponse]:
    return service.search_groups(subject, period, topic, offset, limit)


@router.get("/{group_id}", response_model=GroupResponse, summary="Obter dados do grupo")
def get_group(group_id: UUID, user_id: UserId, service: Service) -> GroupResponse:
    return service.get_group(group_id, user_id)


@router.patch("/{group_id}", response_model=GroupResponse, summary="Editar grupo de estudos",
              openapi_extra=MUTATION_SECURITY)
def update_group(group_id: UUID, user_id: UserId, payload: GroupUpdate,
                 service: Service) -> GroupResponse:
    return service.update_group(group_id, payload, user_id)


@router.post("/{group_id}/join", response_model=MembershipResponse,
             status_code=status.HTTP_201_CREATED, summary="Entrar ou solicitar entrada no grupo",
             openapi_extra=MUTATION_SECURITY)
def join_group(group_id: UUID, user_id: UserId, service: Service) -> MembershipResponse:
    return service.join_group(group_id, user_id)


@router.patch("/{group_id}/members/{target_user_id}", response_model=MembershipResponse,
              summary="Aprovar, recusar ou remover participante", openapi_extra=MUTATION_SECURITY)
def manage_membership(group_id: UUID, target_user_id: UUID, payload: MembershipAction,
                      user_id: UserId, service: Service) -> MembershipResponse:
    return service.manage_membership(group_id, user_id, target_user_id, payload)
