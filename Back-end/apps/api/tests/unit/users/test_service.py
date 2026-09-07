from datetime import UTC, datetime
from types import TracebackType
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.modules.users.errors import (
    UserAlreadyExistsError,
    UserNotFoundError,
    UserPersistenceError,
)
from app.modules.users.repository import UserRepository, UserUnitOfWork
from app.modules.users.schemas import UserCreateData, UserRecord
from app.modules.users.service import UserService


def make_record(*, email: str) -> UserRecord:
    now = datetime.now(UTC)
    return UserRecord(
        id=uuid4(),
        email=email,
        password_hash="hash-seguro",
        email_verified_at=None,
        is_active=True,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


class FakeUserRepository(UserRepository):
    def __init__(self, records: list[UserRecord] | None = None) -> None:
        self.records = {record.id: record for record in records or []}
        self.added: UserCreateData | None = None

    def find_by_email(self, normalized_email: str) -> UserRecord | None:
        return next(
            (record for record in self.records.values() if record.email.lower() == normalized_email),
            None,
        )

    def find_by_id(self, user_id: UUID) -> UserRecord | None:
        return self.records.get(user_id)

    def add(self, data: UserCreateData) -> UUID:
        self.added = data
        record = make_record(email=data.email)
        self.records[record.id] = record
        return record.id


class FakeUserUnitOfWork(UserUnitOfWork):
    def __init__(
        self,
        repository: FakeUserRepository,
        *,
        commit_error: Exception | None = None,
    ) -> None:
        self.users = repository
        self.commit_error = commit_error
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self) -> "FakeUserUnitOfWork":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if exc_type is not None:
            self.rollback()

    def commit(self) -> None:
        if self.commit_error is not None:
            self.rollback()
            raise self.commit_error
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


def test_create_normalizes_email_and_optional_profile_text():
    repository = FakeUserRepository()
    unit_of_work = FakeUserUnitOfWork(repository)
    service = UserService(lambda: unit_of_work)

    created = service.create(
        UserCreateData(
            email="  Aluno@NexoAula.TEST  ",
            password_hash="hash-seguro",
            display_name="  Aluno Teste  ",
            bio="  Minha bio  ",
        )
    )

    assert created.email == "aluno@nexoaula.test"
    assert repository.added is not None
    assert repository.added.display_name == "Aluno Teste"
    assert repository.added.bio == "Minha bio"
    assert unit_of_work.commits == 1


def test_create_without_profile_is_supported():
    repository = FakeUserRepository()
    service = UserService(lambda: FakeUserUnitOfWork(repository))

    service.create(UserCreateData(email="aluno@example.test", password_hash="hash-seguro"))

    assert repository.added is not None
    assert repository.added.display_name is None
    assert repository.added.bio is None


def test_password_hash_is_masked_in_public_record_representations():
    record = make_record(email="aluno@example.test")

    assert "hash-seguro" not in repr(record)
    assert record.password_hash.get_secret_value() == "hash-seguro"


def test_bio_requires_an_optional_profile_to_exist():
    with pytest.raises(ValidationError, match="bio exige display_name"):
        UserCreateData(
            email="aluno@example.test",
            password_hash="hash-seguro",
            bio="Bio sem perfil",
        )


def test_duplicate_email_has_a_stable_error_and_does_not_write():
    existing = make_record(email="aluno@example.test")
    repository = FakeUserRepository([existing])
    unit_of_work = FakeUserUnitOfWork(repository)
    service = UserService(lambda: unit_of_work)

    with pytest.raises(UserAlreadyExistsError, match="Já existe uma conta"):
        service.create(UserCreateData(email="ALUNO@example.test", password_hash="outro-hash"))

    assert repository.added is None
    assert unit_of_work.commits == 0
    assert unit_of_work.rollbacks == 1


def test_get_by_email_and_id_return_the_same_user():
    existing = make_record(email="aluno@example.test")
    repository = FakeUserRepository([existing])
    service = UserService(lambda: FakeUserUnitOfWork(repository))

    assert service.get_by_email(" ALUNO@EXAMPLE.TEST ") == existing
    assert service.get_by_id(existing.id) == existing


def test_missing_user_has_a_stable_error():
    service = UserService(lambda: FakeUserUnitOfWork(FakeUserRepository()))

    with pytest.raises(UserNotFoundError, match="Usuário não encontrado"):
        service.get_by_email("missing@example.test")
    with pytest.raises(UserNotFoundError, match="Usuário não encontrado"):
        service.get_by_id(uuid4())


def test_persistence_failure_propagates_standard_error_after_rollback():
    unit_of_work = FakeUserUnitOfWork(
        FakeUserRepository(),
        commit_error=UserPersistenceError(),
    )
    service = UserService(lambda: unit_of_work)

    with pytest.raises(UserPersistenceError, match="Não foi possível persistir"):
        service.create(UserCreateData(email="aluno@example.test", password_hash="hash-seguro"))

    assert unit_of_work.rollbacks >= 1
