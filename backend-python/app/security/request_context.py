from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RequestContext:
    user_id: str
    email: str
    company_id: str
    company_name: str
    company_role: str
    permissions: frozenset[str]
    access_token: str

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions


_request_context: ContextVar[RequestContext | None] = ContextVar(
    "request_context",
    default=None,
)


def set_request_context(context: RequestContext) -> Token[RequestContext | None]:
    return _request_context.set(context)


def reset_request_context(token: Token[RequestContext | None]) -> None:
    _request_context.reset(token)


def get_request_context() -> RequestContext:
    context = _request_context.get()
    if context is None:
        raise RuntimeError("A verified authenticated request is required.")
    return context


def get_current_company_id() -> str:
    return get_request_context().company_id
