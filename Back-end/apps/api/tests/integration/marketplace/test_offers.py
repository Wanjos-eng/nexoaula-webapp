from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.main import app
from app.modules.auth.dependencies import (
    active_subject,
    get_authentication_service,
)
from app.modules.auth.security import SessionTokens
from app.core.config import settings
from app.modules.users.service import UserService
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork
from app.modules.auth.service import AuthenticationService

P = "/api/v1/marketplace"


def offer(market):
    assert market.client.post(P + "/tutor/activate", json={}).status_code == 200
    response = market.client.post(P + "/sessions", json=market.payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_optional_profile_reversible_preserves_academic_account(market):
    c = market.client
    assert c.get(P + "/tutor").json() is None
    assert c.get(P + "/sessions/mine").json() == []
    assert c.post(P + "/sessions", json=market.payload).status_code == 403
    activated = c.post(
        P + "/tutor/activate",
        json={"headline": "Tutor de cálculo", "bio": "Bio profissional"},
    )
    assert activated.status_code == 200
    assert activated.json()["status"] == "active" and activated.json()["simulated"]
    assert c.request("DELETE", P + "/tutor/deactivate").json()["status"] == "paused"
    assert c.post(P + "/sessions", json=market.payload).status_code == 403
    resumed = c.post(P + "/tutor/activate", json={}).json()
    assert resumed["bio"] == "Bio profissional" and resumed["status"] == "active"
    assert (
        market.connection.scalar(
            text("SELECT bio FROM user_profiles WHERE user_id=:id"),
            {"id": market.ids["tutor"]},
        )
        == "Bio acadêmica"
    )
    assert market.connection.scalar(
        text("SELECT is_active FROM users WHERE id=:id"), {"id": market.ids["tutor"]}
    )
    assert (
        market.connection.scalar(
            text("SELECT count(*) FROM tutor_profiles WHERE user_id=:id"),
            {"id": market.ids["tutor"]},
        )
        == 1
    )


def test_create_edit_publish_and_cancel(market):
    row = offer(market)
    c = market.client
    path = P + "/sessions/" + row["id"]
    assert row["status"] == "draft" and row["tutor_user_id"] == str(market.ids["tutor"])
    assert row["currency"] == "BRL" and row["simulated"] is True
    assert "Nenhum pagamento foi processado." in row["notice"]
    edited = c.patch(
        path, json={"title": "Integrais", "capacity": 1, "price_cents": 0}
    ).json()
    assert edited["title"] == "Integrais" and edited["price_cents"] == 0
    assert c.request("DELETE", path).status_code == 409
    published = c.post(path + "/publish", json={})
    assert published.status_code == 200 and published.json()["status"] == "scheduled"
    assert c.patch(path, json={"title": "Novo"}).status_code == 409
    assert c.post(path + "/publish", json={}).status_code == 409
    c.request("DELETE", P + "/tutor/deactivate")
    assert c.request("DELETE", path).json()["status"] == "cancelled"
    assert c.request("DELETE", path).status_code == 409
    c.post(P + "/tutor/activate", json={})
    assert c.post(path + "/publish", json={}).status_code == 409
    assert c.patch(path, json={"price_cents": 100}).status_code == 409
    assert c.get(P + "/sessions/mine").json()[0]["status"] == "cancelled"
    assert (
        market.connection.scalar(
            text(
                "SELECT count(*) FROM tutor_subjects WHERE tutor_user_id=:tutor AND subject_id=:subject"
            ),
            market.ids,
        )
        == 1
    )


def test_other_user_cannot_edit_publish_cancel_or_list(market):
    row = offer(market)
    market.as_user("other")
    market.client.post(P + "/tutor/activate", json={})
    path = P + "/sessions/" + row["id"]
    assert market.client.patch(path, json={"title": "Ataque"}).status_code == 403
    assert market.client.post(path + "/publish", json={}).status_code == 403
    assert market.client.request("DELETE", path).status_code == 403
    assert market.client.get(P + "/sessions/mine").json() == []
    assert (
        market.client.patch(
            P + "/sessions/" + str(uuid4()), json={"title": "Novo"}
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "change",
    [
        {"title": " "},
        {"title": "x" * 201},
        {"capacity": 0},
        {"capacity": -1},
        {"capacity": True},
        {"capacity": 2.5},
        {"capacity": 2147483648},
        {"price_cents": -1},
        {"price_cents": 1.5},
        {"currency": "USD"},
        {"modality": "invalid"},
        {"external_url": "javascript:alert(1)"},
        {"external_url": "https://user:password@example.test"},
        {"modality": "in_person"},
        {"modality": "hybrid"},
        {"starts_at": "2030-01-01T10:00:00"},
        {"starts_at": "2020-01-01T10:00:00Z", "ends_at": "2020-01-01T11:00:00Z"},
        {"ends_at": "2020-01-01T10:00:00Z"},
        {"subject_id": str(uuid4())},
        {"status": "scheduled"},
        {"tutor_user_id": str(uuid4())},
        {"simulated": False},
    ],
)
def test_invalid_creation_rejected_without_writing(market, change):
    market.client.post(P + "/tutor/activate", json={})
    assert (
        market.client.post(P + "/sessions", json=market.payload | change).status_code
        == 422
    )
    assert market.client.get(P + "/sessions/mine").json() == []


def test_partial_update_validates_combined_state_and_context(market):
    row = offer(market)
    path = P + "/sessions/" + row["id"]
    for change in (
        {"modality": "hybrid"},
        {"subject_id": str(market.ids["other_subject"])},
        {"ends_at": market.payload["starts_at"]},
        {"capacity": None},
        {"title": None},
        {"external_url": None},
        {"external_url": "https://u:p@example.test"},
    ):
        assert market.client.patch(path, json=change).status_code == 422
    assert market.client.get(P + "/sessions/mine").json()[0]["modality"] == "online"
    valid = market.client.patch(
        path,
        json={
            "modality": "in_person",
            "location": "Sala 1",
            "external_url": None,
            "subject_id": str(market.ids["other_subject"]),
            "class_section_id": None,
        },
    )
    assert valid.status_code == 200, valid.text
    assert valid.json()["external_url"] is None
    assert market.client.post(path + "/publish", json={}).status_code == 200


def test_publish_rechecks_clock_and_terminal_state(market):
    row = offer(market)
    path = P + "/sessions/" + row["id"]
    market.service._clock = lambda: datetime.now(UTC) + timedelta(days=2)
    assert market.client.post(path + "/publish", json={}).status_code == 422
    market.connection.execute(
        text("UPDATE tutor_sessions SET status='completed' WHERE id=:id"),
        {"id": row["id"]},
    )
    assert market.client.post(path + "/publish", json={}).status_code == 409
    assert market.client.request("DELETE", path).status_code == 409


def test_suspended_profile_cannot_self_reactivate(market):
    offer(market)
    market.connection.execute(
        text("UPDATE tutor_profiles SET status='suspended' WHERE user_id=:tutor"),
        market.ids,
    )
    assert market.client.post(P + "/tutor/activate", json={}).status_code == 403
    assert market.client.request("DELETE", P + "/tutor/deactivate").status_code == 403
    assert market.client.post(P + "/sessions", json=market.payload).status_code == 403


def test_cancel_existing_bookings_preserves_receipt(market):
    row = offer(market)
    path = P + "/sessions/" + row["id"]
    market.client.post(path + "/publish", json={})
    booking = uuid4()
    args = {**market.ids, "session": row["id"], "booking": booking}
    market.connection.execute(
        text(
            "INSERT INTO session_bookings(id,session_id,user_id) VALUES (:booking,:session,:student)"
        ),
        args,
    )
    market.connection.execute(
        text(
            "INSERT INTO transactions(session_booking_id,buyer_id,amount_cents,commission_cents) VALUES (:booking,:student,2500,375)"
        ),
        args,
    )
    assert market.client.request("DELETE", path).status_code == 200
    assert (
        market.connection.scalar(
            text("SELECT status FROM session_bookings WHERE id=:booking"), args
        )
        == "cancelled"
    )
    assert (
        market.connection.scalar(
            text("SELECT status FROM transactions WHERE session_booking_id=:booking"),
            args,
        )
        == "completed"
    )


def test_mine_pagination(market):
    offer(market)
    market.client.post(P + "/sessions", json=market.payload)
    assert len(market.client.get(P + "/sessions/mine?limit=1&offset=1").json()) == 1
    assert market.client.get(P + "/sessions/mine?limit=1&offset=2").json() == []
    assert market.client.get(P + "/sessions/mine?limit=101").status_code == 422


def test_signed_cookie_inactive_user_is_rejected(market):
    # Exercise real JWT + active user validation, without password login overhead.
    app.dependency_overrides.pop(active_subject)
    users = UserService(lambda: SqlAlchemyUserUnitOfWork(market.factory))
    auth = AuthenticationService(users, None, None)
    app.dependency_overrides[get_authentication_service] = lambda: auth
    tokens = SessionTokens(settings)
    token, _ = tokens.issue(market.ids["tutor"])
    market.client.cookies.set(settings.auth_cookie_name, token.get_secret_value())
    assert market.client.get(P + "/tutor").status_code == 200
    market.connection.execute(
        text("UPDATE users SET is_active=false WHERE id=:tutor"), market.ids
    )
    assert market.client.post(P + "/tutor/activate", json={}).status_code == 401
