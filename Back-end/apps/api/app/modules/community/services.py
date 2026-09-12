from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.community.models import Group, GroupMembership, GroupPolicy, MembershipStatus
from app.modules.community.schemas import GroupSearchParams


class CommunityService:
    def __init__(self, db: Session):
        self.db = db

    def search_groups(self, params: GroupSearchParams) -> List[Group]:
        query = self.db.query(Group).filter(Group.is_visible == True)

        if params.subject:
            query = query.filter(Group.subject.ilike(f"%{params.subject}%"))
        if params.period:
            query = query.filter(Group.period.ilike(f"%{params.period}%"))
        if params.topic:
            query = query.filter(Group.topic.ilike(f"%{params.topic}%"))

        return query.offset(params.skip).limit(params.limit).all()

    def join_group(self, group_id: UUID, user_id: UUID) -> GroupMembership:
        group = self.db.query(Group).filter(Group.id == group_id, Group.is_visible == True).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Grupo não encontrado ou indisponível."
            )

        existing_membership = self.db.query(GroupMembership).filter(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == user_id
        ).first()

        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você já possui uma solicitação ou vínculo com este grupo."
            )

        initial_status = (
            MembershipStatus.APPROVED 
            if group.policy == GroupPolicy.OPEN 
            else MembershipStatus.PENDING
        )

        membership = GroupMembership(
            group_id=group_id,
            user_id=user_id,
            status=initial_status
        )
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def manage_membership(
        self, 
        group_id: UUID, 
        current_user_id: UUID, 
        target_user_id: UUID, 
        action: str
    ) -> GroupMembership:
        group = self.db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail="Grupo não encontrado."
            )

        if group.owner_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas o organizador do grupo pode gerenciar membros."
            )

        if target_user_id == group.owner_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O proprietário do grupo não pode ter seu vínculo alterado ou removido."
            )

        membership = self.db.query(GroupMembership).filter(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == target_user_id
        ).first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Membro ou solicitação não encontrada."
            )

        if action == "approve":
            membership.status = MembershipStatus.APPROVED
        elif action == "reject":
            membership.status = MembershipStatus.REJECTED
        elif action == "remove":
            self.db.delete(membership)
            self.db.commit()
            return membership
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ação inválida. Use: approve, reject ou remove."
            )

        self.db.commit()
        self.db.refresh(membership)
        return membership