"""Physical session-only simulation slice of ADR-0004; no financial credentials."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKeyConstraint, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TutorProfile(Base):
    __tablename__ = "tutor_profiles"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        CheckConstraint("status IN ('active', 'paused', 'suspended')", name="chk_tutor_profiles_status"),
    )
    user_id: Mapped[UUID] = mapped_column(PGUUID, primary_key=True)
    headline: Mapped[str | None] = mapped_column(String(200))
    bio: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TutorSubject(Base):
    __tablename__ = "tutor_subjects"
    __table_args__ = (
        ForeignKeyConstraint(["tutor_user_id"], ["tutor_profiles.user_id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="RESTRICT"),
        Index("ix_tutor_subjects_subject_id", "subject_id"),
    )
    tutor_user_id: Mapped[UUID] = mapped_column(PGUUID, primary_key=True)
    subject_id: Mapped[UUID] = mapped_column(PGUUID, primary_key=True)


class TutorSession(Base):
    __tablename__ = "tutor_sessions"
    __table_args__ = (
        ForeignKeyConstraint(["tutor_user_id", "subject_id"], ["tutor_subjects.tutor_user_id", "tutor_subjects.subject_id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["class_section_id", "subject_id"], ["class_sections.id", "class_sections.subject_id"], ondelete="RESTRICT"),
        CheckConstraint("status IN ('draft', 'scheduled', 'completed', 'cancelled')", name="chk_tutor_sessions_status"),
        CheckConstraint("modality IN ('online', 'in_person', 'hybrid')", name="chk_tutor_sessions_modality"),
        CheckConstraint("length(btrim(title)) > 0", name="chk_tutor_sessions_title"),
        CheckConstraint("ends_at > starts_at", name="chk_tutor_sessions_time_range"),
        CheckConstraint("capacity > 0", name="chk_tutor_sessions_capacity"),
        CheckConstraint("price_cents >= 0", name="chk_tutor_sessions_price"),
        CheckConstraint("currency = 'BRL'", name="chk_tutor_sessions_currency"),
        CheckConstraint("simulated", name="chk_tutor_sessions_simulated"),
        CheckConstraint("(modality = 'in_person' AND NULLIF(btrim(location), '') IS NOT NULL) OR (modality = 'online' AND NULLIF(btrim(external_url), '') IS NOT NULL) OR (modality = 'hybrid' AND NULLIF(btrim(location), '') IS NOT NULL AND NULLIF(btrim(external_url), '') IS NOT NULL)", name="chk_tutor_sessions_modality_fields"),
        Index("ix_tutor_sessions_tutor_start", "tutor_user_id", "starts_at"),
        Index("ix_tutor_sessions_subject_status_start", "subject_id", "status", "starts_at"),
        Index("ix_tutor_sessions_class_section_id", "class_section_id"),
    )
    id: Mapped[UUID] = mapped_column(PGUUID, primary_key=True, server_default=text("gen_random_uuid()"))
    tutor_user_id: Mapped[UUID] = mapped_column(PGUUID)
    subject_id: Mapped[UUID] = mapped_column(PGUUID)
    class_section_id: Mapped[UUID | None] = mapped_column(PGUUID)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    modality: Mapped[str] = mapped_column(String(20))
    location: Mapped[str | None] = mapped_column(String(250))
    external_url: Mapped[str | None] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer)
    price_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), server_default="BRL")
    simulated: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    status: Mapped[str] = mapped_column(String(20), server_default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessionBooking(Base):
    __tablename__ = "session_bookings"
    __table_args__ = (
        ForeignKeyConstraint(["session_id"], ["tutor_sessions.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        UniqueConstraint("id", "user_id", name="uq_session_bookings_id_user_id"),
        CheckConstraint("status IN ('confirmed', 'cancelled')", name="chk_session_bookings_status"),
        CheckConstraint("(status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status = 'confirmed' AND cancelled_at IS NULL)", name="chk_session_bookings_cancellation"),
        CheckConstraint("cancelled_at IS NULL OR cancelled_at >= booked_at", name="chk_session_bookings_cancellation_time"),
        Index("uq_session_bookings_non_cancelled", "session_id", "user_id", unique=True, postgresql_where=text("status <> 'cancelled'")),
        Index("ix_session_bookings_user_status", "user_id", "status"),
        Index("ix_session_bookings_session_status", "session_id", "status"),
    )
    id: Mapped[UUID] = mapped_column(PGUUID, primary_key=True, server_default=text("gen_random_uuid()"))
    session_id: Mapped[UUID] = mapped_column(PGUUID)
    user_id: Mapped[UUID] = mapped_column(PGUUID)
    status: Mapped[str] = mapped_column(String(20), server_default="confirmed")
    booked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SimulatedTransaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        ForeignKeyConstraint(["session_booking_id", "buyer_id"], ["session_bookings.id", "session_bookings.user_id"], ondelete="RESTRICT"),
        UniqueConstraint("session_booking_id", name="uq_transactions_booking"),
        CheckConstraint("amount_cents >= 0", name="chk_transactions_amount"),
        CheckConstraint("commission_cents = round(amount_cents::numeric * 0.15)", name="chk_transactions_commission"),
        CheckConstraint("currency = 'BRL'", name="chk_transactions_currency"),
        CheckConstraint("status = 'completed'", name="chk_transactions_status"),
        CheckConstraint("simulated", name="chk_transactions_simulated"),
        Index("ix_transactions_buyer_created", "buyer_id", "created_at"),
    )
    id: Mapped[UUID] = mapped_column(PGUUID, primary_key=True, server_default=text("gen_random_uuid()"))
    buyer_id: Mapped[UUID] = mapped_column(PGUUID)
    session_booking_id: Mapped[UUID] = mapped_column(PGUUID)
    amount_cents: Mapped[int] = mapped_column(Integer)
    commission_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), server_default="BRL")
    status: Mapped[str] = mapped_column(String(20), server_default="completed")
    simulated: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
