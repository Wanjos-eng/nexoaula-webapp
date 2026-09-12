from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GroupVisibility(str, Enum):
    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


class JoinPolicy(str, Enum):
    OPEN = "open"
    APPROVAL_REQUIRED = "approval_required"
    INVITE_ONLY = "invite_only"


class GroupStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    CLOSED = "closed"


class GroupCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str = Field(min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    rules: str | None = Field(default=None, max_length=2000)
    visibility: GroupVisibility = Field(default=GroupVisibility.PUBLIC)
    join_policy: JoinPolicy = Field(
        default=JoinPolicy.OPEN, alias="joinPolicy"
    )
    discipline_id: UUID = Field(alias="disciplineId")
    offering_id: UUID | None = Field(default=None, alias="offeringId")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("O nome deve ter pelo menos 3 caracteres.")
        if len(normalized) > 100:
            raise ValueError("O nome deve ter no máximo 100 caracteres.")
        return normalized

    @field_validator("description", "rules")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GroupUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    name: str | None = Field(default=None, min_length=3, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    rules: str | None = Field(default=None, max_length=2000)
    visibility: GroupVisibility | None = None
    join_policy: JoinPolicy | None = Field(default=None, alias="joinPolicy")

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("O nome deve ter pelo menos 3 caracteres.")
        if len(normalized) > 100:
            raise ValueError("O nome deve ter no máximo 100 caracteres.")
        return normalized

    @field_validator("description", "rules")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class GroupResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
        from_attributes=True,
    )

    id: UUID
    name: str
    description: str | None = None
    rules: str | None = None
    visibility: GroupVisibility
    join_policy: JoinPolicy = Field(serialization_alias="joinPolicy")
    status: GroupStatus
    discipline_id: UUID = Field(serialization_alias="disciplineId")
    offering_id: UUID | None = Field(default=None, serialization_alias="offeringId")
    owner_id: UUID = Field(serialization_alias="ownerId")
    capacity: int | None = None
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
