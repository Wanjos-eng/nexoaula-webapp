from app.modules.auth.passwords import PasswordHasher
from app.modules.auth.schemas import RegisterRequest, RegisterResponse
from app.modules.users import UserCreateData, UserPersistenceError, UserService


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
