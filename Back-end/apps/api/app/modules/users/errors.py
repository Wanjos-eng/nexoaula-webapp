class UserServiceError(Exception):
    """Base class for stable errors exposed by the users module."""


class UserAlreadyExistsError(UserServiceError):
    def __init__(self) -> None:
        super().__init__("Já existe uma conta com este e-mail.")


class UserNotFoundError(UserServiceError):
    def __init__(self) -> None:
        super().__init__("Usuário não encontrado.")


class UserPersistenceError(UserServiceError):
    def __init__(self) -> None:
        super().__init__("Não foi possível persistir o usuário.")
