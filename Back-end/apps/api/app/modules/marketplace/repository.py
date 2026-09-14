from collections.abc import Callable
from datetime import datetime
from typing import Protocol, Self
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.academic.context_access import AcademicContextAccess
from app.modules.marketplace.errors import MarketplaceError, MarketplacePersistenceError
from app.modules.marketplace.models import (
    SessionBooking,
    TutorProfile,
    TutorSession,
    TutorSubject,
)


class MarketplaceRepository(Protocol):
    def profile(self, user_id: UUID, *, lock: bool = False) -> TutorProfile | None: ...
    def ensure_profile(self, user_id: UUID) -> None: ...
    def declare_subject(self, user_id: UUID, subject_id: UUID) -> None: ...
    def session(
        self, session_id: UUID, *, lock: bool = False
    ) -> TutorSession | None: ...
    def add_session(self, row: TutorSession) -> None: ...
    def list_mine(
        self, user_id: UUID, limit: int, offset: int
    ) -> list[TutorSession]: ...
    def cancel_bookings(self, session_id: UUID, now: datetime) -> None: ...


class MarketplaceUnitOfWork(Protocol):
    marketplace: MarketplaceRepository
    academic: AcademicContextAccess

    def __enter__(self) -> Self: ...
    def __exit__(self, exc_type, exc_value, traceback) -> None: ...
    def commit(self) -> None: ...


class SqlAlchemyMarketplaceRepository:
    def __init__(self, session: Session):
        self._session = session

    def profile(self, user_id, *, lock=False):
        stmt = select(TutorProfile).where(TutorProfile.user_id == user_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def ensure_profile(self, user_id):
        self._session.execute(
            insert(TutorProfile)
            .values(user_id=user_id)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )

    def declare_subject(self, user_id, subject_id):
        self._session.execute(
            insert(TutorSubject)
            .values(tutor_user_id=user_id, subject_id=subject_id)
            .on_conflict_do_nothing()
        )

    def session(self, session_id, *, lock=False):
        stmt = select(TutorSession).where(TutorSession.id == session_id)
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def add_session(self, row):
        self._session.add(row)
        self._session.flush()

    def list_mine(self, user_id, limit, offset):
        return list(
            self._session.scalars(
                select(TutorSession)
                .where(TutorSession.tutor_user_id == user_id)
                .order_by(TutorSession.starts_at.desc(), TutorSession.id)
                .limit(limit)
                .offset(offset)
            )
        )

    def cancel_bookings(self, session_id, now):
        self._session.execute(
            update(SessionBooking)
            .where(
                SessionBooking.session_id == session_id,
                SessionBooking.status == "confirmed",
            )
            .values(status="cancelled", cancelled_at=now)
        )


class SqlAlchemyMarketplaceUnitOfWork:
    def __init__(self, session_factory: Callable[[], Session]):
        self._factory = session_factory
        self._session = None

    def __enter__(self):
        try:
            self._session = self._factory()
            self.marketplace = SqlAlchemyMarketplaceRepository(self._session)
            self.academic = AcademicContextAccess(self._session)
            return self
        except SQLAlchemyError:
            raise MarketplacePersistenceError() from None

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            self._session.rollback()
        except SQLAlchemyError:
            raise MarketplacePersistenceError() from None
        finally:
            self._session.close()
        if isinstance(exc_value, IntegrityError):
            raise MarketplaceError(
                "Operação conflita com o estado atual. Atualize e tente novamente.", 409
            ) from None
        if isinstance(exc_value, SQLAlchemyError):
            raise MarketplacePersistenceError() from None

    def commit(self):
        self._session.commit()
