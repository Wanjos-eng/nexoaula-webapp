from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.academic.errors import AcademicPersistenceError
from app.modules.academic.models import (
    AcademicTerm,
    ClassSection,
    ClassSectionEnrollment,
    Institution,
    Subject,
)
from app.modules.academic.schemas import (
    AcademicProfileResponse,
    ClassSectionResponse,
    EnrolledClassSectionResponse,
    EnrollmentResponse,
    SubjectResponse,
)
from app.modules.users.infrastructure.models import UserProfile


class SqlAlchemyAcademicRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_profile(self, user_id: UUID) -> AcademicProfileResponse | None:
        try:
            profile = self._session.get(UserProfile, user_id)
            if profile is None:
                return None
            return AcademicProfileResponse.model_validate(profile)
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def update_profile(
        self, user_id: UUID, updates: dict[str, object]
    ) -> AcademicProfileResponse:
        try:
            profile = self._session.get(UserProfile, user_id)
            if profile is None:
                raise AcademicPersistenceError()
            for key, value in updates.items():
                setattr(profile, key, value)
            profile.updated_at = datetime.now(UTC)
            self._session.flush()
            return AcademicProfileResponse.model_validate(profile)
        except AcademicPersistenceError:
            raise
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def institution_exists(self, institution_id: UUID) -> bool:
        try:
            return self._session.get(Institution, institution_id) is not None
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def get_subject_institution_id(self, subject_id: UUID) -> UUID | None:
        try:
            subject = self._session.get(Subject, subject_id)
            return subject.institution_id if subject else None
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def get_academic_term_institution_id(
        self, academic_term_id: UUID
    ) -> UUID | None:
        try:
            term = self._session.get(AcademicTerm, academic_term_id)
            return term.institution_id if term else None
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def add_subject(
        self,
        institution_id: UUID,
        name: str,
        code: str | None,
        description: str | None,
    ) -> UUID:
        subject_id = uuid4()
        self._session.add(
            Subject(
                id=subject_id,
                institution_id=institution_id,
                name=name,
                code=code,
                description=description,
            )
        )
        return subject_id

    def find_subject(self, subject_id: UUID) -> SubjectResponse | None:
        try:
            subject = self._session.get(Subject, subject_id)
            if subject is None:
                return None
            return SubjectResponse.model_validate(subject)
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def add_class_section(
        self,
        subject_id: UUID,
        academic_term_id: UUID,
        institution_id: UUID,
        label: str,
        created_by: UUID,
    ) -> UUID:
        section_id = uuid4()
        self._session.add(
            ClassSection(
                id=section_id,
                institution_id=institution_id,
                subject_id=subject_id,
                academic_term_id=academic_term_id,
                label=label,
                created_by=created_by,
            )
        )
        return section_id

    def find_class_section(
        self, class_section_id: UUID
    ) -> ClassSectionResponse | None:
        try:
            section = self._session.get(ClassSection, class_section_id)
            if section is None:
                return None
            return ClassSectionResponse.model_validate(section)
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def class_section_exists(self, class_section_id: UUID) -> bool:
        try:
            return self._session.get(ClassSection, class_section_id) is not None
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def enrollment_exists(self, user_id: UUID, class_section_id: UUID) -> bool:
        try:
            return (
                self._session.get(
                    ClassSectionEnrollment, (user_id, class_section_id)
                )
                is not None
            )
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def add_enrollment(self, user_id: UUID, class_section_id: UUID) -> None:
        self._session.add(
            ClassSectionEnrollment(
                user_id=user_id, class_section_id=class_section_id
            )
        )

    def find_enrollment(
        self, user_id: UUID, class_section_id: UUID
    ) -> EnrollmentResponse | None:
        try:
            enrollment = self._session.get(
                ClassSectionEnrollment, (user_id, class_section_id)
            )
            if enrollment is None:
                return None
            return EnrollmentResponse.model_validate(enrollment)
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def remove_enrollment(self, user_id: UUID, class_section_id: UUID) -> None:
        try:
            enrollment = self._session.get(
                ClassSectionEnrollment, (user_id, class_section_id)
            )
            if enrollment is not None:
                self._session.delete(enrollment)
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error

    def list_enrollments(
        self, user_id: UUID
    ) -> list[EnrolledClassSectionResponse]:
        try:
            stmt = (
                select(
                    ClassSectionEnrollment.class_section_id,
                    ClassSection.label,
                    ClassSection.subject_id,
                    Subject.name.label("subject_name"),
                    ClassSectionEnrollment.enrolled_at,
                )
                .join(
                    ClassSection,
                    ClassSection.id == ClassSectionEnrollment.class_section_id,
                )
                .join(Subject, Subject.id == ClassSection.subject_id)
                .where(ClassSectionEnrollment.user_id == user_id)
                .order_by(ClassSectionEnrollment.enrolled_at.desc())
            )
            rows = self._session.execute(stmt).all()
            return [
                EnrolledClassSectionResponse(
                    class_section_id=row.class_section_id,
                    label=row.label,
                    subject_id=row.subject_id,
                    subject_name=row.subject_name,
                    enrolled_at=row.enrolled_at,
                )
                for row in rows
            ]
        except SQLAlchemyError as error:
            raise AcademicPersistenceError() from error
