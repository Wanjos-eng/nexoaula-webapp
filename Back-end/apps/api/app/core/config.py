from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

API_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_ROOT / ".env",
        env_file_encoding="utf-8",
        hide_input_in_errors=True,
    )

    PROJECT_NAME: str = Field(default="nexoAula API", min_length=1)
    VERSION: str = Field(default="0.1.0", min_length=1)
    DATABASE_URL: str | None = None
    ENVIRONMENT: Literal["development", "test", "production"] = "production"
    AUTH_JWT_SECRET: SecretStr | None = None
    AUTH_COOKIE_SECURE: bool = True
    AUTH_ALLOWED_ORIGINS: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_auth_configuration(self) -> "Settings":
        if not self.AUTH_COOKIE_SECURE and self.ENVIRONMENT != "development":
            raise ValueError("Cookie sem Secure exige ENVIRONMENT=development.")
        if self.AUTH_JWT_SECRET is not None:
            if len(self.AUTH_JWT_SECRET.get_secret_value().encode("utf-8")) < 32:
                raise ValueError(
                    "AUTH_JWT_SECRET exige pelo menos 32 bytes aleatórios."
                )
        for origin in self.AUTH_ALLOWED_ORIGINS:
            parsed = urlsplit(origin)
            # Reject malformed/out-of-range ports before accepting the origin.
            _ = parsed.port
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.path
                or parsed.query
                or parsed.fragment
                or origin != f"{parsed.scheme}://{parsed.netloc}"
            ):
                raise ValueError(
                    "AUTH_ALLOWED_ORIGINS exige origens exatas, sem caminho."
                )
            if parsed.scheme == "http" and self.ENVIRONMENT != "development":
                raise ValueError("Origens HTTP exigem ENVIRONMENT=development.")
        return self

    @property
    def auth_cookie_name(self) -> str:
        return (
            "__Host-nexoaula_session" if self.AUTH_COOKIE_SECURE else "nexoaula_session"
        )

    def require_auth_secret(self) -> str:
        if self.AUTH_JWT_SECRET is None:
            raise RuntimeError("AUTH_JWT_SECRET não configurado.")
        return self.AUTH_JWT_SECRET.get_secret_value()

    def require_database_url(self) -> str:
        """Return a PostgreSQL URL only when a database operation needs it."""
        if not self.DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL é obrigatória para acessar o banco. "
                "Consulte .env.example e docs/environment/postgresql-local.md."
            )

        try:
            url = make_url(self.DATABASE_URL)
        except ArgumentError as error:
            raise RuntimeError("DATABASE_URL possui formato inválido.") from error

        if url.get_backend_name() != "postgresql":
            raise RuntimeError(
                "DATABASE_URL deve usar PostgreSQL; SQLite não é suportado."
            )

        return self.DATABASE_URL


settings = Settings()
