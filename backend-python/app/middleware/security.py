from __future__ import annotations

import logging
import re
import hashlib
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Protocol
from uuid import uuid4

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response


logger = logging.getLogger("ai_cfo_backend.requests")
_UUID_PATH = re.compile(
    r"/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-"
    r"[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
)


@dataclass(frozen=True, slots=True)
class RateLimitRule:
    prefix: str
    limit: int
    window_seconds: int = 60
    methods: frozenset[str] | None = None


RATE_LIMIT_RULES = (
    RateLimitRule("/auth", 20),
    RateLimitRule("/chat", 30, methods=frozenset({"POST", "DELETE"})),
    RateLimitRule("/reports", 20, methods=frozenset({"POST", "DELETE"})),
    RateLimitRule("/rag", 15, methods=frozenset({"POST", "DELETE"})),
    RateLimitRule("/attachments", 15, methods=frozenset({"POST", "DELETE"})),
    RateLimitRule("/actions/detect", 10, methods=frozenset({"POST"})),
    RateLimitRule("/actions", 60, methods=frozenset({"POST", "PATCH", "DELETE"})),
)


class RateLimitUnavailableError(RuntimeError):
    pass


class RateLimiter(Protocol):
    async def check(
        self,
        *,
        client_key: str,
        path: str,
        method: str,
        now: float | None = None,
    ) -> tuple[bool, int]: ...

    async def ready(self) -> bool: ...

    async def aclose(self) -> None: ...


class InMemoryRateLimiter:
    """Per-process limiter for development and isolated tests only."""

    def __init__(self, rules: tuple[RateLimitRule, ...] = RATE_LIMIT_RULES) -> None:
        self.rules = rules
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _rule_for(self, path: str, method: str) -> RateLimitRule | None:
        for rule in self.rules:
            if path.startswith(rule.prefix) and (
                rule.methods is None or method in rule.methods
            ):
                return rule
        return None

    async def check(
        self,
        *,
        client_key: str,
        path: str,
        method: str,
        now: float | None = None,
    ) -> tuple[bool, int]:
        rule = self._rule_for(path, method)
        if rule is None:
            return True, 0
        now = now if now is not None else time.monotonic()
        bucket_key = (client_key, rule.prefix)
        cutoff = now - rule.window_seconds
        with self._lock:
            hits = self._hits[bucket_key]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= rule.limit:
                retry_after = max(1, int(rule.window_seconds - (now - hits[0])) + 1)
                return False, retry_after
            hits.append(now)
        return True, 0

    async def ready(self) -> bool:
        return True

    async def aclose(self) -> None:
        return None


class RedisRateLimiter:
    """Atomic fixed-window limiter shared by every backend replica."""

    _SCRIPT = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""

    def __init__(
        self,
        client: Redis,
        rules: tuple[RateLimitRule, ...] = RATE_LIMIT_RULES,
        *,
        namespace: str = "ai-cfo:rate-limit",
    ) -> None:
        self.client = client
        self.rules = rules
        self.namespace = namespace

    @classmethod
    def from_url(
        cls,
        redis_url: str,
        rules: tuple[RateLimitRule, ...] = RATE_LIMIT_RULES,
        *,
        namespace: str = "ai-cfo:rate-limit",
    ) -> "RedisRateLimiter":
        return cls(
            Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
                health_check_interval=30,
            ),
            rules,
            namespace=namespace,
        )

    def _rule_for(self, path: str, method: str) -> RateLimitRule | None:
        for rule in self.rules:
            if path.startswith(rule.prefix) and (
                rule.methods is None or method in rule.methods
            ):
                return rule
        return None

    def _bucket_key(
        self,
        *,
        client_key: str,
        rule: RateLimitRule,
        now: float,
    ) -> str:
        client_digest = hashlib.sha256(client_key.encode("utf-8")).hexdigest()
        route_digest = hashlib.sha256(rule.prefix.encode("utf-8")).hexdigest()[:16]
        window = int(now) // rule.window_seconds
        return f"{self.namespace}:{route_digest}:{client_digest}:{window}"

    async def check(
        self,
        *,
        client_key: str,
        path: str,
        method: str,
        now: float | None = None,
    ) -> tuple[bool, int]:
        rule = self._rule_for(path, method)
        if rule is None:
            return True, 0
        current_time = now if now is not None else time.time()
        key = self._bucket_key(
            client_key=client_key,
            rule=rule,
            now=current_time,
        )
        try:
            result = await self.client.eval(
                self._SCRIPT,
                1,
                key,
                rule.window_seconds,
            )
        except RedisError as error:
            raise RateLimitUnavailableError(
                "Shared rate-limit service is unavailable."
            ) from error
        count, ttl = (int(result[0]), int(result[1]))
        if count > rule.limit:
            return False, max(1, ttl)
        return True, 0

    async def ready(self) -> bool:
        try:
            return bool(await self.client.ping())
        except RedisError:
            return False

    async def aclose(self) -> None:
        await self.client.aclose()


def build_rate_limiter(
    *,
    backend: str,
    redis_url: str | None,
) -> RateLimiter:
    if backend == "memory":
        return InMemoryRateLimiter()
    if backend == "redis" and redis_url:
        return RedisRateLimiter.from_url(redis_url)
    raise RuntimeError("Invalid rate-limit backend configuration.")


class RequestSecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: RateLimiter) -> None:
        super().__init__(app)
        self.limiter = limiter

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        started = time.perf_counter()
        request_id = request.headers.get("x-request-id") or str(uuid4())
        client_key = request.client.host if request.client else "unknown"
        try:
            allowed, retry_after = await self.limiter.check(
                client_key=client_key,
                path=request.url.path,
                method=request.method,
            )
        except RateLimitUnavailableError:
            logger.error(
                "rate_limit_service_unavailable",
                extra={"request_id": request_id},
            )
            response = JSONResponse(
                status_code=503,
                content={"detail": "Request protection service is unavailable."},
                headers={"Retry-After": "5"},
            )
        else:
            response = None
        if response is None and not allowed:
            response = JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Try again later."},
                headers={"Retry-After": str(retry_after)},
            )
        elif response is None:
            response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_complete",
            extra={
                "request_id": request_id,
                "method": request.method,
                "route": _UUID_PATH.sub("/<id>", request.url.path),
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )
        return response
