"""Academic HTTP boundary checks run even without PostgreSQL."""

from secrets import token_urlsafe
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from app.core.config import settings
from app.main import app
from app.modules.academic.dependencies import get_academic_service
from app.modules.auth.dependencies import get_authentication_service
from app.modules.auth.security import InvalidCredentialsError, SessionTokens


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", SecretStr(token_urlsafe(32)))
    monkeypatch.setattr(settings, "AUTH_ALLOWED_ORIGINS", ["https://testserver"])
    monkeypatch.setattr(settings, "AUTH_COOKIE_SECURE", True)
    with TestClient(app, base_url="https://testserver") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "path,method",
    [
        ("profile", "patch"),
        ("institutions", "post"),
        ("courses", "post"),
        ("subjects", "post"),
        ("academic-terms", "post"),
        ("class-sections", "post"),
    ],
)
@pytest.mark.parametrize("kind", ["missing", "foreign", "cross-site", "simple"])
def test_academic_mutations_reject_missing_or_untrusted_csrf(
    client, path, method, kind
):
    headers = {"Origin": "https://testserver", "X-NexoAula-CSRF": "1"}
    if kind == "missing":
        headers.pop("X-NexoAula-CSRF")
    elif kind == "foreign":
        headers["Origin"] = "https://untrusted.example"
    elif kind == "cross-site":
        headers["Sec-Fetch-Site"] = "cross-site"
    else:
        headers["Content-Type"] = "text/plain"
    response = client.request(
        method, "/api/v1/academic/" + path, headers=headers, json={}
    )
    assert response.status_code == 403
    assert response.headers["cache-control"] == "no-store"


def test_account_validation_is_not_bypassed_by_valid_jwt(client):
    class DisabledAccount:
        def current_user(self, user_id):
            raise InvalidCredentialsError()

    class NeverUseAcademic:
        def get_profile(self, user_id):
            pytest.fail("Academic service must not run for an invalid account")

    app.dependency_overrides[get_authentication_service] = lambda: DisabledAccount()
    app.dependency_overrides[get_academic_service] = lambda: NeverUseAcademic()
    token, _ = SessionTokens(settings).issue(uuid4())
    client.cookies.set(settings.auth_cookie_name, token.get_secret_value())
    assert client.get("/api/v1/academic/profile").status_code == 401


def test_unauthenticated_profile_is_rejected(client):
    assert client.get("/api/v1/academic/profile").status_code == 401
