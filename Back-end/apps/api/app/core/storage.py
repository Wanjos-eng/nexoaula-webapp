"""Storage provider abstraction and validation for local filesystem and object storage."""
import hashlib
import os
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from app.core.config import settings


class StorageValidationError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class StorageService(Protocol):
    def save(self, key: str, data: bytes) -> str:
        ...

    def read(self, key: str) -> bytes | None:
        ...

    def delete(self, key: str) -> bool:
        ...

    def exists(self, key: str) -> bool:
        ...

    def get_path(self, key: str) -> Path:
        ...


class LocalStorageService:
    def __init__(self, base_path: Path | str | None = None):
        self.base_path = Path(base_path or settings.STORAGE_PATH).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, key: str) -> Path:
        clean_key = key.lstrip("/\\")
        target = (self.base_path / clean_key).resolve()
        if not target.is_relative_to(self.base_path):
            raise StorageValidationError("Caminho de arquivo inválido.")
        return target

    def save(self, key: str, data: bytes) -> str:
        target = self._resolve_safe_path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        temp_target = target.with_name(f"{target.name}.tmp_{uuid4().hex}")
        try:
            temp_target.write_bytes(data)
            temp_target.replace(target)
        except Exception:
            if temp_target.exists():
                temp_target.unlink(missing_ok=True)
            raise
        return key

    def read(self, key: str) -> bytes | None:
        target = self._resolve_safe_path(key)
        if not target.is_file():
            return None
        return target.read_bytes()

    def delete(self, key: str) -> bool:
        target = self._resolve_safe_path(key)
        if target.is_file():
            target.unlink()
            return True
        return False

    def exists(self, key: str) -> bool:
        target = self._resolve_safe_path(key)
        return target.is_file()

    def get_path(self, key: str) -> Path:
        target = self._resolve_safe_path(key)
        return target


default_storage = LocalStorageService()


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def validate_avatar_file(
    content: bytes, filename: str | None = None, content_type: str | None = None
) -> tuple[str, str]:
    if not content:
        raise StorageValidationError("Arquivo vazio.", status_code=422)
    if len(content) > settings.MAX_AVATAR_SIZE_BYTES:
        max_mb = settings.MAX_AVATAR_SIZE_BYTES // (1024 * 1024)
        raise StorageValidationError(
            f"O tamanho da foto excede o limite de {max_mb} MB.", status_code=422
        )

    # Magic byte inspection
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"

    raise StorageValidationError(
        "Formato de imagem inválido. Formatos suportados: JPEG e PNG.", status_code=422
    )


def validate_teaching_plan_file(
    content: bytes, filename: str | None = None, content_type: str | None = None
) -> tuple[str, str]:
    if not content:
        raise StorageValidationError("Arquivo vazio.", status_code=422)
    if len(content) > settings.MAX_PLAN_ATTACHMENT_SIZE_BYTES:
        max_mb = settings.MAX_PLAN_ATTACHMENT_SIZE_BYTES // (1024 * 1024)
        raise StorageValidationError(
            f"O anexo excede o limite permitido de {max_mb} MB.", status_code=422
        )

    # Magic byte inspection for PDF
    if content.startswith(b"%PDF-"):
        return "application/pdf", ".pdf"

    raise StorageValidationError(
        "Formato de arquivo inválido. O plano exige um arquivo PDF.", status_code=422
    )
