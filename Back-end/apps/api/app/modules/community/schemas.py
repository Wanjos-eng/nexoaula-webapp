from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.modules.community.models import GroupPolicy, MembershipStatus


class GroupSearchParams(BaseModel):
    subject: Optional[str] = None
    period: Optional[str] = None
    topic: Optional[str] = None
    skip: int = 0
    limit: int = 10


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    subject: Optional[str] = None
    period: Optional[str] = None
    topic: Optional[str] = None
    is_visible: bool
    policy: GroupPolicy
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class MembershipAction(BaseModel):
    action: str  # approve, reject, remove


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    user_id: UUID
    status: MembershipStatus
    created_at: datetime
    updated_at: datetime