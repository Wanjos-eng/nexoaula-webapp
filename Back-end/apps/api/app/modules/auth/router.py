from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.config import settings
from app.modules.auth.dependencies import (
    authenticated_subject,
    get_authentication_service,
    get_registration_service,
    get_session_tokens,
)
from app.modules.auth.schemas import (
    ErrorResponse,
    LoginRequest,
    PublicUserResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.modules.auth.security import InvalidCredentialsError, SessionTokens
from app.modules.auth.service import AuthenticationService, RegistrationService
from app.modules.users import UserAlreadyExistsError, UserPersistenceError

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

NO_STORE_HEADERS = {"Cache-Control": "no-store"}


CSRF_DESCRIPTION = (
    "Exige JSON, X-NexoAula-CSRF: 1 e Origin permitido (Referer como fallback). "
    "Rejeita Sec-Fetch-Site: cross-site. "
)
CSRF_OPENAPI = {
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
            "description": "Origem exata autorizada; Referer é o fallback quando ausente.",
            "schema": {"type": "string"},
        },
        {
            "name": "Referer",
            "in": "header",
            "required": False,
            "schema": {"type": "string"},
        },
        {
            "name": "Sec-Fetch-Site",
            "in": "header",
            "required": False,
            "description": "cross-site é rejeitado.",
            "schema": {"type": "string"},
        },
    ],
}


@router.post(
    "/register",
    openapi_extra=CSRF_OPENAPI,
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar uma conta",
    description=CSRF_DESCRIPTION
    + (
        "Cria a identidade e o perfil mínimo do usuário. "
        "A operação não autentica o usuário e nunca retorna senha ou hash."
    ),
    responses={
        403: {
            "model": ErrorResponse,
            "description": "Origem ou proteção CSRF inválida.",
        },
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


AUTH_ERRORS = {
    401: {
        "model": ErrorResponse,
        "description": "Credenciais inválidas, conta indisponível ou sessão expirada.",
    },
    403: {"model": ErrorResponse, "description": "Origem ou proteção CSRF inválida."},
    503: {
        "model": ErrorResponse,
        "description": "Autenticação temporariamente indisponível.",
    },
}


@router.post(
    "/login",
    openapi_extra=CSRF_OPENAPI,
    response_model=PublicUserResponse,
    responses=AUTH_ERRORS,
    summary="Autenticar com e-mail e senha",
    description=CSRF_DESCRIPTION
    + (
        "Define cookie HttpOnly, Secure, SameSite=Lax por 30 minutos. "
        "Retorna apenas o usuário público, nunca o JWT. Sem refresh."
    ),
)
def login(
    payload: LoginRequest,
    response: Response,
    tokens: Annotated[SessionTokens, Depends(get_session_tokens)],
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> PublicUserResponse:
    user = service.login(payload)
    token, expires = tokens.issue(user.id)
    response.set_cookie(
        settings.auth_cookie_name,
        token.get_secret_value(),
        max_age=max(0, int((expires - datetime.now(UTC)).total_seconds())),
        expires=expires,
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return user


@router.get(
    "/me",
    response_model=PublicUserResponse,
    responses={key: value for key, value in AUTH_ERRORS.items() if key != 403},
    summary="Consultar usuário autenticado",
    description="Valida o JWT do cookie e consulta a conta ativa e não excluída. Sem renovação da sessão.",
)
def me(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> PublicUserResponse:
    return service.current_user(user_id)


@router.post(
    "/logout",
    status_code=204,
    openapi_extra=CSRF_OPENAPI
    | {
        "requestBody": {
            "required": False,
            "content": {"application/json": {"schema": {"type": "object"}}},
        }
    },
    responses={403: AUTH_ERRORS[403]},
    summary="Encerrar sessão no navegador",
    description=CSRF_DESCRIPTION
    + (
        "Expira o cookie, inclusive se ausente ou inválido. "
        "Não revoga cópias anteriores do JWT, que valem até expirar."
    ),
)
def logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(
        settings.auth_cookie_name,
        path="/",
        secure=settings.AUTH_COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )
    return response
