import pytest
from fastapi.testclient import TestClient

from app.config.settings import (
    LOCAL_CORS_ALLOWED_ORIGINS,
    normalize_app_environment,
    parse_cors_allowed_origins,
    parse_rate_limit_backend,
    validate_rate_limit_redis_url,
)
from app.main import app


def test_development_cors_defaults_are_loopback_only():
    assert parse_cors_allowed_origins(
        None,
        app_environment="development",
    ) == LOCAL_CORS_ALLOWED_ORIGINS


def test_explicit_cors_origins_are_normalized_and_deduplicated():
    assert parse_cors_allowed_origins(
        "https://pilot.example.com/, https://pilot.example.com",
        app_environment="pilot",
    ) == ("https://pilot.example.com",)


@pytest.mark.parametrize("environment", ["pilot", "production"])
def test_deployed_environments_require_explicit_https_origins(environment):
    with pytest.raises(RuntimeError, match="required"):
        parse_cors_allowed_origins(None, app_environment=environment)

    with pytest.raises(RuntimeError, match="HTTPS"):
        parse_cors_allowed_origins(
            "http://pilot.example.com",
            app_environment=environment,
        )


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "https://*.example.com",
        "ftp://pilot.example.com",
        "https://pilot.example.com:invalid",
        "https://user:password@pilot.example.com",
        "https://pilot.example.com/path",
        "https://pilot.example.com?debug=true",
        "https://pilot.example.com#fragment",
    ],
)
def test_cors_rejects_wildcard_or_non_origin_values(origin):
    with pytest.raises(RuntimeError):
        parse_cors_allowed_origins(
            origin,
            app_environment="pilot",
        )


def test_app_environment_rejects_unknown_values():
    with pytest.raises(RuntimeError, match="APP_ENV"):
        normalize_app_environment("staging-ish")


@pytest.mark.parametrize("environment", ["pilot", "production"])
def test_deployed_environments_require_redis_rate_limiting(environment):
    with pytest.raises(RuntimeError, match="redis"):
        parse_rate_limit_backend("memory", app_environment=environment)
    assert (
        parse_rate_limit_backend("redis", app_environment=environment)
        == "redis"
    )


def test_development_can_use_in_memory_rate_limiting():
    assert (
        parse_rate_limit_backend(None, app_environment="development")
        == "memory"
    )


def test_deployed_redis_requires_tls_and_valid_url():
    with pytest.raises(RuntimeError, match="TLS"):
        validate_rate_limit_redis_url(
            "redis://cache.example.com:6379/0",
            backend="redis",
            app_environment="production",
        )
    assert (
        validate_rate_limit_redis_url(
            "rediss://cache.example.com:6380/0",
            backend="redis",
            app_environment="production",
        )
        == "rediss://cache.example.com:6380/0"
    )


def test_redis_backend_requires_a_url():
    with pytest.raises(RuntimeError, match="required"):
        validate_rate_limit_redis_url(
            None,
            backend="redis",
            app_environment="development",
        )


def test_default_app_cors_allows_loopback_and_rejects_old_lan_origin():
    with TestClient(app) as client:
        allowed = client.options(
            "/health/live",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        rejected = client.options(
            "/health/live",
            headers={
                "Origin": "http://192.168.1.118:3000",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == (
        "http://localhost:3000"
    )
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers
