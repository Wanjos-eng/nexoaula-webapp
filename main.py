from fastapi import FastAPI

from api.auth import router as auth_router
from database import Base, engine
from models import user  # Registers the User model in Base.metadata.

# This project does not have an Alembic migration for the users table yet.
# Create it on application startup so the local SQLite database is usable.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="nexoAula API")
app.include_router(auth_router)
