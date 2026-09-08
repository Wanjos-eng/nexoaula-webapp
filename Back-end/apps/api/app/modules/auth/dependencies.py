from functools import lru_cache

from sqlalchemy.orm import Session, sessionmaker

from app.db.session import create_database_engine, create_session_factory
from app.modules.auth.passwords import BcryptPasswordHasher
from app.modules.auth.service import RegistrationService
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork
from app.modules.users.service import UserService


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    """Create the process-wide pool only when a database endpoint is used."""
    return create_session_factory(create_database_engine())


@lru_cache
def get_password_hasher() -> BcryptPasswordHasher:
    return BcryptPasswordHasher()


def get_user_service() -> UserService:
    session_factory = get_session_factory()
    return UserService(lambda: SqlAlchemyUserUnitOfWork(session_factory))


def get_registration_service() -> RegistrationService:
    return RegistrationService(get_user_service(), get_password_hasher())
