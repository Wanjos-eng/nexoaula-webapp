from typing import Protocol

from pydantic import SecretStr


class PasswordHasher(Protocol):
    def hash(self, password: SecretStr) -> SecretStr: ...

    def verify(self, password: SecretStr, password_hash: SecretStr) -> bool: ...


class BcryptPasswordHasher:
    """Hash passwords with bcrypt without exposing their plain value."""

    def __init__(self, rounds: int = 12) -> None:
        if not 4 <= rounds <= 31:
            raise ValueError("bcrypt rounds must be between 4 and 31")
        self._rounds = rounds

    def hash(self, password: SecretStr) -> SecretStr:
        import bcrypt

        encoded = password.get_secret_value().encode("utf-8")
        hashed = bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=self._rounds))
        return SecretStr(hashed.decode("utf-8"))

    def verify(self, password: SecretStr, password_hash: SecretStr) -> bool:
        import bcrypt

        try:
            return bcrypt.checkpw(
                password.get_secret_value().encode("utf-8"),
                password_hash.get_secret_value().encode("utf-8"),
            )
        except (ValueError, TypeError):
            return False
