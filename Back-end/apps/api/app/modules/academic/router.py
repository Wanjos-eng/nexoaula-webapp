from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.modules.academic.dependencies import get_academic_service
from app.modules.academic.service import AcademicService
from app.modules.academic.schemas import (
    AcademicProfileResponse,
    AcademicProfileUpdate,
    InstitutionCreate,
    InstitutionResponse,
    CourseCreate,
    CourseResponse,
    SubjectCreate,
    SubjectResponse,
    AcademicTermCreate,
    AcademicTermResponse,
    ClassSectionCreate,
    ClassSectionResponse,
)
from app.modules.auth.dependencies import active_subject

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
router = APIRouter(prefix="/api/v1/academic", tags=["Academic"])
UserId = Annotated[UUID, Depends(active_subject)]
Service = Annotated[AcademicService, Depends(get_academic_service)]


@router.get("/profile", response_model=AcademicProfileResponse)
def get_profile(user_id: UserId, service: Service):
    return service.get_profile(user_id)


@router.patch(
    "/profile", response_model=AcademicProfileResponse, openapi_extra=MUTATION_SECURITY
)
def update_profile(payload: AcademicProfileUpdate, user_id: UserId, service: Service):
    return service.update_profile(user_id, payload)


@router.post(
    "/institutions",
    response_model=InstitutionResponse,
    status_code=201,
    openapi_extra=MUTATION_SECURITY,
)
def create_institutions(payload: InstitutionCreate, user_id: UserId, service: Service):
    return service.create("institutions", payload, user_id)


@router.get("/institutions", response_model=list[InstitutionResponse])
def list_institutions(
    user_id: UserId,
    service: Service,
    institution_id: Annotated[UUID | None, Query(alias="institutionId")] = None,
    subject_id: Annotated[UUID | None, Query(alias="subjectId")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return service.list_catalog(
        "institutions", institution_id, subject_id, limit, offset
    )


@router.post(
    "/courses",
    response_model=CourseResponse,
    status_code=201,
    openapi_extra=MUTATION_SECURITY,
)
def create_courses(payload: CourseCreate, user_id: UserId, service: Service):
    return service.create("courses", payload, user_id)


@router.get("/courses", response_model=list[CourseResponse])
def list_courses(
    user_id: UserId,
    service: Service,
    institution_id: Annotated[UUID | None, Query(alias="institutionId")] = None,
    subject_id: Annotated[UUID | None, Query(alias="subjectId")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return service.list_catalog("courses", institution_id, subject_id, limit, offset)


@router.post(
    "/subjects",
    response_model=SubjectResponse,
    status_code=201,
    openapi_extra=MUTATION_SECURITY,
)
def create_subjects(payload: SubjectCreate, user_id: UserId, service: Service):
    return service.create("subjects", payload, user_id)


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(
    user_id: UserId,
    service: Service,
    institution_id: Annotated[UUID | None, Query(alias="institutionId")] = None,
    subject_id: Annotated[UUID | None, Query(alias="subjectId")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return service.list_catalog("subjects", institution_id, subject_id, limit, offset)


@router.post(
    "/academic-terms",
    response_model=AcademicTermResponse,
    status_code=201,
    openapi_extra=MUTATION_SECURITY,
)
def create_academic_terms(
    payload: AcademicTermCreate, user_id: UserId, service: Service
):
    return service.create("academic-terms", payload, user_id)


@router.get("/academic-terms", response_model=list[AcademicTermResponse])
def list_academic_terms(
    user_id: UserId,
    service: Service,
    institution_id: Annotated[UUID | None, Query(alias="institutionId")] = None,
    subject_id: Annotated[UUID | None, Query(alias="subjectId")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return service.list_catalog(
        "academic-terms", institution_id, subject_id, limit, offset
    )


@router.post(
    "/class-sections",
    response_model=ClassSectionResponse,
    status_code=201,
    openapi_extra=MUTATION_SECURITY,
)
def create_class_sections(
    payload: ClassSectionCreate, user_id: UserId, service: Service
):
    return service.create("class-sections", payload, user_id)


@router.get("/class-sections", response_model=list[ClassSectionResponse])
def list_class_sections(
    user_id: UserId,
    service: Service,
    institution_id: Annotated[UUID | None, Query(alias="institutionId")] = None,
    subject_id: Annotated[UUID | None, Query(alias="subjectId")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    return service.list_catalog(
        "class-sections", institution_id, subject_id, limit, offset
    )
