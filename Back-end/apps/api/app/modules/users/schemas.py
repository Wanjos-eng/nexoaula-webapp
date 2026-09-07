from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


class UserCreateData(BaseModel):
    model_config = ConfigDict(frozen=True)

    email: str = Field(min_length=1, max_length=320)
    password_hash: SecretStr = Field(min_length=1)
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    bio: str | None = None

    @model_validator(mode="after")
    def bio_requires_a_profile(self) -> "UserCreateData":
        if self.bio is not None and self.display_name is None:
            raise ValueError("bio exige display_name para criar o perfil")
        return self


class UserProfileRecord(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    user_id: UUID
    display_name: str
    bio: str | None
    avatar_file_id: UUID | None
    institution_id: UUID | None
    course_id: UUID | None
    created_at: datetime
    updated_at: datetime


class UserRecord(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: UUID
    email: str
    password_hash: SecretStr
    email_verified_at: datetime | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    profile: UserProfileRecord | None = None
