from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.modules.academic.errors import AcademicError, AcademicPersistenceError
from app.modules.academic.infrastructure.repository import SqlAlchemyAcademicRepository


class SqlAlchemyAcademicUnitOfWork:
    def __init__(self, session_factory):
        self._session_factory = session_factory
        self._session = None

    def __enter__(self):
        self._session = self._session_factory()
        self.academic = SqlAlchemyAcademicRepository(self._session)
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            if self._session.in_transaction():
                self._session.rollback()
        finally:
            self._session.close()
            self._session = None
        if isinstance(exc_value, IntegrityError):
            code = getattr(exc_value.orig, "pgcode", None)
            if code == "23505":
                raise AcademicError(
                    "Já existe um registro com esses dados.", 409
                ) from exc_value
            if code in {"23503", "23514"}:
                raise AcademicError(
                    "Referência acadêmica ou dados inválidos.", 422
                ) from exc_value
        if isinstance(exc_value, SQLAlchemyError):
            raise AcademicPersistenceError() from exc_value

    def commit(self):
        self._session.commit()

    def rollback(self):
        self._session.rollback()
