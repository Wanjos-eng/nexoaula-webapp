"""Channels isolation and status constraints on migrated PostgreSQL."""
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from test_academic_group_migration import graph, pytestmark


@pytest.fixture
def group_state(graph):
    connection, ids = graph
    ids |= {key: uuid4() for key in ('other_group', 'channel', 'other_channel')}
    connection.execute(text("INSERT INTO study_groups(id,created_by,subject_id,class_section_id,name) VALUES (:other_group,:user,:subject,:section,'Other group')"), ids)
    connection.execute(text("INSERT INTO channels(id,group_id,created_by,name,status) VALUES (:channel,:group,:user,'Geral','active')"), ids)
    return connection, ids


@pytest.mark.parametrize('statement,sqlstate', [
    # group_id and name must be unique
    ("INSERT INTO channels(group_id,created_by,name,status) VALUES (:group,:user,'Geral','active')", '23505'),
    # check constraint on status/archived_at
    ("UPDATE channels SET status='archived' WHERE id=:channel", '23514'),
    ("UPDATE channels SET archived_at=now() WHERE id=:channel", '23514'),
    ("INSERT INTO channels(group_id,created_by,name,status,archived_at) VALUES (:group,:user,'Archived','active',now())", '23514'),
    ("INSERT INTO channels(group_id,created_by,name,status) VALUES (:group,:user,'Archived','archived')", '23514'),
    # Foreign keys
    ("INSERT INTO channels(group_id,created_by,name,status) VALUES (gen_random_uuid(),:user,'Lost','active')", '23503'),
])
def test_invalid_channel_is_rejected(group_state, statement, sqlstate):
    connection, ids = group_state
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text(statement), ids)
    assert caught.value.orig.pgcode == sqlstate


def test_independent_group_channels(group_state):
    connection, ids = group_state
    # Mesmos nomes em grupos diferentes são permitidos
    connection.execute(text("INSERT INTO channels(id,group_id,created_by,name,status) VALUES (:other_channel,:other_group,:user,'Geral','active')"), ids)
    assert connection.scalar(text("SELECT count(*) FROM channels WHERE name='Geral'"), ids) == 2

    # Arquivamento válido
    connection.execute(text("UPDATE channels SET status='archived', archived_at=now() WHERE id=:channel"), ids)
    assert connection.scalar(text("SELECT count(*) FROM channels WHERE status='archived' AND archived_at IS NOT NULL"), ids) == 1


def test_channel_topic_must_belong_to_same_group(group_state):
    connection, ids = group_state
    ids['topic'] = uuid4()
    connection.execute(text("INSERT INTO group_topics(id,group_id,subject_id,custom_title) VALUES (:topic,:group,:subject,'Assunto próprio')"),ids)
    connection.execute(text('UPDATE channels SET group_topic_id=:topic WHERE id=:channel'),ids)
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text("INSERT INTO channels(group_id,group_topic_id,created_by,name) VALUES (:other_group,:topic,:user,'Wrong group')"),ids)
    assert caught.value.orig.pgcode == '23503'
