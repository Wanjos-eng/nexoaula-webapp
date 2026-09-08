import os
from datetime import UTC, datetime
from secrets import token_urlsafe
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from pydantic import SecretStr
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.modules.auth.dependencies import (
    get_authentication_service,
    get_registration_service,
)
from app.modules.auth.passwords import BcryptPasswordHasher
from app.modules.auth.security import SessionTokens
from app.modules.auth.service import AuthenticationService, RegistrationService
from app.modules.users import UserNotFoundError, UserPersistenceError, UserService
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork
from app.modules.users.schemas import UserRecord

PATH = "/api/v1/auth"
HEADERS = {"Origin": "https://testserver", "X-NexoAula-CSRF": "1"}
PAYLOAD = {"email": "lucas@example.com", "password": "senha-segura"}


class MemoryUsers:
    def __init__(self, user):
        self.user = user
        self.error = None

    def get_by_email(self, email):
        if self.error:
            raise self.error
        if self.user is None or email.strip().lower() != self.user.email:
            raise UserNotFoundError()
        return self.user

    def get_by_id(self, user_id):
        if self.error:
            raise self.error
        if self.user is None or user_id != self.user.id:
            raise UserNotFoundError()
        return self.user


@pytest.fixture
def auth(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", SecretStr(token_urlsafe(32)))
    monkeypatch.setattr(settings, "AUTH_ALLOWED_ORIGINS", ["https://testserver"])
    hasher = BcryptPasswordHasher(rounds=4)
    now = datetime.now(UTC)
    users = MemoryUsers(
        UserRecord(
            id=uuid4(),
            email=PAYLOAD["email"],
            password_hash=hasher.hash(SecretStr(PAYLOAD["password"])),
            email_verified_at=None,
            is_active=True,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
    )
    service = AuthenticationService(
        users, hasher, hasher.hash(SecretStr(token_urlsafe(32)))
    )
    app.dependency_overrides[get_authentication_service] = lambda: service
    with TestClient(app, base_url="https://testserver", headers=HEADERS) as client:
        yield client, users
    app.dependency_overrides.clear()


def test_login_cookie_me_logout_and_copied_token_limit(auth):
    client, users = auth
    response = client.post(
        f"{PATH}/login", json=PAYLOAD | {"email": " LUCAS@EXAMPLE.COM "}
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": str(users.user.id),
        "email": PAYLOAD["email"],
        "fullName": None,
        "createdAt": users.user.created_at.isoformat().replace("+00:00", "Z"),
    }
    cookie = response.headers["set-cookie"]
    assert all(
        part in cookie
        for part in (
            "__Host-nexoaula_session=",
            "HttpOnly",
            "Secure",
            "SameSite=lax",
            "Path=/",
            "expires=",
        )
    )
    assert "Domain=" not in cookie
    token = client.cookies.get(settings.auth_cookie_name)
    assert token not in response.text and "password" not in response.text
    claims = jwt.get_unverified_claims(token)
    assert set(claims) == {"sub", "iss", "aud", "iat", "nbf", "exp", "jti"}
    assert claims["exp"] - claims["iat"] == 1800
    assert client.get(f"{PATH}/me").json() == response.json()
    assert "set-cookie" not in client.get(f"{PATH}/me").headers
    logged_out = client.post(f"{PATH}/logout", json={})
    assert logged_out.status_code == 204 and not logged_out.content
    assert "Max-Age=0" in logged_out.headers["set-cookie"]
    assert "Secure" in logged_out.headers["set-cookie"]
    assert client.get(f"{PATH}/me").status_code == 401
    client.cookies.set(settings.auth_cookie_name, token)
    assert client.get(f"{PATH}/me").status_code == 200  # No denylist promised.


@pytest.mark.parametrize(
    "kind", ["wrong_password", "missing", "inactive", "deleted", "bad_hash"]
)
def test_invalid_credentials_are_generic(auth, kind):
    client, users = auth
    payload = PAYLOAD.copy()
    if kind == "wrong_password":
        payload["password"] = "incorrect"
    elif kind == "missing":
        users.user = None
    elif kind == "inactive":
        users.user = users.user.model_copy(update={"is_active": False})
    elif kind == "deleted":
        users.user = users.user.model_copy(update={"deleted_at": datetime.now(UTC)})
    else:
        users.user = users.user.model_copy(
            update={"password_hash": SecretStr("corrupted")}
        )
    response = client.post(f"{PATH}/login", json=payload)
    assert response.status_code == 401
    assert response.json() == {"detail": "Credenciais inválidas ou sessão expirada."}
    assert "set-cookie" not in response.headers
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("change", ["inactive", "deleted", "removed", "unavailable"])
def test_me_loads_current_account_state(auth, change):
    client, users = auth
    assert client.post(f"{PATH}/login", json=PAYLOAD).status_code == 200
    if change == "inactive":
        users.user = users.user.model_copy(update={"is_active": False})
    elif change == "deleted":
        users.user = users.user.model_copy(update={"deleted_at": datetime.now(UTC)})
    elif change == "removed":
        users.user = None
    else:
        users.error = UserPersistenceError()
    response = client.get(f"{PATH}/me")
    assert response.status_code == (503 if change == "unavailable" else 401)
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Origin": "https://testserver"},
        HEADERS | {"Origin": "https://evil.example"},
        HEADERS | {"Origin": "https://testserver.evil.example"},
        HEADERS | {"Origin": "null"},
        HEADERS | {"Sec-Fetch-Site": "cross-site"},
        HEADERS | {"X-NexoAula-CSRF": "0"},
        HEADERS | {"Content-Type": "text/plain"},
        {"Referer": "https://testserver@evil.example/path", "X-NexoAula-CSRF": "1"},
    ],
)
@pytest.mark.parametrize("endpoint", ["login", "logout", "register"])
def test_csrf_rejects_unsafe_requests(auth, headers, endpoint):
    client, _ = auth
    client.headers.clear()
    response = client.post(f"{PATH}/{endpoint}", json=PAYLOAD, headers=headers)
    assert response.status_code == 403
    assert response.headers["cache-control"] == "no-store"
    assert {"Origin", "Referer", "Sec-Fetch-Site"} <= set(
        response.headers["vary"].split(", ")
    )
    assert "set-cookie" not in response.headers


