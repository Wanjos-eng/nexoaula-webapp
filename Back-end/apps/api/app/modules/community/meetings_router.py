from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import AwareDatetime

from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.schemas import (
    MeetingCreate,
    MeetingOutcomeUpdate,
    MeetingParticipantResponse,
    MeetingParticipantUpsert,
    MeetingResponse,
    MeetingUpdate,
)
from app.modules.community.service import CommunityService


router = APIRouter(tags=["Meetings"])
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


@router.post("/api/v1/groups/{group_id}/meetings", response_model=MeetingResponse,
             status_code=status.HTTP_201_CREATED, summary="Criar encontro do grupo",
             openapi_extra=MUTATION_SECURITY)
def create_meeting(group_id: UUID, payload: MeetingCreate, user_id: UserId,
                   service: Service) -> MeetingResponse:
    return service.create_meeting(group_id, user_id, payload)


@router.get("/api/v1/groups/{group_id}/meetings", response_model=list[MeetingResponse],
            summary="Listar encontros do grupo")
def list_group_meetings(
    group_id: UUID,
    user_id: UserId,
    service: Service,
    start: AwareDatetime | None = Query(default=None),
    end: AwareDatetime | None = Query(default=None),
) -> list[MeetingResponse]:
    return service.list_group_meetings(group_id, user_id, start, end)


@router.get("/api/v1/me/meetings", response_model=list[MeetingResponse],
            summary="Meu calendário de encontros")
def user_meeting_calendar(
    user_id: UserId,
    service: Service,
    start: AwareDatetime | None = Query(default=None),
    end: AwareDatetime | None = Query(default=None),
) -> list[MeetingResponse]:
    return service.user_meeting_calendar(user_id, start, end)


@router.get("/api/v1/meetings/{meeting_id}", response_model=MeetingResponse,
            summary="Detalhes do encontro")
def get_meeting(meeting_id: UUID, user_id: UserId,
                service: Service) -> MeetingResponse:
    return service.get_meeting(meeting_id, user_id)


@router.patch("/api/v1/meetings/{meeting_id}", response_model=MeetingResponse,
              summary="Atualizar encontro", openapi_extra=MUTATION_SECURITY)
def update_meeting(meeting_id: UUID, payload: MeetingUpdate, user_id: UserId,
                   service: Service) -> MeetingResponse:
    return service.update_meeting(meeting_id, user_id, payload)


@router.post("/api/v1/meetings/{meeting_id}/cancel", response_model=MeetingResponse,
             summary="Cancelar encontro preservando o histórico",
             openapi_extra=MUTATION_SECURITY)
def cancel_meeting(meeting_id: UUID, user_id: UserId,
                   service: Service) -> MeetingResponse:
    return service.cancel_meeting(meeting_id, user_id)


@router.put("/api/v1/meetings/{meeting_id}/outcome", response_model=MeetingResponse,
            summary="Registrar resultado do encontro", openapi_extra=MUTATION_SECURITY)
def report_meeting_outcome(meeting_id: UUID, payload: MeetingOutcomeUpdate,
                           user_id: UserId, service: Service) -> MeetingResponse:
    return service.report_meeting_outcome(meeting_id, user_id, payload)


@router.put("/api/v1/meetings/{meeting_id}/participants/me",
            response_model=MeetingParticipantResponse,
            summary="Registrar ou atualizar minha participação",
            openapi_extra=MUTATION_SECURITY)
def put_meeting_participation(meeting_id: UUID, payload: MeetingParticipantUpsert,
                              user_id: UserId, service: Service) -> MeetingParticipantResponse:
    return service.put_meeting_participant(meeting_id, user_id, payload.status)
