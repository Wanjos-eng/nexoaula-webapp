"""Real HTTP contracts and PostgreSQL transactions for group planning."""
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.modules.auth.dependencies import active_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.repository import SqlAlchemyCommunityUnitOfWork
from app.modules.community.service import CommunityService
from tests.test_academic_group_migration import graph, pytestmark
from tests.integration.community.test_groups import anyio_backend, isolate_app_state, BASE_URL, SECURITY_HEADERS


@pytest.fixture
def api_context(graph):
    connection, ids = graph
    connection.execute(text("UPDATE study_groups SET join_policy='open' WHERE id=:group"), ids)
    other_group = uuid4()
    ids['other_group'] = other_group
    connection.execute(text("INSERT INTO study_groups(id,created_by,subject_id,class_section_id,name) VALUES (:other_group,:other_user,:subject,:section,'Other group')"), ids)
    connection.execute(text("INSERT INTO group_members(group_id,user_id,role) VALUES (:other_group,:other_user,'owner')"), ids)
    factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode='create_savepoint')
    app.dependency_overrides[get_community_service] = lambda: CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(factory))
    app.dependency_overrides[active_subject] = lambda: ids['user']
    return connection, ids


def lesson(title='Lesson', **kwargs):
    return {'title': title, 'scheduledAt': (datetime.now(UTC) + timedelta(days=1)).isoformat(), **kwargs}


@pytest.mark.anyio
async def test_create_publish_version_history_and_membership_revocation(api_context):
    connection, ids = api_context
    group = f"/api/v1/groups/{ids['group']}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS | {"Content-Type": "application/json"}) as client:
        topic = await client.post(group+'/topics', json={'customTitle': 'Local content'})
        assert topic.status_code == 201, topic.text
        first = await client.post(group+'/plans', json={'lessons': [lesson(topicIds=[topic.json()['id']])]})
        assert first.status_code == 201, first.text
        plan = first.json()
        assert plan['version'] == 1 and plan['status'] == 'draft'
        assert len(plan['lessons']) == 1 and plan['lessons'][0]['topicIds'] == [topic.json()['id']]
        lesson_id = plan['lessons'][0]['id']
        assert (await client.get(group+'/lessons')).json() == []
        published = await client.post(group+f"/plans/{plan['id']}/publish")
        assert published.status_code == 200, published.text
        assert published.json()['publishedBy'] == str(ids['user'])
        assert published.json()['publishedAt']
        assert len((await client.get(group+'/lessons')).json()) == 1
        assert (await client.patch(group+f'/lessons/{lesson_id}', json={'title': 'Overwritten'})).status_code == 409
        assert (await client.delete(group+f'/lessons/{lesson_id}')).status_code == 409
        assert (await client.patch(group+f"/plans/{plan['id']}", json={'lessons': []})).status_code == 409
        second = await client.post(group+'/plans', json={'lessons': [lesson('New version')]})
        assert second.status_code == 201, second.text
        assert second.json()['version'] == 2
        assert (await client.get(group+'/lessons')).json()[0]['title'] == 'Lesson'
        assert (await client.post(group+f"/plans/{second.json()['id']}/publish")).status_code == 200
        history = (await client.get(group+'/plans')).json()
        assert [p['status'] for p in history] == ['published', 'archived']
        assert (await client.get(group+'/lessons')).json()[0]['title'] == 'New version'
        app.dependency_overrides[active_subject] = lambda: ids['other_user']
        assert (await client.get(group+'/lessons')).status_code == 403
        assert (await client.get('/api/v1/groups/me/lessons')).json() == []
        assert (await client.post(group+'/join', json={})).status_code == 201
        assert len((await client.get('/api/v1/groups/me/lessons?period=future')).json()) == 1
        assert (await client.get('/api/v1/groups/me/lessons?period=past')).json() == []
        assert (await client.post(group+'/plans', json={})).status_code == 403
        app.dependency_overrides[active_subject] = lambda: ids['user']
        removed = await client.patch(group+f"/members/{ids['other_user']}", json={'action': 'remove'})
        assert removed.status_code == 200, removed.text
        app.dependency_overrides[active_subject] = lambda: ids['other_user']
        assert (await client.get(group+'/plans')).status_code == 403
        assert (await client.get(group+f"/lessons?plan_id={plan['id']}")).status_code == 403
        assert (await client.get('/api/v1/groups/me/lessons')).json() == []