def test_referer_fallback_and_origin_precedence(auth):
    client, _ = auth
    client.headers.clear()
    headers = {"Referer": "https://testserver/login?next=/", "X-NexoAula-CSRF": "1"}
    assert (
        client.post(f"{PATH}/login", json=PAYLOAD, headers=headers).status_code == 200
    )
    assert (
        client.post(
            f"{PATH}/login", json=PAYLOAD, headers=headers | {"Origin": "null"}
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "payload",
    [
        PAYLOAD | {"email": "invalid"},
        PAYLOAD | {"password": ""},
        PAYLOAD | {"password": "é" * 37},
        PAYLOAD | {"unexpected": "secret-value"},
    ],
)
def test_validation_does_not_reflect_credentials(auth, payload):
    client, _ = auth
    response = client.post(f"{PATH}/login", json=payload)
    assert response.status_code == 422
    assert (
        PAYLOAD["password"] not in response.text and "secret-value" not in response.text
    )
    assert all("input" not in error for error in response.json()["detail"])


def test_login_persistence_failure_is_sanitized(auth):
    client, users = auth
    users.error = UserPersistenceError()
    response = client.post(f"{PATH}/login", json=PAYLOAD)
    assert response.status_code == 503
    assert response.json() == {"detail": "Autenticação temporariamente indisponível."}


def test_missing_secret_fails_closed_without_affecting_health(auth, monkeypatch):
    client, _ = auth
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", None)
    assert client.post(f"{PATH}/login", json=PAYLOAD).status_code == 503
    assert client.get("/health").status_code == 200


def test_openapi_contract(auth):
    client, _ = auth
    doc = client.get("/openapi.json").json()
    assert doc["paths"][f"{PATH}/login"]["post"]["responses"].keys() >= {
        "200",
        "401",
        "403",
        "422",
        "503",
    }
    assert doc["paths"][f"{PATH}/me"]["get"]["security"] == [{"APIKeyCookie": []}]
    assert set(doc["components"]["schemas"]["PublicUserResponse"]["properties"]) == {
        "id",
        "email",
        "fullName",
        "createdAt",
    }


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL is required for PostgreSQL tests",
)
def test_real_registration_login_and_account_deactivation(auth):
    client, _ = auth
    engine = create_engine(os.environ["DATABASE_URL"])
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    users = UserService(lambda: SqlAlchemyUserUnitOfWork(factory))
    hasher = BcryptPasswordHasher(rounds=4)
    service = AuthenticationService(
        users, hasher, hasher.hash(SecretStr(token_urlsafe(32)))
    )
    app.dependency_overrides[get_authentication_service] = lambda: service
    app.dependency_overrides[get_registration_service] = lambda: RegistrationService(
        users, hasher
    )
    email = f"login-{uuid4()}@example.com"
    payload = PAYLOAD | {"email": email}
    try:
        created = client.post(
            f"{PATH}/register", json=payload | {"fullName": "Lucas Almeida"}
        )
        assert created.status_code == 201
        logged_in = client.post(f"{PATH}/login", json=payload)
        assert logged_in.status_code == 200
        assert logged_in.json() == created.json()
        assert client.get(f"{PATH}/me").json() == created.json()
        with factory.begin() as session:
            session.execute(
                text("UPDATE users SET is_active=false WHERE email=:email"),
                {"email": email},
            )
        assert client.get(f"{PATH}/me").status_code == 401
        assert client.post(f"{PATH}/login", json=payload).status_code == 401
    finally:
        with factory.begin() as session:
            session.execute(
                text("DELETE FROM users WHERE email=:email"), {"email": email}
            )
        engine.dispose()


