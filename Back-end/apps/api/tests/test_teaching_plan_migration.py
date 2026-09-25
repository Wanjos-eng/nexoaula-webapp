"""Planning isolation and publication constraints on migrated PostgreSQL."""
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from test_academic_group_migration import graph, pytestmark


@pytest.fixture
def planning(graph):
    connection, ids = graph
    ids |= {key: uuid4() for key in ('other_group', 'plan', 'other_plan', 'lesson', 'topic', 'other_topic')}
    connection.execute(text("INSERT INTO study_groups(id,created_by,subject_id,class_section_id,name) VALUES (:other_group,:user,:subject,:section,'Other group')"), ids)
    connection.execute(text("INSERT INTO teaching_plans(id,group_id,creator_id) VALUES (:plan,:group,:user),(:other_plan,:other_group,:user)"), ids)
    connection.execute(text("INSERT INTO group_topics(id,group_id,subject_id,custom_title) VALUES (:topic,:group,:subject,'Local'),(:other_topic,:other_group,:subject,'Other')"), ids)
    connection.execute(text("INSERT INTO scheduled_lessons(id,group_id,plan_id,title,scheduled_at) VALUES (:lesson,:group,:plan,'Lesson',now())"), ids)
    return connection, ids


@pytest.mark.parametrize('statement,sqlstate', [
    ("UPDATE scheduled_lessons SET plan_id=:other_plan WHERE id=:lesson", '23503'),
    ("INSERT INTO scheduled_lesson_topics(lesson_id,group_topic_id,group_id) VALUES (:lesson,:other_topic,:group)", '23503'),
    ("INSERT INTO scheduled_lesson_topics(lesson_id,group_topic_id,group_id) VALUES (:lesson,:other_topic,:other_group)", '23503'),
    ("INSERT INTO teaching_plans(group_id,creator_id) VALUES (:group,:user)", '23505'),
    ("UPDATE teaching_plans SET version=0 WHERE id=:plan", '23514'),
    ("UPDATE teaching_plans SET status='published' WHERE id=:plan", '23514'),
    ("UPDATE teaching_plans SET source_file_id=gen_random_uuid() WHERE id=:plan", '23503'),
    ("INSERT INTO group_topics(group_id,subject_id) VALUES (:group,:subject)", '23514'),
    ("INSERT INTO group_topics(group_id,subject_id,custom_title) VALUES (:group,:other_subject,'Wrong subject')", '23503'),
    ("INSERT INTO group_topics(group_id,subject_id,subject_topic_id) VALUES (:group,:subject,gen_random_uuid())", '23503'),
])
def test_invalid_planning_is_rejected(planning, statement, sqlstate):
    connection, ids = planning
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text(statement), ids)
    assert caught.value.orig.pgcode == sqlstate


def test_independent_groups_and_publication(planning):
    connection, ids = planning
    connection.execute(text("INSERT INTO scheduled_lesson_topics(lesson_id,group_topic_id,group_id) VALUES (:lesson,:topic,:group)"), ids)
    connection.execute(text("UPDATE teaching_plans SET status='published',published_by=:user,published_at=now() WHERE id IN (:plan,:other_plan)"), ids)
    assert connection.scalar(text("SELECT count(*) FROM teaching_plans WHERE id IN (:plan,:other_plan) AND version=1 AND published_at IS NOT NULL"), ids) == 2
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text("INSERT INTO teaching_plans(group_id,creator_id,version,status,published_by,published_at) VALUES (:group,:user,2,'published',:user,now())"), ids)
    assert caught.value.orig.pgcode == '23505'


def test_catalog_topic_must_match_group_subject(planning):
    connection, ids = planning
    ids |= {'catalog_topic': uuid4(), 'subject_topic': uuid4()}
    connection.execute(text("INSERT INTO topics(id,slug,name) VALUES (:catalog_topic,:slug,'Topic')"), ids | {'slug': str(ids['catalog_topic'])})
    connection.execute(text("INSERT INTO subject_topics(id,subject_id,topic_id) VALUES (:subject_topic,:other_subject,:catalog_topic)"), ids)
    with pytest.raises(IntegrityError) as caught:
        with connection.begin_nested():
            connection.execute(text("INSERT INTO group_topics(group_id,subject_id,subject_topic_id) VALUES (:group,:subject,:subject_topic)"), ids)
    assert caught.value.orig.pgcode == '23503'
