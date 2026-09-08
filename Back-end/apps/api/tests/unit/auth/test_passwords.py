import bcrypt
import pytest
from pydantic import SecretStr, ValidationError

from app.modules.auth.passwords import BcryptPasswordHasher
from app.modules.auth.schemas import RegisterRequest


def test_bcrypt_hash_is_verifiable_and_does_not_contain_the_password():
    password = "uma-senha-segura"

    password_hash = BcryptPasswordHasher(rounds=4).hash(SecretStr(password))
    encoded_hash = password_hash.get_secret_value()

    assert bcrypt.checkpw(password.encode(), encoded_hash.encode())
    assert password not in encoded_hash
    assert password not in repr(password_hash)


@pytest.mark.parametrize(
    ("password", "expected_message"),
    [
        ("curta", "at least 8"),
        (" " * 8, "apenas espaços"),
        ("á" * 37, "no máximo 72 bytes"),
    ],
)
def test_register_request_rejects_passwords_outside_the_bcrypt_contract(
    password: str, expected_message: str
):
    with pytest.raises(ValidationError, match=expected_message):
        RegisterRequest(fullName="Aluno Teste", email="aluno@example.com", password=password)


def test_register_request_normalizes_name_and_rejects_unknown_fields():
    request = RegisterRequest(
        fullName="  Lucas   Almeida  ",
        email="lucas@example.com",
        password="senha-segura",
    )

    assert request.full_name == "Lucas Almeida"

    with pytest.raises(ValidationError, match="extra_forbidden"):
        RegisterRequest(
            fullName="Lucas Almeida",
            email="lucas@example.com",
            password="senha-segura",
            role="admin",
        )
