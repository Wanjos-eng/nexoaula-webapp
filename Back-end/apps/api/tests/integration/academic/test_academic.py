from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.academic.dependencies import get_academic_service
from app.modules.academic.schemas import (
    AcademicProfileResponse,
    ClassSectionResponse,
    EnrolledClassSectionResponse,
    EnrollmentResponse,
    SubjectResponse,
)
from app.modules.academic.service import AcademicService
from app.modules.auth.dependencies import authenticated_subject

BASE_URL = "https://testserver"
API_PREFIX = "/api/v1/academic"


class MemoryAcademicRepository:
    def __init__(self) -> None:
        self.profiles: dict[UUID, dict] = {}
        self.institutions: set[UUID] = set()
        self.subjects: dict[UUID, dict] = {}
        self.academic_terms: dict[UUID, dict] = {}
        self.class_sections: dict[UUID, dict] = {}
        self.enrollments: dict[tuple[UUID, UUID], datetime] = {}

    def get_profile(self, user_id: UUID) -> AcademicProfileResponse | None:
        data = self.profiles.get(user_id)
        if not data:
            return None
        return AcademicProfileResponse(**data)

    def update_profile(
        self, user_id: UUID, updates: dict
    ) -> AcademicProfileResponse:
        current = self.profiles.get(user_id, {"user_id": user_id, "display_name": "Usuário"})
        current.update(updates)
        self.profiles[user_id] = current
        return AcademicProfileResponse(**current)

    def institution_exists(self, institution_id: UUID) -> bool:
        return institution_id in self.institutions

    def get_subject_institution_id(self, subject_id: UUID) -> UUID | None:
        subject = self.subjects.get(subject_id)
        return subject["institution_id"] if subject else None

    def get_academic_term_institution_id(
        self, academic_term_id: UUID
    ) -> UUID | None:
        term = self.academic_terms.get(academic_term_id)
        return term["institution_id"] if term else None

    def add_subject(
        self,
        institution_id: UUID,
        name: str,
        code: str | None,
        description: str | None,
    ) -> UUID:
        subject_id = uuid4()
        self.subjects[subject_id] = {
            "id": subject_id,
            "institution_id": institution_id,
            "name": name,
            "code": code,
            "description": description,
            "created_at": datetime.now(UTC),
        }
        return subject_id

    def find_subject(self, subject_id: UUID) -> SubjectResponse | None:
        data = self.subjects.get(subject_id)
        return SubjectResponse(**data) if data else None

    def add_class_section(
        self,
        subject_id: UUID,
        academic_term_id: UUID,
        institution_id: UUID,
        label: str,
        created_by: UUID,
    ) -> UUID:
        section_id = uuid4()
        self.class_sections[section_id] = {
            "id": section_id,
            "institution_id": institution_id,
            "subject_id": subject_id,
            "academic_term_id": academic_term_id,
            "label": label,
            "created_by": created_by,
            "created_at": datetime.now(UTC),
        }
        return section_id

    def find_class_section(
        self, class_section_id: UUID
    ) -> ClassSectionResponse | None:
        data = self.class_sections.get(class_section_id)
        return ClassSectionResponse(**data) if data else None

    def class_section_exists(self, class_section_id: UUID) -> bool:
        return class_section_id in self.class_sections

    def enrollment_exists(self, user_id: UUID, class_section_id: UUID) -> bool:
        return (user_id, class_section_id) in self.enrollments

    def add_enrollment(self, user_id: UUID, class_section_id: UUID) -> None:
        self.enrollments[(user_id, class_section_id)] = datetime.now(UTC)

    def find_enrollment(
        self, user_id: UUID, class_section_id: UUID
    ) -> EnrollmentResponse | None:
        enrolled_at = self.enrollments.get((user_id, class_section_id))
        if not enrolled_at:
            return None
        return EnrollmentResponse(
            user_id=user_id,
            class_section_id=class_section_id,
            enrolled_at=enrolled_at,
        )

    def remove_enrollment(self, user_id: UUID, class_section_id: UUID) -> None:
        self.enrollments.pop((user_id, class_section_id), None)

    def list_enrollments(
        self, user_id: UUID
    ) -> list[EnrolledClassSectionResponse]:
        results = []
        for (u_id, sec_id), enrolled_at in self.enrollments.items():
            if u_id == user_id:
                section = self.class_sections.get(sec_id)
                if section:
                    subject = self.subjects.get(section["subject_id"])
                    results.append(
                        EnrolledClassSectionResponse(
                            class_section_id=sec_id,
                            label=section["label"],
                            subject_id=section["subject_id"],
                            subject_name=subject["name"] if subject else "",
                            enrolled_at=enrolled_at,
                        )
                    )
        return results


