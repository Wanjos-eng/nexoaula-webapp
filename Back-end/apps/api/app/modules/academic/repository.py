from types import TracebackType
from typing import Any, Protocol, Self
from uuid import UUID

from app.modules.academic.schemas import (
    AcademicProfileResponse,
    ClassSectionResponse,
    EnrolledClassSectionResponse,
    EnrollmentResponse,
    SubjectResponse,
)


class AcademicRepository(Protocol):
    def get_profile(self, user_id: UUID) -> AcademicProfileResponse | None: ...

    def update_profile(
        self, user_id: UUID, updates: dict[str, Any]
    ) -> AcademicProfileResponse: ...

    def institution_exists(self, institution_id: UUID) -> bool: ...

    def get_subject_institution_id(self, subject_id: UUID) -> UUID | None: ...

    def get_academic_term_institution_id(
        self, academic_term_id: UUID
    ) -> UUID | None: ...

    def add_subject(
        self,
        institution_id: UUID,
        name: str,
        code: str | None,
        description: str | None,
    ) -> UUID: ...

    def find_subject(self, subject_id: UUID) -> SubjectResponse | None: ...

    def add_class_section(
        self,
        subject_id: UUID,
        academic_term_id: UUID,
        institution_id: UUID,
        label: str,
        created_by: UUID,
    ) -> UUID: ...

    def find_class_section(
        self, class_section_id: UUID
    ) -> ClassSectionResponse | None: ...

    def class_section_exists(self, class_section_id: UUID) -> bool: ...

    def enrollment_exists(self, user_id: UUID, class_section_id: UUID) -> bool: ...

    def add_enrollment(self, user_id: UUID, class_section_id: UUID) -> None: ...

    def find_enrollment(
        self, user_id: UUID, class_section_id: UUID
    ) -> EnrollmentResponse | None: ...

    def remove_enrollment(self, user_id: UUID, class_section_id: UUID) -> None: ...

    def list_enrollments(
        self, user_id: UUID
    ) -> list[EnrolledClassSectionResponse]: ...


class AcademicUnitOfWork(Protocol):
    academic: AcademicRepository

    def __enter__(self) -> Self: ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...
