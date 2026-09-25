"""Exercise channel_messages constraints on the migrated PostgreSQL schema."""

from uuid import uuid4

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from tests.test_academic_group_migration import graph, pytestmark as database_marks

pytestmark = database_marks


@pytest.fixture
def message_graph(graph):
    connection, base_ids = graph
    ids = dict(base_ids)
    ids.update(
        {
            "channel": uuid4(),
            "other_channel": uuid4(),
            "message": uuid4(),
            "reply": uuid4(),
        }
    )
    connection.execute(
        text(
            "INSERT INTO channels(id,group_id,name,created_by) VALUES "
            "(:channel,:group,'geral',:user),"
            "(:other_channel,:group,'duvidas',:user)"
        ),
        ids,
    )
    return connection, ids


def assert_integrity_error(connection, statement, params, sqlstate):
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text(statement), params)
    assert caught.value.orig.pgcode == sqlstate


def test_channel_messages_schema_matches_approved_dbml(message_graph):
    connection, _ = message_graph
    inspector = inspect(connection)

    assert {column["name"] for column in inspector.get_columns("channel_messages")} == {
        "id",
        "channel_id",
        "author_id",
        "reply_to_message_id",
        "content",
        "created_at",
        "edited_at",
        "deleted_at",
    }

    indexes = {
        index["name"]: tuple(index["column_names"])
        for index in inspector.get_indexes("channel_messages")
        if not index.get("unique")
    }
    assert indexes == {
        "ix_channel_messages_author_created_at": ("author_id", "created_at"),
        "ix_channel_messages_channel_created_at": ("channel_id", "created_at"),
    }

    assert {
        constraint["name"]
        for constraint in inspector.get_unique_constraints("channel_messages")
    } == {"uq_channel_messages_id_channel_id"}
    assert {
        constraint["name"]
        for constraint in inspector.get_check_constraints("channel_messages")
    } == {"chk_channel_messages_not_self_reply"}

    foreign_keys = {
        fk["name"]: (
            tuple(fk["constrained_columns"]),
            fk["referred_table"],
            tuple(fk["referred_columns"]),
            fk["options"].get("ondelete"),
        )
        for fk in inspector.get_foreign_keys("channel_messages")
    }
    assert foreign_keys["fk_channel_messages_author"] == (
        ("author_id",),
        "users",
        ("id",),
        "RESTRICT",
    )
    assert foreign_keys["fk_channel_messages_channel"] == (
        ("channel_id",),
        "channels",
        ("id",),
        "CASCADE",
    )
    assert foreign_keys["fk_channel_messages_reply_target"] == (
        ("reply_to_message_id",),
        "channel_messages",
        ("id",),
        "SET NULL",
    )
    assert foreign_keys["fk_channel_messages_reply_same_channel"][:3] == (
        ("reply_to_message_id", "channel_id"),
        "channel_messages",
        ("id", "channel_id"),
    )


def test_valid_message_and_same_channel_reply_persist(message_graph):
    connection, ids = message_graph
    connection.execute(
        text(
            "INSERT INTO channel_messages(id,channel_id,author_id,content) "
            "VALUES (:message,:channel,:user,'Mensagem inicial')"
        ),
        ids,
    )
    connection.execute(
        text(
            "INSERT INTO channel_messages("
            "id,channel_id,author_id,reply_to_message_id,content"
            ") VALUES (:reply,:channel,:other_user,:message,'Resposta')"
        ),
        ids,
    )

    row = connection.execute(
        text(
            "SELECT channel_id,author_id,reply_to_message_id,content,"
            "created_at,edited_at,deleted_at "
            "FROM channel_messages WHERE id=:reply"
        ),
        ids,
    ).mappings().one()

    assert row["channel_id"] == ids["channel"]
    assert row["author_id"] == ids["other_user"]
    assert row["reply_to_message_id"] == ids["message"]
    assert row["content"] == "Resposta"
    assert row["created_at"] is not None
    assert row["edited_at"] is None
    assert row["deleted_at"] is None


@pytest.mark.parametrize(
    ("statement", "sqlstate"),
    [
        (
            "INSERT INTO channel_messages(channel_id,author_id,content) "
            "VALUES (gen_random_uuid(),:user,'Canal inexistente')",
            "23503",
        ),
        (
            "INSERT INTO channel_messages(channel_id,author_id,content) "
            "VALUES (:channel,gen_random_uuid(),'Autor inexistente')",
            "23503",
        ),
    ],
)
def test_channel_and_author_foreign_keys_are_enforced(
    message_graph,
    statement,
    sqlstate,
):
    connection, ids = message_graph
    assert_integrity_error(connection, statement, ids, sqlstate)


def test_reply_must_stay_inside_the_same_channel(message_graph):
    connection, ids = message_graph
    connection.execute(
        text(
            "INSERT INTO channel_messages(id,channel_id,author_id,content) "
            "VALUES (:message,:channel,:user,'Origem')"
        ),
        ids,
    )

    assert_integrity_error(
        connection,
        (
            "INSERT INTO channel_messages("
            "channel_id,author_id,reply_to_message_id,content"
            ") VALUES (:other_channel,:other_user,:message,'Resposta cruzada')"
        ),
        ids,
        "23503",
    )


def test_message_cannot_reply_to_itself(message_graph):
    connection, ids = message_graph

    assert_integrity_error(
        connection,
        (
            "INSERT INTO channel_messages("
            "id,channel_id,author_id,reply_to_message_id,content"
            ") VALUES (:message,:channel,:user,:message,'Autorresposta')"
        ),
        ids,
        "23514",
    )


def test_deleting_reply_target_sets_reference_to_null(message_graph):
    connection, ids = message_graph
    connection.execute(
        text(
            "INSERT INTO channel_messages(id,channel_id,author_id,content) "
            "VALUES (:message,:channel,:user,'Origem')"
        ),
        ids,
    )
    connection.execute(
        text(
            "INSERT INTO channel_messages("
            "id,channel_id,author_id,reply_to_message_id,content"
            ") VALUES (:reply,:channel,:other_user,:message,'Resposta')"
        ),
        ids,
    )

    connection.execute(
        text("DELETE FROM channel_messages WHERE id=:message"),
        ids,
    )

    assert connection.scalar(
        text("SELECT reply_to_message_id FROM channel_messages WHERE id=:reply"),
        ids,
    ) is None


def test_deleting_channel_cascades_its_messages(message_graph):
    connection, ids = message_graph
    connection.execute(
        text(
            "INSERT INTO channel_messages(id,channel_id,author_id,content) "
            "VALUES (:message,:channel,:user,'Mensagem')"
        ),
        ids,
    )

    connection.execute(text("DELETE FROM channels WHERE id=:channel"), ids)

    assert connection.scalar(
        text("SELECT count(*) FROM channel_messages WHERE id=:message"),
        ids,
    ) == 0
