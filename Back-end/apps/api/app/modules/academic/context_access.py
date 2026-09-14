"""Public catalog validation in the caller's transaction; grants no group access."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.academic.models import ClassSection, Subject


class AcademicContextAccess:
    def __init__(self, session: Session):
        self._session = session

    def subject_exists(self, subject_id: UUID) -> bool:
        return self._session.get(Subject, subject_id) is not None

    def section_matches(self, section_id: UUID, subject_id: UUID) -> bool:
        row = self._session.get(ClassSection, section_id)
        return row is not None and row.subject_id == subject_id
