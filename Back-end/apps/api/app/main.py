from fastapi import FastAPI

from app.api.errors import register_exception_handlers
from app.api.router import router
from app.core.config import settings
from app.modules.auth.middleware import AuthSecurityMiddleware

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(AuthSecurityMiddleware)

register_exception_handlers(app)
app.include_router(router)
