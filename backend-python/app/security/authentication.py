from __future__ import annotations

from collections.abc import AsyncIterator, Callable

from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security.request_context import (
    RequestContext,
    reset_request_context,
    set_request_context,
)
from app.services.supabase_client import (
    get_service_supabase_client,
    get_token_supabase_client,
)


bearer_scheme = HTTPBearer(auto_error=False)


class MissingCompanyMembershipError(Exception):
    pass


def _resolve_request_context(access_token: str) -> RequestContext:
    service_client = get_service_supabase_client()

    try:
        user_response = service_client.auth.get_user(access_token)
    except Exception as error:
        raise ValueError("Invalid or expired access token") from error

    user = user_response.user if user_response else None
    if user is None:
        raise ValueError("Invalid or expired access token")

    user_client = get_token_supabase_client(access_token)
    auth_context_response = user_client.rpc("get_my_auth_context").execute()
    if not auth_context_response.data:
        raise MissingCompanyMembershipError(
            "The authenticated user does not belong to a company."
        )

    auth_context = auth_context_response.data[0]
    return RequestContext(
        user_id=str(user.id),
        email=str(user.email or ""),
        company_id=str(auth_context["company_id"]),
        company_name=str(auth_context["company_name"]),
        company_role=str(auth_context["role"]),
        permissions=frozenset(auth_context.get("permissions") or []),
        access_token=access_token,
    )


async def require_authenticated_request(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AsyncIterator[RequestContext]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        context = await run_in_threadpool(
            _resolve_request_context,
            credentials.credentials,
        )
    except MissingCompanyMembershipError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service or tenant membership is unavailable.",
        ) from error

    token = set_request_context(context)
    try:
        yield context
    finally:
        reset_request_context(token)


def require_permission(
    permission: str,
) -> Callable[..., RequestContext]:
    """Build a FastAPI dependency backed by the database permission matrix."""

    async def permission_dependency(
        context: RequestContext = Depends(require_authenticated_request),
    ) -> RequestContext:
        if not context.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission}",
            )
        return context

    return permission_dependency
