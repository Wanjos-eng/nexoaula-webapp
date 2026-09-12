"""Public academic service; catalog references never grant access to group PD."""

from app.modules.academic.errors import AcademicError, AcademicPersistenceError
from app.modules.academic.service import AcademicService

__all__ = ["AcademicError", "AcademicPersistenceError", "AcademicService"]
