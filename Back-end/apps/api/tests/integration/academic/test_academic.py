"""Real HTTP + JWT + PostgreSQL integration; each test owns a rollback transaction."""

import os
from datetime import datetime, UTC
from secrets import token_urlsafe
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.modules.academic.dependencies import get_academic_service
from app.modules.academic.infrastructure.unit_of_work import (
    SqlAlchemyAcademicUnitOfWork,
)
from app.modules.academic.service import AcademicService
from app.modules.auth.dependencies import (
    get_authentication_service,
    get_registration_service,
)
from app.modules.auth.passwords import BcryptPasswordHasher
from app.modules.auth.service import AuthenticationService, RegistrationService
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork
from app.modules.users.service import UserService

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"), reason="Requires migrated PostgreSQL"
)
PREFIX = "/api/v1/academic"
HEADERS = {"Origin": "https://testserver", "X-NexoAula-CSRF": "1"}
PASSWORD = "password-for-tests"


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", SecretStr(token_urlsafe(32)))
    monkeypatch.setattr(settings, "AUTH_ALLOWED_ORIGINS", ["https://testserver"])
    monkeypatch.setattr(settings, "AUTH_COOKIE_SECURE", True)
    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as connection:
        transaction = connection.begin()
        factory = sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        users = UserService(lambda: SqlAlchemyUserUnitOfWork(factory))
        hasher = BcryptPasswordHasher(rounds=4)
        auth = AuthenticationService(users, hasher, hasher.hash(SecretStr(PASSWORD)))
        academic = AcademicService(lambda: SqlAlchemyAcademicUnitOfWork(factory))
        app.dependency_overrides[get_authentication_service] = lambda: auth
        app.dependency_overrides[get_registration_service] = (
            lambda: RegistrationService(users, hasher)
        )
        app.dependency_overrides[get_academic_service] = lambda: academic
        try:
            with TestClient(
                app, base_url="https://testserver", headers=HEADERS
            ) as client:
                email = f"{uuid4()}@example.com"
                res = client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": email,
                        "password": PASSWORD,
                        "fullName": "Test Student",
                    },
                )
                assert res.status_code == 201, res.text
                uid = res.json()["id"]
                assert (
                    client.post(
                        "/api/v1/auth/login",
                        json={"email": email, "password": PASSWORD},
                    ).status_code
                    == 200
                )
                yield client, connection, uid
        finally:
            app.dependency_overrides.clear()
            transaction.rollback()
    engine.dispose()


def create(client, kind, data):
    response = client.post(f"{PREFIX}/{kind}", json=data)
    assert response.status_code == 201, response.text
    return response.json()


def catalog(client):
    institution = create(
        client,
        "institutions",
        {"name": f"University {uuid4()}", "timezone": "America/Fortaleza"},
    )
    inst = {"institutionId": institution["id"]}
    course = create(
        client, "courses", inst | {"name": "Computer Science", "code": "CS"}
    )
    subject = create(
        client, "subjects", inst | {"name": "Database Systems", "code": "DB"}
    )
    term = create(
        client,
        "academic-terms",
        inst | {"label": "2026.2", "startDate": "2026-08-01", "endDate": "2026-12-01"},
    )
    section = create(
        client,
        "class-sections",
        {"subjectId": subject["id"], "academicTermId": term["id"], "label": "A"},
    )
    return institution, course, subject, term, section


def test_complete_catalog_profile_and_read_contracts(api):
    client, connection, uid = api
    institution, course, subject, term, section = catalog(client)
    payload = {
        "institutionId": institution["id"],
        "courseId": course["id"],
        "bio": "Interesses: bancos de dados",
    }
    response = client.patch(f"{PREFIX}/profile", json=payload)
    assert response.status_code == 200, response.text
    assert response.json() | {} == client.get(f"{PREFIX}/profile").json()
    assert response.json()["courseId"] == course["id"]
    assert "password" not in response.text and "email" not in response.text
    for kind, item in zip(
        ["courses", "subjects", "academic-terms", "class-sections"],
        [course, subject, term, section],
    ):
        res = client.get(
            f"{PREFIX}/{kind}", params={"institutionId": institution["id"]}
        )
        assert res.status_code == 200 and [x["id"] for x in res.json()] == [item["id"]]
        assert res.headers["cache-control"] == "no-store"
        assert (
            client.get(
                f"{PREFIX}/{kind}",
                params={"institutionId": institution["id"], "offset": 1},
            ).json()
            == []
        )
    assert course["id"] != subject["id"]
    assert section["createdBy"] == uid
    assert (
        client.patch(
            f"{PREFIX}/profile",
            json={"institutionId": None, "courseId": None, "bio": None},
        ).status_code
        == 200
    )


