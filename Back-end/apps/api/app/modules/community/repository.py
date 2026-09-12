from datetime import UTC, datetime
from types import TracebackType
from typing import Any, Protocol, Self
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.modules.academic.models import ClassSection, Subject
from app.modules.community.models import (
    GroupMember,
    GroupStatus,
    MembershipRole,
    MembershipStatus,
    StudyGroup,
)
from app.modules.community.schemas import GroupCreate


class CommunityRepository(Protocol):
    def find_by_id(self, group_id: UUID) -> StudyGroup | None: ...

    def find_active_owner_id(self, group_id: UUID) -> UUID | None: ...

    def create_group(
        self, owner_id: UUID, data: GroupCreate
    ) -> StudyGroup: ...

    def update_group(
        self, group: StudyGroup, updates: dict[str, Any]
    ) -> StudyGroup: ...

    def check_discipline_exists(self, discipline_id: UUID) -> bool: ...

    def check_offering_belongs_to_discipline(
        self, offering_id: UUID, discipline_id: UUID
    ) -> bool: ...


class CommunityUnitOfWork(Protocol):
    community: CommunityRepository

    def __enter__(self) -> Self: ...

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


class SqlAlchemyCommunityRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_by_id(self, group_id: UUID) -> StudyGroup | None:
        group = self._session.get(StudyGroup, group_id)
        if group is not None and group.deleted_at is None:
            return group
        return None

    def find_active_owner_id(self, group_id: UUID) -> UUID | None:
        stmt = (
            select(GroupMember.user_id)
            .where(
                GroupMember.group_id == group_id,
                GroupMember.role == MembershipRole.OWNER,
                GroupMember.status == MembershipStatus.ACTIVE,
            )
            .limit(1)
        )
        owner_id = self._session.execute(stmt).scalar_one_or_none()
        if owner_id is not None:
            return owner_id
        # Fallback para created_by
        group = self._session.get(StudyGroup, group_id)
        return group.created_by if group else None

    def create_group(
        self, owner_id: UUID, data: GroupCreate
    ) -> StudyGroup:
        group_id = uuid4()
        now = datetime.now(UTC)

        group = StudyGroup(
            id=group_id,
            created_by=owner_id,
            subject_id=data.discipline_id,
            class_section_id=data.offering_id,
            name=data.name,
            description=data.description,
            visibility=data.visibility.value,
            join_policy=data.join_policy.value,
            status=GroupStatus.ACTIVE.value,
            created_at=now,
            updated_at=now,
        )
        self._session.add(group)
        self._session.flush()

        member = GroupMember(
            group_id=group_id,
            user_id=owner_id,
            role=MembershipRole.OWNER.value,
            status=MembershipStatus.ACTIVE.value,
            joined_at=now,
        )
        self._session.add(member)
        self._session.flush()
        return group

    def update_group(
        self, group: StudyGroup, updates: dict[str, Any]
    ) -> StudyGroup:
        # Se visibility ou join_policy forem enums, salvar o .value
        for field, value in updates.items():
            if hasattr(value, "value"):
                value = value.value
            setattr(group, field, value)

        group.updated_at = datetime.now(UTC)
        self._session.flush()
        return group

    def check_discipline_exists(self, discipline_id: UUID) -> bool:
        return self._session.get(Subject, discipline_id) is not None

    def check_offering_belongs_to_discipline(
        self, offering_id: UUID, discipline_id: UUID
    ) -> bool:
        section = self._session.get(ClassSection, offering_id)
        if section is None:
            return False
        return section.subject_id == discipline_id


class SqlAlchemyCommunityUnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory
        self._session: Session | None = None
        self.community: CommunityRepository | None = None

    def __enter__(self) -> Self:
        self._session = self._session_factory()
        self.community = SqlAlchemyCommunityRepository(self._session)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._session is None:
            return
        if self._session.in_transaction():
            self._session.rollback()
        self._session.close()
        self._session = None

    def commit(self) -> None:
        if self._session is None:
            raise RuntimeError("Unidade de trabalho não iniciada.")
        self._session.commit()

    def rollback(self) -> None:
        if self._session is not None:
            self._session.rollback()
