from typing import Protocol

from passlib.context import CryptContext
from pydantic import SecretStr


class PasswordHasher(Protocol):
    def hash(self, password: SecretStr) -> SecretStr: ...


class BcryptPasswordHasher:
    """Hash passwords with bcrypt without exposing their plain value."""

    def __init__(self, rounds: int = 12) -> None:
        self._context = CryptContext(
            schemes=["bcrypt"],
            bcrypt__rounds=rounds,
            deprecated="auto",
        )

    def hash(self, password: SecretStr) -> SecretStr:
        return SecretStr(self._context.hash(password.get_secret_value()))