class MemoryAcademicUnitOfWork:
    def __init__(self, repo: MemoryAcademicRepository) -> None:
        self.academic = repo

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass


@pytest.fixture
def repo():
    return MemoryAcademicRepository()


@pytest.fixture
def service(repo):
    return AcademicService(lambda: MemoryAcademicUnitOfWork(repo))


@pytest.fixture
def user_a():
    return uuid4()


@pytest.fixture
def user_b():
    return uuid4()


@pytest.fixture
def client(service, user_a):
    app.dependency_overrides[get_academic_service] = lambda: service
    app.dependency_overrides[authenticated_subject] = lambda: user_a
    with TestClient(app, base_url=BASE_URL) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- Testes de Autenticação (401) ---


def test_unauthenticated_access_returns_401():
    app.dependency_overrides.clear()
    with TestClient(app, base_url=BASE_URL) as unauthed_client:
        # GET profile
        assert unauthed_client.get(f"{API_PREFIX}/profile").status_code == 401
        assert unauthed_client.get(f"{API_PREFIX}/profile/me").status_code == 401

        # PATCH profile
        assert unauthed_client.patch(f"{API_PREFIX}/profile", json={}).status_code == 401

        # POST subject
        assert unauthed_client.post(
            f"{API_PREFIX}/subjects",
            json={"institutionId": str(uuid4()), "name": "Cálculo I"},
        ).status_code == 401

        # POST class
        assert unauthed_client.post(
            f"{API_PREFIX}/class-sections",
            json={
                "subjectId": str(uuid4()),
                "academicTermId": str(uuid4()),
                "label": "Turma A",
            },
        ).status_code == 401

        # POST enroll
        assert unauthed_client.post(
            f"{API_PREFIX}/class-sections/{uuid4()}/enrollment"
        ).status_code == 401

        # DELETE enroll
        assert unauthed_client.delete(
            f"{API_PREFIX}/class-sections/{uuid4()}/enrollment"
        ).status_code == 401

        # GET enrollments
        assert unauthed_client.get(f"{API_PREFIX}/enrollments").status_code == 401
        assert unauthed_client.get(f"{API_PREFIX}/classes/me").status_code == 401


# --- Testes de Perfil Acadêmico ---


def test_get_profile_success(client, repo, user_a):
    inst_id = uuid4()
    repo.profiles[user_a] = {
        "user_id": user_a,
        "display_name": "Lucas Almeida",
        "bio": "Estudante de Computação",
        "institution_id": inst_id,
        "course_id": uuid4(),
    }

    response = client.get(f"{API_PREFIX}/profile")
    assert response.status_code == 200
    data = response.json()
    assert data["userId"] == str(user_a)
    assert data["displayName"] == "Lucas Almeida"
    assert data["bio"] == "Estudante de Computação"
    assert data["institutionId"] == str(inst_id)

    # Alias /profile/me
    alias_response = client.get(f"{API_PREFIX}/profile/me")
    assert alias_response.status_code == 200
    assert alias_response.json() == data


def test_get_profile_not_found(client):
    response = client.get(f"{API_PREFIX}/profile")
    assert response.status_code == 404
    assert response.json()["detail"] == "Perfil acadêmico não encontrado."


