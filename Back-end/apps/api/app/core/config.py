from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_ROOT / ".env",
        env_file_encoding="utf-8",
    )

    PROJECT_NAME: str = Field(default="nexoAula API", min_length=1)
    VERSION: str = Field(default="0.1.0", min_length=1)


settings = Settings()
