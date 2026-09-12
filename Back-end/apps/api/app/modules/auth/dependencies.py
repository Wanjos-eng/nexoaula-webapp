from functools import lru_cache
from secrets import token_urlsafe
from typing import Annotated
from uuid import UUID


from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyCookie
from pydantic import SecretStr
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.session import create_database_engine, create_session_factory
from app.modules.auth.passwords import BcryptPasswordHasher
from app.modules.auth.security import InvalidCredentialsError, SessionTokens
from app.modules.auth.service import AuthenticationService, RegistrationService
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


@lru_cache
def get_dummy_password_hash() -> SecretStr:
    return get_password_hasher().hash(SecretStr(token_urlsafe(32)))


def get_session_tokens() -> SessionTokens:
    try:
        return SessionTokens(settings)
    except RuntimeError:
        raise HTTPException(503, "Autenticação temporariamente indisponível.") from None


def get_authentication_service() -> AuthenticationService:
    try:
        users = get_user_service()
    except RuntimeError:
        raise HTTPException(503, "Autenticação temporariamente indisponível.") from None
    return AuthenticationService(
        users, get_password_hasher(), get_dummy_password_hash()
    )


cookie_session = APIKeyCookie(name=settings.auth_cookie_name, auto_error=False)


def authenticated_subject(
    request: Request,
    _cookie: Annotated[str | None, Depends(cookie_session)] = None,
) -> UUID:
    token = request.cookies.get(settings.auth_cookie_name) or _cookie
    if not token:
        raise InvalidCredentialsError()

    tokens_dep = request.app.dependency_overrides.get(
        get_session_tokens, get_session_tokens
    )
    tokens: SessionTokens = tokens_dep()
    return tokens.subject(token)


def active_subject(
    user_id: Annotated[UUID, Depends(authenticated_subject)],
    service: Annotated[AuthenticationService, Depends(get_authentication_service)],
) -> UUID:
    service.current_user(user_id)
    return user_id
