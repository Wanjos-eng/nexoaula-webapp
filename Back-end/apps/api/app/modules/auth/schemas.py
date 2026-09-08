from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {
                    "fullName": "Lucas Almeida",
                    "email": "lucas@example.com",
                    "password": "uma-senha-segura",
                }
            ]
        },
    )

    full_name: str = Field(alias="fullName", min_length=3, max_length=120)
    email: EmailStr = Field(max_length=320)
    password: SecretStr = Field(min_length=8, max_length=72)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("Informe um nome completo com pelo menos 3 caracteres.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_bcrypt_password_size(cls, value: SecretStr) -> SecretStr:
        plain_password = value.get_secret_value()
        if plain_password.isspace():
            raise ValueError("A senha não pode conter apenas espaços.")
        if len(plain_password.encode("utf-8")) > 72:
            raise ValueError("A senha deve ter no máximo 72 bytes.")
        return value


class RegisterResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: UUID
    email: EmailStr
    full_name: str = Field(serialization_alias="fullName")
    created_at: datetime = Field(serialization_alias="createdAt")


class ErrorResponse(BaseModel):
    detail: str


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=320)
    password: SecretStr = Field(min_length=1, max_length=72)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode("utf-8")) > 72:
            raise ValueError("A senha deve ter no máximo 72 bytes.")
        return value


class PublicUserResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: UUID
    email: EmailStr
    full_name: str | None = Field(serialization_alias="fullName")
    created_at: datetime = Field(serialization_alias="createdAt")
