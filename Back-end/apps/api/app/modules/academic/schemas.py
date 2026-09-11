from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AcademicProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    institution_id: UUID | None = Field(default=None, alias="institutionId")
    course_id: UUID | None = Field(default=None, alias="courseId")
    bio: str | None = Field(default=None, max_length=500)

    @field_validator("bio")
    @classmethod
    def normalize_bio(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AcademicProfileResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )

    user_id: UUID = Field(serialization_alias="userId")
    display_name: str = Field(serialization_alias="displayName")
    bio: str | None = None
    institution_id: UUID | None = Field(default=None, serialization_alias="institutionId")
    course_id: UUID | None = Field(default=None, serialization_alias="courseId")


class SubjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    institution_id: UUID = Field(alias="institutionId")
    name: str = Field(min_length=3, max_length=200)
    code: str | None = Field(default=None, max_length=40)
    description: str | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("O nome deve ter pelo menos 3 caracteres.")
        return normalized


class SubjectResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )

    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    name: str
    code: str | None = None
    description: str | None = None
    created_at: datetime = Field(serialization_alias="createdAt")


class ClassSectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    subject_id: UUID = Field(alias="subjectId")
    academic_term_id: UUID = Field(alias="academicTermId")
    label: str = Field(min_length=1, max_length=80)

    @field_validator("label")
    @classmethod
    def normalize_label(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("O rótulo não pode ser vazio.")
        return normalized


class ClassSectionResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )

    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    subject_id: UUID = Field(serialization_alias="subjectId")
    academic_term_id: UUID = Field(serialization_alias="academicTermId")
    label: str
    created_by: UUID = Field(serialization_alias="createdBy")
    created_at: datetime = Field(serialization_alias="createdAt")


class EnrollmentResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )

    user_id: UUID = Field(serialization_alias="userId")
    class_section_id: UUID = Field(serialization_alias="classSectionId")
    enrolled_at: datetime = Field(serialization_alias="enrolledAt")


class EnrolledClassSectionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    class_section_id: UUID = Field(serialization_alias="classSectionId")
    label: str
    subject_id: UUID = Field(serialization_alias="subjectId")
    subject_name: str = Field(serialization_alias="subjectName")
    enrolled_at: datetime = Field(serialization_alias="enrolledAt")


class ErrorResponse(BaseModel):
    detail: str
