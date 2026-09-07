from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

API_ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_ROOT / ".env",
        env_file_encoding="utf-8",
    )

    PROJECT_NAME: str = Field(default="nexoAula API", min_length=1)
    VERSION: str = Field(default="0.1.0", min_length=1)
    DATABASE_URL: str | None = None

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
            raise RuntimeError("DATABASE_URL deve usar PostgreSQL; SQLite não é suportado.")

        return self.DATABASE_URL


settings = Settings()