@pytest.mark.parametrize(
    "field,value",
    [("courseId", "missing"), ("institutionId", "missing"), ("courseId", "foreign")],
)
def test_invalid_profile_references_do_not_persist(api, field, value):
    client, connection, uid = api
    institution, course, _, _, _ = catalog(client)
    other = create(client, "institutions", {"name": f"Other {uuid4()}"})
    initial = {"institutionId": institution["id"], "courseId": course["id"]}
    assert client.patch(f"{PREFIX}/profile", json=initial).status_code == 200
    payload = (
        {field: str(uuid4())} if value == "missing" else {"institutionId": other["id"]}
    )
    result = client.patch(f"{PREFIX}/profile", json=payload)
    assert result.status_code == (404 if value == "missing" else 422)
    assert client.get(f"{PREFIX}/profile").json()["institutionId"] == institution["id"]
    assert client.get(f"{PREFIX}/profile").json()["courseId"] == course["id"]


@pytest.mark.parametrize(
    "kind", ["courses", "subjects", "academic-terms", "class-sections"]
)
def test_duplicate_catalog_returns_409_and_transaction_recovers(api, kind):
    client, _, _ = api
    institution, course, subject, term, section = catalog(client)
    payloads = {
        "courses": {"institutionId": institution["id"], "name": course["name"]},
        "subjects": {"institutionId": institution["id"], "name": subject["name"]},
        "academic-terms": {
            "institutionId": institution["id"],
            "label": term["label"],
            "startDate": term["startDate"],
            "endDate": term["endDate"],
        },
        "class-sections": {
            "subjectId": subject["id"],
            "academicTermId": term["id"],
            "label": section["label"],
        },
    }
    assert client.post(f"{PREFIX}/{kind}", json=payloads[kind]).status_code == 409
    assert client.get(f"{PREFIX}/{kind}").status_code == 200


def test_mismatched_section_and_invalid_payloads(api):
    client, _, _ = api
    institution, _, subject, _, _ = catalog(client)
    other = create(client, "institutions", {"name": "Other institution"})
    term = create(
        client,
        "academic-terms",
        {
            "institutionId": other["id"],
            "label": "2026.2",
            "startDate": "2026-08-01",
            "endDate": "2026-12-01",
        },
    )
    assert (
        client.post(
            f"{PREFIX}/class-sections",
            json={
                "subjectId": subject["id"],
                "academicTermId": term["id"],
                "label": "X",
            },
        ).status_code
        == 422
    )
    for path, payload in [
        ("institutions", {"name": "   "}),
        ("institutions", {"name": "University", "timezone": "Invalid/Zone"}),
        ("subjects", {"institutionId": str(uuid4()), "name": "Subject"}),
        (
            "academic-terms",
            {
                "institutionId": institution["id"],
                "label": "bad",
                "startDate": "2026-12-01",
                "endDate": "2026-08-01",
            },
        ),
    ]:
        assert client.post(f"{PREFIX}/{path}", json=payload).status_code in {404, 422}


@pytest.mark.parametrize("state", ["inactive", "deleted", "missing"])
def test_real_cookie_rechecks_account_state_on_academic_routes(api, state):
    client, connection, uid = api
    if state == "inactive":
        connection.execute(
            text("UPDATE users SET is_active=false WHERE id=:id"), {"id": uid}
        )
    elif state == "deleted":
        connection.execute(
            text("UPDATE users SET deleted_at=now() WHERE id=:id"), {"id": uid}
        )
    else:
        connection.execute(text("DELETE FROM users WHERE id=:id"), {"id": uid})
    assert client.get(f"{PREFIX}/profile").status_code == 401
    assert (
        client.post(
            f"{PREFIX}/institutions", json={"name": "Must not create"}
        ).status_code
        == 401
    )


def test_profile_isolation_with_two_real_accounts(api):
    client, _, uid = api
    cookie_a = client.cookies.get(settings.auth_cookie_name)
    assert (
        client.patch(f"{PREFIX}/profile", json={"bio": "Private A"}).status_code == 200
    )
    email = f"{uuid4()}@example.com"
    assert (
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": PASSWORD, "fullName": "Second Student"},
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
        ).status_code
        == 200
    )
    assert client.get(f"{PREFIX}/profile").json()["bio"] is None
    assert (
        client.patch(
            f"{PREFIX}/profile", json={"userId": uid, "bio": "Overwrite A"}
        ).status_code
        == 422
    )
    assert client.get(f"{PREFIX}/profile/{uid}").status_code == 404
    client.cookies.clear()
    client.cookies.set(settings.auth_cookie_name, cookie_a)
    assert client.get(f"{PREFIX}/profile").json()["bio"] == "Private A"


def test_no_independent_enrollment_routes_or_table(api):
    client, connection, uid = api
    for path in ["/enrollments", "/classes/me"]:
        assert client.get(PREFIX + path).status_code == 404
    assert (
        client.post(
            f"{PREFIX}/class-sections/{uuid4()}/enrollment", json={}
        ).status_code
        == 404
    )
    assert (
        connection.scalar(text("SELECT to_regclass('class_section_enrollments')"))
        is None
    )
