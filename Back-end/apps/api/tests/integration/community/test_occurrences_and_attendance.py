"""Integration tests for lesson occurrences, private student attendance, and topic progress."""
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
def occ_context(graph):
    connection, ids = graph
    connection.execute(text("UPDATE study_groups SET join_policy='open' WHERE id=:group"), ids)

    # Add other_user as active member in the group
    connection.execute(
        text("INSERT INTO group_members(group_id, user_id, role, status) VALUES (:group, :other_user, 'member', 'active')"),
        ids,
    )

    # Create a third user who is NOT a member of the group
    third_user = uuid4()
    ids["third_user"] = third_user
    connection.execute(
        text("INSERT INTO users(id, email, password_hash, is_active) VALUES (:third_user, 'outsider@test.com', 'hash', true)"),
        ids,
    )

    factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")
    app.dependency_overrides[get_community_service] = lambda: CommunityService(
        lambda: SqlAlchemyCommunityUnitOfWork(factory)
    )
    # Default active_subject is the owner (ids['user'])
    app.dependency_overrides[active_subject] = lambda: ids["user"]
    return connection, ids


@pytest.mark.anyio
async def test_occurrences_attendance_progress_and_adjustments_lifecycle(occ_context):
    connection, ids = occ_context
    group = f"/api/v1/groups/{ids['group']}"
    now = datetime.now(UTC)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url=BASE_URL,
        headers=SECURITY_HEADERS | {"Content-Type": "application/json"},
    ) as client:
        # 1. Organizer creates a topic and publishes a teaching plan with 1 lesson
        topic_res = await client.post(group + "/topics", json={"customTitle": "Cálculo Diferencial"})
        assert topic_res.status_code == 201, topic_res.text
        topic_id = topic_res.json()["id"]

        past_scheduled = (now - timedelta(days=2)).isoformat()
        plan_res = await client.post(
            group + "/plans",
            json={
                "lessons": [
                    {
                        "title": "Aula 01 - Limites e Derivadas",
                        "scheduledAt": past_scheduled,
                        "topicIds": [topic_id],
                    }
                ]
            },
        )
        assert plan_res.status_code == 201
        plan_id = plan_res.json()["id"]
        scheduled_lesson_id = plan_res.json()["lessons"][0]["id"]

        pub_res = await client.post(group + f"/plans/{plan_id}/publish")
        assert pub_res.status_code == 200

        # 2. Organizer attempts to record a 'held' occurrence in the future -> Rejected (422)
        future_started = (now + timedelta(hours=1)).isoformat()
        future_ended = (now + timedelta(hours=2)).isoformat()
        rej_future = await client.post(
            group + "/occurrences",
            json={
                "status": "held",
                "scheduledLessonId": scheduled_lesson_id,
                "actualStartedAt": future_started,
                "actualEndedAt": future_ended,
            },
        )
        assert rej_future.status_code == 422

        # 3. Non-organizer (other_user) attempts to record occurrence -> Rejected (403)
        app.dependency_overrides[active_subject] = lambda: ids["other_user"]
        past_started = (now - timedelta(hours=3)).isoformat()
        past_ended = (now - timedelta(hours=1)).isoformat()
        rej_perm = await client.post(
            group + "/occurrences",
            json={
                "status": "held",
                "scheduledLessonId": scheduled_lesson_id,
                "actualStartedAt": past_started,
                "actualEndedAt": past_ended,
            },
        )
        assert rej_perm.status_code == 403

        # 4. Organizer records valid 'held' occurrence
        app.dependency_overrides[active_subject] = lambda: ids["user"]
        occ_res = await client.post(
            group + "/occurrences",
            json={
                "status": "held",
                "scheduledLessonId": scheduled_lesson_id,
                "actualStartedAt": past_started,
                "actualEndedAt": past_ended,
                "notes": "Aula realizada com sucesso",
            },
        )
        assert occ_res.status_code == 201, occ_res.text
        occ = occ_res.json()
        occ_id = occ["id"]
        assert occ["status"] == "held"
        assert occ["topicIds"] == [topic_id]  # inherited from scheduled lesson!

        # 5. Member (other_user) records private attendance: 'present'
        app.dependency_overrides[active_subject] = lambda: ids["other_user"]
        att_res = await client.post(
            "/api/v1/me/attendance",
            json={"lessonOccurrenceId": occ_id, "status": "present", "notes": "Entendi a matéria"},
        )
        assert att_res.status_code == 201, att_res.text
        assert att_res.json()["status"] == "present"
        assert att_res.json()["groupId"] == str(ids["group"])

        # Member updates topic progress to 'reviewing'
        prog_res = await client.put(
            f"/api/v1/me/progress/{topic_id}",
            json={"status": "reviewing", "notes": "Preciso refazer os exercícios 3 e 4"},
        )
        assert prog_res.status_code == 200, prog_res.text
        assert prog_res.json()["status"] == "reviewing"

        # Member checks their own attendance and progress list
        my_atts = await client.get("/api/v1/me/attendance")
        assert my_atts.status_code == 200
        assert len(my_atts.json()) == 1
        assert my_atts.json()[0]["lessonOccurrenceId"] == occ_id

        my_progs = await client.get("/api/v1/me/progress")
        assert my_progs.status_code == 200
        assert len(my_progs.json()) == 1
        assert my_progs.json()[0]["groupTopicId"] == topic_id

        # 6. Strict Privacy: Outsider (third_user) cannot access other_user's attendance/progress
        app.dependency_overrides[active_subject] = lambda: ids["third_user"]
        outsider_atts = await client.get("/api/v1/me/attendance")
        assert outsider_atts.status_code == 200
        assert outsider_atts.json() == []

        outsider_progs = await client.get("/api/v1/me/progress")
        assert outsider_progs.status_code == 200
        assert outsider_progs.json() == []

        # Outsider cannot record attendance in the group
        rej_out_att = await client.post(
            "/api/v1/me/attendance",
            json={"lessonOccurrenceId": occ_id, "status": "present"},
        )
        assert rej_out_att.status_code == 403

        # 7. Correction / Successor Tree:
        # Organizer retifies the occurrence: replaces with a new held occurrence with adjusted time
        app.dependency_overrides[active_subject] = lambda: ids["user"]
        new_started = (now - timedelta(hours=4)).isoformat()
        new_ended = (now - timedelta(hours=2)).isoformat()
        rect_res = await client.post(
            group + "/occurrences",
            json={
                "status": "held",
                "supersedesOccurrenceId": occ_id,
                "actualStartedAt": new_started,
                "actualEndedAt": new_ended,
                "notes": "Horário retificado",
            },
        )
        assert rect_res.status_code == 201, rect_res.text
        rect_occ_id = rect_res.json()["id"]

        # 8. Successor Leaf Constraint:
        # Trying to retify the old occurrence again -> 409 Conflict
        dup_rect = await client.post(
            group + "/occurrences",
            json={
                "status": "cancelled",
                "supersedesOccurrenceId": occ_id,
                "notes": "Tentativa duplicada",
            },
        )
        assert dup_rect.status_code == 409

        # 9. Verify Attendance Copy & Adjustments:
        # For other_user: attendance should have been transferred to rect_occ_id
        app.dependency_overrides[active_subject] = lambda: ids["other_user"]
        cur_atts = await client.get("/api/v1/me/attendance")
        assert cur_atts.status_code == 200
        assert len(cur_atts.json()) == 1
        assert cur_atts.json()[0]["lessonOccurrenceId"] == rect_occ_id
        assert cur_atts.json()[0]["status"] == "present"

        # Check adjustment notices
        adjs = await client.get("/api/v1/me/attendance-adjustments?unreadOnly=true")
        assert adjs.status_code == 200
        assert len(adjs.json()) == 1
        adj = adjs.json()[0]
        assert adj["sourceOccurrenceId"] == occ_id
        assert adj["targetOccurrenceId"] == rect_occ_id
        assert adj["outcome"] == "transferred"
        assert adj["noticeSeenAt"] is None

        # Student marks adjustment as seen
        seen_res = await client.patch(f"/api/v1/me/attendance-adjustments/{adj['id']}/seen")
        assert seen_res.status_code == 200
        assert seen_res.json()["noticeSeenAt"] is not None

        # Unread list is now empty
        unread = await client.get("/api/v1/me/attendance-adjustments?unreadOnly=true")
        assert unread.json() == []

        # 10. Student deletes attendance -> 204 No Content
        del_res = await client.delete(f"/api/v1/me/attendance/{rect_occ_id}")
        assert del_res.status_code == 204

        after_del = await client.get("/api/v1/me/attendance")
        assert after_del.json() == []


