from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime
from fastapi import APIRouter, Body, Depends, Query

from app.modules.auth.dependencies import active_subject
from app.modules.marketplace.dependencies import get_marketplace_service
from app.modules.marketplace.schemas import (
    BookingHistoryResponse, BookingResponse, EnrollmentRequest, SessionDiscoveryResponse,
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    TutorActivation,
    TutorResponse,
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


@router.get("/sessions", response_model=list[SessionDiscoveryResponse], summary="Buscar ofertas futuras publicadas")
def search(user_id: UserId, service: Service, subject_id: UUID | None = None,
           topic: str | None = Query(None, max_length=200), starts_after: AwareDatetime | None = None,
           limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return service.search(subject_id, topic, starts_after, limit, offset)


@router.get("/bookings/mine", response_model=list[BookingHistoryResponse], summary="Meu histórico e recibos demonstrativos")
def bookings_mine(user_id: UserId, service: Service,
                  limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return service.bookings_mine(user_id, limit, offset)


@router.get("/sessions/{session_id}", response_model=SessionDiscoveryResponse)
def detail(session_id: UUID, user_id: UserId, service: Service):
    return service.detail(session_id)


@router.post("/sessions/{session_id}/enroll", response_model=BookingResponse, status_code=201,
             openapi_extra=MUTATION_SECURITY, summary="Inscrição simulada sem pagamento real")
def enroll(session_id: UUID, user_id: UserId, service: Service,
           payload: EnrollmentRequest = Body(default=EnrollmentRequest())):
    return service.enroll(user_id, session_id)


@router.delete("/sessions/{session_id}/enroll", response_model=BookingResponse,
               openapi_extra=MUTATION_SECURITY, summary="Cancelar minha inscrição futura")
def cancel_enrollment(session_id: UUID, user_id: UserId, service: Service,
                      payload: EnrollmentRequest = Body(default=EnrollmentRequest())):
    return service.cancel_enrollment(user_id, session_id)
