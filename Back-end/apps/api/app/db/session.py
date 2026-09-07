from sqlalchemy import Engine, create_engine

from app.core.config import Settings, settings


def create_database_engine(config: Settings = settings) -> Engine:
    """Create an engine lazily, keeping the technical health independent of DB."""
    return create_engine(config.require_database_url(), pool_pre_ping=True)
