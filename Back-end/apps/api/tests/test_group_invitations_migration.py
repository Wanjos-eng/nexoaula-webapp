"""Exercise group invitation constraints on the migrated PostgreSQL schema."""

from uuid import uuid4

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from tests.test_academic_group_migration import graph, pytestmark as database_marks

pytestmark = database_marks


def test_group_invitation_schema_and_indexes(graph):
    connection, _ = graph
    inspector = inspect(connection)
    assert {column["name"] for column in inspector.get_columns("group_invitations")} == {
        "id",
        "group_id",
        "invited_user_id",
        "created_by",
        "token_hash",
        "status",
        "expires_at",
        "created_at",
        "accepted_at",
        "cancelled_at",
    }
    assert {constraint["name"] for constraint in inspector.get_check_constraints("group_invitations")} == {
        "chk_group_invitations_status",
        "chk_group_invitations_lifecycle",
        "chk_group_invitations_distinct_users",
    }
    indexes = {index["name"] for index in inspector.get_indexes("group_invitations")}
    assert {
        "uq_group_invitations_pending_user",
        "ix_group_invitations_group_status",
        "ix_group_invitations_invited_status",
    } <= indexes


def test_invitation_lifecycle_preserves_history_and_single_pending(graph):
    connection, ids = graph
    token = f"{uuid4().hex}{uuid4().hex}"
    connection.execute(
        text(
            "INSERT INTO group_invitations("
            "group_id,invited_user_id,created_by,token_hash,expires_at"
            ") VALUES (:group,:other_user,:user,:token,now() + interval '7 days')"
        ),
        ids | {"token": token},
    )

    with pytest.raises(IntegrityError) as duplicate:
        with connection.begin_nested():
            connection.execute(
                text(
                    "INSERT INTO group_invitations("
                    "group_id,invited_user_id,created_by,token_hash,expires_at"
                    ") VALUES (:group,:other_user,:user,:token,now() + interval '7 days')"
                ),
                ids | {"token": uuid4().hex},
            )
    assert duplicate.value.orig.pgcode == "23505"

    connection.execute(
        text(
            "UPDATE group_invitations SET status='accepted',accepted_at=now() "
            "WHERE token_hash=:token"
        ),
        {"token": token},
    )
    connection.execute(
        text(
            "INSERT INTO group_invitations("
            "group_id,invited_user_id,created_by,token_hash,expires_at"
            ") VALUES (:group,:other_user,:user,:token,now() + interval '7 days')"
        ),
        ids | {"token": uuid4().hex},
    )
    assert connection.scalar(
        text(
            "SELECT count(*) FROM group_invitations "
            "WHERE group_id=:group AND invited_user_id=:other_user"
        ),
        ids,
    ) == 2


def test_invitation_rejects_self_invite_and_invalid_lifecycle(graph):
    connection, ids = graph
    with pytest.raises(IntegrityError) as self_invite:
        with connection.begin_nested():
            connection.execute(
                text(
                    "INSERT INTO group_invitations("
                    "group_id,invited_user_id,created_by,token_hash,expires_at"
                    ") VALUES (:group,:user,:user,:token,now() + interval '1 day')"
                ),
                ids | {"token": uuid4().hex},
            )
    assert self_invite.value.orig.pgcode == "23514"

    with pytest.raises(IntegrityError) as lifecycle:
        with connection.begin_nested():
            connection.execute(
                text(
                    "INSERT INTO group_invitations("
                    "group_id,invited_user_id,created_by,token_hash,status,expires_at"
                    ") VALUES (:group,:other_user,:user,:token,'accepted',"
                    "now() + interval '1 day')"
                ),
                ids | {"token": uuid4().hex},
            )
    assert lifecycle.value.orig.pgcode == "23514"
