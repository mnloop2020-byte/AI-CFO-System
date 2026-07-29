import asyncio

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app.middleware.security import (
    InMemoryRateLimiter,
    RateLimitRule,
    RateLimitUnavailableError,
    RedisRateLimiter,
)
from app.utils.logger import sanitize_log_text


def test_rate_limiter_blocks_and_then_releases_a_bucket() -> None:
    limiter = InMemoryRateLimiter((RateLimitRule("/chat", 2, 10),))

    assert asyncio.run(
        limiter.check(client_key="client", path="/chat", method="POST", now=1)
    )[0]
    assert asyncio.run(
        limiter.check(client_key="client", path="/chat", method="POST", now=2)
    )[0]
    allowed, retry_after = asyncio.run(
        limiter.check(client_key="client", path="/chat", method="POST", now=3)
    )
    assert allowed is False
    assert retry_after > 0
    assert asyncio.run(
        limiter.check(client_key="client", path="/chat", method="POST", now=12)
    )[0]


def test_rate_limiter_keeps_clients_and_unmatched_routes_separate() -> None:
    limiter = InMemoryRateLimiter((RateLimitRule("/reports", 1),))

    assert asyncio.run(
        limiter.check(
            client_key="a",
            path="/reports/pdf",
            method="POST",
            now=1,
        )
    )[0]
    assert not asyncio.run(
        limiter.check(client_key="a", path="/reports/pdf", method="POST", now=2)
    )[0]
    assert asyncio.run(
        limiter.check(client_key="b", path="/reports/pdf", method="POST", now=2)
    )[0]
    assert asyncio.run(
        limiter.check(client_key="a", path="/health", method="GET", now=2)
    )[0]


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    async def eval(self, _script, _key_count, key, window_seconds):
        self.counts[key] = self.counts.get(key, 0) + 1
        return [self.counts[key], int(window_seconds)]

    async def ping(self):
        return True

    async def aclose(self):
        return None


def test_redis_limiter_shares_atomic_counters_between_instances() -> None:
    redis = FakeRedis()
    rule = RateLimitRule("/chat", 2, 10)
    first = RedisRateLimiter(redis, (rule,))
    second = RedisRateLimiter(redis, (rule,))

    assert asyncio.run(
        first.check(client_key="client", path="/chat", method="POST", now=1)
    )[0]
    assert asyncio.run(
        second.check(client_key="client", path="/chat", method="POST", now=2)
    )[0]
    allowed, retry_after = asyncio.run(
        first.check(client_key="client", path="/chat", method="POST", now=3)
    )
    assert allowed is False
    assert retry_after == 10


def test_redis_limiter_fails_closed_when_store_is_unavailable() -> None:
    class UnavailableRedis(FakeRedis):
        async def eval(self, *_args):
            raise RedisConnectionError("local test outage")

    limiter = RedisRateLimiter(
        UnavailableRedis(),
        (RateLimitRule("/chat", 1),),
    )

    with pytest.raises(RateLimitUnavailableError):
        asyncio.run(
            limiter.check(
                client_key="client",
                path="/chat",
                method="POST",
            )
        )


def test_log_sanitizer_redacts_tokens_emails_and_record_ids() -> None:
    sanitized = sanitize_log_text(
        "Bearer secret.token user@example.com "
        "10000000-0000-4000-8000-000000000001"
    )

    assert "secret.token" not in sanitized
    assert "user@example.com" not in sanitized
    assert "10000000-0000-4000-8000-000000000001" not in sanitized
