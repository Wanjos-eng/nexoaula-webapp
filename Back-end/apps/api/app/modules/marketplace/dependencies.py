from fastapi import HTTPException

from app.modules.auth.dependencies import get_session_factory
from app.modules.marketplace.repository import SqlAlchemyMarketplaceUnitOfWork
from app.modules.marketplace.service import MarketplaceService


def get_marketplace_service() -> MarketplaceService:
    try:
        factory = get_session_factory()
    except RuntimeError:
        raise HTTPException(503, "Tutoria temporariamente indisponível.") from None
    return MarketplaceService(lambda: SqlAlchemyMarketplaceUnitOfWork(factory))
