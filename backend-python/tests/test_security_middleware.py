from app.middleware.security import InMemoryRateLimiter, RateLimitRule
from app.utils.logger import sanitize_log_text


def test_rate_limiter_blocks_and_then_releases_a_bucket() -> None:
    limiter = InMemoryRateLimiter((RateLimitRule("/chat", 2, 10),))

    assert limiter.check(client_key="client", path="/chat", method="POST", now=1)[0]
    assert limiter.check(client_key="client", path="/chat", method="POST", now=2)[0]
    allowed, retry_after = limiter.check(
        client_key="client", path="/chat", method="POST", now=3
    )
    assert allowed is False
    assert retry_after > 0
    assert limiter.check(client_key="client", path="/chat", method="POST", now=12)[0]


def test_rate_limiter_keeps_clients_and_unmatched_routes_separate() -> None:
    limiter = InMemoryRateLimiter((RateLimitRule("/reports", 1),))

    assert limiter.check(client_key="a", path="/reports/pdf", method="POST", now=1)[0]
    assert not limiter.check(
        client_key="a", path="/reports/pdf", method="POST", now=2
    )[0]
    assert limiter.check(client_key="b", path="/reports/pdf", method="POST", now=2)[0]
    assert limiter.check(client_key="a", path="/health", method="GET", now=2)[0]


def test_log_sanitizer_redacts_tokens_emails_and_record_ids() -> None:
    sanitized = sanitize_log_text(
        "Bearer secret.token user@example.com "
        "10000000-0000-4000-8000-000000000001"
    )

    assert "secret.token" not in sanitized
    assert "user@example.com" not in sanitized
    assert "10000000-0000-4000-8000-000000000001" not in sanitized
