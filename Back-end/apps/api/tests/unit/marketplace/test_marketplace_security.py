from secrets import token_urlsafe
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.main import app
from app.modules.auth.dependencies import active_subject
from app.modules.marketplace.dependencies import get_marketplace_service
from app.modules.marketplace.repository import SqlAlchemyMarketplaceUnitOfWork
from app.modules.marketplace.service import MarketplaceService

P = "/api/v1/marketplace"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_ALLOWED_ORIGINS", ["https://testserver"])
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", SecretStr(token_urlsafe(48)))
    with TestClient(app, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/tutor"),
        ("GET", "/sessions/mine"),
        ("GET", "/sessions"),
        ("GET", f"/sessions/{uuid4()}"),
        ("GET", "/bookings/mine"),
        ("POST", f"/sessions/{uuid4()}/enroll"),
        ("DELETE", f"/sessions/{uuid4()}/enroll"),
        ("POST", "/tutor/activate"),
        ("DELETE", "/tutor/deactivate"),
        ("POST", "/sessions"),
        ("PATCH", f"/sessions/{uuid4()}"),
        ("POST", f"/sessions/{uuid4()}/publish"),
        ("DELETE", f"/sessions/{uuid4()}"),
    ],
)
def test_routes_require_authentication(client, method, path):
    response = client.request(
        method,
        P + path,
        json={},
        headers={"Origin": "https://testserver", "X-NexoAula-CSRF": "1"},
    )
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Origin": "https://evil.test", "X-NexoAula-CSRF": "1"},
        {"Origin": "https://testserver"},
        {
            "Origin": "https://testserver",
            "X-NexoAula-CSRF": "1",
            "Sec-Fetch-Site": "cross-site",
        },
    ],
)
def test_mutations_require_same_origin_csrf(client, headers):
    response = client.post(P + "/tutor/activate", json={}, headers=headers)
    assert (
        response.status_code == 403 and response.headers["cache-control"] == "no-store"
    )


def test_database_failure_is_generic(client):
    def broken_factory():
        raise OperationalError("private SQL", {}, Exception("password=secret"))

    service = MarketplaceService(
        lambda: SqlAlchemyMarketplaceUnitOfWork(broken_factory)
    )
    app.dependency_overrides[active_subject] = uuid4
    app.dependency_overrides[get_marketplace_service] = lambda: service
    response = client.get(P + "/tutor")
    assert response.status_code == 503
    assert "SQL" not in response.text and "secret" not in response.text


def test_openapi_documents_simulation_and_security(client):
    schema = client.get("/openapi.json").json()
    create = schema["paths"][P + "/sessions"]["post"]
    assert create["security"] and any(
        p["name"] == "X-NexoAula-CSRF" for p in create["parameters"]
    )
    assert (
        schema["components"]["schemas"]["SessionResponse"]["properties"]["simulated"][
            "const"
        ]
        is True
    )
