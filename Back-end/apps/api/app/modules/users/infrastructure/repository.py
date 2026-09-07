from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.users.errors import UserPersistenceError
from app.modules.users.infrastructure.models import User, UserProfile
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import (
    UserCreateData,
    UserProfileRecord,
    UserRecord,
)


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_email(self, normalized_email: str) -> UserRecord | None:
        try:
            user = self._session.scalar(
                select(User).where(func.lower(User.email) == normalized_email.lower())
            )
            return self._to_record(user)
        except SQLAlchemyError as error:
            raise UserPersistenceError() from error

    def find_by_id(self, user_id: UUID) -> UserRecord | None:
        try:
            return self._to_record(self._session.get(User, user_id))
        except SQLAlchemyError as error:
            raise UserPersistenceError() from error

    def add(self, data: UserCreateData) -> UUID:
        user_id = uuid4()
        self._session.add(
            User(
                id=user_id,
                email=data.email,
                password_hash=data.password_hash.get_secret_value(),
            )
        )
        if data.display_name is not None:
            self._session.add(
                UserProfile(
                    user_id=user_id,
                    display_name=data.display_name,
                    bio=data.bio,
                )
            )
        return user_id

    def _to_record(self, user: User | None) -> UserRecord | None:
        if user is None:
            return None

        profile = self._session.get(UserProfile, user.id)
        profile_record = UserProfileRecord.model_validate(profile) if profile else None
        return UserRecord(
            id=user.id,
            email=user.email,
            password_hash=user.password_hash,
            email_verified_at=user.email_verified_at,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
            deleted_at=user.deleted_at,
            profile=profile_record,
        )
