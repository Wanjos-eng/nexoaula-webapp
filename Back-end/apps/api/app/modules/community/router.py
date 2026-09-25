from typing import Annotated, Literal
from pydantic import AwareDatetime
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.schemas import (
    AttendanceAdjustmentResponse,
    ChannelCreate,
    ChannelResponse,
    ChannelUpdate,
    GroupCreate,
    GroupDiscoveryResponse,
    GroupResponse,
    GroupTopicCreate,
    GroupTopicResponse,
    GroupUpdate,
    LessonOccurrenceCreate,
    LessonOccurrenceResponse,
    MembershipAction,
    MembershipResponse,
    ParticipantResponse,
    ParticipationResponse,
    PlanningCorrectionCreate,
    PlanningCorrectionDecision,
    PlanningCorrectionResponse,
    PlanningCorrectionStatus,
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
    subject_id: UUID | None = Query(default=None, alias="subjectId"),
    class_section_id: UUID | None = Query(default=None, alias="classSectionId"),
    teacher_id: UUID | None = Query(default=None, alias="teacherId"),
    subject_topic_id: UUID | None = Query(default=None, alias="subjectTopicId"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[GroupDiscoveryResponse]:
    return service.search_groups(subject, period, topic, offset, limit,
                                 **{key: value for key, value in {
                                     "subject_id": subject_id, "class_section_id": class_section_id,
                                     "teacher_id": teacher_id, "subject_topic_id": subject_topic_id,
                                 }.items() if value is not None})


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


@router.post(
    "/{group_id}/plans/{plan_id}/attachment",
    response_model=TeachingPlanResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Anexar arquivo PDF ao plano de aulas",
)
async def attach_plan_source(
    group_id: UUID,
    plan_id: UUID,
    user_id: UserId,
    service: Service,
    file: UploadFile = File(...),
) -> TeachingPlanResponse:
    content = await file.read()
    return service.attach_plan_source(
        group_id,
        plan_id,
        user_id,
        content=content,
        original_filename=file.filename,
        content_type=file.content_type,
    )


@router.delete(
    "/{group_id}/plans/{plan_id}/attachment",
    response_model=TeachingPlanResponse,
    openapi_extra=MUTATION_SECURITY,
    summary="Remover anexo do plano de aulas",
)
def remove_plan_source(
    group_id: UUID,
    plan_id: UUID,
    user_id: UserId,
    service: Service,
) -> TeachingPlanResponse:
    return service.remove_plan_source(group_id, plan_id, user_id)


@router.get(
    "/{group_id}/plans/{plan_id}/attachment",
    summary="Baixar anexo do plano de aulas",
)
def download_plan_source(
    group_id: UUID,
    plan_id: UUID,
    user_id: UserId,
    service: Service,
):
    content, filename, mime_type = service.download_plan_source(
        group_id, plan_id, user_id
    )
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-cache",
        },
    )


# --- TASK US20: Sugestões e decisões de correção do cronograma ---


@router.post("/{group_id}/planning-corrections",
             response_model=PlanningCorrectionResponse,
             status_code=status.HTTP_201_CREATED,
             summary="Sugerir correção de aula ou ocorrência",
             openapi_extra=MUTATION_SECURITY)
def create_planning_correction(
    group_id: UUID, user_id: UserId, payload: PlanningCorrectionCreate,
    service: Service,
) -> PlanningCorrectionResponse:
    return service.create_planning_correction(group_id, user_id, payload)


@router.get("/{group_id}/planning-corrections",
            response_model=list[PlanningCorrectionResponse],
            summary="Listar sugestões de correção do grupo")
def list_planning_corrections(
    group_id: UUID, user_id: UserId, service: Service,
    correction_status: PlanningCorrectionStatus | None = Query(default=None, alias="status"),
) -> list[PlanningCorrectionResponse]:
    return service.list_planning_corrections(group_id, user_id, correction_status)


@router.post("/{group_id}/planning-corrections/{correction_id}/decision",
             response_model=PlanningCorrectionResponse,
             summary="Aprovar ou rejeitar sugestão de correção",
             openapi_extra=MUTATION_SECURITY)
def decide_planning_correction(
    group_id: UUID, correction_id: UUID, user_id: UserId,
    payload: PlanningCorrectionDecision, service: Service,
) -> PlanningCorrectionResponse:
    return service.decide_planning_correction(group_id, correction_id, user_id, payload)


# --- TASK #114: Ocorrências de Aula, Frequência e Progresso ---


@router.post("/{group_id}/occurrences", response_model=LessonOccurrenceResponse,
             status_code=status.HTTP_201_CREATED, summary="Registrar ocorrência de aula",
             openapi_extra=MUTATION_SECURITY)
def create_occurrence(group_id: UUID, user_id: UserId, payload: LessonOccurrenceCreate,
                      service: Service) -> LessonOccurrenceResponse:
    return service.create_occurrence(group_id, user_id, payload)


@router.get("/{group_id}/occurrences", response_model=list[LessonOccurrenceResponse],
            summary="Listar ocorrências do grupo")
def list_occurrences(group_id: UUID, user_id: UserId, service: Service,
                     current_only: bool = Query(default=True, alias="currentOnly"),
                     scheduled_lesson_id: UUID | None = Query(default=None, alias="scheduledLessonId")) -> list[LessonOccurrenceResponse]:
    return service.list_occurrences(group_id, user_id, current_only=current_only, scheduled_lesson_id=scheduled_lesson_id)


