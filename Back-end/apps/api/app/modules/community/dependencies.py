from app.modules.auth.dependencies import get_session_factory
from app.modules.community.repository import SqlAlchemyCommunityUnitOfWork
from app.modules.community.service import CommunityService


def get_community_service() -> CommunityService:
    session_factory = get_session_factory()
    return CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(session_factory))
