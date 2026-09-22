from typing import Annotated, Literal
from pydantic import AwareDatetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.schemas import (
    GroupCreate,
    GroupDiscoveryResponse,
    GroupResponse,
    GroupTopicCreate,
    GroupTopicResponse,
    GroupUpdate,
    MembershipAction,
    MembershipResponse,
    ParticipantResponse,
    ParticipationResponse,
    ScheduledLessonCreate,
    ScheduledLessonResponse,
    ScheduledLessonUpdate,
    TeachingPlanCreate,
    TeachingPlanResponse,
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


@router.get("/mine", response_model=list[GroupResponse], summary="Listar meus grupos")
def list_mine(user_id: UserId, service: Service,
              offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=100)):
    return service.list_mine(user_id, offset, limit)


@router.get("/{group_id}/participation", response_model=ParticipationResponse)
def participation(group_id: UUID, user_id: UserId, service: Service):
    return service.participation(group_id, user_id)


@router.get("/{group_id}/members", response_model=list[ParticipantResponse])
def list_participants(group_id: UUID, user_id: UserId, service: Service,
                      pending: bool = False, offset: int = Query(default=0, ge=0),
                      limit: int = Query(default=20, ge=1, le=100)):
    return service.list_participants(group_id, user_id, pending, offset, limit)


@router.get("/me/lessons", response_model=list[ScheduledLessonResponse], summary="Meu cronograma vigente")
def user_calendar(user_id: UserId, service: Service,
                  start: AwareDatetime | None = None, end: AwareDatetime | None = None,
                  period: Literal["past", "future"] | None = None,
                  offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
    return service.user_calendar(user_id, start, end, period, offset, limit)


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


# --- TASK #112: Rotas para Tópicos, Plano de Aulas e Cronograma ---


@router.post("/{group_id}/topics", response_model=GroupTopicResponse,
             status_code=status.HTTP_201_CREATED, summary="Adicionar tópico ao grupo",
             openapi_extra=MUTATION_SECURITY)
def create_topic(group_id: UUID, user_id: UserId, payload: GroupTopicCreate,
                 service: Service) -> GroupTopicResponse:
    return service.create_topic(group_id, user_id, payload)


@router.get("/{group_id}/topics", response_model=list[GroupTopicResponse],
            summary="Listar tópicos do grupo")
def list_topics(group_id: UUID, user_id: UserId, service: Service) -> list[GroupTopicResponse]:
    return service.list_topics(group_id, user_id)


@router.post("/{group_id}/teaching-plans", response_model=TeachingPlanResponse,
             status_code=status.HTTP_201_CREATED, summary="Criar novo plano de aulas",
             openapi_extra=MUTATION_SECURITY)
def create_teaching_plan(group_id: UUID, user_id: UserId, payload: TeachingPlanCreate,
                         service: Service) -> TeachingPlanResponse:
    return service.create_teaching_plan(group_id, user_id, payload)


@router.get("/{group_id}/teaching-plans/latest", response_model=TeachingPlanResponse | None,
            summary="Obter plano de aulas mais recente")
def get_latest_teaching_plan(group_id: UUID, user_id: UserId,
                              service: Service) -> TeachingPlanResponse | None:
    return service.get_latest_teaching_plan(group_id, user_id)


@router.post("/{group_id}/lessons", response_model=ScheduledLessonResponse,
             status_code=status.HTTP_201_CREATED, summary="Agendar aula no cronograma",
             openapi_extra=MUTATION_SECURITY)
def create_lesson(group_id: UUID, user_id: UserId, payload: ScheduledLessonCreate,
                  service: Service) -> ScheduledLessonResponse:
    return service.create_lesson(group_id, user_id, payload)


@router.get("/{group_id}/lessons", response_model=list[ScheduledLessonResponse],
            summary="Listar cronograma de aulas agendadas")
def list_lessons(group_id: UUID, user_id: UserId, service: Service,
                 plan_id: UUID | None = Query(default=None)) -> list[ScheduledLessonResponse]:
    return service.list_lessons(group_id, user_id, plan_id)


@router.patch("/{group_id}/lessons/{lesson_id}", response_model=ScheduledLessonResponse,
              summary="Atualizar aula agendada", openapi_extra=MUTATION_SECURITY)
def update_lesson(group_id: UUID, lesson_id: UUID, user_id: UserId,
                  payload: ScheduledLessonUpdate, service: Service) -> ScheduledLessonResponse:
    return service.update_lesson(group_id, lesson_id, user_id, payload)


@router.delete("/{group_id}/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT,
               summary="Remover aula do cronograma", openapi_extra=MUTATION_SECURITY)
def delete_lesson(group_id: UUID, lesson_id: UUID, user_id: UserId, service: Service) -> None:
    service.delete_lesson(group_id, lesson_id, user_id)

@router.get("/{group_id}/plans", response_model=list[TeachingPlanResponse])
def list_plans(group_id: UUID, user_id: UserId, service: Service,
               offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=100)):
    return service.list_plans(group_id, user_id, offset, limit)


@router.post("/{group_id}/plans", response_model=TeachingPlanResponse,
             status_code=status.HTTP_201_CREATED, openapi_extra=MUTATION_SECURITY)
def create_plan(group_id: UUID, user_id: UserId, payload: TeachingPlanCreate, service: Service):
    return service.create_teaching_plan(group_id, user_id, payload)


@router.patch("/{group_id}/plans/{plan_id}", response_model=TeachingPlanResponse,
              openapi_extra=MUTATION_SECURITY)
def replace_plan(group_id: UUID, plan_id: UUID, user_id: UserId, payload: TeachingPlanCreate, service: Service):
    return service.replace_plan(group_id, plan_id, user_id, payload)


@router.post("/{group_id}/plans/{plan_id}/publish", response_model=TeachingPlanResponse,
             openapi_extra=MUTATION_SECURITY)
def publish_plan(group_id: UUID, plan_id: UUID, user_id: UserId, service: Service):
    return service.publish_plan(group_id, plan_id, user_id)