@router.get("/{group_id}/occurrences/{occurrence_id}", response_model=LessonOccurrenceResponse,
            summary="Obter dados da ocorrência de aula")
def get_occurrence(group_id: UUID, occurrence_id: UUID, user_id: UserId,
                   service: Service) -> LessonOccurrenceResponse:
    return service.get_occurrence(group_id, occurrence_id, user_id)


# --- Rotas Pessoais de Frequência e Progresso (/api/v1/me) ---

me_router = APIRouter(prefix="/api/v1/me", tags=["Personal"])


@me_router.get("/lessons", response_model=list[ScheduledLessonResponse], summary="Meu cronograma vigente")
def user_calendar_me(user_id: UserId, service: Service,
                     start: AwareDatetime | None = None, end: AwareDatetime | None = None,
                     period: Literal["past", "future"] | None = None,
                     offset: int = Query(default=0, ge=0), limit: int = Query(default=50, ge=1, le=100)):
    return service.user_calendar(user_id, start, end, period, offset, limit)


@me_router.get("/attendance", response_model=list[StudentAttendanceResponse],
               summary="Listar frequência privada")
def list_attendance(user_id: UserId, service: Service,
                    group_id: UUID | None = Query(default=None, alias="groupId")) -> list[StudentAttendanceResponse]:
    return service.list_attendance(user_id, group_id=group_id)


@me_router.post("/attendance", response_model=StudentAttendanceResponse,
                status_code=status.HTTP_201_CREATED, summary="Registrar ou atualizar frequência privada",
                openapi_extra=MUTATION_SECURITY)
def record_attendance(user_id: UserId, payload: StudentAttendanceCreate,
                      service: Service) -> StudentAttendanceResponse:
    return service.record_attendance(user_id, payload)


@me_router.delete("/attendance/{occurrence_id}", status_code=status.HTTP_204_NO_CONTENT,
                  summary="Remover registro de frequência privada", openapi_extra=MUTATION_SECURITY)
def delete_attendance(occurrence_id: UUID, user_id: UserId, service: Service) -> None:
    service.delete_attendance(user_id, occurrence_id)


@me_router.get("/progress", response_model=list[StudentTopicProgressResponse],
               summary="Listar progresso privado de tópicos")
def list_progress(user_id: UserId, service: Service,
                  group_id: UUID | None = Query(default=None, alias="groupId")) -> list[StudentTopicProgressResponse]:
    return service.list_topic_progress(user_id, group_id=group_id)


@me_router.put("/progress/{group_topic_id}", response_model=StudentTopicProgressResponse,
               summary="Atualizar progresso privado de tópico", openapi_extra=MUTATION_SECURITY)
def update_progress(group_topic_id: UUID, user_id: UserId, payload: StudentTopicProgressUpdate,
                    service: Service) -> StudentTopicProgressResponse:
    return service.update_topic_progress(user_id, group_topic_id, payload)


@me_router.get("/attendance-adjustments", response_model=list[AttendanceAdjustmentResponse],
               summary="Listar avisos de ajuste de frequência")
def list_adjustments(user_id: UserId, service: Service,
                     unread_only: bool = Query(default=False, alias="unreadOnly")) -> list[AttendanceAdjustmentResponse]:
    return service.list_student_adjustments(user_id, unread_only=unread_only)


@me_router.patch("/attendance-adjustments/{adjustment_id}/seen", response_model=AttendanceAdjustmentResponse,
                 summary="Marcar aviso de ajuste como visto", openapi_extra=MUTATION_SECURITY)
def mark_adjustment_seen(adjustment_id: UUID, user_id: UserId,
                         service: Service) -> AttendanceAdjustmentResponse:
    return service.mark_adjustment_seen(user_id, adjustment_id)


# --- TASK #120: Canais ---

@router.get("/{group_id}/channels", response_model=list[ChannelResponse],
            summary="Listar canais do grupo")
def list_channels(group_id: UUID, user_id: UserId, service: Service) -> list[ChannelResponse]:
    return service.list_channels(group_id, user_id)


@router.post("/{group_id}/channels", response_model=ChannelResponse,
             status_code=status.HTTP_201_CREATED,
             summary="Criar canal no grupo", openapi_extra=MUTATION_SECURITY)
def create_channel(group_id: UUID, payload: ChannelCreate, user_id: UserId,
                   service: Service) -> ChannelResponse:
    return service.create_channel(group_id, user_id, payload)


@router.patch("/{group_id}/channels/{channel_id}", response_model=ChannelResponse,
              summary="Renomear canal", openapi_extra=MUTATION_SECURITY)
def update_channel(group_id: UUID, channel_id: UUID, payload: ChannelUpdate, user_id: UserId,
                   service: Service) -> ChannelResponse:
    return service.update_channel(group_id, channel_id, user_id, payload)


@router.post("/{group_id}/channels/{channel_id}/archive", response_model=ChannelResponse,
             summary="Arquivar canal", openapi_extra=MUTATION_SECURITY)
def archive_channel(group_id: UUID, channel_id: UUID, user_id: UserId,
                    service: Service) -> ChannelResponse:
    return service.archive_channel(group_id, channel_id, user_id)