@pytest.mark.anyio
async def test_invalid_payloads_cross_group_topics_and_atomic_rollback(api_context):
    connection, ids = api_context
    group = f"/api/v1/groups/{ids['group']}"
    other_topic = uuid4()
    connection.execute(text("INSERT INTO group_topics(id,group_id,subject_id,custom_title) VALUES (:id,:other_group,:subject,'Other')"), ids | {'id': other_topic})
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS | {"Content-Type": "application/json"}) as client:
        for payload in ({}, {'customTitle': '  '}, {'customTitle': 'Both', 'subjectTopicId': str(uuid4())}, {'subjectTopicId': str(uuid4())}):
            assert (await client.post(group+'/topics', json=payload)).status_code == 422
        assert (await client.post(group+'/plans', json={'sourceFileId': str(uuid4())})).status_code == 422
        for payload in (lesson(topicIds=[str(other_topic)]), lesson(scheduledAt='2026-01-01T10:00:00'), lesson(title='   ')):
            invalid = await client.post(group+'/plans', json={'lessons': [lesson(), payload]})
            assert invalid.status_code == 422, invalid.text
        assert (await client.get(group+'/plans')).json() == []
        plan = (await client.post(group+'/plans', json={'lessons': [lesson(description='Text')]})).json()
        lesson_id = plan['lessons'][0]['id']
        for payload in ({'title': None}, {'title': '   '}, {'scheduledAt': None}, {'topicIds': None}, {'topicIds': [str(other_topic)]}):
            assert (await client.patch(group+f'/lessons/{lesson_id}', json=payload)).status_code == 422
        cleared = await client.patch(group+f'/lessons/{lesson_id}', json={'description': None})
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()['description'] is None
        topic = (await client.post(group+'/topics', json={'customTitle': 'Valid'})).json()
        duplicates = await client.patch(group+f'/lessons/{lesson_id}', json={'topicIds': [topic['id'], topic['id']]})
        assert duplicates.status_code == 422
        updated = await client.patch(group+f'/lessons/{lesson_id}', json={'topicIds': [topic['id']]})
        assert updated.status_code == 200, updated.text
        assert updated.json()['topicIds'] == [topic['id']]
        assert (await client.patch(group+f"/plans/{plan['id']}", json={})).status_code == 422
        replaced = await client.patch(group+f"/plans/{plan['id']}", json={'lessons': [lesson('Replacement')]})
        assert replaced.status_code == 200, replaced.text
        assert replaced.json()['lessons'][0]['title'] == 'Replacement'
        assert (await client.get('/api/v1/groups/me/lessons?start=2026-01-02T00:00:00Z&end=2026-01-01T00:00:00Z')).status_code == 422
        app.dependency_overrides[active_subject] = lambda: ids['other_user']
        other = f"/api/v1/groups/{ids['other_group']}"
        assert (await client.patch(other+f'/lessons/{lesson_id}', json={'title': 'Intrusion'})).status_code == 404
        assert (await client.post(other+f"/plans/{plan['id']}/publish")).status_code == 404


@pytest.mark.anyio
async def test_pending_request_approval_and_security(api_context):
    connection, ids = api_context
    group = f"/api/v1/groups/{ids['group']}"
    connection.execute(text("UPDATE study_groups SET join_policy='approval_required' WHERE id=:group"), ids)
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS | {'Content-Type': 'application/json'}) as client:
        plan = (await client.post(group+'/plans', json={'lessons': [lesson()]})).json()
        assert (await client.post(group+f"/plans/{plan['id']}/publish")).status_code == 200
        app.dependency_overrides[active_subject] = lambda: ids['other_user']
        pending = await client.post(group+'/join', json={})
        assert pending.status_code == 201 and pending.json()['status'] == 'pending'
        assert (await client.get(group+'/lessons')).status_code == 403
        assert (await client.get('/api/v1/groups/me/lessons')).json() == []
        app.dependency_overrides[active_subject] = lambda: ids['user']
        assert (await client.patch(group+f"/members/{ids['other_user']}", json={'action': 'approve'})).status_code == 200
        app.dependency_overrides[active_subject] = lambda: ids['other_user']
        assert len((await client.get('/api/v1/groups/me/lessons?limit=1')).json()) == 1
        assert (await client.get('/api/v1/groups/me/lessons?offset=1')).json() == []
        connection.execute(text("UPDATE group_members SET status='left',ended_at=now() WHERE group_id=:group AND user_id=:other_user"), ids)
        assert (await client.get(group+'/lessons')).status_code == 403
        assert (await client.get('/api/v1/groups/me/lessons')).json() == []
        app.dependency_overrides[active_subject] = lambda: ids['user']
        assert (await client.post(group+'/plans', json={}, headers={'X-NexoAula-CSRF': 'invalid'})).status_code == 403
        app.dependency_overrides.pop(active_subject)
        assert (await client.get(group+'/plans')).status_code == 401
        assert (await client.get('/api/v1/groups/me/lessons')).status_code == 401
        assert (await client.post(group+'/plans', json={})).status_code == 401


@pytest.mark.anyio
async def test_topic_catalog_and_failed_replacement_preserve_previous_lessons(api_context):
    connection, ids = api_context
    group = f"/api/v1/groups/{ids['group']}"
    ids |= {'topic_id': uuid4(), 'subject_topic_id': uuid4()}
    connection.execute(text("INSERT INTO topics(id,slug,name) VALUES (:topic_id,:slug,'Catalog')"), ids | {'slug': str(ids['topic_id'])})
    connection.execute(text("INSERT INTO subject_topics(id,subject_id,topic_id) VALUES (:subject_topic_id,:subject,:topic_id)"), ids)
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS | {'Content-Type': 'application/json'}) as client:
        linked = await client.post(group+'/topics', json={'subjectTopicId': str(ids['subject_topic_id'])})
        assert linked.status_code == 201, linked.text
        assert (await client.post(group+'/topics', json={'subjectTopicId': str(ids['subject_topic_id'])})).status_code == 409
        plan = (await client.post(group+'/plans', json={'lessons': [lesson('Keep me')]})).json()
        invalid = await client.patch(group+f"/plans/{plan['id']}", json={'lessons': [lesson(topicIds=[str(uuid4())])]})
        assert invalid.status_code == 422
        latest = (await client.get(group+'/teaching-plans/latest')).json()
        assert latest['lessons'][0]['title'] == 'Keep me'
        added = await client.post(group+'/lessons', json=lesson('Added', scheduledAt='2026-09-22T08:00:00-03:00'))
        assert added.status_code == 201, added.text
        assert added.json()['scheduledAt'] == '2026-09-22T11:00:00Z'
        assert (await client.delete(group+f"/lessons/{added.json()['id']}")).status_code == 204
