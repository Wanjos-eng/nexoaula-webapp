from collections.abc import Callable
from datetime import datetime
from typing import Protocol, Self
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.academic.models import Subject
from app.modules.users.infrastructure.models import User, UserProfile
from app.modules.academic.context_access import AcademicContextAccess
from app.modules.marketplace.errors import MarketplaceError, MarketplacePersistenceError
from app.modules.marketplace.models import (
    SessionBooking,
    SimulatedTransaction,
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

    def search(self, now: datetime, subject_id: UUID | None, topic: str | None,
               starts_after: datetime | None, limit: int, offset: int): ...
    def discovery(self, session_id: UUID, now: datetime): ...
    def confirmed_booking(self, session_id: UUID, user_id: UUID) -> SessionBooking | None: ...
    def booking_count(self, session_id: UUID) -> int: ...
    def add_booking(self, booking: SessionBooking, receipt: SimulatedTransaction) -> None: ...
    def receipt(self, booking_id: UUID) -> SimulatedTransaction | None: ...
    def history(self, user_id: UUID, limit: int, offset: int): ...
    def tutor_active(self, user_id: UUID) -> bool: ...


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
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
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
            stmt = stmt.with_for_update().execution_options(populate_existing=True)
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

    @staticmethod
    def _discovery_query():
        count = (select(func.count(SessionBooking.id)).where(
            SessionBooking.session_id == TutorSession.id, SessionBooking.status == "confirmed"
        ).correlate(TutorSession).scalar_subquery())
        return (select(TutorSession, func.coalesce(UserProfile.display_name, "Tutor"), Subject.name, count)
                .join(Subject, Subject.id == TutorSession.subject_id)
                .outerjoin(UserProfile, UserProfile.user_id == TutorSession.tutor_user_id))

    @classmethod
    def _public_query(cls, now):
        return (cls._discovery_query()
                .join(TutorProfile, TutorProfile.user_id == TutorSession.tutor_user_id)
                .join(User, User.id == TutorProfile.user_id)
                .where(TutorProfile.status == "active", User.is_active.is_(True),
                       TutorSession.status == "scheduled", TutorSession.starts_at > now))

    def search(self, now, subject_id, topic, starts_after, limit, offset):
        stmt = self._public_query(now)
        if subject_id is not None:
            stmt = stmt.where(TutorSession.subject_id == subject_id)
        if topic:
            stmt = stmt.where(or_(TutorSession.title.icontains(topic, autoescape=True),
                                 TutorSession.description.icontains(topic, autoescape=True)))
        if starts_after is not None:
            stmt = stmt.where(TutorSession.starts_at >= starts_after)
        return self._session.execute(stmt.order_by(TutorSession.starts_at, TutorSession.id).limit(limit).offset(offset)).all()

    def discovery(self, session_id, now):
        return self._session.execute(self._public_query(now).where(TutorSession.id == session_id)).first()

    def tutor_active(self, user_id):
        return self._session.scalar(select(User.is_active).where(User.id == user_id)) is True

    def confirmed_booking(self, session_id, user_id):
        return self._session.scalar(select(SessionBooking).where(
            SessionBooking.session_id == session_id, SessionBooking.user_id == user_id,
            SessionBooking.status == "confirmed"))

    def booking_count(self, session_id):
        return self._session.scalar(select(func.count(SessionBooking.id)).where(
            SessionBooking.session_id == session_id, SessionBooking.status == "confirmed"))

    def add_booking(self, booking, receipt):
        self._session.add(booking)
        self._session.flush()
        self._session.add(receipt)
        self._session.flush()

    def receipt(self, booking_id):
        return self._session.scalar(select(SimulatedTransaction).where(SimulatedTransaction.session_booking_id == booking_id))

    def history(self, user_id, limit, offset):
        stmt = (self._discovery_query().add_columns(SessionBooking, SimulatedTransaction)
                .join(SessionBooking, SessionBooking.session_id == TutorSession.id)
                .outerjoin(SimulatedTransaction, SimulatedTransaction.session_booking_id == SessionBooking.id)
                .where(SessionBooking.user_id == user_id)
                .order_by(SessionBooking.booked_at.desc(), SessionBooking.id).limit(limit).offset(offset))
        return self._session.execute(stmt).all()


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
