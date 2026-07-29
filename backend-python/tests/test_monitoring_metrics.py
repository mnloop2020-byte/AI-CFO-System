from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.monitoring.metrics import (
    ApplicationMetrics,
    safe_token_count,
    status_class,
    valid_metrics_token,
)
from app.routes import health


def test_metrics_use_bounded_labels_and_never_include_request_identity() -> None:
    registry = ApplicationMetrics()
    registry.record_http(
        method="post",
        route="/customers/{customer_id}",
        status_code=201,
        duration_seconds=0.125,
    )
    registry.record_rate_limit(
        outcome="rejected",
        route="/chat",
    )
    registry.record_llm(
        model="provider/model",
        status_code=200,
        prompt_tokens=12,
        completion_tokens=5,
        total_tokens=17,
    )

    payload = registry.render().decode("utf-8")

    assert 'route="/customers/{customer_id}"' in payload
    assert 'status_code="201"' in payload
    assert 'status_class="2xx"' in payload
    assert 'kind="total"' in payload
    assert "customer@example.com" not in payload
    assert "company_id" not in payload


def test_metrics_token_uses_fail_closed_comparison() -> None:
    assert valid_metrics_token("x" * 32, "x" * 32)
    assert not valid_metrics_token("x" * 31, "x" * 32)
    assert not valid_metrics_token(None, "x" * 32)
    assert not valid_metrics_token("x" * 32, None)


def test_metric_value_normalization_rejects_invalid_provider_usage() -> None:
    assert status_class(503) == "5xx"
    assert status_class(999) == "unknown"
    assert safe_token_count(0) == 0
    assert safe_token_count(-1) is None
    assert safe_token_count(True) is None
    assert safe_token_count("10") is None


def test_metrics_endpoint_requires_dedicated_bearer_token(monkeypatch) -> None:
    token = "x" * 32
    monkeypatch.setattr(health, "METRICS_BEARER_TOKEN", token)

    with TestClient(app) as client:
        unauthorized = client.get("/internal/metrics")
        authorized = client.get(
            "/internal/metrics",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert unauthorized.status_code == 401
    assert unauthorized.headers["www-authenticate"] == "Bearer"
    assert authorized.status_code == 200
    assert authorized.headers["cache-control"] == "no-store"
    assert "text/plain" in authorized.headers["content-type"]
    assert "ai_cfo_http_requests_total" in authorized.text


def test_metrics_endpoint_is_unavailable_when_not_configured(monkeypatch) -> None:
    monkeypatch.setattr(health, "METRICS_BEARER_TOKEN", None)

    with TestClient(app) as client:
        response = client.get("/internal/metrics")

    assert response.status_code == 503
    assert response.json() == {"detail": "Metrics collection is not configured."}


def test_unmatched_paths_do_not_create_unbounded_metric_labels(
    monkeypatch,
) -> None:
    token = "x" * 32
    monkeypatch.setattr(health, "METRICS_BEARER_TOKEN", token)

    with TestClient(app) as client:
        missing = client.get("/attacker-controlled-random-path-987654")
        metrics_response = client.get(
            "/internal/metrics",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert missing.status_code == 404
    assert 'route="/<unmatched>"' in metrics_response.text
    assert "attacker-controlled-random-path-987654" not in metrics_response.text
