from uuid import UUID

from pydantic import SecretStr

from app.modules.auth.passwords import PasswordHasher
from app.modules.auth.schemas import (
    LoginRequest,
    PublicUserResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.modules.auth.security import InvalidCredentialsError
from app.modules.users import (
    UserCreateData,
    UserNotFoundError,
    UserPersistenceError,
    UserService,
)
from app.modules.users.schemas import UserRecord


class RegistrationService:
    def __init__(self, users: UserService, password_hasher: PasswordHasher) -> None:
        self._users = users
        self._password_hasher = password_hasher

    def register(self, request: RegisterRequest) -> RegisterResponse:
        password_hash = self._password_hasher.hash(request.password)
        created = self._users.create(
            UserCreateData(
                email=str(request.email),
                password_hash=password_hash,
                display_name=request.full_name,
            )
        )

        if created.profile is None:
            raise UserPersistenceError()

        return RegisterResponse(
            id=created.id,
            email=created.email,
            full_name=created.profile.display_name,
            created_at=created.created_at,
        )


class AuthenticationService:
    def __init__(
        self, users: UserService, password_hasher: PasswordHasher, dummy_hash: SecretStr
    ) -> None:
        self._users = users
        self._password_hasher = password_hasher
        self._dummy_hash = dummy_hash

    def login(self, request: LoginRequest) -> PublicUserResponse:
        try:
            user = self._users.get_by_email(str(request.email))
        except UserNotFoundError:
            # Perform the same expensive bcrypt operation for unknown accounts.
            self._password_hasher.verify(request.password, self._dummy_hash)
            raise InvalidCredentialsError() from None
        matches = self._password_hasher.verify(request.password, user.password_hash)
        if not matches or not user.is_active or user.deleted_at is not None:
            raise InvalidCredentialsError()
        return self._public_user(user)

    def current_user(self, user_id: UUID) -> PublicUserResponse:
        try:
            user = self._users.get_by_id(user_id)
        except UserNotFoundError:
            raise InvalidCredentialsError() from None
        if not user.is_active or user.deleted_at is not None:
            raise InvalidCredentialsError()
        return self._public_user(user)

    @staticmethod
    def _public_user(user: UserRecord) -> PublicUserResponse:
        return PublicUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.profile.display_name if user.profile else None,
            created_at=user.created_at,
        )
