"""Real PostgreSQL coverage for persisted channel chat."""
from uuid import uuid4

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
async def chat_client(graph, monkeypatch):
    connection, ids = graph
    connection.execute(
        text(
            "INSERT INTO user_profiles(user_id,display_name) VALUES "
            "(:user,'Ana Silva'),(:other_user,'Bruno Lima')"
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


async def create_channel(client, group_id, name="geral"):
    response = await client.post(
        f"{PREFIX}/{group_id}/channels",
        json={"name": name},
    )
    assert response.status_code == 201, response.text
    return response.json()


def add_member(connection, ids):
    connection.execute(
        text(
            "INSERT INTO group_members(group_id,user_id) "
            "VALUES (:group,:other_user)"
        ),
        ids,
    )


async def test_chat_lifecycle_persists_reply_edit_and_soft_delete(chat_client):
    client, connection, ids = chat_client
    channel = await create_channel(client, ids["group"])
    url = f"{PREFIX}/{ids['group']}/channels/{channel['id']}/messages"

    created = await client.post(url, json={"content": "  Primeira mensagem  "})
    assert created.status_code == 201, created.text
    first = created.json()
    assert first["content"] == "Primeira mensagem"
    assert first["authorId"] == str(ids["user"])
    assert first["authorName"] == "Ana Silva"
    assert first["replyPreview"] is None
    assert "email" not in first

    add_member(connection, ids)
    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    reply = await client.post(
        url,
        json={"content": "Resposta", "replyToMessageId": first["id"]},
    )
    assert reply.status_code == 201, reply.text
    second = reply.json()
    assert second["authorName"] == "Bruno Lima"
    assert second["replyPreview"] == {
        "id": first["id"],
        "authorName": "Ana Silva",
        "content": "Primeira mensagem",
        "deleted": False,
    }

    history = (await client.get(url)).json()
    assert [item["id"] for item in history] == [first["id"], second["id"]]

    app.dependency_overrides[active_subject] = lambda: ids["user"]
    edited = await client.patch(
        f"{url}/{first['id']}",
        json={"content": "Mensagem editada"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["content"] == "Mensagem editada"
    assert edited.json()["editedAt"] is not None

    deleted = await client.delete(f"{url}/{first['id']}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["content"] is None
    assert deleted.json()["deletedAt"] is not None

    stored = connection.execute(
        text(
            "SELECT content,deleted_at FROM channel_messages "
            "WHERE id=:message_id"
        ),
        {"message_id": first["id"]},
    ).mappings().one()
    assert stored["content"] == "Mensagem editada"
    assert stored["deleted_at"] is not None

    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    reloaded = (await client.get(url)).json()
    assert reloaded[0]["content"] is None
    assert reloaded[1]["replyPreview"]["deleted"] is True
    assert reloaded[1]["replyPreview"]["content"] is None


async def test_chat_requires_active_membership_for_read_and_send(chat_client):
    client, connection, ids = chat_client
    channel = await create_channel(client, ids["group"])
    url = f"{PREFIX}/{ids['group']}/channels/{channel['id']}/messages"

    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    assert (await client.get(url)).status_code == 403
    assert (await client.post(url, json={"content": "Não entra"})).status_code == 403

    add_member(connection, ids)
    assert (await client.get(url)).status_code == 200

    connection.execute(
        text(
            "UPDATE group_members SET status='left',ended_at=now() "
            "WHERE group_id=:group AND user_id=:other_user"
        ),
        ids,
    )
    assert (await client.get(url)).status_code == 403


async def test_chat_rejects_cross_group_channel_and_cross_channel_reply(chat_client):
    client, connection, ids = chat_client
    first_channel = await create_channel(client, ids["group"], "geral")
    second_channel = await create_channel(client, ids["group"], "duvidas")
    first_url = f"{PREFIX}/{ids['group']}/channels/{first_channel['id']}/messages"
    second_url = f"{PREFIX}/{ids['group']}/channels/{second_channel['id']}/messages"

    origin = (await client.post(first_url, json={"content": "Origem"})).json()
    crossed = await client.post(
        second_url,
        json={"content": "Cruzada", "replyToMessageId": origin["id"]},
    )
    assert crossed.status_code == 422

    other_group = uuid4()
    connection.execute(
        text(
            "INSERT INTO study_groups(id,created_by,subject_id,name) "
            "VALUES (:other_group,:user,:subject,'Outro grupo')"
        ),
        ids | {"other_group": other_group},
    )
    connection.execute(
        text(
            "INSERT INTO group_members(group_id,user_id,role) "
            "VALUES (:other_group,:user,'owner')"
        ),
        ids | {"other_group": other_group},
    )
    foreign_url = (
        f"{PREFIX}/{other_group}/channels/{first_channel['id']}/messages"
    )
    assert (await client.get(foreign_url)).status_code == 404
    assert (
        await client.post(foreign_url, json={"content": "Inválida"})
    ).status_code == 404


async def test_archived_channel_and_group_only_block_new_messages(chat_client):
    client, connection, ids = chat_client
    channel = await create_channel(client, ids["group"], "historico")
    url = f"{PREFIX}/{ids['group']}/channels/{channel['id']}/messages"
    assert (await client.post(url, json={"content": "Antes"})).status_code == 201

    archived = await client.post(
        f"{PREFIX}/{ids['group']}/channels/{channel['id']}/archive",
        json={},
    )
    assert archived.status_code == 200
    assert (await client.get(url)).status_code == 200
    assert (await client.post(url, json={"content": "Depois"})).status_code == 409

    active = await create_channel(client, ids["group"], "ativo")
    active_url = f"{PREFIX}/{ids['group']}/channels/{active['id']}/messages"
    connection.execute(
        text("UPDATE study_groups SET status='archived' WHERE id=:group"),
        ids,
    )
    assert (await client.get(active_url)).status_code == 200
    assert (
        await client.post(active_url, json={"content": "Grupo arquivado"})
    ).status_code == 409


async def test_only_author_can_edit_or_delete_and_deleted_message_is_immutable(chat_client):
    client, connection, ids = chat_client
    channel = await create_channel(client, ids["group"])
    url = f"{PREFIX}/{ids['group']}/channels/{channel['id']}/messages"
    message = (await client.post(url, json={"content": "Minha"})).json()

    add_member(connection, ids)
    app.dependency_overrides[active_subject] = lambda: ids["other_user"]
    assert (
        await client.patch(f"{url}/{message['id']}", json={"content": "Tomada"})
    ).status_code == 403
    assert (await client.delete(f"{url}/{message['id']}")).status_code == 403

    app.dependency_overrides[active_subject] = lambda: ids["user"]
    assert (await client.delete(f"{url}/{message['id']}")).status_code == 200
    assert (
        await client.patch(f"{url}/{message['id']}", json={"content": "Volta"})
    ).status_code == 409
    assert (await client.delete(f"{url}/{message['id']}")).status_code == 409


async def test_message_validation_and_csrf(chat_client):
    client, _, ids = chat_client
    channel = await create_channel(client, ids["group"])
    url = f"{PREFIX}/{ids['group']}/channels/{channel['id']}/messages"

    assert (await client.post(url, json={"content": "   "})).status_code == 422
    assert (await client.post(url, json={"content": "x" * 4001})).status_code == 422

    message = (await client.post(url, json={"content": "Válida"})).json()
    bad = {"Origin": "https://untrusted.example"}
    assert (
        await client.post(url, json={"content": "CSRF"}, headers=bad)
    ).status_code == 403
    assert (
        await client.patch(
            f"{url}/{message['id']}",
            json={"content": "CSRF"},
            headers=bad,
        )
    ).status_code == 403
    assert (
        await client.delete(f"{url}/{message['id']}", headers=bad)
    ).status_code == 403


async def test_message_pagination_uses_newest_page_but_returns_chronological_order(chat_client):
    client, connection, ids = chat_client
    channel = await create_channel(client, ids["group"])
    url = f"{PREFIX}/{ids['group']}/channels/{channel['id']}/messages"
    message_ids = [uuid4(), uuid4(), uuid4()]

    for index, message_id in enumerate(message_ids, start=1):
        connection.execute(
            text(
                "INSERT INTO channel_messages("
                "id,channel_id,author_id,content,created_at"
                ") VALUES (:id,:channel,:author,:content,"
                "now() - (:minutes * interval '1 minute'))"
            ),
            {
                "id": message_id,
                "channel": channel["id"],
                "author": ids["user"],
                "content": f"Mensagem {index}",
                "minutes": 4 - index,
            },
        )

    newest = await client.get(url, params={"limit": 2, "offset": 0})
    assert newest.status_code == 200
    assert [item["content"] for item in newest.json()] == [
        "Mensagem 2",
        "Mensagem 3",
    ]

    older = await client.get(url, params={"limit": 2, "offset": 2})
    assert older.status_code == 200
    assert [item["content"] for item in older.json()] == ["Mensagem 1"]
