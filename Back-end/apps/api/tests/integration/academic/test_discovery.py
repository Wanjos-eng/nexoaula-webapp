"""Discovery contracts against migrated PostgreSQL, with rollback-owned data."""
import os
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from test_academic import api as academic_api, catalog, create, PASSWORD
from app.main import app
from app.modules.community.dependencies import get_community_service
from app.modules.community.repository import SqlAlchemyCommunityUnitOfWork
from app.modules.community.service import CommunityService

pytestmark = pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="Requires migrated PostgreSQL")


@pytest.fixture
def api(academic_api):
    client, connection, user_id = academic_api
    factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")
    app.dependency_overrides[get_community_service] = lambda: CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(factory))
    yield client, connection, user_id


def context(client):
    institution, _, subject, _, section = catalog(client)
    teacher = create(client, "teachers", {"institutionId": institution["id"], "fullName": "Professora Ada"})
    assignment = {"teacherId": teacher["id"], "classSectionId": section["id"], "startsOn": "2026-08-01"}
    create(client, "class-section-teachers", assignment)
    topic = create(client, "topics", {"name": "Normalização relacional", "slug": f"normalizacao-{uuid4()}"})
    subject_topic = create(client, "subject-topics", {"subjectId": subject["id"], "topicId": topic["id"]})
    return subject, section, teacher, subject_topic, assignment


def group(client, subject, section, topic=None, **extra):
    response = client.post("/api/v1/groups", json={
        "name": "Grupo de estudo", "disciplineId": subject["id"], "offeringId": section["id"],
        "subjectTopicIds": [topic["id"]] if topic else [], **extra,
    })
    assert response.status_code == 201, response.text
    return response.json()


def test_combined_discovery_visibility_relations_and_pagination(api):
    client, connection, _ = api
    subject, section, teacher, topic, assignment = context(client)
    first = group(client, subject, section, topic)
    second = group(client, subject, section, topic)
    group(client, subject, section, topic, visibility="private")
    group(client, subject, section, topic, visibility="unlisted")
    for field, value in [("status", "'archived'"), ("deleted_at", "now()")]:
        hidden = group(client, subject, section, topic)
        connection.execute(text(f"UPDATE study_groups SET {field}={value} WHERE id=:id"), {"id": hidden["id"]})
    unrelated = group(client, subject, section)
    create(client, "class-section-teachers", assignment | {"startsOn": "2026-09-01", "role": "substitute"})
    params = {"subject": "Database", "period": "2026.2", "topic": "Normalização", "subjectId": subject["id"],
              "classSectionId": section["id"], "teacherId": teacher["id"], "subjectTopicId": topic["id"]}
    response = client.get("/api/v1/groups", params=params)
    assert response.status_code == 200, response.text
    ids = [row["id"] for row in response.json()]
    assert set(ids) == {first["id"], second["id"]} and len(ids) == 2
    assert unrelated["id"] not in ids
    pages = [client.get("/api/v1/groups", params=params | {"offset": offset, "limit": 1}).json() for offset in range(3)]
    assert [pages[0][0]["id"], pages[1][0]["id"]] == ids and pages[2] == []
    custom = client.post(f'/api/v1/groups/{unrelated["id"]}/topics', json={"customTitle": "Estudo independente"})
    assert custom.status_code == 201, custom.text
    assert [row["id"] for row in client.get("/api/v1/groups", params={"subjectId": subject["id"], "topic": "independente"}).json()] == [unrelated["id"]]
    assert client.get("/api/v1/groups", params={"topic": "%"}).json() == []
    assert any(row["id"] == first["id"] for row in client.get("/api/v1/groups", params={"topic": "Grupo de estudo"}).json())


def test_invalid_filters_and_academic_references(api):
    client, _, _ = api
    subject, section, teacher, topic, assignment = context(client)
    other_subject, other_section, other_teacher, other_topic, _ = context(client)
    for params in [
        {"subjectId": "not-a-uuid"}, {"teacherId": str(uuid4())}, {"limit": 101}, {"offset": -1},
        {"subjectId": other_subject["id"], "classSectionId": section["id"]},
        {"classSectionId": section["id"], "subjectTopicId": other_topic["id"]},
        {"subjectId": subject["id"], "teacherId": other_teacher["id"]},
        {"classSectionId": other_section["id"], "teacherId": teacher["id"]},
    ]:
        assert client.get("/api/v1/groups", params=params).status_code == 422, params
    assert client.post("/api/v1/academic/class-section-teachers", json=assignment | {"teacherId": other_teacher["id"]}).status_code == 422
    assert client.post("/api/v1/academic/class-section-teachers", json=assignment | {"endsOn": "2026-01-01"}).status_code == 422
    assert client.post("/api/v1/academic/class-section-teachers", json=assignment).status_code == 409
    for kind in ["teachers", "topics", "subject-topics", "class-section-teachers"]:
        assert client.get(f"/api/v1/academic/{kind}?limit=1&offset=0").status_code == 200
    assert client.get("/api/v1/groups", params={"subjectTopicId": topic["id"]}).json() == []


def test_topic_configuration_atomicity_history_and_authorization(api):
    client, _, _ = api
    subject, section, _, topic, _ = context(client)
    other_subject, _, _, other_topic, _ = context(client)
    current = group(client, subject, section, topic)
    path = f'/api/v1/groups/{current["id"]}'
    assert client.get(path + "/topics").json()[0]["subjectTopicId"] == topic["id"]
    for ids in [[other_topic["id"]], [topic["id"], topic["id"]]]:
        response = client.patch(path, json={"name": "Não salvar", "subjectTopicIds": ids})
        assert response.status_code == 422, response.text
        assert client.get(path).json()["name"] == current["name"]
    assert client.patch(path, json={"subjectTopicIds": None}).status_code == 422
    assert client.patch(path, json={"subjectTopicIds": []}).status_code == 200
    assert client.get(path + "/topics").json() == []
    assert client.patch(path, json={"subjectTopicIds": [topic["id"]]}).status_code == 200
    linked = client.get(path + "/topics").json()[0]
    assert client.post(path + "/channels", json={"name": "Assunto", "groupTopicId": linked["id"]}).status_code == 201
    assert client.patch(path, json={"subjectTopicIds": [], "name": "Não salvar"}).status_code == 409
    assert client.get(path).json()["name"] == current["name"]
    assert client.get(path + "/topics").json()[0]["id"] == linked["id"]
    email = f"{uuid4()}@example.com"
    assert client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "fullName": "Outro estudante"}).status_code == 201
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
    assert client.patch(path, json={"subjectTopicIds": []}).status_code == 403
    assert client.get(path + "/topics").status_code == 403
    assert [row["id"] for row in client.get("/api/v1/groups", params={"subjectTopicId": topic["id"]}).json()] == [current["id"]]


def test_database_enforces_teacher_institution_and_dates(api):
    client, connection, _ = api
    _, section, teacher, _, _ = context(client)
    _, _, other_teacher, _, _ = context(client)
    sql = text("INSERT INTO class_section_teachers(class_section_id, teacher_id, institution_id, starts_on, ends_on) VALUES (:section, :teacher, :institution, :start, :end)")
    for teacher_id, start, end, code in [(other_teacher["id"], "2027-01-01", None, "23503"), (teacher["id"], "2027-01-01", "2026-01-01", "23514")]:
        with connection.begin_nested() as savepoint:
            with pytest.raises(IntegrityError) as exc:
                connection.execute(sql, {"section": section["id"], "teacher": teacher_id, "institution": section["institutionId"], "start": start, "end": end})
            assert exc.value.orig.pgcode == code
            savepoint.rollback()
