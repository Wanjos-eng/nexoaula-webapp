import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="DATABASE_URL is required for PostgreSQL migration integration tests",
)


@pytest.fixture(scope="module")
def database_engine():
    engine = create_engine(DATABASE_URL)
    try:
        yield engine
    finally:
        engine.dispose()


def test_only_identity_tables_are_released(database_engine):
    tables = set(inspect(database_engine).get_table_names())

    assert tables == {
        "alembic_version",
        "users",
        "user_profiles",
        "auth_tokens",
        "academic_terms",
        "subjects",
        # Add any other tables that are being created in your migration
    }


def test_identity_columns_match_the_approved_model(database_engine):
    inspector = inspect(database_engine)
    expected = {
        "users": {
            "id",
            "email",
            "password_hash",
            "email_verified_at",
            "is_active",
            "created_at",
            "updated_at",
            "deleted_at",
        },
        "user_profiles": {
            "user_id",
            "display_name",
            "bio",
            "avatar_file_id",
            "institution_id",
            "course_id",
            "created_at",
            "updated_at",
        },
        "auth_tokens": {
            "id",
            "user_id",
            "type",
            "token_hash",
            "expires_at",
            "used_at",
            "revoked_at",
            "created_at",
        },
    }

    for table, columns in expected.items():
        assert {column["name"] for column in inspector.get_columns(table)} == columns


def test_constraints_indexes_and_enum_match_the_approved_model(database_engine):
    with database_engine.connect() as connection:
        index_rows = connection.execute(
            text(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE schemaname = current_schema() AND tablename IN "
                "('users', 'auth_tokens')"
            )
        ).mappings()
        indexes = {row["indexname"]: row["indexdef"] for row in index_rows}
        enum_values = connection.execute(
            text(
                "SELECT enumlabel FROM pg_enum "
                "JOIN pg_type ON pg_type.oid = pg_enum.enumtypid "
                "WHERE pg_type.typname = 'auth_token_type' ORDER BY enumsortorder"
            )
        ).scalars().all()

    assert "UNIQUE" in indexes["uq_users_email_ci"]
    assert "lower((email)::text)" in indexes["uq_users_email_ci"]
    assert "ix_auth_tokens_user_type_expires_at" in indexes
    assert enum_values == ["email_verification", "password_reset"]

    inspector = inspect(database_engine)
    profile_fks = inspector.get_foreign_keys("user_profiles")
    token_fks = inspector.get_foreign_keys("auth_tokens")
    assert [(fk["referred_table"], fk["options"]["ondelete"]) for fk in profile_fks] == [
        ("users", "CASCADE")
    ]
    assert [(fk["referred_table"], fk["options"]["ondelete"]) for fk in token_fks] == [
        ("users", "CASCADE")
    ]
    assert {constraint["name"] for constraint in inspector.get_check_constraints("user_profiles")} == {
        "chk_user_profile_course_requires_institution"
    }
    assert {constraint["name"] for constraint in inspector.get_unique_constraints("auth_tokens")} == {
        "uq_auth_tokens_token_hash"
    }


def test_email_is_unique_without_case_sensitivity(database_engine):
    first_id = uuid4()
    with database_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, email, password_hash) "
                "VALUES (:id, 'Aluno@NexoAula.test', 'hash-seguro')"
            ),
            {"id": first_id},
        )

    with pytest.raises(IntegrityError):
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users (id, email, password_hash) "
                    "VALUES (:id, 'aluno@nexoaula.test', 'outro-hash')"
                ),
                {"id": uuid4()},
            )


def test_profile_and_token_are_removed_with_the_user(database_engine):
    user_id = uuid4()
    with database_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id, email, password_hash) "
                "VALUES (:id, :email, 'hash-seguro')"
            ),
            {"id": user_id, "email": f"cascade-{user_id}@nexoaula.test"},
        )
        connection.execute(
            text(
                "INSERT INTO user_profiles (user_id, display_name) "
                "VALUES (:user_id, 'Aluno de teste')"
            ),
            {"user_id": user_id},
        )
        connection.execute(
            text(
                "INSERT INTO auth_tokens (user_id, type, token_hash, expires_at) "
                "VALUES (:user_id, 'email_verification', :token_hash, now() + interval '1 hour')"
            ),
            {"user_id": user_id, "token_hash": f"token-{user_id}"},
        )
        connection.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})

        assert connection.scalar(
            text("SELECT count(*) FROM user_profiles WHERE user_id = :id"), {"id": user_id}
        ) == 0
        assert connection.scalar(
            text("SELECT count(*) FROM auth_tokens WHERE user_id = :id"), {"id": user_id}
        ) == 0
