"""Integration tests for teaching plan attachments with storage and permission rules."""
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


VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"


@pytest.fixture
def plan_context(graph):
    connection, ids = graph
    # Add second user as member
    member_user = uuid4()
    ids["member_user"] = member_user
    ids["non_member"] = uuid4()
    connection.execute(
        text("INSERT INTO users(id, email, password_hash) VALUES (:member_user, 'member@test.edu', 'hash'), (:non_member, 'outsider@test.edu', 'hash')"),
        ids,
    )
    # Member user is active member
    connection.execute(
        text("INSERT INTO group_members(group_id, user_id, role, status) VALUES (:group, :member_user, 'member', 'active')"),
        ids,
    )
    # Create a draft teaching plan
    plan_id = uuid4()
    ids["plan_id"] = plan_id
    connection.execute(
        text("INSERT INTO teaching_plans(id, group_id, creator_id, version, status) VALUES (:plan_id, :group, :user, 1, 'draft')"),
        ids,
    )

    factory = sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")
    app.dependency_overrides[get_community_service] = lambda: CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(factory))
    app.dependency_overrides[active_subject] = lambda: ids["user"]
    return connection, ids


@pytest.mark.anyio
async def test_organizer_attaches_and_downloads_plan_pdf(plan_context):
    connection, ids = plan_context
    group_url = f"/api/v1/groups/{ids['group']}/plans/{ids['plan_id']}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS) as client:
        # Attach valid PDF
        response = await client.post(
            f"{group_url}/attachment",
            files={"file": ("ementa.pdf", VALID_PDF_BYTES, "application/pdf")},
        )
        assert response.status_code == 200, response.text
        plan_data = response.json()
        assert plan_data["sourceFileId"] is not None
        assert plan_data["sourceFileName"] == "ementa.pdf"
        assert plan_data["sourceFileSize"] == len(VALID_PDF_BYTES)

        # Switch subject to active member
        app.dependency_overrides[active_subject] = lambda: ids["member_user"]

        # Download attachment
        download = await client.get(f"{group_url}/attachment")
        assert download.status_code == 200, download.text
        assert download.content == VALID_PDF_BYTES
        assert "application/pdf" in download.headers["Content-Type"]
        assert 'filename="ementa.pdf"' in download.headers["Content-Disposition"]


@pytest.mark.anyio
async def test_download_revalidates_membership(plan_context):
    connection, ids = plan_context
    group_url = f"/api/v1/groups/{ids['group']}/plans/{ids['plan_id']}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS) as client:
        # Organizer attaches PDF
        await client.post(
            f"{group_url}/attachment",
            files={"file": ("ementa.pdf", VALID_PDF_BYTES, "application/pdf")},
        )

        # 1. Non-member cannot download
        app.dependency_overrides[active_subject] = lambda: ids["non_member"]
        res = await client.get(f"{group_url}/attachment")
        assert res.status_code == 403, res.text

        # 2. Left member cannot download
        connection.execute(
            text("UPDATE group_members SET status='left', ended_at=now() WHERE group_id=:group AND user_id=:member_user"),
            ids,
        )
        app.dependency_overrides[active_subject] = lambda: ids["member_user"]
        res = await client.get(f"{group_url}/attachment")
        assert res.status_code == 403, res.text

        # 3. Removed member cannot download
        connection.execute(
            text("UPDATE group_members SET status='removed', ended_at=now(), removed_by=:user WHERE group_id=:group AND user_id=:member_user"),
            ids,
        )
        res = await client.get(f"{group_url}/attachment")
        assert res.status_code == 403, res.text


@pytest.mark.anyio
async def test_organizer_replaces_and_removes_attachment(plan_context):
    connection, ids = plan_context
    group_url = f"/api/v1/groups/{ids['group']}/plans/{ids['plan_id']}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS) as client:
        # 1. Initial upload
        res1 = await client.post(
            f"{group_url}/attachment",
            files={"file": ("v1.pdf", VALID_PDF_BYTES, "application/pdf")},
        )
        assert res1.status_code == 200
        id1 = res1.json()["sourceFileId"]

        # 2. Replace with another PDF
        updated_pdf = VALID_PDF_BYTES + b"\n% updated"
        res2 = await client.post(
            f"{group_url}/attachment",
            files={"file": ("v2.pdf", updated_pdf, "application/pdf")},
        )
        assert res2.status_code == 200
        id2 = res2.json()["sourceFileId"]
        assert id1 != id2
        assert res2.json()["sourceFileName"] == "v2.pdf"

        # 3. Remove attachment
        res3 = await client.delete(f"{group_url}/attachment")
        assert res3.status_code == 200
        assert res3.json()["sourceFileId"] is None
        assert res3.json()["sourceFileName"] is None

        # 4. Download after removal gives 404
        dl = await client.get(f"{group_url}/attachment")
        assert dl.status_code == 404


@pytest.mark.anyio
async def test_invalid_files_and_permissions(plan_context):
    connection, ids = plan_context
    group_url = f"/api/v1/groups/{ids['group']}/plans/{ids['plan_id']}"

    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, headers=SECURITY_HEADERS) as client:
        # 1. Invalid PDF magic bytes
        res = await client.post(
            f"{group_url}/attachment",
            files={"file": ("fake.pdf", b"NOT A PDF DOCUMENT", "application/pdf")},
        )
        assert res.status_code == 422
        assert "PDF" in res.json()["detail"]

        # 2. Regular member cannot attach
        app.dependency_overrides[active_subject] = lambda: ids["member_user"]
        res = await client.post(
            f"{group_url}/attachment",
            files={"file": ("ementa.pdf", VALID_PDF_BYTES, "application/pdf")},
        )
        assert res.status_code == 403

        # 3. Regular member cannot remove
        res = await client.delete(f"{group_url}/attachment")
        assert res.status_code == 403
