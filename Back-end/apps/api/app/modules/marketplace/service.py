from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID, uuid4

from pydantic import ValidationError

from app.modules.marketplace.errors import MarketplaceError
from app.modules.marketplace.models import SessionBooking, SimulatedTransaction, TutorSession
from app.modules.marketplace.repository import MarketplaceUnitOfWork
from app.modules.marketplace.schemas import (
    SessionCreate,
    BookingResponse,
    EnrollmentReceipt,
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
                self._response(uow, row)
                for row in uow.marketplace.list_mine(user_id, limit, offset)
            ]

    @staticmethod
    def _response(uow, row):
        view = uow.marketplace.public_session(row.id)
        if view is None:
            return SessionResponse.model_validate(row)
        session, tutor_name, subject_name, enrolled_count = view
        return SessionResponse.model_validate({
            **{field: getattr(session, field) for field in SessionResponse.model_fields if hasattr(session, field)},
            "tutor_name": tutor_name,
            "subject_name": subject_name,
            "enrolled_count": enrolled_count,
        })

    def list_public(self, subject_id, starts_after, limit, offset):
        with self._factory() as uow:
            return [
                SessionResponse.model_validate({
                    **{field: getattr(row, field) for field in SessionResponse.model_fields if hasattr(row, field)},
                    "tutor_name": tutor_name,
                    "subject_name": subject_name,
                    "enrolled_count": enrolled_count,
                })
                for row, tutor_name, subject_name, enrolled_count in uow.marketplace.public_sessions(
                    subject_id, starts_after or self._clock(), limit, offset
                )
            ]

    def get_public(self, session_id):
        with self._factory() as uow:
            view = uow.marketplace.public_session(session_id)
            if view is None or view[0].status != "scheduled":
                raise MarketplaceError("Sessão não encontrada.", 404)
            row, tutor_name, subject_name, enrolled_count = view
            return SessionResponse.model_validate({
                **{field: getattr(row, field) for field in SessionResponse.model_fields if hasattr(row, field)},
                "tutor_name": tutor_name,
                "subject_name": subject_name,
                "enrolled_count": enrolled_count,
            })

    def enroll(self, user_id, session_id):
        with self._factory() as uow:
            row = uow.marketplace.session(session_id, lock=True)
            if row is None or row.status != "scheduled":
                raise MarketplaceError("Sessão indisponível para inscrição.", 409)
            if row.starts_at <= self._clock():
                raise MarketplaceError("O início da sessão já passou.", 409)
            if uow.marketplace.booking(session_id, user_id, lock=True):
                raise MarketplaceError("Você já possui inscrição ativa nesta sessão.", 409)
            if uow.marketplace.count_confirmed(session_id) >= row.capacity:
                raise MarketplaceError("A sessão está lotada.", 409)
            now = self._clock()
            booking = SessionBooking(
                session_id=session_id, user_id=user_id, status="confirmed", booked_at=now
            )
            uow.marketplace.add_booking(booking)
            transaction = SimulatedTransaction(
                buyer_id=user_id,
                session_booking_id=booking.id,
                amount_cents=row.price_cents,
                commission_cents=round(row.price_cents * 0.15),
                currency=row.currency,
                status="completed",
                simulated=True,
            )
            uow.marketplace.add_transaction(transaction)
            uow.commit()
            return EnrollmentReceipt.model_validate({
                "booking_id": booking.id,
                "session_id": session_id,
                "status": booking.status,
                "transaction": transaction,
            })

    def cancel_enrollment(self, user_id, session_id):
        with self._factory() as uow:
            row = uow.marketplace.session(session_id, lock=True)
            booking = uow.marketplace.booking(session_id, user_id, lock=True)
            if row is None or booking is None:
                raise MarketplaceError("Inscrição ativa não encontrada.", 404)
            if row.starts_at <= self._clock():
                raise MarketplaceError("O cancelamento só é permitido antes do início.", 409)
            booking.status = "cancelled"
            booking.cancelled_at = self._clock()
            uow.commit()

    def list_bookings(self, user_id):
        with self._factory() as uow:
            result = []
            for booking, transaction in uow.marketplace.list_bookings(user_id):
                view = uow.marketplace.public_session(booking.session_id)
                if view is None:
                    continue
                row, tutor_name, subject_name, enrolled_count = view
                session = SessionResponse.model_validate({
                    **{field: getattr(row, field) for field in SessionResponse.model_fields if hasattr(row, field)},
                    "tutor_name": tutor_name,
                    "subject_name": subject_name,
                    "enrolled_count": enrolled_count,
                })
                result.append(BookingResponse.model_validate({
                    "id": booking.id,
                    "session": session,
                    "status": booking.status,
                    "booked_at": booking.booked_at,
                    "cancelled_at": booking.cancelled_at,
                    "transaction": transaction,
                }))
            return result

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
