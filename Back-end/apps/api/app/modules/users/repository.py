from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from app.modules.users.schemas import UserCreateData, UserRecord


class UserRepository(Protocol):
    def find_by_email(self, normalized_email: str) -> UserRecord | None: ...

    def find_by_id(self, user_id: UUID) -> UserRecord | None: ...

    def add(self, data: UserCreateData) -> UUID: ...


class UserUnitOfWork(Protocol):
    users: UserRepository

    def __enter__(self) -> Self: ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...
