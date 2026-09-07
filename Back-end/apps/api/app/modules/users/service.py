from collections.abc import Callable
from uuid import UUID

from app.modules.users.errors import (
    UserAlreadyExistsError,
    UserNotFoundError,
    UserPersistenceError,
)
from app.modules.users.repository import UserUnitOfWork
from app.modules.users.schemas import UserCreateData, UserRecord

UserUnitOfWorkFactory = Callable[[], UserUnitOfWork]


class UserService:
    def __init__(self, unit_of_work_factory: UserUnitOfWorkFactory) -> None:
        self._unit_of_work_factory = unit_of_work_factory

    def create(self, data: UserCreateData) -> UserRecord:
        normalized = UserCreateData(
            email=self.normalize_email(data.email),
            password_hash=data.password_hash,
            display_name=self._normalize_optional_text(data.display_name),
            bio=self._normalize_optional_text(data.bio),
        )

        with self._unit_of_work_factory() as unit_of_work:
            if unit_of_work.users.find_by_email(normalized.email) is not None:
                raise UserAlreadyExistsError()

            user_id = unit_of_work.users.add(normalized)
            unit_of_work.commit()
            created = unit_of_work.users.find_by_id(user_id)
            if created is None:
                raise UserPersistenceError()
            return created

    def get_by_email(self, email: str) -> UserRecord:
        with self._unit_of_work_factory() as unit_of_work:
            user = unit_of_work.users.find_by_email(self.normalize_email(email))
            if user is None:
                raise UserNotFoundError()
            return user

    def get_by_id(self, user_id: UUID) -> UserRecord:
        with self._unit_of_work_factory() as unit_of_work:
            user = unit_of_work.users.find_by_id(user_id)
            if user is None:
                raise UserNotFoundError()
            return user

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @staticmethod
    def _normalize_optional_text(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None
