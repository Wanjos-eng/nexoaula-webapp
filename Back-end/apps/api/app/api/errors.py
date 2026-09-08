from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


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
