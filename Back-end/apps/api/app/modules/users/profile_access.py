"""Public transactional profile access for academic composition.

The caller supplies its existing session so catalog validation and profile changes
share a transaction. Persistence models remain owned by Users.
"""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.users.infrastructure.models import UserProfile
from app.modules.users.schemas import UserProfileRecord


class ProfileAccess:
    def __init__(self, session: Session):
        self._session = session

    def get(self, user_id: UUID) -> UserProfileRecord | None:
        row = self._session.get(UserProfile, user_id)
        return UserProfileRecord.model_validate(row) if row else None

    def update(self, user_id: UUID, updates: dict[str, object]) -> UserProfileRecord:
        if updates.keys() - {"institution_id", "course_id", "bio"}:
            raise ValueError("Unsupported academic profile fields")
        
        row = self._session.get(UserProfile, user_id)
        if row is None:
            # Se o perfil ainda não existe, cria um novo objeto vinculado ao user_id
            row = UserProfile(user_id=user_id, **updates)
            self._session.add(row)
        else:
            for key, value in updates.items():
                setattr(row, key, value)
        
        row.updated_at = datetime.now(UTC)
        self._session.flush()
        return UserProfileRecord.model_validate(row)