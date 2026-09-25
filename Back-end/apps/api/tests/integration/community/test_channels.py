"""HTTP flows on migrated PostgreSQL; synthetic records roll back per scenario."""
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
PREFIX = '/api/v1/groups'

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture
async def channel_client(graph, monkeypatch):
    connection, ids = graph
    factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode='create_savepoint')
    monkeypatch.setattr(settings,'AUTH_ALLOWED_ORIGINS',['https://testserver'])
    app.dependency_overrides[active_subject] = lambda: ids['user']
    app.dependency_overrides[get_community_service] = lambda: CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(factory))
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='https://testserver',
                               headers={'Origin':'https://testserver','X-NexoAula-CSRF':'1'}) as client:
            yield client, connection, ids
    finally:
        app.dependency_overrides.clear()


async def test_channel_lifecycle_persists_and_keeps_history(channel_client):
    client, connection, ids = channel_client
    url = f"{PREFIX}/{ids['group']}/channels"
    assert (await client.get(url)).json() == []
    topic = (await client.post(f"{PREFIX}/{ids['group']}/topics", json={'customTitle':'Álgebra'})).json()
    response = await client.post(url,json={'name':'  Dúvidas   gerais ','groupTopicId':topic['id']})
    assert response.status_code == 201, response.text
    channel = response.json()
    assert channel['topicName'] == 'Álgebra'
    assert channel['groupTopicId'] == topic['id']
    assert channel['name'] == 'Dúvidas gerais'
    detail = f"{url}/{channel['id']}"
    assert (await client.patch(detail,json={'name':'Perguntas','description':'Descrição'})).status_code == 200
    assert (await client.patch(detail,json={'description':None})).json()['description'] is None
    assert connection.scalar(text('SELECT name FROM channels WHERE id=:id'),{'id':channel['id']}) == 'Perguntas'
    connection.execute(text("INSERT INTO group_members(group_id,user_id) VALUES (:group,:other_user)"),ids)
    app.dependency_overrides[active_subject] = lambda: ids['other_user']
    assert (await client.get(url)).json()[0]['name'] == 'Perguntas'
    app.dependency_overrides[active_subject] = lambda: ids['user']
    archived = await client.post(detail+'/archive',json={})
    assert archived.status_code == 200
    assert archived.json()['archivedAt'] is not None
    assert (await client.get(url)).json()[0]['status'] == 'archived'
    assert (await client.post(detail+'/archive',json={})).status_code == 409
    assert (await client.patch(detail,json={'name':'New'})).status_code == 409


@pytest.mark.parametrize('role,status,allowed', [('member','active',False),('moderator','active',True),('member','removed',False),('owner','left',False)])
async def test_channel_access_by_membership(channel_client,role,status,allowed):
    client, connection, ids = channel_client
    url=f"{PREFIX}/{ids['group']}/channels"
    channel=(await client.post(url,json={'name':'Geral'})).json()
    connection.execute(text("UPDATE group_members SET role=:role,status=:status, ended_at=CASE WHEN :status='active' THEN NULL ELSE now() END, removed_by=CASE WHEN :status='removed' THEN :other_user ELSE NULL END WHERE group_id=:group"), ids|{'role':role,'status':status})
    assert (await client.get(url)).status_code == (200 if status=='active' else 403)
    assert (await client.post(url,json={'name':'Outro'})).status_code == (201 if allowed else 403)
    assert (await client.patch(f"{url}/{channel['id']}",json={'name':'Renomeado'})).status_code == (200 if allowed else 403)
    assert (await client.post(f"{url}/{channel['id']}/archive",json={})).status_code == (200 if allowed else 403)


