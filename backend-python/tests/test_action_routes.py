from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.routes import actions as action_routes
from app.schemas.action_schema import (
    ActionExecutionRequest,
    FinancialActionResponse,
    FinancialActionTransition,
)
from app.security.request_context import RequestContext


ACTION_ID = UUID("00000000-0000-0000-0000-000000000101")
SOURCE_ID = UUID("00000000-0000-0000-0000-000000000102")
USER_ID = UUID("00000000-0000-0000-0000-000000000103")


def make_context(*permissions: str) -> RequestContext:
    return RequestContext(
        user_id=str(USER_ID),
        email="role-test@example.com",
        company_id="00000000-0000-0000-0000-000000000001",
        company_name="Development Company",
        company_role="admin",
        permissions=frozenset(permissions),
        access_token="test-token",
    )


def make_action(
    *,
    status: str = "waiting_for_approval",
    requires_approval: bool = True,
    last_execution_key: str | None = None,
) -> FinancialActionResponse:
    now = datetime.now(timezone.utc)
    return FinancialActionResponse(
        id=ACTION_ID,
        action_type="low_inventory",
        dedup_key="low-inventory:test",
        title_en="Low inventory",
        title_ar="مخزون منخفض",
        description_en="Inventory is below its reorder level.",
        description_ar="المخزون أقل من حد إعادة الطلب.",
        severity="high",
        financial_impact=Decimal("30.00"),
        currency=None,
        source_type="inventory",
        source_id=SOURCE_ID,
        evidence={"quantity": 3, "reorder_level": 5},
        recommendation_en="Review a purchase.",
        recommendation_ar="راجع عملية شراء.",
        assigned_to=None,
        due_date=None,
        requires_approval=requires_approval,
        proposed_action={"external_execution_allowed": False},
        status=status,
        created_by=USER_ID,
        approved_by=USER_ID if status in {"approved", "in_progress"} else None,
        approved_at=now if status in {"approved", "in_progress"} else None,
        approval_expires_at=now + timedelta(hours=1),
        resolved_at=None,
        last_execution_key=last_execution_key,
        created_at=now,
        updated_at=now,
    )


def test_accountant_cannot_approve_or_reject(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        action_routes,
        "transition_financial_action",
        lambda *_args, **_kwargs: pytest.fail("store must not be called"),
    )
    context = make_context("actions.write")

    for status in ("approved", "rejected"):
        with pytest.raises(HTTPException) as error:
            action_routes.transition_action(
                ACTION_ID,
                FinancialActionTransition(status=status),
                context,
            )
        assert error.value.status_code == 403


def test_admin_can_approve_and_reject(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    waiting = make_action()
    monkeypatch.setattr(
        action_routes,
        "get_financial_action",
        lambda _action_id: waiting,
    )
    monkeypatch.setattr(
        action_routes,
        "transition_financial_action",
        lambda _action_id, status, _due_date, _note: make_action(status=status),
    )
    context = make_context("actions.write", "actions.approve")

    approved = action_routes.transition_action(
        ACTION_ID,
        FinancialActionTransition(status="approved"),
        context,
    )
    rejected = action_routes.transition_action(
        ACTION_ID,
        FinancialActionTransition(status="rejected"),
        context,
    )

    assert approved.status == "approved"
    assert rejected.status == "rejected"


def test_execution_is_recorded_once_and_replayed_by_idempotency_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw_key = "integration-idempotency-key"
    hashed_key = hashlib.sha256(f"{ACTION_ID}:{raw_key}".encode()).hexdigest()
    approved = make_action(status="approved")
    replayable = make_action(
        status="in_progress",
        last_execution_key=hashed_key,
    )
    current = approved

    def get_current(_action_id: UUID) -> FinancialActionResponse:
        return current

    def record_once(
        _action_id: UUID,
        execution_key: str,
    ) -> FinancialActionResponse:
        nonlocal current
        assert execution_key == hashed_key
        current = replayable
        return current

    monkeypatch.setattr(action_routes, "get_financial_action", get_current)
    monkeypatch.setattr(action_routes, "record_action_execution", record_once)
    context = make_context("actions.write")
    payload = ActionExecutionRequest(idempotency_key=raw_key)

    first = action_routes.execute_action(ACTION_ID, payload, context)
    second = action_routes.execute_action(ACTION_ID, payload, context)

    assert first.replayed is False
    assert first.external_executed is False
    assert second.replayed is True
    assert second.external_executed is False
