import asyncio
import os
from uuid import uuid4

import pytest

from app.middleware.security import RateLimitRule, RedisRateLimiter


TEST_REDIS_URL = os.getenv("TEST_REDIS_URL")


@pytest.mark.skipif(
    not TEST_REDIS_URL,
    reason="TEST_REDIS_URL is required for the isolated Redis integration test.",
)
def test_two_backend_instances_share_the_same_redis_limit() -> None:
    async def scenario() -> None:
        rule = RateLimitRule("/chat", 2, 10)
        namespace = f"ai-cfo:test:{uuid4().hex}"
        first = RedisRateLimiter.from_url(
            TEST_REDIS_URL,
            (rule,),
            namespace=namespace,
        )
        second = RedisRateLimiter.from_url(
            TEST_REDIS_URL,
            (rule,),
            namespace=namespace,
        )
        try:
            assert await first.ready()
            assert (await first.check(
                client_key="shared-client",
                path="/chat",
                method="POST",
                now=1,
            ))[0]
            assert (await second.check(
                client_key="shared-client",
                path="/chat",
                method="POST",
                now=2,
            ))[0]
            allowed, retry_after = await first.check(
                client_key="shared-client",
                path="/chat",
                method="POST",
                now=3,
            )
            assert allowed is False
            assert retry_after > 0
        finally:
            await first.aclose()
            await second.aclose()

    asyncio.run(scenario())