@pytest.mark.parametrize("kind", ["missing", "malformed", "expired", "wrong_signature"])
def test_invalid_session_is_401_before_user_lookup(auth, kind):
    client, users = auth
    users.error = AssertionError("Must not query users before validating the session")
    token = "malformed"
    if kind in {"expired", "wrong_signature"}:
        issued, _ = SessionTokens(settings).issue(uuid4())
        claims = jwt.get_unverified_claims(issued.get_secret_value())
        if kind == "expired":
            for key in ("iat", "nbf", "exp"):
                claims[key] -= 1900
        key = (
            token_urlsafe(32)
            if kind == "wrong_signature"
            else settings.require_auth_secret()
        )
        token = jwt.encode(claims, key, algorithm="HS256")
    if kind != "missing":
        client.cookies.set(settings.auth_cookie_name, token)
    response = client.get(f"{PATH}/me")
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_local_development_cookie_and_idempotent_logout(auth, monkeypatch):
    client, _ = auth
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "AUTH_COOKIE_SECURE", False)
    response = client.post(f"{PATH}/login", json=PAYLOAD)
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("nexoaula_session=")
    assert "Secure" not in cookie and "HttpOnly" in cookie
    for _ in range(2):
        response = client.post(f"{PATH}/logout", json={})
        assert response.status_code == 204
        assert response.headers["set-cookie"].startswith("nexoaula_session=")
        assert "Secure" not in response.headers["set-cookie"]


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL is required for PostgreSQL tests",
)
def test_real_dependency_wiring(auth, monkeypatch):
    from app.modules.auth import dependencies

    client, _ = auth
    engine = create_engine(os.environ["DATABASE_URL"])
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(dependencies, "get_session_factory", lambda: factory)
    app.dependency_overrides.clear()
    email = f"wiring-{uuid4()}@example.com"
    payload = PAYLOAD | {"email": email}
    try:
        created = client.post(
            f"{PATH}/register", json=payload | {"fullName": "Lucas Almeida"}
        )
        assert created.status_code == 201
        assert client.post(f"{PATH}/login", json=payload).json() == created.json()
        assert client.get(f"{PATH}/me").json() == created.json()
        assert (
            client.post(
                f"{PATH}/login", json=payload | {"email": "unknown@example.com"}
            ).status_code
            == 401
        )
    finally:
        with factory.begin() as session:
            session.execute(
                text("DELETE FROM users WHERE email=:email"), {"email": email}
            )
        engine.dispose()
