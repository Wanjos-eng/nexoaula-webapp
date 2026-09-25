from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, Response, status

from app.modules.auth.dependencies import active_subject
from app.modules.marketplace.dependencies import get_marketplace_service
from app.modules.marketplace.schemas import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    TutorActivation,
    TutorResponse,
    BookingResponse,
    EnrollmentReceipt,
)
from app.modules.marketplace.service import MarketplaceService

router = APIRouter(prefix="/api/v1/marketplace", tags=["Tutoria simulada"])
UserId = Annotated[UUID, Depends(active_subject)]
Service = Annotated[MarketplaceService, Depends(get_marketplace_service)]
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
            "description": "Origem autorizada; Referer aceito como fallback. Envie Content-Type: application/json também em DELETE.",
        },
    ]
}


@router.get(
    "/tutor",
    response_model=TutorResponse | None,
    summary="Consultar meu perfil profissional opcional",
)
def profile(user_id: UserId, service: Service):
    return service.get_profile(user_id)


@router.post(
    "/tutor/activate",
    response_model=TutorResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Ativar ou retomar perfil profissional",
)
def activate(
    user_id: UserId,
    service: Service,
    payload: TutorActivation = Body(default=TutorActivation()),
):
    return service.activate(user_id, payload)


@router.delete(
    "/tutor/deactivate",
    response_model=TutorResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Pausar perfil sem remover conta acadêmica",
)
def deactivate(user_id: UserId, service: Service):
    return service.deactivate(user_id)


@router.post(
    "/sessions",
    response_model=SessionResponse,
    status_code=201,
    openapi_extra=MUTATION_SECURITY,
    summary="Criar rascunho de sessão com valor demonstrativo",
)
def create(user_id: UserId, payload: SessionCreate, service: Service):
    return service.create(user_id, payload)


@router.get(
    "/sessions/mine",
    response_model=list[SessionResponse],
    summary="Listar minhas ofertas",
)
def mine(
    user_id: UserId,
    service: Service,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return service.list_mine(user_id, limit, offset)


@router.get("/sessions", response_model=list[SessionResponse], summary="Buscar sessões publicadas")
def discover(
    service: Service,
    subject_id: UUID | None = None,
    starts_after: datetime | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    return service.list_public(subject_id, starts_after, limit, offset)


@router.get("/sessions/{session_id}", response_model=SessionResponse, summary="Detalhar sessão publicada")
def detail(session_id: UUID, service: Service):
    return service.get_public(session_id)


@router.post("/sessions/{session_id}/enroll", response_model=EnrollmentReceipt, status_code=201, openapi_extra=MUTATION_SECURITY)
def enroll(session_id: UUID, user_id: UserId, service: Service):
    return service.enroll(user_id, session_id)


@router.delete("/sessions/{session_id}/enroll", status_code=status.HTTP_204_NO_CONTENT, openapi_extra=MUTATION_SECURITY)
def cancel_enrollment(session_id: UUID, user_id: UserId, service: Service):
    service.cancel_enrollment(user_id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/bookings/mine", response_model=list[BookingResponse], summary="Listar minhas inscrições")
def bookings(user_id: UserId, service: Service):
    return service.list_bookings(user_id)


@router.patch(
    "/sessions/{session_id}",
    response_model=SessionResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Editar somente rascunho próprio",
)
def edit(session_id: UUID, user_id: UserId, payload: SessionUpdate, service: Service):
    return service.edit(user_id, session_id, payload)


@router.post(
    "/sessions/{session_id}/publish",
    response_model=SessionResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Publicar sessão futura",
)
def publish(session_id: UUID, user_id: UserId, service: Service):
    return service.publish(user_id, session_id)


@router.delete(
    "/sessions/{session_id}",
    response_model=SessionResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Cancelar oferta futura e suas inscrições simuladas",
)
def cancel(session_id: UUID, user_id: UserId, service: Service):
    return service.cancel(user_id, session_id)
