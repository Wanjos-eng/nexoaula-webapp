from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.modules.users.errors import UserPersistenceError
from app.modules.users.infrastructure.repository import SqlAlchemyUserRepository
from app.modules.users.infrastructure.unit_of_work import SqlAlchemyUserUnitOfWork


def test_repository_translates_read_failure_without_exposing_sqlalchemy():
    session = Mock()
    session.scalar.side_effect = SQLAlchemyError("database unavailable")
    repository = SqlAlchemyUserRepository(session)

    with pytest.raises(UserPersistenceError, match="Não foi possível persistir"):
        repository.find_by_email("aluno@nexoaula.test")


def test_repository_translates_get_failure_without_exposing_sqlalchemy():
    session = Mock()
    session.get.side_effect = SQLAlchemyError("database unavailable")
    repository = SqlAlchemyUserRepository(session)

    with pytest.raises(UserPersistenceError, match="Não foi possível persistir"):
        repository.find_by_id(uuid4())


def test_unit_of_work_rolls_back_and_translates_commit_failure():
    session = Mock()
    session.commit.side_effect = SQLAlchemyError("commit failed")
    session.in_transaction.return_value = False
    unit_of_work = SqlAlchemyUserUnitOfWork(lambda: session)

    with unit_of_work:
        with pytest.raises(UserPersistenceError, match="Não foi possível persistir"):
            unit_of_work.commit()

    session.rollback.assert_called_once()
    session.close.assert_called_once()


def test_unit_of_work_rejects_use_outside_context_manager():
    unit_of_work = SqlAlchemyUserUnitOfWork(Mock())

    with pytest.raises(RuntimeError, match="bloco with"):
        unit_of_work.rollback()