def test_update_profile_success(client, repo, user_a):
    inst_id = uuid4()
    course_id = uuid4()
    repo.institutions.add(inst_id)
    repo.profiles[user_a] = {
        "user_id": user_a,
        "display_name": "Lucas Almeida",
        "bio": None,
        "institution_id": None,
        "course_id": None,
    }

    payload = {
        "institutionId": str(inst_id),
        "courseId": str(course_id),
        "bio": "Interesse em IA e Engenharia de Software",
    }
    response = client.patch(f"{API_PREFIX}/profile", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["institutionId"] == str(inst_id)
    assert data["courseId"] == str(course_id)
    assert data["bio"] == "Interesse em IA e Engenharia de Software"

    # Alias PUT /profile/me
    alias_response = client.put(f"{API_PREFIX}/profile/me", json={"bio": "Bio atualizada"})
    assert alias_response.status_code == 200
    assert alias_response.json()["bio"] == "Bio atualizada"


def test_update_profile_course_without_institution_fails_422(client, repo, user_a):
    repo.profiles[user_a] = {
        "user_id": user_a,
        "display_name": "Lucas",
        "institution_id": None,
        "course_id": None,
    }
    response = client.patch(
        f"{API_PREFIX}/profile",
        json={"courseId": str(uuid4())},
    )
    assert response.status_code == 422
    assert "institutionId" in response.json()["detail"]


def test_update_profile_institution_not_found_fails_404(client, repo, user_a):
    repo.profiles[user_a] = {
        "user_id": user_a,
        "display_name": "Lucas",
        "institution_id": None,
        "course_id": None,
    }
    response = client.patch(
        f"{API_PREFIX}/profile",
        json={"institutionId": str(uuid4())},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Instituição não encontrada."


def test_profile_isolation_user_a_cannot_affect_user_b(service, repo, user_a, user_b):
    repo.profiles[user_a] = {
        "user_id": user_a,
        "display_name": "User A",
        "bio": "Original A",
    }
    repo.profiles[user_b] = {
        "user_id": user_b,
        "display_name": "User B",
        "bio": "Original B",
    }

    # Logado como User A
    app.dependency_overrides[get_academic_service] = lambda: service
    app.dependency_overrides[authenticated_subject] = lambda: user_a
    with TestClient(app, base_url=BASE_URL) as client_a:
        res = client_a.patch(f"{API_PREFIX}/profile", json={"bio": "Modificado por A"})
        assert res.status_code == 200

    # Logado como User B
    app.dependency_overrides[authenticated_subject] = lambda: user_b
    with TestClient(app, base_url=BASE_URL) as client_b:
        res_b = client_b.get(f"{API_PREFIX}/profile")
        assert res_b.status_code == 200
        # Perfil do User B não foi alterado
        assert res_b.json()["bio"] == "Original B"
        assert res_b.json()["userId"] == str(user_b)


# --- Testes de Disciplinas (Subjects / Courses) ---


def test_create_subject_success(client, repo):
    inst_id = uuid4()
    repo.institutions.add(inst_id)

    payload = {
        "institutionId": str(inst_id),
        "name": "Estruturas de Dados",
        "code": "ED101",
        "description": "Algoritmos e estruturas clássicas.",
    }
    response = client.post(f"{API_PREFIX}/subjects", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Estruturas de Dados"
    assert data["code"] == "ED101"
    assert data["institutionId"] == str(inst_id)
    assert "id" in data
    assert "createdAt" in data

    # Alias /courses
    alias_res = client.post(f"{API_PREFIX}/courses", json=payload | {"name": "Algoritmos II"})
    assert alias_res.status_code == 201
    assert alias_res.json()["name"] == "Algoritmos II"


def test_create_subject_institution_not_found_fails_404(client):
    response = client.post(
        f"{API_PREFIX}/subjects",
        json={"institutionId": str(uuid4()), "name": "Física Teórica"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Instituição não encontrada."


def test_create_subject_invalid_payload_fails_422(client, repo):
    inst_id = uuid4()
    repo.institutions.add(inst_id)

    # Nome muito curto (< 3 chars)
    response = client.post(
        f"{API_PREFIX}/subjects",
        json={"institutionId": str(inst_id), "name": "AB"},
    )
    assert response.status_code == 422

    # Campo obrigatório ausente (name)
    response_missing = client.post(
        f"{API_PREFIX}/subjects",
        json={"institutionId": str(inst_id)},
    )
    assert response_missing.status_code == 422


# --- Testes de Turmas (ClassSections / Classes) ---


def test_create_class_section_success(client, repo):
    inst_id = uuid4()
    repo.institutions.add(inst_id)
    subject_id = repo.add_subject(inst_id, "Cálculo I", "MAT01", None)
    term_id = uuid4()
    repo.academic_terms[term_id] = {"id": term_id, "institution_id": inst_id}

    payload = {
        "subjectId": str(subject_id),
        "academicTermId": str(term_id),
        "label": "Turma 01",
    }
    response = client.post(f"{API_PREFIX}/class-sections", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["label"] == "Turma 01"
    assert data["subjectId"] == str(subject_id)
    assert data["academicTermId"] == str(term_id)
    assert data["institutionId"] == str(inst_id)
    assert "id" in data

    # Alias /classes
    alias_res = client.post(f"{API_PREFIX}/classes", json=payload | {"label": "Turma 02"})
    assert alias_res.status_code == 201
    assert alias_res.json()["label"] == "Turma 02"


def test_create_class_section_subject_not_found_fails_404(client, repo):
    inst_id = uuid4()
    term_id = uuid4()
    repo.academic_terms[term_id] = {"id": term_id, "institution_id": inst_id}

    response = client.post(
        f"{API_PREFIX}/class-sections",
        json={
            "subjectId": str(uuid4()),
            "academicTermId": str(term_id),
            "label": "Turma A",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Disciplina não encontrada."


def test_create_class_section_term_not_found_fails_404(client, repo):
    inst_id = uuid4()
    subject_id = repo.add_subject(inst_id, "Química Geral", None, None)

    response = client.post(
        f"{API_PREFIX}/class-sections",
        json={
            "subjectId": str(subject_id),
            "academicTermId": str(uuid4()),
            "label": "Turma A",
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Período acadêmico não encontrado."


def test_create_class_section_institution_mismatch_fails_422(client, repo):
    inst_1 = uuid4()
    inst_2 = uuid4()
    subject_id = repo.add_subject(inst_1, "Biologia", None, None)
    term_id = uuid4()
    repo.academic_terms[term_id] = {"id": term_id, "institution_id": inst_2}

    response = client.post(
        f"{API_PREFIX}/class-sections",
        json={
            "subjectId": str(subject_id),
            "academicTermId": str(term_id),
            "label": "Turma A",
        },
    )
    assert response.status_code == 422
    assert "mesma instituição" in response.json()["detail"]


# --- Testes de Acompanhamento (Enrollment / Follow) ---


def test_enroll_and_unenroll_lifecycle(client, repo, user_a):
    inst_id = uuid4()
    subject_id = repo.add_subject(inst_id, "Banco de Dados", None, None)
    term_id = uuid4()
    repo.academic_terms[term_id] = {"id": term_id, "institution_id": inst_id}
    sec_id = repo.add_class_section(subject_id, term_id, inst_id, "Turma BD-A", user_a)

    # 1. Acompanhar turma
    response = client.post(f"{API_PREFIX}/class-sections/{sec_id}/enrollment")
    assert response.status_code == 201
    data = response.json()
    assert data["userId"] == str(user_a)
    assert data["classSectionId"] == str(sec_id)
    assert "enrolledAt" in data

    # 2. Listar turmas acompanhadas
    list_res = client.get(f"{API_PREFIX}/enrollments")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["classSectionId"] == str(sec_id)
    assert items[0]["subjectName"] == "Banco de Dados"

    # Alias /classes/me
    alias_list = client.get(f"{API_PREFIX}/classes/me")
    assert alias_list.status_code == 200
    assert len(alias_list.json()) == 1

    # 3. Tentar acompanhar novamente (409 Conflict)
    duplicate_res = client.post(f"{API_PREFIX}/class-sections/{sec_id}/enrollment")
    assert duplicate_res.status_code == 409
    assert duplicate_res.json()["detail"] == "Você já está acompanhando esta turma."

    # 4. Deixar de acompanhar
    del_res = client.delete(f"{API_PREFIX}/class-sections/{sec_id}/enrollment")
    assert del_res.status_code == 204

    # 5. Confirmar que lista está vazia
    empty_list = client.get(f"{API_PREFIX}/enrollments")
    assert empty_list.status_code == 200
    assert len(empty_list.json()) == 0

    # 6. Tentar deixar de acompanhar novamente (404 Not Found)
    del_not_found = client.delete(f"{API_PREFIX}/class-sections/{sec_id}/enrollment")
    assert del_not_found.status_code == 404
    assert del_not_found.json()["detail"] == "Você não está acompanhando esta turma."


def test_enroll_aliases_follow_and_unfollow(client, repo, user_a):
    inst_id = uuid4()
    subject_id = repo.add_subject(inst_id, "Redes de Computadores", None, None)
    term_id = uuid4()
    sec_id = repo.add_class_section(subject_id, term_id, inst_id, "Turma R-1", user_a)

    # POST /classes/{id}/enroll
    assert client.post(f"{API_PREFIX}/classes/{sec_id}/enroll").status_code == 201
    assert client.delete(f"{API_PREFIX}/classes/{sec_id}/enroll").status_code == 204

    # POST /classes/{id}/follow & DELETE /classes/{id}/unfollow
    assert client.post(f"{API_PREFIX}/classes/{sec_id}/follow").status_code == 201
    assert client.delete(f"{API_PREFIX}/classes/{sec_id}/unfollow").status_code == 204


def test_enroll_class_not_found_fails_404(client):
    response = client.post(f"{API_PREFIX}/class-sections/{uuid4()}/enrollment")
    assert response.status_code == 404
    assert response.json()["detail"] == "Turma não encontrada."
