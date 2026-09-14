import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="PostgreSQL required")


@pytest.fixture
def connection():
    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as conn:
        transaction = conn.begin()
        yield conn
        transaction.rollback()
    engine.dispose()


@pytest.fixture
def records(connection):
    ids = {name: uuid4() for name in ("tutor", "student", "other", "institution", "subject", "session", "booking")}
    for name in ("tutor", "student", "other"):
        connection.execute(text("INSERT INTO users(id, email, password_hash) VALUES (:id, :email, 'test')"), {"id": ids[name], "email": f"{ids[name]}@example.test"})
    connection.execute(text("INSERT INTO institutions(id, name) VALUES (:institution, 'Teste')"), ids)
    connection.execute(text("INSERT INTO subjects(id, institution_id, name) VALUES (:subject, :institution, 'Calculo')"), ids)
    connection.execute(text("INSERT INTO tutor_profiles(user_id) VALUES (:tutor)"), ids)
    connection.execute(text("INSERT INTO tutor_subjects(tutor_user_id, subject_id) VALUES (:tutor, :subject)"), ids)
    connection.execute(text("INSERT INTO tutor_sessions(id, tutor_user_id, subject_id, title, modality, external_url, starts_at, ends_at, capacity, price_cents) VALUES (:session, :tutor, :subject, 'Limites', 'online', 'https://example.test', now() + interval '1 day', now() + interval '2 days', 1, 10)"), ids)
    connection.execute(text("INSERT INTO session_bookings(id, session_id, user_id) VALUES (:booking, :session, :student)"), ids)
    return ids


@pytest.mark.parametrize("table,assignment", [
    ("tutor_profiles", "status='invalid'"),
    ("tutor_sessions", "capacity=0"),
    ("tutor_sessions", "capacity=-1"),
    ("tutor_sessions", "price_cents=-1"),
    ("tutor_sessions", "currency='USD'"),
    ("tutor_sessions", "simulated=false"),
    ("tutor_sessions", "ends_at=starts_at"),
    ("tutor_sessions", "title=' '"),
    ("tutor_sessions", "status='published'"),
    ("tutor_sessions", "modality='unknown'"),
    ("tutor_sessions", "external_url=' '"),
    ("tutor_sessions", "modality='hybrid'"),
    ("session_bookings", "status='cancelled'"),
    ("session_bookings", "status='attended'"),
    ("session_bookings", "cancelled_at=now()"),
    ("session_bookings", "status='cancelled', cancelled_at=booked_at - interval '1 second'"),
])
def test_invalid_values_rejected(connection, records, table, assignment):
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(text(f"UPDATE {table} SET {assignment}"))


def test_duplicate_and_reenrollment_preserve_history(connection, records):
    statement = text("INSERT INTO session_bookings(session_id, user_id) VALUES (:session, :student)")
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(statement, records)
    connection.execute(text("UPDATE session_bookings SET status='cancelled', cancelled_at=now() WHERE id=:booking"), records)
    connection.execute(statement, records)
    assert connection.scalar(text("SELECT count(*) FROM session_bookings WHERE session_id=:session"), records) == 2


def test_transaction_integrity_and_rounding(connection, records):
    insert = text("INSERT INTO transactions(session_booking_id,buyer_id,amount_cents,commission_cents) VALUES (:booking,:buyer,:amount,:commission)")
    for values in [dict(buyer=records["other"],amount=10,commission=2), dict(buyer=records["student"],amount=10,commission=1), dict(buyer=records["student"],amount=-1,commission=0)]:
        with pytest.raises(IntegrityError), connection.begin_nested():
            connection.execute(insert, {**records, **values})
    args = {**records, "buyer": records["student"], "amount":10, "commission":2}
    connection.execute(insert, args)
    with pytest.raises(IntegrityError), connection.begin_nested():
        connection.execute(insert, args)
    for assignment in ("simulated=false", "currency='USD'", "status='refunded'", "completed_at=NULL"):
        with pytest.raises(IntegrityError), connection.begin_nested():
            connection.execute(text(f"UPDATE transactions SET {assignment}"))
    assert connection.scalar(text("SELECT simulated FROM transactions WHERE session_booking_id=:booking"), records) is True


def test_references_restrict_deletion_and_undeclared_subject(connection, records):
    for statement in ("DELETE FROM users WHERE id=:tutor", "DELETE FROM subjects WHERE id=:subject", "UPDATE tutor_sessions SET tutor_user_id=:other", "UPDATE session_bookings SET session_id=:other"):
        with pytest.raises(IntegrityError), connection.begin_nested():
            connection.execute(text(statement), records)
