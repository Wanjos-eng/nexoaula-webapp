from fastapi import FastAPI
from app.api.errors import register_exception_handlers
from app.api.router import router
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

register_exception_handlers(app)
app.include_router(router)
