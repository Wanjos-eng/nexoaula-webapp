import os
from datetime import UTC, datetime
from uuid import uuid4

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.modules.auth.dependencies import get_registration_service
from app.modules.auth.passwords import BcryptPasswordHasher
from app.modules.auth.schemas import RegisterResponse
from app.modules.auth.service import RegistrationService
from app.modules.users import UserAlreadyExistsError, UserPersistenceError, UserService
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork

DATABASE_URL = os.getenv("DATABASE_URL")


class StubRegistrationService:
    def __init__(self, result: RegisterResponse | Exception) -> None:
        self.result = result
        self.calls = 0

    def register(self, payload):
        self.calls += 1
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


@pytest.fixture
def client_with_override():
    def build(result: RegisterResponse | Exception):
        service = StubRegistrationService(result)
        app.dependency_overrides[get_registration_service] = lambda: service
        return TestClient(app), service

    yield build
    app.dependency_overrides.clear()


def public_user() -> RegisterResponse:
    return RegisterResponse(
        id=uuid4(),
        email="lucas@example.com",
        full_name="Lucas Almeida",
        created_at=datetime.now(UTC),
    )


def valid_payload() -> dict[str, str]:
    return {
        "fullName": "Lucas Almeida",
        "email": "lucas@example.com",
        "password": "senha-segura",
    }


def test_register_returns_201_without_password_hash_or_session(client_with_override):
    client, service = client_with_override(public_user())

    response = client.post("/api/v1/auth/register", json=valid_payload())

    assert response.status_code == 201
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "id": str(service.result.id),
        "email": "lucas@example.com",
        "fullName": "Lucas Almeida",
        "createdAt": service.result.created_at.isoformat().replace("+00:00", "Z"),
    }
    serialized = response.text.lower()
    assert "password" not in serialized
    assert "token" not in serialized
    assert "set-cookie" not in response.headers


def test_register_maps_duplicate_and_persistence_errors_without_internal_details(
    client_with_override,
):
    duplicate_client, _ = client_with_override(UserAlreadyExistsError())
    duplicate = duplicate_client.post("/api/v1/auth/register", json=valid_payload())

    app.dependency_overrides.clear()
    unavailable_client, _ = client_with_override(UserPersistenceError())
    unavailable = unavailable_client.post("/api/v1/auth/register", json=valid_payload())

    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "Já existe uma conta com este e-mail."}
    assert duplicate.headers["cache-control"] == "no-store"
    assert unavailable.status_code == 503
    assert unavailable.json() == {
        "detail": "Não foi possível criar a conta agora. Tente novamente mais tarde."
    }
    assert unavailable.headers["cache-control"] == "no-store"


def test_invalid_payload_is_not_forwarded_and_does_not_reflect_plain_password(
    client_with_override,
):
    client, service = client_with_override(public_user())
    payload = valid_payload() | {"password": "segredo"}

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422
    assert response.headers["cache-control"] == "no-store"
    assert service.calls == 0
    assert "segredo" not in response.text


def test_openapi_documents_registration_payload_and_errors():
    document = TestClient(app).get("/openapi.json").json()
    operation = document["paths"]["/api/v1/auth/register"]["post"]
    request_schema = document["components"]["schemas"]["RegisterRequest"]
    response_schema = document["components"]["schemas"]["RegisterResponse"]

    assert operation["responses"].keys() >= {"201", "409", "422", "503"}
    assert request_schema["required"] == ["fullName", "email", "password"]
    assert set(response_schema["properties"]) == {"id", "email", "fullName", "createdAt"}
    assert "password" not in response_schema["properties"]


@pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL is required for PostgreSQL tests")
def test_register_persists_a_bcrypt_hash_and_rejects_case_insensitive_duplicate():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    service = RegistrationService(
        UserService(lambda: SqlAlchemyUserUnitOfWork(session_factory)),
        BcryptPasswordHasher(rounds=4),
    )
    app.dependency_overrides[get_registration_service] = lambda: service

    try:
        with session_factory.begin() as session:
            session.execute(text("TRUNCATE auth_tokens, user_profiles, users CASCADE"))

        with TestClient(app) as client:
            created = client.post("/api/v1/auth/register", json=valid_payload())
            duplicate = client.post(
                "/api/v1/auth/register",
                json=valid_payload() | {"email": "LUCAS@EXAMPLE.COM"},
            )

        with session_factory() as session:
            stored = session.execute(
                text(
                    "SELECT u.email, u.password_hash, p.display_name "
                    "FROM users u JOIN user_profiles p ON p.user_id = u.id"
                )
            ).one()
            count = session.scalar(text("SELECT count(*) FROM users"))

        assert created.status_code == 201
        assert duplicate.status_code == 409
        assert count == 1
        assert stored.email == "lucas@example.com"
        assert stored.display_name == "Lucas Almeida"
        assert stored.password_hash != valid_payload()["password"]
        assert bcrypt.checkpw(
            valid_payload()["password"].encode(), stored.password_hash.encode()
        )
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
