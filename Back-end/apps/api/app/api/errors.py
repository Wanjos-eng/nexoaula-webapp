from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.modules.auth.security import InvalidCredentialsError
from app.modules.academic.errors import AcademicError
from app.modules.users import UserPersistenceError


def _public_validation_errors(error: RequestValidationError) -> list[dict[str, Any]]:
    """Keep validation context useful without reflecting credentials or payloads."""
    return [
        {
            "type": item["type"],
            "loc": item["loc"],
            "msg": item["msg"],
        }
        for item in error.errors()
    ]


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AcademicError)
    async def academic_handler(request: Request, error: AcademicError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"detail": str(error)},
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(InvalidCredentialsError)
    async def invalid_credentials_handler(
        request: Request, error: InvalidCredentialsError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=401,
            content={"detail": "Credenciais inválidas ou sessão expirada."},
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(UserPersistenceError)
    async def persistence_handler(
        request: Request, error: UserPersistenceError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            content={"detail": "Autenticação temporariamente indisponível."},
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        del request
        return JSONResponse(
            status_code=422,
            content={"detail": _public_validation_errors(error)},
            headers={"Cache-Control": "no-store"},
        )
