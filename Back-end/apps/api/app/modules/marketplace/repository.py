from collections.abc import Callable
from datetime import datetime
from typing import Protocol, Self
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.academic.context_access import AcademicContextAccess
from app.modules.marketplace.errors import MarketplaceError, MarketplacePersistenceError
from app.modules.marketplace.models import (
    SessionBooking,
    SimulatedTransaction,
    TutorProfile,
    TutorSession,
    TutorSubject,
)
from app.modules.academic.models import Subject
from app.modules.users.infrastructure.models import UserProfile


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
    def public_sessions(self, subject_id, starts_after, limit, offset): ...
    def public_session(self, session_id): ...
    def booking(self, session_id, user_id, *, lock=False): ...
    def list_bookings(self, user_id): ...
    def add_booking(self, row: SessionBooking) -> None: ...
    def add_transaction(self, row: SimulatedTransaction) -> None: ...
    def count_confirmed(self, session_id: UUID) -> int: ...


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

    @staticmethod
    def _view_query():
        counts = (
            select(SessionBooking.session_id, func.count(SessionBooking.id).label("enrolled_count"))
            .where(SessionBooking.status == "confirmed")
            .group_by(SessionBooking.session_id)
            .subquery()
        )
        return (
            select(TutorSession, UserProfile.display_name, Subject.name,
                   func.coalesce(counts.c.enrolled_count, 0))
            .join(UserProfile, UserProfile.user_id == TutorSession.tutor_user_id)
            .join(Subject, Subject.id == TutorSession.subject_id)
            .outerjoin(counts, counts.c.session_id == TutorSession.id)
        )

    def public_sessions(self, subject_id, starts_after, limit, offset):
        stmt = self._view_query().where(
            TutorSession.status == "scheduled", TutorSession.starts_at > starts_after
        )
        if subject_id is not None:
            stmt = stmt.where(TutorSession.subject_id == subject_id)
        return list(self._session.execute(
            stmt.order_by(TutorSession.starts_at, TutorSession.id).offset(offset).limit(limit)
        ).all())

    def public_session(self, session_id):
        return self._session.execute(
            self._view_query().where(TutorSession.id == session_id)
        ).first()

    def booking(self, session_id, user_id, *, lock=False):
        stmt = select(SessionBooking).where(
            SessionBooking.session_id == session_id,
            SessionBooking.user_id == user_id,
            SessionBooking.status == "confirmed",
        )
        if lock:
            stmt = stmt.with_for_update()
        return self._session.scalar(stmt)

    def list_bookings(self, user_id):
        return list(self._session.execute(
            select(SessionBooking, SimulatedTransaction)
            .outerjoin(SimulatedTransaction, SimulatedTransaction.session_booking_id == SessionBooking.id)
            .where(SessionBooking.user_id == user_id)
            .order_by(SessionBooking.booked_at.desc(), SessionBooking.id)
        ).all())

    def add_booking(self, row):
        self._session.add(row)
        self._session.flush()

    def add_transaction(self, row):
        self._session.add(row)
        self._session.flush()

    def count_confirmed(self, session_id):
        return int(self._session.scalar(
            select(func.count(SessionBooking.id)).where(
                SessionBooking.session_id == session_id,
                SessionBooking.status == "confirmed",
            )
        ))

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
