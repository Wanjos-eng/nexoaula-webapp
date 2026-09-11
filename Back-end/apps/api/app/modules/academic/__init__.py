"""Public academic capabilities consumed by other modules."""

from app.modules.academic.errors import (
    AcademicPersistenceError,
    AcademicServiceError,
    AcademicTermNotFoundError,
    ClassSectionAlreadyExistsError,
    ClassSectionNotFoundError,
    EnrollmentAlreadyExistsError,
    EnrollmentNotFoundError,
    InstitutionMismatchError,
    InstitutionNotFoundError,
    InvalidProfileUpdateError,
    ProfileNotFoundError,
    SubjectAlreadyExistsError,
    SubjectNotFoundError,
)
from app.modules.academic.service import AcademicService

__all__ = [
    "AcademicPersistenceError",
    "AcademicService",
    "AcademicServiceError",
    "AcademicTermNotFoundError",
    "ClassSectionAlreadyExistsError",
    "ClassSectionNotFoundError",
    "EnrollmentAlreadyExistsError",
    "EnrollmentNotFoundError",
    "InstitutionMismatchError",
    "InstitutionNotFoundError",
    "InvalidProfileUpdateError",
    "ProfileNotFoundError",
    "SubjectAlreadyExistsError",
    "SubjectNotFoundError",
]
