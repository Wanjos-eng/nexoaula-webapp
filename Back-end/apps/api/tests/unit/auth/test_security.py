from datetime import UTC, datetime
from secrets import token_urlsafe
from uuid import uuid4

import pytest
from jose import jwt
from pydantic import ValidationError

from app.core.config import Settings
from app.modules.auth.security import InvalidCredentialsError, SessionTokens


@pytest.fixture
def token_config():
    return Settings(AUTH_JWT_SECRET=token_urlsafe(32), _env_file=None)


def test_issued_tokens_have_unique_ids_and_validate(token_config):
    tokens = SessionTokens(token_config)
    user_id = uuid4()
    first, expires = tokens.issue(user_id)
    second, _ = tokens.issue(user_id)
    assert tokens.subject(first.get_secret_value()) == user_id
    assert first != second
    assert 1798 < (expires - datetime.now(UTC)).total_seconds() <= 1800


@pytest.mark.parametrize("claim", ["sub", "iss", "aud", "iat", "nbf", "exp", "jti"])
def test_required_claims(token_config, claim):
    tokens = SessionTokens(token_config)
    token, _ = tokens.issue(uuid4())
    claims = jwt.get_unverified_claims(token.get_secret_value())
    del claims[claim]
    forged = jwt.encode(claims, token_config.require_auth_secret(), algorithm="HS256")
    with pytest.raises(InvalidCredentialsError):
        tokens.subject(forged)


@pytest.mark.parametrize(
    "change",
    [
        {"sub": "not-a-uuid"},
        {"iss": "other"},
        {"aud": "other"},
        {"aud": ["nexoaula-web", "other"]},
        {"jti": ""},
        {"iat": "123"},
        {"nbf": None},
        {"exp": True},
        {"exp": 0},
    ],
)
def test_invalid_claims(token_config, change):
    tokens = SessionTokens(token_config)
    token, _ = tokens.issue(uuid4())
    claims = jwt.get_unverified_claims(token.get_secret_value()) | change
    forged = jwt.encode(claims, token_config.require_auth_secret(), algorithm="HS256")
    with pytest.raises(InvalidCredentialsError):
        tokens.subject(forged)


@pytest.mark.parametrize("offset", [-1900, 120])
def test_expired_and_future_sessions(token_config, offset):
    tokens = SessionTokens(token_config)
    token, _ = tokens.issue(uuid4())
    claims = jwt.get_unverified_claims(token.get_secret_value())
    for name in ("iat", "nbf", "exp"):
        claims[name] += offset
    forged = jwt.encode(claims, token_config.require_auth_secret(), algorithm="HS256")
    with pytest.raises(InvalidCredentialsError):
        tokens.subject(forged)


@pytest.mark.parametrize("algorithm,wrong_key", [("HS384", False), ("HS256", True)])
def test_only_hs256_and_current_key(token_config, algorithm, wrong_key):
    tokens = SessionTokens(token_config)
    token, _ = tokens.issue(uuid4())
    claims = jwt.get_unverified_claims(token.get_secret_value())
    key = token_urlsafe(32) if wrong_key else token_config.require_auth_secret()
    with pytest.raises(InvalidCredentialsError):
        tokens.subject(jwt.encode(claims, key, algorithm=algorithm))


@pytest.mark.parametrize("token", ["", "garbage", "a.b.c"])
def test_malformed_token(token_config, token):
    with pytest.raises(InvalidCredentialsError):
        SessionTokens(token_config).subject(token)


def test_secure_defaults_and_explicit_http_development():
    assert Settings(_env_file=None).auth_cookie_name == "__Host-nexoaula_session"
    dev = Settings(
        ENVIRONMENT="development",
        AUTH_COOKIE_SECURE=False,
        AUTH_ALLOWED_ORIGINS=["http://localhost:3000"],
        _env_file=None,
    )
    assert dev.auth_cookie_name == "nexoaula_session"
    for environment in ("production", "test"):
        with pytest.raises(ValidationError):
            Settings(ENVIRONMENT=environment, AUTH_COOKIE_SECURE=False, _env_file=None)


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "null",
        "https://example.com/",
        "https://example.com/path",
        "https://user@example.com",
        "http://example.com",
        "https://example.com?x=1",
    ],
)
def test_invalid_allowed_origins(origin):
    with pytest.raises(ValidationError):
        Settings(AUTH_ALLOWED_ORIGINS=[origin], _env_file=None)


def test_short_secret_rejected_and_hidden():
    with pytest.raises(ValidationError) as error:
        Settings(AUTH_JWT_SECRET="private-short-secret", _env_file=None)
    assert "private-short-secret" not in str(error.value)
