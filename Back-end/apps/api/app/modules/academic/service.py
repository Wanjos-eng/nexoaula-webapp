from collections.abc import Callable
from uuid import UUID
from app.modules.academic.errors import AcademicError
from app.modules.academic.repository import AcademicUnitOfWork
from app.modules.academic.schemas import AcademicProfileUpdate, CatalogKind, Input


class AcademicService:
    def __init__(self, unit_of_work_factory: Callable[[], AcademicUnitOfWork]):
        self._uow_factory = unit_of_work_factory

    @staticmethod
    def _required(repository, kind, item_id):
        item = repository.get(kind, item_id)
        if item is None:
            raise AcademicError("Contexto acadêmico não encontrado.", 404)
        return item

    def get_profile(self, user_id):
        with self._uow_factory() as uow:
            result = uow.academic.get_profile(user_id)
            if result is None:
                raise AcademicError("Perfil acadêmico não encontrado.", 404)
            return result

    def update_profile(self, user_id: UUID, data: AcademicProfileUpdate):
        updates = data.model_dump(exclude_unset=True)
        with self._uow_factory() as uow:
            profile = uow.academic.get_profile(user_id)
            if profile is None:
                raise AcademicError("Perfil acadêmico não encontrado.", 404)
            institution = updates.get("institution_id", profile.institution_id)
            course = updates.get("course_id", profile.course_id)
            if institution is not None:
                self._required(uow.academic, "institutions", institution)
            if course is not None:
                record = self._required(uow.academic, "courses", course)
                if record.institution_id != institution:
                    raise AcademicError(
                        "O curso deve pertencer à instituição selecionada."
                    )
            result = (
                uow.academic.update_profile(user_id, updates) if updates else profile
            )
            uow.commit()
            return result

    def create(self, kind: CatalogKind, data: Input, user_id: UUID):
        values = data.model_dump()
        with self._uow_factory() as uow:
            if kind in {"courses", "subjects", "academic-terms"}:
                self._required(uow.academic, "institutions", values["institution_id"])
            if kind == "class-sections":
                subject = self._required(uow.academic, "subjects", values["subject_id"])
                term = self._required(
                    uow.academic, "academic-terms", values["academic_term_id"]
                )
                if subject.institution_id != term.institution_id:
                    raise AcademicError(
                        "Disciplina e período devem pertencer à mesma instituição."
                    )
                values |= {
                    "institution_id": subject.institution_id,
                    "created_by": user_id,
                }
            result = uow.academic.add(kind, values)
            uow.commit()
            return result

    def list_catalog(
        self, kind, institution_id=None, subject_id=None, limit=50, offset=0
    ):
        with self._uow_factory() as uow:
            return uow.academic.list(kind, institution_id, subject_id, limit, offset)
