import pytest
from fastapi import HTTPException

from app.routes.auth import (
    _authorize_member_removal,
    _authorize_member_role_change,
)
from app.security.request_context import RequestContext


def make_context(role: str, user_id: str = "actor") -> RequestContext:
    return RequestContext(
        user_id=user_id,
        email="actor@example.com",
        company_id="company",
        company_name="Development Company",
        company_role=role,
        permissions=frozenset({"members.read", "members.invite", "members.manage"}),
        access_token="test-token",
    )


def assert_forbidden(callable_) -> None:
    with pytest.raises(HTTPException) as error:
        callable_()
    assert error.value.status_code == 403


def test_member_cannot_change_own_role() -> None:
    actor = make_context("owner")
    assert_forbidden(
        lambda: _authorize_member_role_change(
            actor=actor,
            target_user_id=actor.user_id,
            current_role="owner",
            requested_role="admin",
        )
    )


def test_admin_cannot_promote_self_or_modify_owner() -> None:
    actor = make_context("admin")
    assert_forbidden(
        lambda: _authorize_member_role_change(
            actor=actor,
            target_user_id="member",
            current_role="viewer",
            requested_role="owner",
        )
    )
    assert_forbidden(
        lambda: _authorize_member_role_change(
            actor=actor,
            target_user_id="owner",
            current_role="owner",
            requested_role="admin",
        )
    )


def test_owner_can_assign_supported_role_to_another_member() -> None:
    _authorize_member_role_change(
        actor=make_context("owner"),
        target_user_id="member",
        current_role="viewer",
        requested_role="admin",
    )


def test_member_cannot_remove_self_and_admin_cannot_remove_owner() -> None:
    admin = make_context("admin")
    assert_forbidden(
        lambda: _authorize_member_removal(
            actor=admin,
            target_user_id=admin.user_id,
            current_role="admin",
        )
    )
    assert_forbidden(
        lambda: _authorize_member_removal(
            actor=admin,
            target_user_id="owner",
            current_role="owner",
        )
    )


def test_owner_can_remove_non_owner_member() -> None:
    _authorize_member_removal(
        actor=make_context("owner"),
        target_user_id="member",
        current_role="viewer",
    )
