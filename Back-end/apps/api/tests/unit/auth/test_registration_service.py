from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import SecretStr

from app.modules.auth.schemas import RegisterRequest
from app.modules.auth.service import RegistrationService
from app.modules.users import UserCreateData, UserPersistenceError
from app.modules.users.schemas import UserProfileRecord, UserRecord


class RecordingHasher:
    password: SecretStr | None = None

    def hash(self, password: SecretStr) -> SecretStr:
        self.password = password
        return SecretStr("hash-irreversivel")


class RecordingUsers:
    data: UserCreateData | None = None

    def __init__(self, *, with_profile: bool = True) -> None:
        self.with_profile = with_profile

    def create(self, data: UserCreateData) -> UserRecord:
        self.data = data
        now = datetime.now(UTC)
        user_id = uuid4()
        profile = (
            UserProfileRecord(
                user_id=user_id,
                display_name=data.display_name or "",
                bio=None,
                avatar_file_id=None,
                institution_id=None,
                course_id=None,
                created_at=now,
                updated_at=now,
            )
            if self.with_profile
            else None
        )
        return UserRecord(
            id=user_id,
            email=data.email.lower(),
            password_hash=data.password_hash,
            email_verified_at=None,
            is_active=True,
            created_at=now,
            updated_at=now,
            deleted_at=None,
            profile=profile,
        )


def make_request() -> RegisterRequest:
    return RegisterRequest(
        fullName="Lucas Almeida",
        email="Lucas@Example.com",
        password="senha-segura",
    )


def test_registration_hashes_password_and_returns_only_public_data():
    users = RecordingUsers()
    hasher = RecordingHasher()
    service = RegistrationService(users, hasher)  # type: ignore[arg-type]

    result = service.register(make_request())

    assert hasher.password is not None
    assert hasher.password.get_secret_value() == "senha-segura"
    assert users.data is not None
    assert users.data.password_hash.get_secret_value() == "hash-irreversivel"
    assert users.data.display_name == "Lucas Almeida"
    assert result.email == "lucas@example.com"
    assert result.full_name == "Lucas Almeida"
    assert "password" not in result.model_dump()


def test_registration_requires_the_minimum_profile_created_with_the_identity():
    service = RegistrationService(  # type: ignore[arg-type]
        RecordingUsers(with_profile=False), RecordingHasher()
    )

    with pytest.raises(UserPersistenceError):
        service.register(make_request())
