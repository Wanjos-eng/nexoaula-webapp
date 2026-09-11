from collections.abc import Callable
from uuid import UUID

from app.modules.academic.errors import (
    AcademicPersistenceError,
    AcademicTermNotFoundError,
    ClassSectionNotFoundError,
    EnrollmentAlreadyExistsError,
    EnrollmentNotFoundError,
    InstitutionMismatchError,
    InstitutionNotFoundError,
    InvalidProfileUpdateError,
    ProfileNotFoundError,
    SubjectNotFoundError,
)
from app.modules.academic.repository import AcademicUnitOfWork
from app.modules.academic.schemas import (
    AcademicProfileResponse,
    AcademicProfileUpdate,
    ClassSectionCreate,
    ClassSectionResponse,
    EnrolledClassSectionResponse,
    EnrollmentResponse,
    SubjectCreate,
    SubjectResponse,
)

AcademicUnitOfWorkFactory = Callable[[], AcademicUnitOfWork]


class AcademicService:
    def __init__(self, unit_of_work_factory: AcademicUnitOfWorkFactory) -> None:
        self._uow_factory = unit_of_work_factory

    def get_profile(self, user_id: UUID) -> AcademicProfileResponse:
        with self._uow_factory() as uow:
            profile = uow.academic.get_profile(user_id)
            if profile is None:
                raise ProfileNotFoundError()
            return profile

    def update_profile(
        self, user_id: UUID, data: AcademicProfileUpdate
    ) -> AcademicProfileResponse:
        updates = data.model_dump(exclude_unset=True)

        with self._uow_factory() as uow:
            profile = uow.academic.get_profile(user_id)
            if profile is None:
                raise ProfileNotFoundError()

            if not updates:
                return profile

            # Merge current values with proposed updates for constraint check.
            new_institution_id = updates.get(
                "institution_id", profile.institution_id
            )
            new_course_id = updates.get("course_id", profile.course_id)

            if new_course_id is not None and new_institution_id is None:
                raise InvalidProfileUpdateError(
                    "courseId exige que institutionId esteja definido."
                )

            if "institution_id" in updates and updates["institution_id"] is not None:
                if not uow.academic.institution_exists(updates["institution_id"]):
                    raise InstitutionNotFoundError()

            result = uow.academic.update_profile(user_id, updates)
            uow.commit()
            return result

    def create_subject(self, data: SubjectCreate) -> SubjectResponse:
        with self._uow_factory() as uow:
            if not uow.academic.institution_exists(data.institution_id):
                raise InstitutionNotFoundError()

            subject_id = uow.academic.add_subject(
                data.institution_id, data.name, data.code, data.description
            )
            uow.commit()

            result = uow.academic.find_subject(subject_id)
            if result is None:
                raise AcademicPersistenceError()
            return result

    def create_class_section(
        self, data: ClassSectionCreate, user_id: UUID
    ) -> ClassSectionResponse:
        with self._uow_factory() as uow:
            subject_institution_id = uow.academic.get_subject_institution_id(
                data.subject_id
            )
            if subject_institution_id is None:
                raise SubjectNotFoundError()

            term_institution_id = (
                uow.academic.get_academic_term_institution_id(
                    data.academic_term_id
                )
            )
            if term_institution_id is None:
                raise AcademicTermNotFoundError()

            if subject_institution_id != term_institution_id:
                raise InstitutionMismatchError()

            section_id = uow.academic.add_class_section(
                data.subject_id,
                data.academic_term_id,
                subject_institution_id,
                data.label,
                user_id,
            )
            uow.commit()

            result = uow.academic.find_class_section(section_id)
            if result is None:
                raise AcademicPersistenceError()
            return result

    def enroll(
        self, user_id: UUID, class_section_id: UUID
    ) -> EnrollmentResponse:
        with self._uow_factory() as uow:
            if not uow.academic.class_section_exists(class_section_id):
                raise ClassSectionNotFoundError()

            if uow.academic.enrollment_exists(user_id, class_section_id):
                raise EnrollmentAlreadyExistsError()

            uow.academic.add_enrollment(user_id, class_section_id)
            uow.commit()

            result = uow.academic.find_enrollment(user_id, class_section_id)
            if result is None:
                raise AcademicPersistenceError()
            return result

    def unenroll(self, user_id: UUID, class_section_id: UUID) -> None:
        with self._uow_factory() as uow:
            if not uow.academic.enrollment_exists(user_id, class_section_id):
                raise EnrollmentNotFoundError()

            uow.academic.remove_enrollment(user_id, class_section_id)
            uow.commit()

    def list_enrollments(
        self, user_id: UUID
    ) -> list[EnrolledClassSectionResponse]:
        with self._uow_factory() as uow:
            return uow.academic.list_enrollments(user_id)
