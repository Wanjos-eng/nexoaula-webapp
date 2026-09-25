"""Integration tests for avatar upload, replacement, removal, and retrieval."""
import os
from secrets import token_urlsafe
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine
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
HEADERS = {"Origin": "https://testserver", "X-NexoAula-CSRF": "1"}
PASSWORD = "password-for-tests"

VALID_PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
VALID_JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb"


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
                app, base_url="https://testserver", cookies={}
            ) as client:
                yield client
        finally:
            app.dependency_overrides.clear()
            transaction.rollback()


def test_avatar_lifecycle_upload_replace_delete(api):
    # 1. Register and login
    email = f"avatar-{uuid4()}@example.com"
    reg = api.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "fullName": "Test Student"},
        headers=HEADERS,
    )
    assert reg.status_code == 201

    login = api.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200

    # 2. Initially, profile has no avatar
    profile_res = api.get("/api/v1/academic/profile")
    assert profile_res.status_code == 200
    assert profile_res.json()["avatarFileId"] is None

    # 3. Upload PNG avatar
    upload_res = api.post(
        "/api/v1/academic/profile/avatar",
        files={"file": ("profile.png", VALID_PNG, "image/png")},
        headers=HEADERS,
    )
    assert upload_res.status_code == 200, upload_res.text
    profile_data = upload_res.json()
    avatar_id = profile_data["avatarFileId"]
    assert avatar_id is not None
    assert "/avatar" in profile_data["avatarUrl"]

    # 4. Fetch the avatar
    get_avatar = api.get("/api/v1/academic/profile/avatar")
    assert get_avatar.status_code == 200
    assert get_avatar.content == VALID_PNG
    assert "image/png" in get_avatar.headers["content-type"]

    # Also fetch via avatarUrl
    get_via_url = api.get(profile_data["avatarUrl"])
    assert get_via_url.status_code == 200
    assert get_via_url.content == VALID_PNG

    # 5. Replace with JPEG avatar
    replace_res = api.post(
        "/api/v1/academic/profile/avatar",
        files={"file": ("new.jpg", VALID_JPEG, "image/jpeg")},
        headers=HEADERS,
    )
    assert replace_res.status_code == 200
    new_avatar_id = replace_res.json()["avatarFileId"]
    assert new_avatar_id != avatar_id

    # Verify updated content
    get_new_avatar = api.get("/api/v1/academic/profile/avatar")
    assert get_new_avatar.status_code == 200
    assert get_new_avatar.content == VALID_JPEG
    assert "image/jpeg" in get_new_avatar.headers["content-type"]

    # 6. Delete avatar
    delete_res = api.delete(
        "/api/v1/academic/profile/avatar",
        headers=HEADERS,
    )
    assert delete_res.status_code == 200
    assert delete_res.json()["avatarFileId"] is None

    # 7. Avatar is now gone (404)
    gone_avatar = api.get("/api/v1/academic/profile/avatar")
    assert gone_avatar.status_code == 404


def test_avatar_validation_rejects_invalid_mime_and_size(api):
    email = f"val-{uuid4()}@example.com"
    reg = api.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "fullName": "Test Student"},
        headers=HEADERS,
    )
    assert reg.status_code == 201
    login = api.post(
        "/api/v1/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200

    # 1. Invalid magic bytes (plain text masquerading as PNG)
    invalid_content = b"Not a PNG image at all"
    res1 = api.post(
        "/api/v1/academic/profile/avatar",
        files={"file": ("fake.png", invalid_content, "image/png")},
        headers=HEADERS,
    )
    assert res1.status_code == 422
    assert "JPEG" in res1.json()["detail"] and "PNG" in res1.json()["detail"]

    # 2. Oversized file (> 5 MB)
    large_payload = VALID_PNG + (b"\x00" * (5 * 1024 * 1024 + 1))
    res2 = api.post(
        "/api/v1/academic/profile/avatar",
        files={"file": ("big.png", large_payload, "image/png")},
        headers=HEADERS,
    )
    assert res2.status_code == 422
    assert "5 MB" in res2.json()["detail"]
