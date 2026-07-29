# Monitoring and Alerting

Last updated: 2026-07-29

## Implemented foundation

FastAPI emits structured redacted JSON logs to standard output and exposes
Prometheus-compatible metrics at `GET /internal/metrics`. The endpoint is
excluded from OpenAPI and requires a dedicated Bearer token. It fails closed
with `503` when monitoring is not configured and with `401` for invalid
credentials.

Set `METRICS_BEARER_TOKEN` to a randomly generated value of at least 32
characters. It is mandatory when `APP_ENV` is `pilot` or `production`. Keep it
only in the backend and monitoring provider secret stores. Never expose it to
the frontend or include it in screenshots, logs, Git, or alert text.

Metrics deliberately exclude user IDs, company IDs, emails, document names,
financial values, prompts, replies, and raw URL identifiers. HTTP routes use
FastAPI templates such as `/customers/{customer_id}` to keep cardinality
bounded. This follows Prometheus guidance to avoid unbounded label values.

## Metrics

- `ai_cfo_http_requests_total`: method, route template, status code/class.
- `ai_cfo_http_request_duration_seconds`: bounded request latency histogram.
- `ai_cfo_rate_limit_events_total`: rejected or fail-closed Redis decisions.
- `ai_cfo_llm_requests_total`: provider response class and usage availability.
- `ai_cfo_llm_tokens_total`: provider-reported prompt/completion/total tokens.
- `ai_cfo_dependency_ready`: fixed readiness indicators for configuration and
  the rate limiter.

The standard Prometheus Python process/runtime metrics are intentionally not
registered in the private application registry. Infrastructure CPU, memory,
container restarts, disk, Redis, PostgreSQL, and network measurements must come
from the selected hosting/monitoring platform.

## Scrape example

Use the provider secret interpolation mechanism; do not put a real token in
this file:

```yaml
scrape_configs:
  - job_name: ai-cfo-backend
    scheme: https
    metrics_path: /internal/metrics
    authorization:
      type: Bearer
      credentials_file: /run/secrets/ai-cfo-metrics-token
    static_configs:
      - targets:
          - api.example.com
```

Alert rules are supplied in
`monitoring/prometheus/ai-cfo-alerts.yml`. Validate them with `promtool` in the
target monitoring environment before enabling notifications.

## Alert ownership

| Alert | Severity | Initial response | Owner |
|---|---|---:|---|
| Backend unavailable | Critical | 5 minutes | Primary on-call engineer |
| Required dependency/Redis unavailable | Critical | 5 minutes | Primary on-call engineer |
| 5xx rate above 5% | Critical | 10 minutes | Backend owner |
| p95 latency above 2.5 seconds | Warning | 30 minutes | Backend owner |
| Authentication/rate-limit anomaly | Warning | 30 minutes | Security owner |
| LLM provider errors | Warning | 30 minutes | AI service owner |
| Backup failure or missed schedule | Critical | 15 minutes | Recovery owner |

The same person must not silently acknowledge and close a critical security or
recovery alert without leaving an incident record.

## Provider-dependent gates

Before Production:

1. choose the centralized log/metrics/alert provider and region;
2. configure retention, access controls, encryption, budgets, and on-call
   routing;
3. add infrastructure and managed Supabase/Redis metrics;
4. add an external HTTPS synthetic check for `/health/live` and
   `/health/ready`;
5. emit backup scheduler success/failure and last-success age from the selected
   backup system;
6. set an approved OpenRouter token/cost budget before adding consumption
   alerts;
7. send test warning and critical alerts and record acknowledgement/escalation
   timing.

No external provider, webhook, email, PagerDuty route, or Production secret was
configured by this local implementation.
