from __future__ import annotations

from hmac import compare_digest

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)


HTTP_DURATION_BUCKETS = (
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1.0,
    2.5,
    5.0,
    10.0,
)
ALLOWED_DEPENDENCIES = frozenset({"configuration", "rate_limiter"})
ALLOWED_TOKEN_KINDS = frozenset({"prompt", "completion", "total"})


def status_class(status_code: int) -> str:
    if 100 <= status_code <= 599:
        return f"{status_code // 100}xx"
    return "unknown"


def valid_metrics_token(provided: str | None, expected: str | None) -> bool:
    if not provided or not expected:
        return False
    return compare_digest(provided, expected)


def safe_token_count(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        return None
    return value


class ApplicationMetrics:
    def __init__(self) -> None:
        self.registry = CollectorRegistry(auto_describe=True)
        self.http_requests = Counter(
            "ai_cfo_http_requests_total",
            "Completed backend HTTP requests.",
            ("method", "route", "status_code", "status_class"),
            registry=self.registry,
        )
        self.http_duration = Histogram(
            "ai_cfo_http_request_duration_seconds",
            "Backend HTTP request duration.",
            ("method", "route"),
            buckets=HTTP_DURATION_BUCKETS,
            registry=self.registry,
        )
        self.rate_limit_events = Counter(
            "ai_cfo_rate_limit_events_total",
            "Rate-limit decisions that rejected a request or failed closed.",
            ("outcome", "route"),
            registry=self.registry,
        )
        self.llm_requests = Counter(
            "ai_cfo_llm_requests_total",
            "Completed LLM provider requests.",
            ("model", "status_class", "usage"),
            registry=self.registry,
        )
        self.llm_tokens = Counter(
            "ai_cfo_llm_tokens_total",
            "Provider-reported LLM token usage.",
            ("model", "kind"),
            registry=self.registry,
        )
        self.dependency_ready = Gauge(
            "ai_cfo_dependency_ready",
            "Whether a required backend dependency is ready (1) or not (0).",
            ("dependency",),
            registry=self.registry,
        )

    def record_http(
        self,
        *,
        method: str,
        route: str,
        status_code: int,
        duration_seconds: float,
    ) -> None:
        normalized_method = method.upper()[:12]
        normalized_route = route[:160]
        self.http_requests.labels(
            normalized_method,
            normalized_route,
            str(status_code) if 100 <= status_code <= 599 else "unknown",
            status_class(status_code),
        ).inc()
        self.http_duration.labels(normalized_method, normalized_route).observe(
            max(0.0, duration_seconds)
        )

    def record_rate_limit(self, *, outcome: str, route: str) -> None:
        if outcome not in {"rejected", "unavailable"}:
            raise ValueError("Unsupported rate-limit metric outcome.")
        self.rate_limit_events.labels(outcome, route[:160]).inc()

    def record_llm(
        self,
        *,
        model: str,
        status_code: int,
        prompt_tokens: object = None,
        completion_tokens: object = None,
        total_tokens: object = None,
    ) -> None:
        normalized_model = model[:120] or "unknown"
        counts = {
            "prompt": safe_token_count(prompt_tokens),
            "completion": safe_token_count(completion_tokens),
            "total": safe_token_count(total_tokens),
        }
        usage = "reported" if any(value is not None for value in counts.values()) else "missing"
        self.llm_requests.labels(
            normalized_model,
            status_class(status_code),
            usage,
        ).inc()
        for kind, value in counts.items():
            if kind in ALLOWED_TOKEN_KINDS and value is not None:
                self.llm_tokens.labels(normalized_model, kind).inc(value)

    def set_dependency(self, dependency: str, ready: bool) -> None:
        if dependency not in ALLOWED_DEPENDENCIES:
            raise ValueError("Unsupported dependency metric.")
        self.dependency_ready.labels(dependency).set(1 if ready else 0)

    def render(self) -> bytes:
        return generate_latest(self.registry)


metrics = ApplicationMetrics()
