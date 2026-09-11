from fastapi import APIRouter

from app.modules.academic.router import router as academic_router
from app.modules.auth.router import router as auth_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(academic_router)

@router.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "API is running"}
