from datetime import UTC, datetime
import os
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.modules.academic.models import AcademicTerm, ClassSection, Institution, Subject
from app.modules.auth.dependencies import authenticated_subject
from app.modules.community.dependencies import get_community_service
from app.modules.community.models import (
    GroupMember,
    GroupStatus,
    MembershipRole,
    MembershipStatus,
    StudyGroup,
)
from app.modules.community.repository import (
    CommunityRepository,
    CommunityUnitOfWork,
    SqlAlchemyCommunityUnitOfWork,
)
from app.modules.community.schemas import (
    GroupCreate,
    GroupUpdate,
    GroupVisibility,
    JoinPolicy,
)
from app.modules.community.service import CommunityService
from app.modules.users.infrastructure.models import User

BASE_URL = "https://testserver"
API_PREFIX = "/api/v1/groups"


@pytest.fixture
def anyio_backend():
    return "asyncio"


class MemoryCommunityRepository:
    def __init__(self) -> None:
        self.groups: dict[UUID, StudyGroup] = {}
        self.members: dict[tuple[UUID, UUID], GroupMember] = {}
        self.disciplines: set[UUID] = set()
        self.offerings: dict[UUID, UUID] = {}  # offering_id -> discipline_id

    def find_by_id(self, group_id: UUID) -> StudyGroup | None:
        group = self.groups.get(group_id)
        if group and group.deleted_at is None:
            return group
        return None

    def find_active_owner_id(self, group_id: UUID) -> UUID | None:
        for (g_id, u_id), member in self.members.items():
            if (
                g_id == group_id
                and member.role in (MembershipRole.OWNER, MembershipRole.OWNER.value)
                and member.status in (MembershipStatus.ACTIVE, MembershipStatus.ACTIVE.value)
            ):
                return u_id
        group = self.groups.get(group_id)
        return group.created_by if group else None

    def create_group(self, owner_id: UUID, data: GroupCreate) -> StudyGroup:
        group_id = uuid4()
        now = datetime.now(UTC)

        group = StudyGroup(
            id=group_id,
            created_by=owner_id,
            subject_id=data.discipline_id,
            class_section_id=data.offering_id,
            name=data.name,
            description=data.description,
            visibility=data.visibility.value,
            join_policy=data.join_policy.value,
            status=GroupStatus.ACTIVE.value,
            created_at=now,
            updated_at=now,
        )
        self.groups[group_id] = group

        member = GroupMember(
            group_id=group_id,
            user_id=owner_id,
            role=MembershipRole.OWNER.value,
            status=MembershipStatus.ACTIVE.value,
            joined_at=now,
        )
        self.members[(group_id, owner_id)] = member
        return group

    def update_group(
        self, group: StudyGroup, updates: dict
    ) -> StudyGroup:
        for key, value in updates.items():
            if hasattr(value, "value"):
                value = value.value
            setattr(group, key, value)
        group.updated_at = datetime.now(UTC)
        return group

    def check_discipline_exists(self, discipline_id: UUID) -> bool:
        return discipline_id in self.disciplines

    def check_offering_belongs_to_discipline(
        self, offering_id: UUID, discipline_id: UUID
    ) -> bool:
        return self.offerings.get(offering_id) == discipline_id


class MemoryCommunityUnitOfWork:
    def __init__(self, repo: MemoryCommunityRepository) -> None:
        self.community = repo

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass


@pytest.fixture
def memory_repo():
    return MemoryCommunityRepository()


@pytest.fixture
def memory_service(memory_repo):
    return CommunityService(lambda: MemoryCommunityUnitOfWork(memory_repo))


@pytest.fixture
def user_a():
    return uuid4()


@pytest.fixture
def user_b():
    return uuid4()


# --- Testes com httpx.AsyncClient ---


