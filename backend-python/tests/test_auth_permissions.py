import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routes.auth import InvitationCreate
from app.security.authentication import require_permission
from app.security.request_context import RequestContext


def make_context(*permissions: str) -> RequestContext:
    return RequestContext(
        user_id="00000000-0000-0000-0000-000000000010",
        email="user@example.com",
        company_id="00000000-0000-0000-0000-000000000001",
        company_name="Development Company",
        company_role="viewer",
        permissions=frozenset(permissions),
        access_token="test-access-token",
    )


def test_permission_dependency_allows_database_granted_permission() -> None:
    context = make_context("financial.read")
    dependency = require_permission("financial.read")

    resolved = asyncio.run(dependency(context))

    assert resolved is context


def test_permission_dependency_rejects_viewer_write() -> None:
    context = make_context("financial.read")
    dependency = require_permission("financial.write")

    with pytest.raises(HTTPException) as error:
        asyncio.run(dependency(context))

    assert error.value.status_code == 403


def test_invitation_normalizes_email_and_limits_role() -> None:
    invitation = InvitationCreate(
        email="  Accountant@Example.COM ",
        role="accountant",
        expires_in_hours=72,
    )

    assert invitation.email == "accountant@example.com"

    with pytest.raises(ValidationError):
        InvitationCreate(
            email="owner@example.com",
            role="owner",
            expires_in_hours=72,
        )


@pytest.mark.parametrize("email", ["missing-at.example.com", "a @example.com", "a@localhost"])
def test_invitation_rejects_invalid_email(email: str) -> None:
    with pytest.raises(ValidationError):
        InvitationCreate(email=email, role="viewer", expires_in_hours=72)
