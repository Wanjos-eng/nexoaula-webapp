class CommunityError(Exception):
    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(detail)
        self.status_code = status_code


class CommunityPersistenceError(CommunityError):
    def __init__(self) -> None:
        super().__init__("Serviço de grupos temporariamente indisponível.", 503)
