from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

API_ROOT = Path(__file__).resolve().parents[1]


def test_released_migration_chain_resolves_from_any_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    config = Config(str(API_ROOT / "alembic.ini"))
    revisions = list(ScriptDirectory.from_config(config).walk_revisions())

    assert [revision.revision for revision in revisions] == [
        "0004_academic_context",
        "0003_enrollments",
        "0002_academic_groups",
        "0001_identity",
    ]
    assert [r.down_revision for r in revisions] == [
        "0003_enrollments", "0002_academic_groups", "0001_identity", None
    ]
    assert config.get_main_option("sqlalchemy.url") is None
