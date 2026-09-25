from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile

from app.modules.academic.dependencies import get_academic_service
from app.modules.academic.schemas import AcademicProfileResponse
from app.modules.academic.service import AcademicService
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

router = APIRouter(prefix="/api/v1/users", tags=["Users"])
UserId = Annotated[UUID, Depends(active_subject)]
Service = Annotated[AcademicService, Depends(get_academic_service)]


@router.post(
    "/me/avatar",
    response_model=AcademicProfileResponse,
    openapi_extra=MUTATION_SECURITY,
)
async def upload_me_avatar(
    user_id: UserId,
    service: Service,
    file: UploadFile = File(...),
):
    content = await file.read()
    return service.upload_avatar(
        user_id,
        content=content,
        original_filename=file.filename,
        content_type=file.content_type,
    )


@router.delete(
    "/me/avatar",
    response_model=AcademicProfileResponse,
    openapi_extra=MUTATION_SECURITY,
)
def delete_me_avatar(user_id: UserId, service: Service):
    return service.delete_avatar(user_id)


@router.get("/me/avatar")
def get_me_avatar(user_id: UserId, service: Service):
    content, mime_type = service.get_avatar_file(user_id)
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/{target_user_id}/avatar")
def get_user_avatar(target_user_id: UUID, service: Service):
    content, mime_type = service.get_avatar_file(target_user_id)
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
