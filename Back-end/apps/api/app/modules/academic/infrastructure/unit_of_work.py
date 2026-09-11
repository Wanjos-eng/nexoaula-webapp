from types import TracebackType

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.modules.academic.errors import (
    AcademicPersistenceError,
    ClassSectionAlreadyExistsError,
    EnrollmentAlreadyExistsError,
    SubjectAlreadyExistsError,
)
from app.modules.academic.infrastructure.repository import (
    SqlAlchemyAcademicRepository,
)
from app.modules.academic.repository import AcademicRepository, AcademicUnitOfWork


class SqlAlchemyAcademicUnitOfWork(AcademicUnitOfWork):
    academic: AcademicRepository

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self._session: Session | None = None

    def __enter__(self) -> "SqlAlchemyAcademicUnitOfWork":
        self._session = self._session_factory()
        self.academic = SqlAlchemyAcademicRepository(self._session)
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
            constraint_name = getattr(
                getattr(error.orig, "diag", None), "constraint_name", None
            )
            if constraint_name == "pk_class_section_enrollments":
                raise EnrollmentAlreadyExistsError() from error
            if constraint_name in (
                "uq_subjects_institution_id_name",
                "uq_subjects_institution_id_code",
            ):
                raise SubjectAlreadyExistsError() from error
            if constraint_name == "uq_class_sections_subject_term_label":
                raise ClassSectionAlreadyExistsError() from error
            raise AcademicPersistenceError() from error
        except SQLAlchemyError as error:
            session.rollback()
            raise AcademicPersistenceError() from error

    def rollback(self) -> None:
        self._require_session().rollback()

    def _require_session(self) -> Session:
        if self._session is None:
            raise RuntimeError(
                "A unidade de trabalho deve ser usada dentro de um bloco with."
            )
        return self._session
