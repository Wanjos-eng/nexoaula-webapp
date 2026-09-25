from collections.abc import Callable
from uuid import UUID, uuid4
from app.core.storage import compute_sha256, default_storage, validate_avatar_file
from app.modules.academic.errors import AcademicError
from app.modules.academic.repository import AcademicUnitOfWork
from app.modules.academic.schemas import AcademicProfileResponse, AcademicProfileUpdate, CatalogKind, Input
from app.modules.users.infrastructure.models import FilePurpose


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

    def upload_avatar(
        self,
        user_id: UUID,
        content: bytes,
        original_filename: str | None = None,
        content_type: str | None = None,
    ) -> AcademicProfileResponse:
        mime_type, ext = validate_avatar_file(content, original_filename, content_type)
        checksum = compute_sha256(content)
        key = f"avatars/{user_id}/{uuid4().hex}{ext}"
        default_storage.save(key, content)

        old_key = None
        old_file_id = None
        try:
            with self._uow_factory() as uow:
                profile = uow.academic.get_profile(user_id)
                if profile is None:
                    raise AcademicError("Perfil acadêmico não encontrado.", 404)
                if profile.avatar_file_id:
                    old_file_id = profile.avatar_file_id
                    old_file = uow.academic.get_file(old_file_id)
                    if old_file:
                        old_key = old_file.storage_key
                file_record = uow.academic.create_file(
                    owner_id=user_id,
                    purpose=FilePurpose.AVATAR,
                    storage_provider="local",
                    storage_key=key,
                    mime_type=mime_type,
                    size_bytes=len(content),
                    checksum_sha256=checksum,
                    original_filename=original_filename,
                )
                result = uow.academic.set_avatar_file(user_id, file_record.id)
                if old_file_id:
                    uow.academic.delete_file(old_file_id)
                uow.commit()
        except Exception:
            default_storage.delete(key)
            raise

        if old_key:
            default_storage.delete(old_key)

        return result

    def delete_avatar(self, user_id: UUID) -> AcademicProfileResponse:
        old_key = None
        with self._uow_factory() as uow:
            profile = uow.academic.get_profile(user_id)
            if profile is None:
                raise AcademicError("Perfil acadêmico não encontrado.", 404)
            if profile.avatar_file_id:
                old_file = uow.academic.get_file(profile.avatar_file_id)
                if old_file:
                    old_key = old_file.storage_key
                uow.academic.delete_file(profile.avatar_file_id)
            result = uow.academic.set_avatar_file(user_id, None)
            uow.commit()

        if old_key:
            default_storage.delete(old_key)

        return result

    def get_avatar_file(self, user_id: UUID) -> tuple[bytes, str]:
        with self._uow_factory() as uow:
            profile = uow.academic.get_profile(user_id)
            if profile is None or not profile.avatar_file_id:
                raise AcademicError("Foto de perfil não encontrada.", 404)
            file_record = uow.academic.get_file(profile.avatar_file_id)
            if file_record is None:
                raise AcademicError("Arquivo da foto não encontrado.", 404)
            content = default_storage.read(file_record.storage_key)
            if content is None:
                raise AcademicError("Arquivo da foto não encontrado no armazenamento.", 404)
            return content, file_record.mime_type

    def create(self, kind: CatalogKind, data: Input, user_id: UUID):
        values = data.model_dump()
        with self._uow_factory() as uow:
            if kind in {"courses", "subjects", "academic-terms", "teachers"}:
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
            if kind == "subject-topics":
                self._required(uow.academic, "subjects", values["subject_id"])
                self._required(uow.academic, "topics", values["topic_id"])
            if kind == "class-section-teachers":
                section = self._required(uow.academic, "class-sections", values["class_section_id"])
                teacher = self._required(uow.academic, "teachers", values["teacher_id"])
                if section.institution_id != teacher.institution_id:
                    raise AcademicError("Professor e turma devem pertencer à mesma instituição.")
                values["institution_id"] = section.institution_id
            result = uow.academic.add(kind, values)
            uow.commit()
            return result

    def list_catalog(
        self, kind, institution_id=None, subject_id=None, limit=50, offset=0
    ):
        with self._uow_factory() as uow:
            return uow.academic.list(kind, institution_id, subject_id, limit, offset)
