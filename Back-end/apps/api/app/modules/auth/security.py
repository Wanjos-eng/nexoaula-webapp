"""Short-lived cookie credentials; no refresh or server-side revocation."""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from jose import JWTError, jwt
from pydantic import SecretStr

from app.core.config import Settings

TOKEN_TTL_SECONDS = 1800
CLOCK_LEEWAY_SECONDS = 30


class InvalidCredentialsError(Exception):
    pass


class SessionTokens:
    def __init__(self, config: Settings) -> None:
        self._secret = config.require_auth_secret()

    def issue(self, user_id: UUID) -> tuple[SecretStr, datetime]:
        now = datetime.now(UTC).replace(microsecond=0)
        expires = now + timedelta(seconds=TOKEN_TTL_SECONDS)
        claims = {
            "sub": str(user_id),
            "iss": "nexoaula-api",
            "aud": "nexoaula-web",
            "iat": int(now.timestamp()),
            "nbf": int(now.timestamp()),
            "exp": int(expires.timestamp()),
            "jti": str(uuid4()),
        }
        return SecretStr(jwt.encode(claims, self._secret, algorithm="HS256")), expires

    def subject(self, token: str) -> UUID:
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                issuer="nexoaula-api",
                audience="nexoaula-web",
                options={
                    "leeway": CLOCK_LEEWAY_SECONDS,
                    **{
                        f"require_{key}": True
                        for key in ("sub", "iss", "aud", "iat", "nbf", "exp", "jti")
                    },
                },
            )
            now = int(datetime.now(UTC).timestamp())
            if any(type(claims[key]) is not int for key in ("iat", "nbf", "exp")):
                raise ValueError()
            if (
                claims["iat"] > now + CLOCK_LEEWAY_SECONDS
                or claims["nbf"] != claims["iat"]
                or claims["exp"] - claims["iat"] != TOKEN_TTL_SECONDS
                or claims["aud"] != "nexoaula-web"
            ):
                raise ValueError()
            UUID(claims["jti"])
            return UUID(claims["sub"])
        except (
            JWTError,
            ValueError,
            TypeError,
            AttributeError,
            OverflowError,
        ) as error:
            raise InvalidCredentialsError() from error
