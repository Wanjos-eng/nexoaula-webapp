from types import TracebackType

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.modules.users.errors import UserAlreadyExistsError, UserPersistenceError
from app.modules.users.infrastructure.repository import SqlAlchemyUserRepository
from app.modules.users.repository import UserRepository, UserUnitOfWork


class SqlAlchemyUserUnitOfWork(UserUnitOfWork):
    users: UserRepository

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self._session: Session | None = None

    def __enter__(self) -> "SqlAlchemyUserUnitOfWork":
        self._session = self._session_factory()
        self.users = SqlAlchemyUserRepository(self._session)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._session is None:
            return
        if self._session.in_transaction():
            self._session.rollback()
        self._session.close()
        self._session = None

    def commit(self) -> None:
        session = self._require_session()
        try:
            session.commit()
        except IntegrityError as error:
            session.rollback()
            constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
            if constraint_name == "uq_users_email_ci":
                raise UserAlreadyExistsError() from error
            raise UserPersistenceError() from error
        except SQLAlchemyError as error:
            session.rollback()
            raise UserPersistenceError() from error

    def rollback(self) -> None:
        self._require_session().rollback()

    def _require_session(self) -> Session:
        if self._session is None:
            raise RuntimeError("A unidade de trabalho deve ser usada dentro de um bloco with.")
        return self._session