async def test_outsider_and_cross_group_access(channel_client):
    client, connection, ids = channel_client
    url=f"{PREFIX}/{ids['group']}/channels"
    channel=(await client.post(url,json={'name':'Privado'})).json()
    app.dependency_overrides[active_subject]=lambda:ids['other_user']
    assert (await client.get(url)).status_code==403
    assert (await client.post(url,json={'name':'Outro'})).status_code==403
    app.dependency_overrides[active_subject]=lambda:ids['user']
    other=uuid4()
    connection.execute(text("INSERT INTO study_groups(id,created_by,subject_id,name) VALUES (:id,:user,:subject,'Other')"),ids|{'id':other})
    connection.execute(text("INSERT INTO group_members(group_id,user_id,role) VALUES (:id,:user,'owner')"),ids|{'id':other})
    foreign=f"{PREFIX}/{other}/channels/{channel['id']}"
    assert (await client.patch(foreign,json={'name':'Taken'})).status_code==404
    assert (await client.post(foreign+'/archive',json={})).status_code==404
    topic=(await client.post(f"{PREFIX}/{other}/topics",json={'customTitle':'Outro assunto'})).json()
    assert (await client.post(url,json={'name':'Inválido','groupTopicId':topic['id']})).status_code==422


async def test_invalid_inputs_duplicates_and_inactive_group(channel_client):
    client, connection, ids = channel_client
    url=f"{PREFIX}/{ids['group']}/channels"
    for payload in ({'name':' '},{'name':'x'*81},{'name':'X','groupTopicId':str(uuid4())},{'name':'X','description':'x'*501}):
        assert (await client.post(url,json=payload)).status_code==422
    channel=(await client.post(url,json={'name':'Geral'})).json()
    other=(await client.post(url,json={'name':'Outro'})).json()
    assert (await client.post(url,json={'name':'Geral'})).status_code==409
    assert (await client.patch(f"{url}/{other['id']}",json={'name':'Geral'})).status_code==409
    for payload in ({},{'name':None},{'name':' '},{'groupTopicId':str(uuid4())}):
        assert (await client.patch(f"{url}/{channel['id']}",json=payload)).status_code==422
    connection.execute(text("UPDATE study_groups SET status='archived' WHERE id=:group"),ids)
    assert (await client.get(url)).status_code==409
    assert (await client.post(url,json={'name':'Novo'})).status_code==409
    assert (await client.patch(f"{url}/{channel['id']}",json={'name':'Novo'})).status_code==409
    assert (await client.post(f"{url}/{channel['id']}/archive",json={})).status_code==409


async def test_new_group_gets_default_channel(channel_client):
    client, connection, ids = channel_client
    result=await client.post(PREFIX,json={'name':'Novo grupo','disciplineId':str(ids['subject'])})
    assert result.status_code==201,result.text
    channels=(await client.get(f"{PREFIX}/{result.json()['id']}/channels")).json()
    assert len(channels)==1
    assert channels[0]['name']=='geral'
    assert channels[0]['groupTopicId'] is None


async def test_catalog_topic_name_and_csrf(channel_client):
    client, connection, ids=channel_client
    topic_id,subject_topic_id,group_topic_id=uuid4(),uuid4(),uuid4()
    data=ids|{'topic':topic_id,'subject_topic':subject_topic_id,'group_topic':group_topic_id}
    connection.execute(text("INSERT INTO topics(id,name,slug) VALUES (:topic,'Derivadas',:slug)"),data|{'slug':str(topic_id)})
    connection.execute(text('INSERT INTO subject_topics(id,subject_id,topic_id) VALUES (:subject_topic,:subject,:topic)'),data)
    connection.execute(text('INSERT INTO group_topics(id,group_id,subject_id,subject_topic_id) VALUES (:group_topic,:group,:subject,:subject_topic)'),data)
    url=f"{PREFIX}/{ids['group']}/channels"
    result=await client.post(url,json={'name':'Cálculo','groupTopicId':str(group_topic_id)})
    assert result.status_code==201,result.text
    assert result.json()['topicName']=='Derivadas'
    assert (await client.post(url,json={'name':'Bad origin'},headers={'Origin':'https://untrusted.example'})).status_code==403
