from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.academic.dependencies import get_academic_service
from app.modules.academic.errors import (
    AcademicPersistenceError,
    AcademicTermNotFoundError,
    ClassSectionAlreadyExistsError,
    ClassSectionNotFoundError,
    EnrollmentAlreadyExistsError,
    EnrollmentNotFoundError,
    InstitutionMismatchError,
    InstitutionNotFoundError,
    InvalidProfileUpdateError,
    ProfileNotFoundError,
    SubjectAlreadyExistsError,
    SubjectNotFoundError,
)
from app.modules.academic.schemas import (
    AcademicProfileResponse,
    AcademicProfileUpdate,
    ClassSectionCreate,
    ClassSectionResponse,
    EnrolledClassSectionResponse,
    EnrollmentResponse,
    ErrorResponse,
    SubjectCreate,
    SubjectResponse,
)
from app.modules.academic.service import AcademicService
from app.modules.auth.dependencies import authenticated_subject

router = APIRouter(prefix="/api/v1/academic", tags=["Academic"])


@router.get(
    "/profile",
    response_model=AcademicProfileResponse,
    summary="Consultar perfil acadêmico",
    description="Retorna o perfil acadêmico do usuário autenticado.",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
        404: {"model": ErrorResponse, "description": "Perfil não encontrado."},
    },
)
@router.get(
    "/profile/me",
    response_model=AcademicProfileResponse,
    include_in_schema=False,
)
def get_profile(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> AcademicProfileResponse:
    try:
        return service.get_profile(user_id)
    except ProfileNotFoundError as error:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error


@router.patch(
    "/profile",
    response_model=AcademicProfileResponse,
    summary="Atualizar perfil acadêmico",
    description=(
        "Atualiza campos acadêmicos do perfil (instituição, curso, bio). "
        "Apenas os campos enviados são atualizados."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
        404: {
            "model": ErrorResponse,
            "description": "Perfil ou instituição não encontrados.",
        },
        422: {
            "model": ErrorResponse,
            "description": "Dados de atualização inválidos.",
        },
    },
)
@router.put(
    "/profile",
    response_model=AcademicProfileResponse,
    include_in_schema=False,
)
@router.patch(
    "/profile/me",
    response_model=AcademicProfileResponse,
    include_in_schema=False,
)
@router.put(
    "/profile/me",
    response_model=AcademicProfileResponse,
    include_in_schema=False,
)
def update_profile(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    payload: AcademicProfileUpdate,
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> AcademicProfileResponse:
    try:
        return service.update_profile(user_id, payload)
    except (ProfileNotFoundError, InstitutionNotFoundError) as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except InvalidProfileUpdateError as error:
        raise HTTPException(
            422, detail=str(error)
        ) from error
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error


@router.post(
    "/subjects",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar disciplina",
    description="Cadastra uma disciplina manualmente, vinculada a uma instituição.",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
        404: {"model": ErrorResponse, "description": "Instituição não encontrada."},
        409: {"model": ErrorResponse, "description": "Disciplina duplicada."},
    },
)
@router.post(
    "/courses",
    response_model=SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_subject(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    payload: SubjectCreate,
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> SubjectResponse:
    try:
        return service.create_subject(payload)
    except InstitutionNotFoundError as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except SubjectAlreadyExistsError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error


@router.post(
    "/class-sections",
    response_model=ClassSectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar turma",
    description="Cadastra uma turma vinculada a uma disciplina e período acadêmico.",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
        404: {
            "model": ErrorResponse,
            "description": "Disciplina ou período acadêmico não encontrados.",
        },
        409: {"model": ErrorResponse, "description": "Turma duplicada."},
        422: {
            "model": ErrorResponse,
            "description": "Disciplina e período de instituições diferentes.",
        },
    },
)
@router.post(
    "/classes",
    response_model=ClassSectionResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_class_section(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    payload: ClassSectionCreate,
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> ClassSectionResponse:
    try:
        return service.create_class_section(payload, user_id)
    except (SubjectNotFoundError, AcademicTermNotFoundError) as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except InstitutionMismatchError as error:
        raise HTTPException(
            422, detail=str(error)
        ) from error
    except ClassSectionAlreadyExistsError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error


@router.post(
    "/class-sections/{class_section_id}/enrollment",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Acompanhar turma",
    description="Vincula o usuário autenticado a uma turma.",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
        404: {"model": ErrorResponse, "description": "Turma não encontrada."},
        409: {"model": ErrorResponse, "description": "Já acompanhando esta turma."},
    },
)
@router.post(
    "/classes/{class_section_id}/enroll",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@router.post(
    "/classes/{class_section_id}/follow",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def enroll(
    class_section_id: UUID,
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> EnrollmentResponse:
    try:
        return service.enroll(user_id, class_section_id)
    except ClassSectionNotFoundError as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except EnrollmentAlreadyExistsError as error:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=str(error)
        ) from error
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error


@router.delete(
    "/class-sections/{class_section_id}/enrollment",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deixar de acompanhar turma",
    description="Remove o vínculo do usuário autenticado com a turma.",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
        404: {"model": ErrorResponse, "description": "Vínculo não encontrado."},
    },
)
@router.delete(
    "/classes/{class_section_id}/enroll",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
)
@router.delete(
    "/classes/{class_section_id}/unfollow",
    status_code=status.HTTP_204_NO_CONTENT,
    include_in_schema=False,
)
def unenroll(
    class_section_id: UUID,
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> None:
    try:
        service.unenroll(user_id, class_section_id)
    except EnrollmentNotFoundError as error:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail=str(error)
        ) from error
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error


@router.get(
    "/enrollments",
    response_model=list[EnrolledClassSectionResponse],
    summary="Listar turmas acompanhadas",
    description="Retorna todas as turmas que o usuário autenticado acompanha.",
    responses={
        401: {"model": ErrorResponse, "description": "Não autenticado."},
    },
)
@router.get(
    "/classes/me",
    response_model=list[EnrolledClassSectionResponse],
    include_in_schema=False,
)
def list_enrollments(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    service: Annotated[AcademicService, Depends(get_academic_service)],
) -> list[EnrolledClassSectionResponse]:
    try:
        return service.list_enrollments(user_id)
    except AcademicPersistenceError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço temporariamente indisponível.",
        ) from error
