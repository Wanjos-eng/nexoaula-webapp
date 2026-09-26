import os
from urllib.parse import quote_plus

from workers import WorkerEntrypoint
from app.main import app
from app.core.config import Settings, settings


_configured = False


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
        global _configured

        _configure_cloudflare_environment(self.env)

        if not _configured:
            # Keep imports in the deployment snapshot, while applying runtime
            # secrets to the shared settings object before serving requests.
            configured = Settings()
            for name in type(configured).model_fields:
                setattr(settings, name, getattr(configured, name))
            _configured = True

        import asgi

        return await asgi.fetch(app, request.js_object, self.env)
