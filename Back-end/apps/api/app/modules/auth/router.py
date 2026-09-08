from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.modules.auth.dependencies import get_registration_service
from app.modules.auth.schemas import ErrorResponse, RegisterRequest, RegisterResponse
from app.modules.auth.service import RegistrationService
from app.modules.users import UserAlreadyExistsError, UserPersistenceError

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

NO_STORE_HEADERS = {"Cache-Control": "no-store"}


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar uma conta",
    description=(
        "Cria a identidade e o perfil mínimo do usuário. "
        "A operação não autentica o usuário e nunca retorna senha ou hash."
    ),
    responses={
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "Já existe uma conta com o e-mail informado.",
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ErrorResponse,
            "description": "A persistência está temporariamente indisponível.",
        },
    },
)
def register(
    payload: RegisterRequest,
    response: Response,
    service: Annotated[RegistrationService, Depends(get_registration_service)],
) -> RegisterResponse:
    response.headers.update(NO_STORE_HEADERS)
    try:
        return service.register(payload)
    except UserAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
            headers=NO_STORE_HEADERS,
        ) from error
    except UserPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível criar a conta agora. Tente novamente mais tarde.",
            headers=NO_STORE_HEADERS,
        ) from error
