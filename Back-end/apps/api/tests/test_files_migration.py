"""Files and storage attachments constraints on migrated PostgreSQL."""
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from test_academic_group_migration import graph, pytestmark


@pytest.fixture
def files_state(graph):
    connection, ids = graph
    ids |= {
        key: uuid4()
        for key in (
            "file_avatar",
            "file_plan",
            "other_user",
            "plan",
        )
    }
    # Create another user for isolation checks
    connection.execute(
        text(
            "INSERT INTO users(id, email, password_hash) "
            "VALUES (:other_user, 'other@example.edu', 'hash')"
        ),
        ids,
    )
    # Insert user profile for :user
    connection.execute(
        text("INSERT INTO user_profiles(user_id, display_name) VALUES (:user, 'User Name')"),
        ids,
    )
    # Insert valid files
    connection.execute(
        text(
            "INSERT INTO files(id, owner_id, purpose, storage_provider, storage_key, mime_type, size_bytes, original_filename) "
            "VALUES (:file_avatar, :user, 'avatar', 'local', 'avatars/avatar1.jpg', 'image/jpeg', 1024, 'photo.jpg'), "
            "       (:file_plan, :user, 'teaching_plan_source', 'local', 'plans/plan1.pdf', 'application/pdf', 2048, 'syllabus.pdf')"
        ),
        ids,
    )
    # Insert teaching plan
    connection.execute(
        text(
            "INSERT INTO teaching_plans(id, group_id, creator_id) "
            "VALUES (:plan, :group, :user)"
        ),
        ids,
    )
    return connection, ids


@pytest.mark.parametrize(
    "statement,sqlstate",
    [
        # size_bytes must be positive (> 0)
        (
            "INSERT INTO files(owner_id, purpose, storage_key, mime_type, size_bytes) "
            "VALUES (:user, 'avatar', 'key_zero', 'image/png', 0)",
            "23514",
        ),
        (
            "INSERT INTO files(owner_id, purpose, storage_key, mime_type, size_bytes) "
            "VALUES (:user, 'avatar', 'key_neg', 'image/png', -10)",
            "23514",
        ),
        # storage_key must be unique
        (
            "INSERT INTO files(owner_id, purpose, storage_key, mime_type, size_bytes) "
            "VALUES (:user, 'avatar', 'avatars/avatar1.jpg', 'image/jpeg', 500)",
            "23505",
        ),
        # owner_id must reference a valid user
        (
            "INSERT INTO files(owner_id, purpose, storage_key, mime_type, size_bytes) "
            "VALUES (gen_random_uuid(), 'avatar', 'key_unknown_user', 'image/png', 100)",
            "23503",
        ),
        # invalid FK in user_profiles.avatar_file_id
        (
            "UPDATE user_profiles SET avatar_file_id=gen_random_uuid() WHERE user_id=:user",
            "23503",
        ),
        # invalid FK in teaching_plans.source_file_id
        (
            "UPDATE teaching_plans SET source_file_id=gen_random_uuid() WHERE id=:plan",
            "23503",
        ),
    ],
)
def test_invalid_file_operations_rejected(files_state, statement, sqlstate):
    connection, ids = files_state
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text(statement), ids)
    assert caught.value.orig.pgcode == sqlstate


def test_avatar_attachment_and_set_null_on_delete(files_state):
    connection, ids = files_state
    # Link avatar file to profile
    connection.execute(
        text("UPDATE user_profiles SET avatar_file_id=:file_avatar WHERE user_id=:user"),
        ids,
    )
    linked = connection.scalar(
        text("SELECT avatar_file_id FROM user_profiles WHERE user_id=:user"),
        ids,
    )
    assert linked == ids["file_avatar"]

    # Deleting the file should set avatar_file_id to NULL
    connection.execute(
        text("DELETE FROM files WHERE id=:file_avatar"),
        ids,
    )
    remaining = connection.scalar(
        text("SELECT avatar_file_id FROM user_profiles WHERE user_id=:user"),
        ids,
    )
    assert remaining is None


def test_teaching_plan_source_file_and_set_null_on_delete(files_state):
    connection, ids = files_state
    # Link plan source file
    connection.execute(
        text("UPDATE teaching_plans SET source_file_id=:file_plan WHERE id=:plan"),
        ids,
    )
    linked = connection.scalar(
        text("SELECT source_file_id FROM teaching_plans WHERE id=:plan"),
        ids,
    )
    assert linked == ids["file_plan"]

    # Deleting the file should set source_file_id to NULL
    connection.execute(
        text("DELETE FROM files WHERE id=:file_plan"),
        ids,
    )
    remaining = connection.scalar(
        text("SELECT source_file_id FROM teaching_plans WHERE id=:plan"),
        ids,
    )
    assert remaining is None


def test_owner_deletion_restricted_when_files_exist(files_state):
    connection, ids = files_state
    # Deleting user who owns files should raise RESTRICT violation
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(
                text("DELETE FROM users WHERE id=:user"),
                ids,
            )
    assert caught.value.orig.pgcode == "23503"
