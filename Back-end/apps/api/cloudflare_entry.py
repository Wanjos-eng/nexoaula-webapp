import os
from urllib.parse import quote_plus

from workers import WorkerEntrypoint


_app = None


def _configure_cloudflare_environment(env) -> None:
    for name in (
        "ENVIRONMENT",
        "AUTH_JWT_SECRET",
        "AUTH_COOKIE_SECURE",
        "AUTH_ALLOWED_ORIGINS",
    ):
        value = getattr(env, name, None)
        if value is not None:
            os.environ[name] = str(value)

    hyperdrive = getattr(env, "HYPERDRIVE", None)
    if hyperdrive is not None:
        user = quote_plus(str(hyperdrive.user))
        password = quote_plus(str(hyperdrive.password))
        host = str(hyperdrive.host)
        port = str(hyperdrive.port)
        database = quote_plus(str(hyperdrive.database))
        os.environ["DATABASE_URL"] = (
            f"postgresql+pg8000://{user}:{password}@{host}:{port}/{database}"
        )


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        global _app

        _configure_cloudflare_environment(self.env)

        if _app is None:
            from app.main import app as fastapi_app
            _app = fastapi_app

        import asgi

        return await asgi.fetch(_app, request.js_object, self.env)
