from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import API_ROOT, Settings


@pytest.fixture(autouse=True)
def clean_config_environment(monkeypatch):
    monkeypatch.delenv("PROJECT_NAME", raising=False)
    monkeypatch.delenv("VERSION", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)


def test_defaults_need_no_database():
    settings = Settings(_env_file=None)
    assert settings.PROJECT_NAME == "nexoAula API"
    assert settings.VERSION == "0.1.0"
    assert settings.DATABASE_URL is None
    assert set(Settings.model_fields) == {"PROJECT_NAME", "VERSION", "DATABASE_URL"}


def test_env_file_and_environment_precedence(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text('PROJECT_NAME="API de teste"\nVERSION="0.2.0"\n', encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    assert Settings(_env_file=env_file).PROJECT_NAME == "API de teste"
    monkeypatch.setenv("PROJECT_NAME", "API via ambiente")
    assert Settings(_env_file=env_file).PROJECT_NAME == "API via ambiente"


def test_default_env_path_is_anchored_to_api(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert Path(Settings.model_config["env_file"]) == API_ROOT / ".env"
    assert API_ROOT == Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("field", ["PROJECT_NAME", "VERSION"])
def test_empty_options_report_the_field(field, monkeypatch):
    monkeypatch.setenv(field, "")
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None)
    assert error.value.errors()[0]["loc"] == (field,)


def test_database_url_is_required_only_for_database_operations():
    settings = Settings(_env_file=None)

    with pytest.raises(RuntimeError, match="DATABASE_URL é obrigatória"):
        settings.require_database_url()


@pytest.mark.parametrize(
    "database_url",
    ["sqlite:///local.db", "mysql://user:password@localhost/database"],
)
def test_database_url_rejects_non_postgresql_dialects(database_url):
    settings = Settings(DATABASE_URL=database_url, _env_file=None)

    with pytest.raises(RuntimeError, match="PostgreSQL"):
        settings.require_database_url()


def test_database_url_accepts_postgresql_driver():
    database_url = "postgresql+psycopg2://user:secret@localhost:5432/nexoaula"
    settings = Settings(DATABASE_URL=database_url, _env_file=None)

    assert settings.require_database_url() == database_url
