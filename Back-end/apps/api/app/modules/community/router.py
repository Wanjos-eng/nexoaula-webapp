from fastapi import APIRouter, Depends, Query, status
from typing import List, Optional
from uuid import UUID

from app.modules.auth.dependencies import active_subject, get_session_factory
from .services import CommunityService
from .schemas import GroupSearchParams, GroupResponse, MembershipAction, MembershipResponse

router = APIRouter(prefix="", tags=["Community"])

@router.get("/groups", response_model=List[GroupResponse])
def search_groups(
    subject: Optional[str] = Query(None),
    period: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    session_factory = Depends(get_session_factory)
):
    """US14: Busca de grupos visíveis com filtros por disciplina, período e assunto."""
    params = GroupSearchParams(
        subject=subject,
        period=period,
        topic=topic,
        skip=skip,
        limit=limit
    )
    with session_factory() as db:
        service = CommunityService(db)
        return service.search_groups(params)

@router.post("/groups/{group_id}/join", response_model=MembershipResponse, status_code=status.HTTP_201_CREATED)
def join_group(
    group_id: UUID,
    session_factory = Depends(get_session_factory),
    current_user_id: UUID = Depends(active_subject)
):
    """US15: Solicita entrada ou entra diretamente em um grupo."""
    with session_factory() as db:
        service = CommunityService(db)
        return service.join_group(group_id=group_id, user_id=current_user_id)

@router.patch("/groups/{group_id}/members/{target_user_id}", response_model=MembershipResponse)
def manage_membership(
    group_id: UUID,
    target_user_id: UUID,
    body: MembershipAction,
    session_factory = Depends(get_session_factory),
    current_user_id: UUID = Depends(active_subject)
):
    """US16: Aprova, recusa ou remove membros (requer autorização do organizador)."""
    with session_factory() as db:
        service = CommunityService(db)
        return service.manage_membership(
            group_id=group_id,
            current_user_id=current_user_id,
            target_user_id=target_user_id,
            action=body.action
        )