@pytest.mark.anyio
async def test_cancellation_and_postponement_invalidation(occ_context):
    connection, ids = occ_context
    group = f"/api/v1/groups/{ids['group']}"
    now = datetime.now(UTC)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url=BASE_URL,
        headers=SECURITY_HEADERS | {"Content-Type": "application/json"},
    ) as client:
        # Organizer creates held occurrence
        app.dependency_overrides[active_subject] = lambda: ids["user"]
        past_started = (now - timedelta(hours=5)).isoformat()
        past_ended = (now - timedelta(hours=3)).isoformat()
        occ_res = await client.post(
            group + "/occurrences",
            json={
                "status": "held",
                "actualStartedAt": past_started,
                "actualEndedAt": past_ended,
            },
        )
        assert occ_res.status_code == 201
        occ_id = occ_res.json()["id"]

        # Student records attendance
        app.dependency_overrides[active_subject] = lambda: ids["other_user"]
        att_res = await client.post(
            "/api/v1/me/attendance",
            json={"lessonOccurrenceId": occ_id, "status": "present"},
        )
        assert att_res.status_code == 201

        # Organizer retifies occurrence to 'cancelled'
        app.dependency_overrides[active_subject] = lambda: ids["user"]
        canc_res = await client.post(
            group + "/occurrences",
            json={
                "status": "cancelled",
                "supersedesOccurrenceId": occ_id,
                "notes": "Aula cancelada retroativamente por imprevisto",
            },
        )
        assert canc_res.status_code == 201
        canc_id = canc_res.json()["id"]

        # Student verifies: active attendance is now 0 (historical attendance is not vigent)
        app.dependency_overrides[active_subject] = lambda: ids["other_user"]
        my_atts = await client.get("/api/v1/me/attendance")
        assert my_atts.status_code == 200
        assert my_atts.json() == []

        # Student checks adjustment: invalidated
        adjs = await client.get("/api/v1/me/attendance-adjustments")
        assert adjs.status_code == 200
        assert len(adjs.json()) == 1
        assert adjs.json()[0]["outcome"] == "invalidated"
        assert adjs.json()[0]["targetStatus"] == "cancelled"

        # Cannot record attendance on cancelled occurrence
        rej = await client.post(
            "/api/v1/me/attendance",
            json={"lessonOccurrenceId": canc_id, "status": "present"},
        )
        assert rej.status_code == 422

