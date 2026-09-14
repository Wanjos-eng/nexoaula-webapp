class MarketplaceError(Exception):
    def __init__(self, detail: str, status_code: int = 422):
        super().__init__(detail)
        self.status_code = status_code


class MarketplacePersistenceError(MarketplaceError):
    def __init__(self):
        super().__init__("Tutoria temporariamente indisponível.", 503)
