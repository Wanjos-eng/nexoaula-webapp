"""HTTP contract, permissions and lifecycle on migrated PostgreSQL."""
from datetime import UTC, datetime, timedelta
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
ORIGIN = 'https://testserver'
HEADERS = {'Origin': ORIGIN, 'X-NexoAula-CSRF': '1'}

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
async def meeting_client(graph, monkeypatch):
    connection, ids = graph
    factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode='create_savepoint')
    monkeypatch.setattr(settings, 'AUTH_ALLOWED_ORIGINS', [ORIGIN])
    app.dependency_overrides[active_subject] = lambda: ids['user']
    app.dependency_overrides[get_community_service] = lambda: CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(factory))
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url=ORIGIN, headers=HEADERS) as client:
            yield client, connection, ids
    finally:
        app.dependency_overrides.clear()


def payload(ids, **updates):
    now = datetime.now(UTC)
    return {'groupId':str(ids['group']), 'title':'Encontro', 'modality':'online',
            'externalUrl':'https://example.org/meet', 'startsAt':(now+timedelta(days=1)).isoformat(),
            'endsAt':(now+timedelta(days=1,hours=1)).isoformat(), **updates}


async def create(client, ids):
    response = await client.post(f"/api/v1/groups/{ids['group']}/meetings", json=payload(ids))
    assert response.status_code == 201, response.text
    return response.json()['id']


async def test_two_members_idempotence_and_calendar_cancellation(meeting_client):
    client, connection, ids = meeting_client
    meeting = await create(client, ids)
    connection.execute(text("INSERT INTO group_members(group_id,user_id) VALUES (:group,:other_user)"), ids)
    app.dependency_overrides[active_subject] = lambda: ids['other_user']
    for _ in range(2):
        assert (await client.put(f'/api/v1/meetings/{meeting}/participants/me',json={'status':'confirmed'})).status_code == 200
    assert connection.scalar(text('SELECT count(*) FROM meeting_participants WHERE meeting_id=:id'), {'id':meeting}) == 1
    result = await client.get(f'/api/v1/meetings/{meeting}')
    assert result.json()['participantStatus'] == 'confirmed'
    assert result.json()['confirmedCount'] == 1
    assert result.headers['cache-control'] == 'no-store'
    for status in ['interested','cancelled','confirmed']:
        assert (await client.put(f'/api/v1/meetings/{meeting}/participants/me',json={'status':status})).json()['status'] == status
    assert (await client.patch(f'/api/v1/meetings/{meeting}',json={'title':'Forbidden'})).status_code == 403
    assert (await client.post(f'/api/v1/meetings/{meeting}/cancel',json={})).status_code == 403
    app.dependency_overrides[active_subject] = lambda: ids['user']
    assert (await client.patch(f'/api/v1/meetings/{meeting}',json={'title':'Revisado'})).status_code == 200
    assert (await client.post(f'/api/v1/meetings/{meeting}/cancel',json={})).status_code == 200
    assert (await client.post(f'/api/v1/meetings/{meeting}/cancel',json={})).status_code == 200
    calendar = await client.get('/api/v1/me/meetings')
    assert calendar.headers['cache-control'] == 'no-store'
    assert calendar.json()[0]['status'] == 'cancelled'
    assert calendar.json()[0]['title'] == 'Revisado'
    assert (await client.put(f'/api/v1/meetings/{meeting}/participants/me',json={'status':'attended'})).status_code == 409


async def test_presence_requires_start_and_survives_completion(meeting_client):
    client, connection, ids = meeting_client
    meeting = await create(client, ids)
    url = f'/api/v1/meetings/{meeting}'
    assert (await client.put(url+'/participants/me',json={'status':'attended'})).status_code == 409
    assert (await client.put(url+'/outcome',json={'status':'completed'})).status_code == 409
    connection.execute(text("UPDATE meetings SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=:id"), {'id':meeting})
    assert (await client.put(url+'/outcome',json={'status':'completed'})).status_code == 200
    for _ in range(2):
        assert (await client.put(url+'/participants/me',json={'status':'attended'})).status_code == 200
    assert (await client.get(url)).json()['participantStatus'] == 'attended'
    assert (await client.put(url+'/participants/me',json={'status':'confirmed'})).status_code == 409
    assert (await client.patch(url,json={'title':'Late'})).status_code == 409
    assert (await client.post(url+'/cancel',json={})).status_code == 409


