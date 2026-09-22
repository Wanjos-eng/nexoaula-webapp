from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID, uuid4

from pydantic import ValidationError

from app.modules.marketplace.errors import MarketplaceError, MarketplacePersistenceError
from app.modules.marketplace.models import TutorSession, SessionBooking, SimulatedTransaction
from app.modules.marketplace.repository import MarketplaceUnitOfWork
from app.modules.marketplace.schemas import (
    BookingHistoryResponse, BookingResponse, SessionDiscoveryResponse, TransactionResponse,
    SessionCreate,
    SessionResponse,
    SessionUpdate,
    TutorActivation,
    TutorResponse,
)


class MarketplaceService:
    def __init__(
        self,
        uow_factory: Callable[[], MarketplaceUnitOfWork],
        *,
        clock=lambda: datetime.now(UTC)
    ):
        self._factory = uow_factory
        self._clock = clock

    @staticmethod
    def _profile(uow, user_id, *, active=False):
        profile = uow.marketplace.profile(user_id, lock=True)
        if profile is None or (active and profile.status != "active"):
            raise MarketplaceError(
                "Ative seu perfil profissional para gerenciar ofertas.", 403
            )
        return profile

    @staticmethod
    def _owned(uow, session_id, user_id):
        row = uow.marketplace.session(session_id, lock=True)
        if row is None:
            raise MarketplaceError("Sessão não encontrada.", 404)
        if row.tutor_user_id != user_id:
            raise MarketplaceError(
                "Somente o responsável pode alterar esta oferta.", 403
            )
        return row

    @staticmethod
    def _context(uow, data):
        if not uow.academic.subject_exists(data.subject_id):
            raise MarketplaceError("Disciplina inexistente.")
        if data.class_section_id is not None and not uow.academic.section_matches(
            data.class_section_id, data.subject_id
        ):
            raise MarketplaceError("A turma deve pertencer à disciplina selecionada.")

    def _future(self, data):
        if data.starts_at <= self._clock():
            raise MarketplaceError("O início da sessão deve estar no futuro.")

    @staticmethod
    def _values(data):
        values = data.model_dump()
        if data.external_url is not None:
            values["external_url"] = str(data.external_url)
        return values

    def get_profile(self, user_id: UUID):
        with self._factory() as uow:
            row = uow.marketplace.profile(user_id)
            return TutorResponse.model_validate(row) if row else None

    def activate(self, user_id: UUID, data: TutorActivation):
        with self._factory() as uow:
            uow.marketplace.ensure_profile(user_id)
            row = self._profile(uow, user_id)
            if row.status == "suspended":
                raise MarketplaceError("Perfil profissional suspenso.", 403)
            row.status = "active"
            for name, value in data.model_dump(exclude_unset=True).items():
                setattr(row, name, value)
            row.updated_at = self._clock()
            uow.commit()
            return TutorResponse.model_validate(row)

    def deactivate(self, user_id: UUID):
        with self._factory() as uow:
            row = self._profile(uow, user_id)
            if row.status == "suspended":
                raise MarketplaceError("Perfil profissional suspenso.", 403)
            row.status = "paused"
            row.updated_at = self._clock()
            uow.commit()
            return TutorResponse.model_validate(row)

    def create(self, user_id: UUID, data: SessionCreate):
        with self._factory() as uow:
            self._profile(uow, user_id, active=True)
            self._context(uow, data)
            self._future(data)
            uow.marketplace.declare_subject(user_id, data.subject_id)
            now = self._clock()
            row = TutorSession(
                id=uuid4(),
                tutor_user_id=user_id,
                status="draft",
                simulated=True,
                created_at=now,
                updated_at=now,
                **self._values(data)
            )
            uow.marketplace.add_session(row)
            uow.commit()
            return SessionResponse.model_validate(row)

    def list_mine(self, user_id: UUID, limit: int, offset: int):
        with self._factory() as uow:
            return [
                SessionResponse.model_validate(row)
                for row in uow.marketplace.list_mine(user_id, limit, offset)
            ]

    def edit(self, user_id: UUID, session_id: UUID, data: SessionUpdate):
        with self._factory() as uow:
            self._profile(uow, user_id, active=True)
            row = self._owned(uow, session_id, user_id)
            if row.status != "draft":
                raise MarketplaceError("Somente rascunhos podem ser editados.", 409)
            values = {key: getattr(row, key) for key in SessionCreate.model_fields}
            values.update(data.model_dump(exclude_unset=True))
            try:
                merged = SessionCreate.model_validate(values)
            except ValidationError:
                raise MarketplaceError(
                    "Alteração inválida: confira agenda, modalidade e campos obrigatórios."
                ) from None
            self._context(uow, merged)
            self._future(merged)
            uow.marketplace.declare_subject(user_id, merged.subject_id)
            for name, value in self._values(merged).items():
                setattr(row, name, value)
            row.updated_at = self._clock()
            uow.commit()
            return SessionResponse.model_validate(row)

    def publish(self, user_id: UUID, session_id: UUID):
        with self._factory() as uow:
            self._profile(uow, user_id, active=True)
            row = self._owned(uow, session_id, user_id)
            if row.status != "draft":
                raise MarketplaceError("Somente rascunhos podem ser publicados.", 409)
            self._future(row)
            row.status = "scheduled"
            row.updated_at = self._clock()
            uow.commit()
            return SessionResponse.model_validate(row)

    def cancel(self, user_id: UUID, session_id: UUID):
        with self._factory() as uow:
            # Paused/suspended tutors may still cancel their own commitments.
            self._profile(uow, user_id)
            row = self._owned(uow, session_id, user_id)
            if row.status != "scheduled":
                raise MarketplaceError(
                    "Somente ofertas publicadas podem ser canceladas.", 409
                )
            self._future(row)
            now = self._clock()
            row.status = "cancelled"
            row.updated_at = now
            uow.marketplace.cancel_bookings(session_id, now)
            uow.commit()
            return SessionResponse.model_validate(row)


    @staticmethod
    def _discovery(record):
        row, tutor_name, subject_name, count = record
        return SessionDiscoveryResponse(**SessionResponse.model_validate(row).model_dump(),
            tutor_name=tutor_name, subject_name=subject_name, enrolled_count=count,
            available_seats=max(0, row.capacity-count), commission_cents=(row.price_cents*15+50)//100)

    @staticmethod
    def _booking(booking, receipt):
        if receipt is None:
            raise MarketplacePersistenceError()
        return BookingResponse(booking_id=booking.id, session_id=booking.session_id,
            status=booking.status, booked_at=booking.booked_at, cancelled_at=booking.cancelled_at,
            transaction=TransactionResponse.model_validate(receipt))

    def search(self, subject_id, topic, starts_after, limit, offset):
        with self._factory() as uow:
            return [self._discovery(row) for row in uow.marketplace.search(
                self._clock(), subject_id, topic.strip() if topic else None, starts_after, limit, offset)]

    def detail(self, session_id):
        with self._factory() as uow:
            row = uow.marketplace.discovery(session_id, self._clock())
            if row is None:
                raise MarketplaceError("Sessão não encontrada ou indisponível.", 404)
            return self._discovery(row)

    @staticmethod
    def _lock_offer(uow, session_id):
        # Same profile -> offer lock order as tutor pause/cancellation. Tutor is immutable.
        row = uow.marketplace.session(session_id)
        if row is None:
            raise MarketplaceError("Sessão não encontrada.", 404)
        profile = uow.marketplace.profile(row.tutor_user_id, lock=True)
        row = uow.marketplace.session(session_id, lock=True)
        if profile is None or row is None:
            raise MarketplaceError("Sessão não encontrada.", 404)
        return profile, row

    def enroll(self, user_id, session_id):
        with self._factory() as uow:
            profile, row = self._lock_offer(uow, session_id)
            now = self._clock()
            if (profile.status != "active" or not uow.marketplace.tutor_active(row.tutor_user_id)
                    or row.status != "scheduled" or row.starts_at <= now):
                raise MarketplaceError("Esta sessão não está disponível para inscrição.", 409)
            if row.tutor_user_id == user_id:
                raise MarketplaceError("O tutor não pode se inscrever na própria sessão.", 409)
            if uow.marketplace.confirmed_booking(session_id, user_id) is not None:
                raise MarketplaceError("Você já possui uma inscrição ativa nesta sessão.", 409)
            if uow.marketplace.booking_count(session_id) >= row.capacity:
                raise MarketplaceError("Esta sessão está lotada.", 409)
            booking = SessionBooking(id=uuid4(), session_id=session_id, user_id=user_id,
                                     status="confirmed", booked_at=now, cancelled_at=None)
            # Exact half-up integer rounding matches PostgreSQL round(numeric).
            receipt = SimulatedTransaction(id=uuid4(), buyer_id=user_id, session_booking_id=booking.id,
                amount_cents=row.price_cents, commission_cents=(row.price_cents*15+50)//100,
                currency="BRL", status="completed", simulated=True, created_at=now, completed_at=now)
            uow.marketplace.add_booking(booking, receipt)
            response = self._booking(booking, receipt)
            uow.commit()
            return response

    def cancel_enrollment(self, user_id, session_id):
        with self._factory() as uow:
            _, row = self._lock_offer(uow, session_id)
            booking = uow.marketplace.confirmed_booking(session_id, user_id)
            if booking is None:
                raise MarketplaceError("Inscrição ativa não encontrada.", 404)
            now = self._clock()
            if row.status != "scheduled" or row.starts_at <= now:
                raise MarketplaceError("O cancelamento só é permitido antes do início da sessão.", 409)
            booking.status = "cancelled"
            booking.cancelled_at = now
            response = self._booking(booking, uow.marketplace.receipt(booking.id))
            uow.commit()
            return response

    def bookings_mine(self, user_id, limit, offset):
        with self._factory() as uow:
            return [BookingHistoryResponse(**self._booking(record[4], record[5]).model_dump(),
                session=self._discovery(record[:4])) for record in uow.marketplace.history(user_id, limit, offset)]
