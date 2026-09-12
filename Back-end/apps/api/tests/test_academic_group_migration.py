"""Exercise the released academic/community constraints in migrated PostgreSQL.

Every scenario rolls back its synthetic data; no create_all or SQLite substitute.
"""

import os
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

DATABASE_URL = os.getenv("DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="DATABASE_URL is required for PostgreSQL migration tests"
)


@pytest.fixture
def graph():
    engine = create_engine(DATABASE_URL)
    ids = {key: uuid4() for key in (
        "user", "other_user", "institution", "other_institution", "subject",
        "other_subject", "term", "other_term", "section", "group",
    )}
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                connection.execute(text(
                    "INSERT INTO users(id,email,password_hash) VALUES "
                    "(:user,:email,'synthetic-hash'),(:other_user,:other_email,'synthetic-hash')"
                ), ids | {"email": f"{ids['user']}@example.test",
                          "other_email": f"{ids['other_user']}@example.test"})
                connection.execute(text(
                    "INSERT INTO institutions(id,name) VALUES "
                    "(:institution,'Institution A'),(:other_institution,'Institution B')"
                ), ids)
                connection.execute(text(
                    "INSERT INTO subjects(id,institution_id,name,code) VALUES "
                    "(:subject,:institution,'Subject A','A'),"
                    "(:other_subject,:other_institution,'Subject B','B')"
                ), ids)
                connection.execute(text(
                    "INSERT INTO academic_terms(id,institution_id,label,start_date,end_date) VALUES "
                    "(:term,:institution,'2026.2','2026-08-01','2026-12-01'),"
                    "(:other_term,:other_institution,'2026.2','2026-08-01','2026-12-01')"
                ), ids)
                connection.execute(text(
                    "INSERT INTO class_sections(id,institution_id,subject_id,academic_term_id,label,created_by) "
                    "VALUES (:section,:institution,:subject,:term,'A',:user)"
                ), ids)
                connection.execute(text(
                    "INSERT INTO study_groups(id,created_by,subject_id,class_section_id,name) "
                    "VALUES (:group,:user,:subject,:section,'Study group')"
                ), ids)
                connection.execute(text(
                    "INSERT INTO group_members(group_id,user_id,role) VALUES (:group,:user,'owner')"
                ), ids)
                yield connection, ids
            finally:
                transaction.rollback()
    finally:
        engine.dispose()


@pytest.mark.parametrize("statement,sqlstate", [
    ("INSERT INTO group_members(group_id,user_id) VALUES (:group,:user)", "23505"),
    ("INSERT INTO group_members(group_id,user_id,role) VALUES (:group,:other_user,'owner')", "23505"),
    ("INSERT INTO group_members(group_id,user_id) VALUES (:group,gen_random_uuid())", "23503"),
    ("INSERT INTO group_members(group_id,user_id) VALUES (gen_random_uuid(),:user)", "23503"),
    ("UPDATE class_sections SET subject_id=:other_subject WHERE id=:section", "23503"),
    ("UPDATE class_sections SET academic_term_id=:other_term WHERE id=:section", "23503"),
    ("UPDATE study_groups SET subject_id=:other_subject WHERE id=:group", "23503"),
    ("UPDATE study_groups SET class_section_id=gen_random_uuid() WHERE id=:group", "23503"),
    ("UPDATE study_groups SET capacity=0 WHERE id=:group", "23514"),
    ("UPDATE academic_terms SET end_date=start_date-1 WHERE id=:term", "23514"),
    ("UPDATE group_members SET status='left' WHERE group_id=:group", "23514"),
    ("UPDATE group_members SET status='removed',ended_at=now() WHERE group_id=:group", "23514"),
    ("UPDATE group_members SET ended_at=now() WHERE group_id=:group", "23514"),
    ("UPDATE group_members SET removed_by=:other_user WHERE group_id=:group", "23514"),
    ("INSERT INTO subjects(institution_id,name) VALUES (:institution,'Subject A')", "23505"),
    ("INSERT INTO subjects(institution_id,name,code) VALUES (:institution,'Different','A')", "23505"),
    ("INSERT INTO academic_terms(institution_id,label,start_date,end_date) "
     "VALUES (:institution,'2026.2','2026-08-01','2026-12-01')", "23505"),
    ("INSERT INTO class_sections(institution_id,subject_id,academic_term_id,label,created_by) "
     "VALUES (:institution,:subject,:term,'A',:user)", "23505"),
    ("DELETE FROM institutions WHERE id=:institution", "23503"),
    ("DELETE FROM subjects WHERE id=:subject", "23503"),
    ("DELETE FROM academic_terms WHERE id=:term", "23503"),
    ("DELETE FROM class_sections WHERE id=:section", "23503"),
    ("DELETE FROM users WHERE id=:user", "23503"),
])
def test_invalid_relationships_and_states_are_rejected(graph, statement, sqlstate):
    connection, ids = graph
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text(statement), ids)
    assert caught.value.orig.pgcode == sqlstate


def test_valid_membership_lifecycle_and_owner_transfer(graph):
    connection, ids = graph
    connection.execute(text(
        "UPDATE group_members SET status='left',ended_at=now() WHERE group_id=:group"
    ), ids)
    connection.execute(text(
        "INSERT INTO group_members(group_id,user_id,role) VALUES (:group,:other_user,'owner')"
    ), ids)
    connection.execute(text(
        "UPDATE group_members SET role='member',status='active',ended_at=NULL "
        "WHERE group_id=:group AND user_id=:user"
    ), ids)
    connection.execute(text(
        "UPDATE group_members SET status='removed',ended_at=now(),removed_by=:other_user "
        "WHERE group_id=:group AND user_id=:user"
    ), ids)
    assert connection.scalar(text(
        "SELECT count(*) FROM group_members WHERE group_id=:group AND role='owner' AND status='active'"
    ), ids) == 1


def test_group_can_exist_without_section_and_without_capacity_limit(graph):
    connection, ids = graph
    connection.execute(text(
        "UPDATE study_groups SET class_section_id=NULL,capacity=NULL WHERE id=:group"
    ), ids)
    assert connection.scalar(text(
        "SELECT subject_id FROM study_groups WHERE id=:group"
    ), ids) == ids["subject"]


def test_group_deletion_removes_members_but_preserves_users_and_catalog(graph):
    connection, ids = graph
    connection.execute(text("DELETE FROM study_groups WHERE id=:group"), ids)
    assert connection.scalar(text(
        "SELECT count(*) FROM group_members WHERE group_id=:group"
    ), ids) == 0
    for table, key in (("users", "user"), ("subjects", "subject"), ("class_sections", "section")):
        assert connection.scalar(text(f"SELECT count(*) FROM {table} WHERE id=:id"), {"id": ids[key]}) == 1
