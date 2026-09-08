"""Enforce the same CSRF policy for every Auth mutation, including login."""

from urllib.parse import urlsplit

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings


class AuthSecurityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not scope["path"].startswith("/api/v1/auth/"):
            await self.app(scope, receive, send)
            return

        async def secured_send(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"
                headers.add_vary_header("Origin, Referer, Sec-Fetch-Site")
            await send(message)

        headers = Headers(scope=scope)
        if scope["method"] in {"POST", "PUT", "PATCH", "DELETE"}:
            origin = headers.get("origin")
            if origin is None:
                try:
                    referer = urlsplit(headers.get("referer", ""))
                    origin = (
                        f"{referer.scheme}://{referer.netloc}"
                        if referer.hostname
                        and referer.username is None
                        and referer.password is None
                        else None
                    )
                except ValueError:
                    origin = None
            valid = (
                headers.get("content-type", "").split(";", 1)[0].strip().lower()
                == "application/json"
                and headers.get("x-nexoaula-csrf") == "1"
                and origin in settings.AUTH_ALLOWED_ORIGINS
                and headers.get("sec-fetch-site", "").lower() != "cross-site"
            )
            if not valid:
                await JSONResponse(
                    {"detail": "Origem ou proteção CSRF inválida."}, status_code=403
                )(scope, receive, secured_send)
                return
        await self.app(scope, receive, secured_send)
