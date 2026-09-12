from app.modules.academic.infrastructure.unit_of_work import (
    SqlAlchemyAcademicUnitOfWork,
)
from app.modules.academic.service import AcademicService
from app.modules.auth.dependencies import get_session_factory


def get_academic_service() -> AcademicService:
    session_factory = get_session_factory()
    return AcademicService(lambda: SqlAlchemyAcademicUnitOfWork(session_factory))
