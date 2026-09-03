import runpy
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

API_ROOT = Path(__file__).resolve().parents[1]


def test_legacy_history_is_empty_and_resolves_from_any_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = Config(str(API_ROOT / "alembic.ini"))
    assert list(ScriptDirectory.from_config(config).walk_revisions()) == []
    assert config.get_main_option("sqlalchemy.url") is None


def test_migration_environment_explicitly_deferred():
    with pytest.raises(RuntimeError, match="Migrations adiadas"):
        runpy.run_path(str(API_ROOT / "alembic" / "env.py"))
