import os
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.main import app
from app.modules.auth.dependencies import active_subject
from app.modules.marketplace.dependencies import get_marketplace_service
from app.modules.marketplace.repository import SqlAlchemyMarketplaceUnitOfWork
from app.modules.marketplace.service import MarketplaceService

PREFIX = "/api/v1/marketplace"


@pytest.fixture
def market(monkeypatch):
    if not os.getenv("DATABASE_URL"):
        pytest.skip("PostgreSQL required")
    engine = create_engine(os.environ["DATABASE_URL"])
    connection = engine.connect()
    transaction = connection.begin()
    factory = sessionmaker(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    ids = {
        name: uuid4()
        for name in (
            "tutor",
            "student",
            "other",
            "institution",
            "subject",
            "other_subject",
            "term",
            "section",
        )
    }
    for name in ("tutor", "student", "other"):
        connection.execute(
            text(
                "INSERT INTO users(id,email,password_hash) VALUES (:id,:email,'test')"
            ),
            {"id": ids[name], "email": f"{ids[name]}@example.com"},
        )
        connection.execute(
            text(
                "INSERT INTO user_profiles(user_id,display_name,bio) VALUES (:id,'Aluno','Bio acadêmica')"
            ),
            {"id": ids[name]},
        )
    connection.execute(
        text("INSERT INTO institutions(id,name) VALUES (:institution,'Teste')"), ids
    )
    for key in ("subject", "other_subject"):
        connection.execute(
            text(
                "INSERT INTO subjects(id,institution_id,name) VALUES (:id,:institution,:name)"
            ),
            {**ids, "id": ids[key], "name": key},
        )
    connection.execute(
        text(
            "INSERT INTO academic_terms(id,institution_id,label,start_date,end_date) VALUES (:term,:institution,'2026', '2026-01-01','2026-12-31')"
        ),
        ids,
    )
    connection.execute(
        text(
            "INSERT INTO class_sections(id,institution_id,subject_id,academic_term_id,label,created_by) VALUES (:section,:institution,:subject,:term,'A',:tutor)"
        ),
        ids,
    )
    service = MarketplaceService(lambda: SqlAlchemyMarketplaceUnitOfWork(factory))
    app.dependency_overrides[get_marketplace_service] = lambda: service
    app.dependency_overrides[active_subject] = lambda: ids["tutor"]
    monkeypatch.setattr(settings, "AUTH_ALLOWED_ORIGINS", ["https://testserver"])
    monkeypatch.setattr(settings, "AUTH_JWT_SECRET", SecretStr(token_urlsafe(48)))
    now = datetime.now(UTC)
    payload = {
        "subject_id": str(ids["subject"]),
        "class_section_id": str(ids["section"]),
        "title": "Limites e derivadas",
        "description": "Funções contínuas",
        "modality": "online",
        "external_url": "https://example.test/sessao",
        "starts_at": (now + timedelta(days=1)).isoformat(),
        "ends_at": (now + timedelta(days=1, hours=1)).isoformat(),
        "capacity": 2,
        "price_cents": 2500,
    }

    def as_user(key):
        app.dependency_overrides[active_subject] = lambda: ids[key]

    with TestClient(
        app,
        base_url="https://testserver",
        headers={
            "Origin": "https://testserver",
            "X-NexoAula-CSRF": "1",
            "Content-Type": "application/json",
        },
    ) as client:
        try:
            yield SimpleNamespace(
                client=client,
                ids=ids,
                connection=connection,
                factory=factory,
                service=service,
                payload=payload,
                as_user=as_user,
            )
        finally:
            app.dependency_overrides.clear()
            transaction.rollback()
            connection.close()
            engine.dispose()
