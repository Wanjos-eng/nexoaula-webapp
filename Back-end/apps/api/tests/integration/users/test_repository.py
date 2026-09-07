import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.modules.users.errors import UserAlreadyExistsError, UserNotFoundError
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork
from app.modules.users.schemas import UserCreateData
from app.modules.users.service import UserService

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="DATABASE_URL is required for PostgreSQL repository integration tests",
)


@pytest.fixture(scope="module")
def session_factory():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        engine.dispose()


@pytest.fixture(autouse=True)
def clean_identity_tables(session_factory):
    with session_factory.begin() as session:
        session.execute(text("TRUNCATE auth_tokens, user_profiles, users CASCADE"))


def make_service(session_factory) -> UserService:
    return UserService(lambda: SqlAlchemyUserUnitOfWork(session_factory))


def test_repository_persists_identity_without_optional_profile(session_factory):
    service = make_service(session_factory)

    created = service.create(
        UserCreateData(email=" Aluno@NexoAula.TEST ", password_hash="hash-seguro")
    )

    assert created.email == "aluno@nexoaula.test"
    assert created.profile is None
    assert service.get_by_id(created.id) == created
    assert service.get_by_email("ALUNO@nexoaula.test") == created


def test_repository_persists_optional_profile_in_the_same_transaction(session_factory):
    service = make_service(session_factory)

    created = service.create(
        UserCreateData(
            email="perfil@nexoaula.test",
            password_hash="hash-seguro",
            display_name="  Perfil de Teste  ",
            bio="  Bio do perfil  ",
        )
    )

    assert created.profile is not None
    assert created.profile.user_id == created.id
    assert created.profile.display_name == "Perfil de Teste"
    assert created.profile.bio == "Bio do perfil"


def test_case_insensitive_duplicate_is_rejected_before_write(session_factory):
    service = make_service(session_factory)
    service.create(UserCreateData(email="duplicado@nexoaula.test", password_hash="hash-1"))

    with pytest.raises(UserAlreadyExistsError):
        service.create(UserCreateData(email="DUPLICADO@NEXOAULA.TEST", password_hash="hash-2"))

    with session_factory() as session:
        assert session.scalar(text("SELECT count(*) FROM users")) == 1


def test_database_constraint_handles_a_concurrent_duplicate_and_rolls_back(session_factory):
    data = UserCreateData(email="corrida@nexoaula.test", password_hash="hash-seguro")

    with SqlAlchemyUserUnitOfWork(session_factory) as first:
        first.users.add(data)
        with SqlAlchemyUserUnitOfWork(session_factory) as second:
            second.users.add(data)
            second.commit()

        with pytest.raises(UserAlreadyExistsError):
            first.commit()

    with session_factory() as session:
        assert session.scalar(text("SELECT count(*) FROM users")) == 1


def test_missing_user_uses_the_public_standard_error(session_factory):
    service = make_service(session_factory)

    with pytest.raises(UserNotFoundError):
        service.get_by_email("missing@nexoaula.test")
