from typing import Any, Protocol, Self
from uuid import UUID
from app.modules.academic.schemas import AcademicProfileResponse, CatalogKind, Output


class AcademicRepository(Protocol):
    def get_profile(self, user_id: UUID) -> AcademicProfileResponse | None: ...
    def update_profile(
        self, user_id: UUID, updates: dict[str, object]
    ) -> AcademicProfileResponse: ...
    def get(self, kind: CatalogKind, item_id: UUID) -> Output | None: ...
    def add(self, kind: CatalogKind, values: dict[str, object]) -> Output: ...
    def list(
        self,
        kind: CatalogKind,
        institution_id: UUID | None,
        subject_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[Output]: ...
    def get_file(self, file_id: UUID) -> Any | None: ...
    def create_file(
        self,
        owner_id: UUID,
        purpose: Any,
        storage_provider: str,
        storage_key: str,
        mime_type: str,
        size_bytes: int,
        checksum_sha256: str | None = None,
        original_filename: str | None = None,
    ) -> Any: ...
    def delete_file(self, file_id: UUID) -> None: ...
    def set_avatar_file(
        self, user_id: UUID, file_id: UUID | None
    ) -> AcademicProfileResponse: ...


class AcademicUnitOfWork(Protocol):
    academic: AcademicRepository

    def __enter__(self) -> Self: ...
    def __exit__(self, exc_type, exc_value, traceback) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
