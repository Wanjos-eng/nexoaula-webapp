from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import create_database_engine
from app.modules.academic.router import router as academic_router
from app.modules.auth.router import router as auth_router
from app.modules.community.router import me_router, router as community_router
from app.modules.community.meetings_router import router as meetings_router
from app.modules.marketplace.router import router as marketplace_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(academic_router)
router.include_router(community_router)
router.include_router(meetings_router)
router.include_router(me_router)
router.include_router(marketplace_router)


@router.get("/health", tags=["Health"])
@router.get("/api/health", tags=["Health"], include_in_schema=False)
def health_check():
    return {"status": "ok", "message": "API is running"}


@router.get("/health/db", tags=["Health"])
def database_health_check():
    engine = create_database_engine()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "reachable"}
    finally:
        engine.dispose()
