from datetime import date, datetime
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CatalogKind = Literal[
    "institutions", "courses", "subjects", "academic-terms", "class-sections", "teachers", "class-section-teachers", "topics", "subject-topics"
]


class Input(BaseModel):
    model_config = ConfigDict(
        extra="forbid", populate_by_name=True, str_strip_whitespace=True
    )


class Output(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True, serialize_by_alias=True, from_attributes=True
    )


class AcademicProfileUpdate(Input):
    institution_id: UUID | None = Field(default=None, alias="institutionId")
    course_id: UUID | None = Field(default=None, alias="courseId")
    bio: str | None = Field(default=None, max_length=500)

    @field_validator("bio")
    @classmethod
    def empty_bio(cls, value):
        return value or None


class AcademicProfileResponse(Output):
    user_id: UUID = Field(serialization_alias="userId")
    display_name: str = Field(serialization_alias="displayName")
    bio: str | None = None
    institution_id: UUID | None = Field(
        default=None, serialization_alias="institutionId"
    )
    course_id: UUID | None = Field(default=None, serialization_alias="courseId")


class InstitutionCreate(Input):
    name: str = Field(min_length=3, max_length=200)
    short_name: str | None = Field(default=None, alias="shortName", max_length=50)
    timezone: str = Field(default="America/Sao_Paulo", max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            import re
            import zoneinfo
            if not zoneinfo.available_timezones() and (
                value == "UTC" or re.match(r"^[A-Za-z_]+(/[A-Za-z_]+)+$", value)
            ):
                return value
            raise ValueError("Informe um fuso horário IANA válido.") from None
        except ValueError:
            raise ValueError("Informe um fuso horário IANA válido.") from None
        return value


class InstitutionResponse(Output):
    id: UUID
    name: str
    short_name: str | None = Field(serialization_alias="shortName")
    timezone: str


class CourseCreate(Input):
    institution_id: UUID = Field(alias="institutionId")
    name: str = Field(min_length=3, max_length=200)
    code: str | None = Field(default=None, max_length=40)

    @field_validator("code")
    @classmethod
    def empty_code(cls, value):
        return value or None


class CourseResponse(Output):
    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    name: str
    code: str | None = None
    created_at: datetime = Field(serialization_alias="createdAt")


class SubjectCreate(CourseCreate):
    description: str | None = Field(default=None, max_length=2000)


class SubjectResponse(CourseResponse):
    description: str | None = None


class AcademicTermCreate(Input):
    institution_id: UUID = Field(alias="institutionId")
    label: str = Field(min_length=1, max_length=30)
    start_date: date = Field(alias="startDate")
    end_date: date = Field(alias="endDate")

    @model_validator(mode="after")
    def valid_range(self):
        if self.end_date < self.start_date:
            raise ValueError("A data final não pode ser anterior à inicial.")
        return self


class AcademicTermResponse(Output):
    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    label: str
    start_date: date = Field(serialization_alias="startDate")
    end_date: date = Field(serialization_alias="endDate")


class ClassSectionCreate(Input):
    subject_id: UUID = Field(alias="subjectId")
    academic_term_id: UUID = Field(alias="academicTermId")
    label: str = Field(min_length=1, max_length=80)


class ClassSectionResponse(Output):
    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    subject_id: UUID = Field(serialization_alias="subjectId")
    academic_term_id: UUID = Field(serialization_alias="academicTermId")
    label: str
    created_by: UUID = Field(serialization_alias="createdBy")
    created_at: datetime = Field(serialization_alias="createdAt")


class TeacherCreate(Input):
    institution_id: UUID = Field(alias="institutionId")
    full_name: str = Field(alias="fullName", min_length=2, max_length=200)
    external_code: str | None = Field(default=None, alias="externalCode", min_length=1, max_length=50)


class TeacherResponse(Output):
    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    full_name: str = Field(serialization_alias="fullName")
    external_code: str | None = Field(serialization_alias="externalCode")


class ClassSectionTeacherCreate(Input):
    class_section_id: UUID = Field(alias="classSectionId")
    teacher_id: UUID = Field(alias="teacherId")
    role: Literal["lead", "assistant", "substitute"] = "lead"
    starts_on: date = Field(alias="startsOn")
    ends_on: date | None = Field(default=None, alias="endsOn")

    @model_validator(mode="after")
    def valid_range(self):
        if self.ends_on is not None and self.ends_on < self.starts_on:
            raise ValueError("A data final não pode ser anterior à inicial.")
        return self


class ClassSectionTeacherResponse(Output):
    id: UUID
    institution_id: UUID = Field(serialization_alias="institutionId")
    class_section_id: UUID = Field(serialization_alias="classSectionId")
    teacher_id: UUID = Field(serialization_alias="teacherId")
    role: str
    starts_on: date = Field(serialization_alias="startsOn")
    ends_on: date | None = Field(serialization_alias="endsOn")


class TopicCreate(Input):
    slug: str = Field(min_length=1, max_length=180, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class TopicResponse(Output):
    id: UUID
    slug: str
    name: str
    description: str | None


class SubjectTopicCreate(Input):
    subject_id: UUID = Field(alias="subjectId")
    topic_id: UUID = Field(alias="topicId")
    display_order: int | None = Field(default=None, alias="displayOrder", ge=0)


class SubjectTopicResponse(Output):
    id: UUID
    subject_id: UUID = Field(serialization_alias="subjectId")
    topic_id: UUID = Field(serialization_alias="topicId")
    display_order: int | None = Field(serialization_alias="displayOrder")