@pytest.mark.parametrize('membership', ['removed','left','demoted'])
async def test_former_organizer_cannot_mutate_or_report_outcome(meeting_client, membership):
    client, connection, ids = meeting_client
    meeting = await create(client, ids)
    if membership == 'demoted':
        connection.execute(text("UPDATE group_members SET role='member' WHERE group_id=:group"),ids)
    else:
        connection.execute(text("UPDATE group_members SET status=:status,ended_at=now(),removed_by=CASE WHEN :status='removed' THEN :other_user ELSE NULL END WHERE group_id=:group"),ids|{'status':membership})
    url=f'/api/v1/meetings/{meeting}'
    assert (await client.patch(url,json={'title':'Forbidden'})).status_code == 403
    assert (await client.post(url+'/cancel',json={})).status_code == 403
    assert (await client.put(url+'/outcome',json={'status':'cancelled'})).status_code == 403
    if membership != 'demoted':
        assert (await client.get(url)).status_code == 403
        assert (await client.put(url+'/participants/me',json={'status':'confirmed'})).status_code == 403
        assert (await client.get('/api/v1/me/meetings')).json() == []


async def test_inactive_group_blocks_all_mutations(meeting_client):
    client, connection, ids = meeting_client
    meeting = await create(client, ids)
    connection.execute(text("UPDATE study_groups SET status='archived' WHERE id=:group"),ids)
    url=f'/api/v1/meetings/{meeting}'
    assert (await client.patch(url,json={'title':'Forbidden'})).status_code == 409
    assert (await client.post(url+'/cancel',json={})).status_code == 409
    assert (await client.put(url+'/outcome',json={'status':'cancelled'})).status_code == 409
    assert (await client.put(url+'/participants/me',json={'status':'confirmed'})).status_code == 409


@pytest.mark.parametrize('invalid', [{'title':' '}, {'externalUrl':'javascript:alert(1)'}, {'externalUrl':'not a URL'}, {'modality':'in_person','location':' '}, {'channelId':str(uuid4())}, {'startsAt':'2020-01-01T00:00:00Z'}, {'endsAt':'2020-01-01T00:00:00Z'}])
async def test_invalid_create_and_update(meeting_client, invalid):
    client, connection, ids = meeting_client
    assert (await client.post(f"/api/v1/groups/{ids['group']}/meetings",json=payload(ids,**invalid))).status_code == 422
    meeting = await create(client, ids)
    assert (await client.patch(f'/api/v1/meetings/{meeting}',json=invalid)).status_code == 422


async def test_postponement_and_cross_group_topics(meeting_client):
    client, connection, ids = meeting_client
    meeting = await create(client, ids)
    new = payload(ids)
    outcome = await client.put(f'/api/v1/meetings/{meeting}/outcome',json={'status':'postponed','startsAt':new['startsAt'],'endsAt':new['endsAt']})
    assert outcome.status_code == 200
    assert outcome.json()['status'] == 'postponed'
    assert (await client.patch(f'/api/v1/meetings/{meeting}',json={'topicIds':[str(uuid4())]})).status_code == 422
    assert (await client.get(f'/api/v1/meetings/{meeting}')).json()['topicIds'] == []


@pytest.mark.parametrize('method,suffix', [('patch',''),('post','/cancel'),('put','/outcome'),('put','/participants/me')])
async def test_csrf_is_enforced(meeting_client,method,suffix):
    client, connection, ids = meeting_client
    meeting = await create(client, ids)
    result = await client.request(method, f'/api/v1/meetings/{meeting}{suffix}', json={}, headers={'Origin':'https://untrusted.example','X-NexoAula-CSRF':''})
    assert result.status_code == 403
    assert 'CSRF' in result.json()['detail']
