from app.db.base import Base

# Imports are explicit: only models released for migrations belong here.
from app.modules.users.infrastructure import models as users_models  # noqa: F401,E402
from app.modules.academic import models as academic_models  # noqa: F401,E402
from app.modules.community import models as community_models  # noqa: F401,E402

target_metadata = Base.metadata
