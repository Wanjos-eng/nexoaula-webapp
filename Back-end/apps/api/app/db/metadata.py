from app.db.base import Base

# Imports are explicit: only models released for migrations belong here.
from app.modules.identity.infrastructure import models as identity_models  # noqa: F401,E402

target_metadata = Base.metadata
