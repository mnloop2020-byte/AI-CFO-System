from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security.request_context import (
    RequestContext,
    reset_request_context,
    set_request_context,
)
from app.services.supabase_client import get_service_supabase_client


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

    membership_response = (
        service_client.table("company_members")
        .select("company_id,role,is_default")
        .eq("user_id", str(user.id))
        .order("is_default", desc=True)
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not membership_response.data:
        raise MissingCompanyMembershipError(
            "The authenticated user does not belong to a company."
        )

    membership = membership_response.data[0]
    return RequestContext(
        user_id=str(user.id),
        company_id=str(membership["company_id"]),
        company_role=str(membership["role"]),
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
