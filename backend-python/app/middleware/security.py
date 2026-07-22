from __future__ import annotations

import logging
import re
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from uuid import uuid4

from fastapi import Request
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


class InMemoryRateLimiter:
    """Per-process limiter; production multi-instance deployments need Redis."""

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

    def check(
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


class RequestSecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: InMemoryRateLimiter | None = None) -> None:
        super().__init__(app)
        self.limiter = limiter or InMemoryRateLimiter()

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        started = time.perf_counter()
        request_id = request.headers.get("x-request-id") or str(uuid4())
        client_key = request.client.host if request.client else "unknown"
        allowed, retry_after = self.limiter.check(
            client_key=client_key,
            path=request.url.path,
            method=request.method,
        )
        if not allowed:
            response = JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Try again later."},
                headers={"Retry-After": str(retry_after)},
            )
        else:
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
