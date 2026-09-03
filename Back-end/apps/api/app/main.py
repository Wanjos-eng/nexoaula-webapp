from fastapi import FastAPI
from app.api.router import router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.include_router(router)