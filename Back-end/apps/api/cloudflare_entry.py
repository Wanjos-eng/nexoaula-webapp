import os
from urllib.parse import quote_plus

from workers import asgi, env


def _configure_cloudflare_environment() -> None:
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


_configure_cloudflare_environment()

from app.main import app  # noqa: E402

Default = asgi.entrypoint(app)
