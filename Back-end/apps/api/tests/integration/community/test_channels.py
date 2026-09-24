from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.modules.community.models import GroupStatus, GroupVisibility, GroupJoinPolicy, MembershipRole, MembershipStatus
from test_groups import (
    API_PREFIX,
    BASE_URL,
    SECURITY_HEADERS,
    isolate_app_state,
    anyio_backend,
)

pytestmark = pytest.mark.anyio


@pytest.fixture
def auth_user():
    return uuid4()


@pytest.fixture
def active_session(auth_user):
    from app.modules.auth.dependencies import active_subject
    from app.main import app
    app.dependency_overrides[active_subject] = lambda: auth_user
    return auth_user


@pytest.fixture
async def setup_db(active_session):
    from app.modules.auth.dependencies import get_session_factory
    from app.main import app

    factory = next(get_session_factory())
    with factory() as session:
        # Create user
        session.execute(text("INSERT INTO users(id,email) VALUES (:id,'t@test.com')"), {"id": active_session})
        session.execute(text("INSERT INTO user_profiles(user_id,display_name) VALUES (:id,'Test User')"), {"id": active_session})

        # Create academic setup
        subject_id = uuid4()
        section_id = uuid4()
        session.execute(text("INSERT INTO institutions(id,name,slug) VALUES (gen_random_uuid(),'I','i') RETURNING id"))
        session.execute(text("INSERT INTO courses(id,institution_id,name,slug) SELECT gen_random_uuid(),id,'C','c' FROM institutions RETURNING id"))
        session.execute(text("INSERT INTO subjects(id,course_id,name,slug) SELECT :subject,id,'S','s' FROM courses"), {"subject": subject_id})
        session.execute(text("INSERT INTO academic_terms(id,institution_id,name,slug,start_date,end_date) SELECT gen_random_uuid(),id,'T','t',now(),now() FROM institutions RETURNING id"))
        session.execute(text("INSERT INTO class_sections(id,subject_id,term_id,name) SELECT :section,:subject,id,'Sec' FROM academic_terms"), {"section": section_id, "subject": subject_id})

        # Create study group
        group_id = uuid4()
        session.execute(text("""
            INSERT INTO study_groups(id,created_by,subject_id,class_section_id,name,visibility,join_policy,status)
            VALUES (:group,:user,:subject,:section,'Test Group',:vis,:join,:status)
        """), {
            "group": group_id, "user": active_session, "subject": subject_id, "section": section_id,
            "vis": GroupVisibility.PUBLIC.value, "join": GroupJoinPolicy.OPEN.value, "status": GroupStatus.ACTIVE.value
        })

        # Insert membership
        session.execute(text("""
            INSERT INTO group_members(group_id,user_id,role,status)
            VALUES (:group,:user,:role,:status)
        """), {
            "group": group_id, "user": active_session, "role": MembershipRole.OWNER.value, "status": MembershipStatus.ACTIVE.value
        })
        
        # Inserir canal "geral" simulando o repository.create_group (que adicionamos agora)
        session.execute(text("""
            INSERT INTO channels(id,group_id,name,created_by,status)
            VALUES (gen_random_uuid(),:group,'geral',:user,'active')
        """), {"group": group_id, "user": active_session})

        session.commit()
    return group_id


async def test_list_channels(setup_db, active_session):
    group_id = setup_db
    async with AsyncClient(app=__import__("app.main").app, base_url=BASE_URL) as client:
        response = await client.get(f"{API_PREFIX}/{group_id}/channels", headers=SECURITY_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "geral"
    assert data[0]["status"] == "active"


async def test_create_and_rename_channel(setup_db, active_session):
    group_id = setup_db
    async with AsyncClient(app=__import__("app.main").app, base_url=BASE_URL) as client:
        # Create
        response = await client.post(f"{API_PREFIX}/{group_id}/channels", json={"name": "Dúvidas", "description": "Tira dúvidas"}, headers=SECURITY_HEADERS)
        assert response.status_code == 201
        channel = response.json()
        assert channel["name"] == "Dúvidas"

        # Rename
        response = await client.patch(f"{API_PREFIX}/{group_id}/channels/{channel['id']}", json={"name": "Perguntas"}, headers=SECURITY_HEADERS)
        assert response.status_code == 200
        assert response.json()["name"] == "Perguntas"


async def test_archive_channel(setup_db, active_session):
    group_id = setup_db
    async with AsyncClient(app=__import__("app.main").app, base_url=BASE_URL) as client:
        # Pega o geral
        response = await client.get(f"{API_PREFIX}/{group_id}/channels", headers=SECURITY_HEADERS)
        channel_id = response.json()[0]["id"]

        # Arquiva
        response = await client.post(f"{API_PREFIX}/{group_id}/channels/{channel_id}/archive", headers=SECURITY_HEADERS)
        assert response.status_code == 200
        archived = response.json()
        assert archived["status"] == "archived"
        assert archived["archivedAt"] is not None

        # Tentar arquivar de novo
        response = await client.post(f"{API_PREFIX}/{group_id}/channels/{channel_id}/archive", headers=SECURITY_HEADERS)
        assert response.status_code == 409
