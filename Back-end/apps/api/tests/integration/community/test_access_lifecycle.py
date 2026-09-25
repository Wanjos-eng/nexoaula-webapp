"""Real PostgreSQL coverage for group access lifecycle and invitations."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.repository import SqlAlchemyCommunityUnitOfWork
from app.modules.community.service import CommunityService
from tests.test_academic_group_migration import graph, pytestmark as database_marks

pytestmark = [pytest.mark.anyio, database_marks]
PREFIX = "/api/v1/groups"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def lifecycle_client(graph, monkeypatch):
    connection, ids = graph
    connection.execute(
        text(
            "INSERT INTO user_profiles(user_id,display_name) VALUES "
            "(:user,'Organizador Pitch'),(:other_user,'Convidado Pitch')"
        ),
        ids,
    )
    factory = sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    monkeypatch.setattr(settings, "AUTH_ALLOWED_ORIGINS", ["https://testserver"])
    app.dependency_overrides[active_subject] = lambda: ids["user"]
    app.dependency_overrides[get_community_service] = lambda: CommunityService(
        lambda: SqlAlchemyCommunityUnitOfWork(factory)
    )
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="https://testserver",
            headers={
                "Origin": "https://testserver",
                "X-NexoAula-CSRF": "1",
                "Content-Type": "application/json",
            },
        ) as client:
            yield client, connection, ids
    finally:
        app.dependency_overrides.clear()


async def test_member_can_leave_but_owner_cannot(lifecycle_client):
    client, connection, ids = lifecycle_client
    connection.execute(
        text(
            "INSERT INTO group_members(group_id,user_id) "
            "VALUES (:group,:other_user)"
        ),
        ids,
    )

    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    left = await client.post(f"{PREFIX}/{ids['group']}/leave", json={})
    assert left.status_code == 200, left.text
    assert left.json()["status"] == "left"
    row = connection.execute(
        text(
            "SELECT status::text,ended_at,removed_by FROM group_members "
            "WHERE group_id=:group AND user_id=:other_user"
        ),
        ids,
    ).one()
    assert row[0] == "left"
    assert row[1] is not None
    assert row[2] is None

    app.dependency_overrides[active_subject] = lambda: ids["user"]
    owner = await client.post(f"{PREFIX}/{ids['group']}/leave", json={})
    assert owner.status_code == 409
    assert "Transfira a propriedade" in owner.json()["detail"]


async def test_user_can_cancel_own_pending_join_request(lifecycle_client):
    client, connection, ids = lifecycle_client
    connection.execute(
        text(
            "INSERT INTO group_join_requests(group_id,user_id) "
            "VALUES (:group,:other_user)"
        ),
        ids,
    )

    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    response = await client.request(
        "DELETE",
        f"{PREFIX}/{ids['group']}/join-request",
        json={},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "cancelled"

    row = connection.execute(
        text(
            "SELECT status::text,resolved_by,resolved_at,resolution_note "
            "FROM group_join_requests "
            "WHERE group_id=:group AND user_id=:other_user"
        ),
        ids,
    ).one()
    assert row[0] == "cancelled"
    assert row[1] == ids["other_user"]
    assert row[2] is not None
    assert row[3] == "Cancelada pelo solicitante."


async def test_invite_only_flow_is_targeted_single_use_and_persistent(lifecycle_client):
    client, connection, ids = lifecycle_client
    connection.execute(
        text(
            "UPDATE study_groups SET visibility='private',join_policy='invite_only' "
            "WHERE id=:group"
        ),
        ids,
    )
    invited_email = f"{ids['other_user']}@example.test"

    created = await client.post(
        f"{PREFIX}/{ids['group']}/invitations",
        json={"email": invited_email.upper()},
    )
    assert created.status_code == 201, created.text
    invite = created.json()
    assert invite["status"] == "pending"
    assert invite["invitedEmail"] == invited_email
    token = invite["token"]
    assert token
    assert token not in connection.scalar(
        text("SELECT token_hash FROM group_invitations WHERE id=:id"),
        {"id": UUID(invite["id"])},
    )

    listed = await client.get(f"{PREFIX}/{ids['group']}/invitations")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == invite["id"]
    assert "token" not in listed.json()[0]

    wrong_user = await client.get(f"{PREFIX}/invites/{token}")
    assert wrong_user.status_code == 404

    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    details = await client.get(f"{PREFIX}/invites/{token}")
    assert details.status_code == 200
    assert details.json()["groupName"] == "Study group"

    accepted = await client.post(f"{PREFIX}/invites/{token}/accept", json={})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "active"

    participation = await client.get(f"{PREFIX}/{ids['group']}/participation")
    assert participation.status_code == 200
    assert participation.json()["status"] == "active"

    reused = await client.post(f"{PREFIX}/invites/{token}/accept", json={})
    assert reused.status_code == 409

    row = connection.execute(
        text(
            "SELECT status,accepted_at FROM group_invitations WHERE id=:id"
        ),
        {"id": UUID(invite["id"])},
    ).one()
    assert row[0] == "accepted"
    assert row[1] is not None


async def test_invitation_can_be_cancelled_and_expired_invitation_cannot_be_used(
    lifecycle_client,
):
    client, connection, ids = lifecycle_client
    invited_email = f"{ids['other_user']}@example.test"

    created = await client.post(
        f"{PREFIX}/{ids['group']}/invitations",
        json={"email": invited_email},
    )
    assert created.status_code == 201, created.text
    invite = created.json()

    cancelled = await client.request(
        "DELETE",
        f"{PREFIX}/{ids['group']}/invitations/{invite['id']}",
        json={},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    second = await client.post(
        f"{PREFIX}/{ids['group']}/invitations",
        json={"email": invited_email},
    )
    assert second.status_code == 201, second.text
    second_invite = second.json()
    connection.execute(
        text(
            "UPDATE group_invitations SET expires_at=:expired "
            "WHERE id=:id"
        ),
        {
            "id": UUID(second_invite["id"]),
            "expired": datetime.now(UTC) - timedelta(minutes=1),
        },
    )

    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    expired = await client.post(
        f"{PREFIX}/invites/{second_invite['token']}/accept",
        json={},
    )
    assert expired.status_code == 410

    state = connection.scalar(
        text("SELECT status FROM group_invitations WHERE id=:id"),
        {"id": UUID(second_invite["id"])},
    )
    assert state == "expired"


async def test_invitation_requires_existing_non_member_without_pending_request(
    lifecycle_client,
):
    client, connection, ids = lifecycle_client

    missing = await client.post(
        f"{PREFIX}/{ids['group']}/invitations",
        json={"email": "nao-existe@nexoaula.test"},
    )
    assert missing.status_code == 404

    connection.execute(
        text(
            "INSERT INTO group_join_requests(group_id,user_id) "
            "VALUES (:group,:other_user)"
        ),
        ids,
    )
    pending = await client.post(
        f"{PREFIX}/{ids['group']}/invitations",
        json={"email": f"{ids['other_user']}@example.test"},
    )
    assert pending.status_code == 409
    assert "Aprove a solicitação" in pending.json()["detail"]
