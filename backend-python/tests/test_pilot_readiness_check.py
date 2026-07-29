import json

import pytest

from scripts.pilot_readiness_check import (
    HttpResult,
    normalize_base_url,
    run_checks,
)


def _response(
    status: int = 200,
    *,
    headers: dict[str, str] | None = None,
    payload: dict[str, str] | None = None,
) -> HttpResult:
    return HttpResult(
        status=status,
        headers=headers or {},
        body=json.dumps(payload or {}).encode(),
    )


@pytest.mark.parametrize(
    "url",
    [
        "ftp://pilot.example.com",
        "https://pilot.example.com:invalid",
        "https://user:password@pilot.example.com",
        "https://pilot.example.com/path",
        "https://pilot.example.com?debug=true",
    ],
)
def test_readiness_url_validation_rejects_non_origins(url):
    with pytest.raises(ValueError):
        normalize_base_url(url, name="target")


def test_target_mode_rejects_loopback_without_network_calls(monkeypatch):
    def unexpected_fetch(*args, **kwargs):
        raise AssertionError("Network must not be called for invalid target URLs.")

    monkeypatch.setattr(
        "scripts.pilot_readiness_check.fetch",
        unexpected_fetch,
    )

    checks = run_checks(
        api_url="http://127.0.0.1:8000",
        frontend_url="http://localhost:3000",
        mode="target",
        timeout=1,
    )

    assert [check.status for check in checks] == ["fail", "fail"]


def test_local_readiness_passes_with_expected_hsts_warning(monkeypatch):
    security_headers = {
        "content-security-policy": "default-src 'self'",
        "permissions-policy": "camera=()",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
    }

    def fake_fetch(url, *, timeout, method="GET", headers=None):
        assert timeout == 1
        if url.endswith("/health/live") and method == "OPTIONS":
            assert headers == {
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            }
            return _response(
                headers={
                    "access-control-allow-origin": "http://localhost:3000"
                }
            )
        if url.endswith("/health/live"):
            return _response(
                headers={"x-request-id": "safe-request-id"},
                payload={"status": "ok"},
            )
        if url.endswith("/health/ready"):
            return _response(payload={"status": "ready"})
        if url.endswith("/login"):
            return _response(headers=security_headers)
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("scripts.pilot_readiness_check.fetch", fake_fetch)

    checks = run_checks(
        api_url="http://127.0.0.1:8000",
        frontend_url="http://localhost:3000",
        mode="local",
        timeout=1,
    )

    assert all(check.status != "fail" for check in checks)
    assert next(
        check for check in checks if check.name == "frontend_hsts"
    ).status == "warn"


def test_target_mode_requires_hsts(monkeypatch):
    security_headers = {
        "content-security-policy": "default-src 'self'",
        "permissions-policy": "camera=()",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
    }

    def fake_fetch(url, *, timeout, method="GET", headers=None):
        if url.endswith("/health/live") and method == "OPTIONS":
            return _response(
                headers={
                    "access-control-allow-origin": "https://pilot.example.com"
                }
            )
        if url.endswith("/health/live"):
            return _response(
                headers={"x-request-id": "safe-request-id"},
                payload={"status": "ok"},
            )
        if url.endswith("/health/ready"):
            return _response(payload={"status": "ready"})
        if url.endswith("/login"):
            return _response(headers=security_headers)
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr("scripts.pilot_readiness_check.fetch", fake_fetch)

    checks = run_checks(
        api_url="https://api.pilot.example.com",
        frontend_url="https://pilot.example.com",
        mode="target",
        timeout=1,
    )

    assert next(
        check for check in checks if check.name == "frontend_hsts"
    ).status == "fail"
