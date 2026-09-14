from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

NOTICE = "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica."
PositiveInt = Annotated[int, Field(strict=True, gt=0, le=2147483647)]
Cents = Annotated[int, Field(strict=True, ge=0, le=2147483647)]
Title = Annotated[str, Field(min_length=1, max_length=200)]
Modality = Literal["online", "in_person", "hybrid"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    simulated: Literal[True] = True
    notice: str = NOTICE


class TutorActivation(Input):
    headline: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=2000)


class TutorResponse(Output):
    user_id: UUID
    headline: str | None
    bio: str | None
    status: Literal["active", "paused", "suspended"]
    created_at: datetime
    updated_at: datetime


class SessionCreate(Input):
    subject_id: UUID
    class_section_id: UUID | None = None
    title: Title
    description: str | None = Field(default=None, max_length=5000)
    modality: Modality
    location: str | None = Field(default=None, min_length=1, max_length=250)
    external_url: HttpUrl | None = Field(default=None, max_length=2000)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    capacity: PositiveInt
    price_cents: Cents
    currency: Literal["BRL"] = "BRL"

    @field_validator("external_url")
    @classmethod
    def no_url_credentials(cls, value):
        if value is not None and (
            value.username is not None or value.password is not None
        ):
            raise ValueError("O link não deve conter credenciais.")
        return value

    @model_validator(mode="after")
    def coherent_session(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("O término deve ser posterior ao início.")
        if self.modality in ("in_person", "hybrid") and not self.location:
            raise ValueError("Informe o local da sessão.")
        if self.modality in ("online", "hybrid") and not self.external_url:
            raise ValueError("Informe o link da sessão.")
        return self


class SessionUpdate(Input):
    subject_id: UUID | None = None
    class_section_id: UUID | None = None
    title: Title | None = None
    description: str | None = Field(default=None, max_length=5000)
    modality: Modality | None = None
    location: str | None = Field(default=None, min_length=1, max_length=250)
    external_url: HttpUrl | None = Field(default=None, max_length=2000)
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    capacity: PositiveInt | None = None
    price_cents: Cents | None = None
    currency: Literal["BRL"] | None = None

    @model_validator(mode="after")
    def required_fields_not_null(self):
        nullable = {"class_section_id", "description", "location", "external_url"}
        if any(getattr(self, key) is None for key in self.model_fields_set - nullable):
            raise ValueError("Campos obrigatórios não podem ser nulos.")
        return self


class SessionResponse(Output):
    id: UUID
    tutor_user_id: UUID
    subject_id: UUID
    class_section_id: UUID | None
    title: str
    description: str | None
    modality: Modality
    location: str | None
    external_url: str | None
    starts_at: datetime
    ends_at: datetime
    capacity: int
    price_cents: int
    currency: Literal["BRL"]
    status: Literal["draft", "scheduled", "completed", "cancelled"]
    created_at: datetime
    updated_at: datetime