@pytest.mark.anyio
async def test_create_group_success_and_owner_membership_created(
    memory_service, memory_repo, user_a
):
    discipline_id = uuid4()
    offering_id = uuid4()
    memory_repo.disciplines.add(discipline_id)
    memory_repo.offerings[offering_id] = discipline_id

    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    payload = {
        "name": "Grupo de Estudos de Cálculo I",
        "description": "Focado em listas e provas antigas",
        "rules": "Respeito e foco nas matérias",
        "visibility": "public",
        "joinPolicy": "open",
        "disciplineId": str(discipline_id),
        "offeringId": str(offering_id),
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.post(f"{API_PREFIX}/", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Grupo de Estudos de Cálculo I"
    assert data["description"] == "Focado em listas e provas antigas"
    assert data["rules"] == "Respeito e foco nas matérias"
    assert data["visibility"] == "public"
    assert data["joinPolicy"] == "open"
    assert data["disciplineId"] == str(discipline_id)
    assert data["offeringId"] == str(offering_id)
    assert data["ownerId"] == str(user_a)
    assert data["status"] == "active"
    assert "id" in data
    assert "createdAt" in data

    # Asserção de que a membership de owner foi persistida atomicamente
    group_id = UUID(data["id"])
    member = memory_repo.members.get((group_id, user_a))
    assert member is not None
    assert member.role in (MembershipRole.OWNER, MembershipRole.OWNER.value)
    assert member.status in (MembershipStatus.ACTIVE, MembershipStatus.ACTIVE.value)

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_group_without_offering_id_success(
    memory_service, memory_repo, user_a
):
    discipline_id = uuid4()
    memory_repo.disciplines.add(discipline_id)

    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    payload = {
        "name": "Grupo de Álgebra Linear",
        "disciplineId": str(discipline_id),
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.post(f"{API_PREFIX}", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Grupo de Álgebra Linear"
    assert data["offeringId"] is None
    assert data["ownerId"] == str(user_a)

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_group_invalid_discipline_returns_400(
    memory_service, memory_repo, user_a
):
    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    payload = {
        "name": "Grupo Inválido",
        "disciplineId": str(uuid4()),
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.post(f"{API_PREFIX}/", json=payload)

    assert response.status_code == 400
    assert "Disciplina acadêmica inválida" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_group_incompatible_offering_returns_400(
    memory_service, memory_repo, user_a
):
    discipline_1 = uuid4()
    discipline_2 = uuid4()
    offering_2 = uuid4()
    memory_repo.disciplines.add(discipline_1)
    memory_repo.disciplines.add(discipline_2)
    memory_repo.offerings[offering_2] = discipline_2

    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    payload = {
        "name": "Grupo Incompatível",
        "disciplineId": str(discipline_1),
        "offeringId": str(offering_2),
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.post(f"{API_PREFIX}/", json=payload)

    assert response.status_code == 400
    assert "não pertence à disciplina" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_create_group_unauthenticated_returns_401():
    app.dependency_overrides.clear()

    payload = {
        "name": "Grupo Anônimo",
        "disciplineId": str(uuid4()),
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.post(f"{API_PREFIX}/", json=payload)

    assert response.status_code == 401


@pytest.mark.anyio
async def test_create_group_invalid_payload_returns_422(
    memory_service, user_a
):
    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    # Nome com menos de 3 caracteres
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.post(
            f"{API_PREFIX}/",
            json={"name": "AB", "disciplineId": str(uuid4())},
        )
    assert response.status_code == 422

    # Falta disciplineId
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response_missing = await client.post(
            f"{API_PREFIX}/", json={"name": "Grupo sem disciplina"}
        )
    assert response_missing.status_code == 422

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_group_success(memory_service, memory_repo, user_a):
    discipline_id = uuid4()
    memory_repo.disciplines.add(discipline_id)
    group = memory_repo.create_group(
        owner_id=user_a,
        data=GroupCreate(
            name="Grupo de Física",
            disciplineId=discipline_id,
            description="Mecânica Clássica",
        ),
    )

    app.dependency_overrides[get_community_service] = lambda: memory_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.get(f"{API_PREFIX}/{group.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(group.id)
    assert data["name"] == "Grupo de Física"
    assert data["description"] == "Mecânica Clássica"
    assert data["ownerId"] == str(user_a)

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_get_group_not_found_returns_404(memory_service):
    app.dependency_overrides[get_community_service] = lambda: memory_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.get(f"{API_PREFIX}/{uuid4()}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Grupo não encontrado."

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_update_group_by_owner_success(
    memory_service, memory_repo, user_a
):
    discipline_id = uuid4()
    memory_repo.disciplines.add(discipline_id)
    group = memory_repo.create_group(
        owner_id=user_a,
        data=GroupCreate(
            name="Nome Antigo",
            disciplineId=discipline_id,
            description="Desc Antiga",
        ),
    )

    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    update_payload = {
        "name": "Nome Atualizado",
        "description": "Nova descrição do grupo",
        "visibility": "private",
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.patch(
            f"{API_PREFIX}/{group.id}", json=update_payload
        )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Nome Atualizado"
    assert data["description"] == "Nova descrição do grupo"
    assert data["visibility"] == "private"
    assert data["ownerId"] == str(user_a)

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_update_group_by_non_owner_returns_403(
    memory_service, memory_repo, user_a, user_b
):
    discipline_id = uuid4()
    memory_repo.disciplines.add(discipline_id)
    group = memory_repo.create_group(
        owner_id=user_a,
        data=GroupCreate(
            name="Grupo do User A",
            disciplineId=discipline_id,
        ),
    )

    app.dependency_overrides[get_community_service] = lambda: memory_service
    # User B autenticado tentando editar grupo do User A
    app.dependency_overrides[authenticated_subject] = lambda: user_b

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.patch(
            f"{API_PREFIX}/{group.id}",
            json={"name": "Tentativa por Outro Usuário"},
        )

    assert response.status_code == 403
    assert "Apenas o proprietário" in response.json()["detail"]

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_update_group_unauthenticated_returns_401(memory_service):
    app.dependency_overrides.clear()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.patch(
            f"{API_PREFIX}/{uuid4()}",
            json={"name": "Tentativa Anônima"},
        )

    assert response.status_code == 401


@pytest.mark.anyio
async def test_update_group_not_found_returns_404(memory_service, user_a):
    app.dependency_overrides[get_community_service] = lambda: memory_service
    app.dependency_overrides[authenticated_subject] = lambda: user_a

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url=BASE_URL
    ) as client:
        response = await client.patch(
            f"{API_PREFIX}/{uuid4()}",
            json={"name": "Tentativa Inexistente"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Grupo não encontrado."

    app.dependency_overrides.clear()


# --- Teste de Integração Real com Banco PostgreSQL (quando DATABASE_URL configurado) ---


@pytest.mark.skipif(
    not (settings.DATABASE_URL or os.getenv("DATABASE_URL")),
    reason="DATABASE_URL is required for real PostgreSQL community integration test",
)
@pytest.mark.anyio
async def test_real_database_atomic_creation_and_owner_membership():
    database_url = settings.DATABASE_URL or os.environ["DATABASE_URL"]
    engine = create_engine(database_url)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    user_id = uuid4()
    inst_id = uuid4()
    subject_id = uuid4()
    term_id = uuid4()
    class_id = uuid4()
    now = datetime.now(UTC)

    # Inserir entidades mínimas de suporte no PostgreSQL na ordem de dependência
    with factory() as session:
        session.add(
            User(
                id=user_id,
                email=f"group-owner-{user_id}@nexoaula.test",
                password_hash="hash-teste",
            )
        )
        session.add(
            Institution(
                id=inst_id,
                name="Universidade Teste",
                short_name="UT",
            )
        )
        session.flush()

        session.add(
            Subject(
                id=subject_id,
                institution_id=inst_id,
                name=f"Disciplina Real {user_id}",
            )
        )
        session.add(
            AcademicTerm(
                id=term_id,
                institution_id=inst_id,
                label=f"2026.1-{str(user_id)[:8]}",
                start_date=now.date(),
                end_date=now.date(),
            )
        )
        session.flush()

        session.add(
            ClassSection(
                id=class_id,
                institution_id=inst_id,
                subject_id=subject_id,
                academic_term_id=term_id,
                label="Turma 01",
                created_by=user_id,
            )
        )
        session.commit()

    real_service = CommunityService(lambda: SqlAlchemyCommunityUnitOfWork(factory))
    app.dependency_overrides[get_community_service] = lambda: real_service
    app.dependency_overrides[authenticated_subject] = lambda: user_id

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=BASE_URL
        ) as client:
            res = await client.post(
                f"{API_PREFIX}/",
                json={
                    "name": "Grupo de Estudo Real",
                    "disciplineId": str(subject_id),
                    "offeringId": str(class_id),
                    "visibility": "public",
                    "joinPolicy": "open",
                },
            )
            assert res.status_code == 201
            group_data = res.json()
            group_id = UUID(group_data["id"])

            # Valida consulta por ID
            get_res = await client.get(f"{API_PREFIX}/{group_id}")
            assert get_res.status_code == 200
            assert get_res.json()["ownerId"] == str(user_id)

            # Valida edição por owner
            patch_res = await client.patch(
                f"{API_PREFIX}/{group_id}",
                json={"name": "Grupo Atualizado Real"},
            )
            assert patch_res.status_code == 200
            assert patch_res.json()["name"] == "Grupo Atualizado Real"

        # Inspeciona diretamente a tabela group_members no PostgreSQL
        with engine.connect() as conn:
            member_row = conn.execute(
                text(
                    "SELECT role::text, status::text FROM group_members "
                    "WHERE group_id = :gid AND user_id = :uid"
                ),
                {"gid": group_id, "uid": user_id},
            ).one()
            assert member_row[0] == "owner"
            assert member_row[1] == "active"
    finally:
        app.dependency_overrides.clear()
        # Limpeza
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM group_members WHERE user_id = :uid"),
                {"uid": user_id},
            )
            conn.execute(
                text("DELETE FROM study_groups WHERE created_by = :uid"),
                {"uid": user_id},
            )
            conn.execute(
                text("DELETE FROM class_sections WHERE id = :cid"),
                {"cid": class_id},
            )
            conn.execute(
                text("DELETE FROM academic_terms WHERE id = :tid"),
                {"tid": term_id},
            )
            conn.execute(
                text("DELETE FROM subjects WHERE id = :sid"),
                {"sid": subject_id},
            )
            conn.execute(
                text("DELETE FROM institutions WHERE id = :iid"),
                {"iid": inst_id},
            )
            conn.execute(
                text("DELETE FROM users WHERE id = :uid"),
                {"uid": user_id},
            )
