from __future__ import annotations

import hashlib
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.action_schema import (
    ActionMetricsResponse,
    ActionExecutionRequest,
    ActionExecutionResponse,
    DetectionResult,
    FinancialActionAssignment,
    FinancialActionDetailResponse,
    FinancialActionFilters,
    FinancialActionResponse,
    FinancialActionTransition,
    FinancialActionUpdate,
)
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.services.action_engine import run_action_detection
from app.services.action_metrics import calculate_action_metrics
from app.services.action_store import (
    assign_financial_action,
    get_financial_action,
    list_financial_actions,
    record_action_execution,
    transition_financial_action,
    update_financial_action,
)


router = APIRouter(prefix="/actions", tags=["financial actions"])


@router.get("", response_model=list[FinancialActionResponse])
def get_actions(
    status_filter: str | None = Query(default=None, alias="status"),
    action_type: str | None = None,
    severity: str | None = None,
    assigned_to: UUID | None = None,
    search: str | None = Query(default=None, max_length=160),
    _: RequestContext = Depends(require_permission("actions.read")),
) -> list[FinancialActionResponse]:
    try:
        filters = FinancialActionFilters(
            status=status_filter,
            action_type=action_type,
            severity=severity,
            assigned_to=assigned_to,
            search=search,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Invalid action filter.") from error
    return list_financial_actions(filters)


@router.get("/metrics", response_model=ActionMetricsResponse)
def get_action_metrics(
    _: RequestContext = Depends(require_permission("actions.read")),
) -> ActionMetricsResponse:
    return calculate_action_metrics(list_financial_actions())


@router.post("/detect", response_model=DetectionResult)
def detect_actions(
    _: RequestContext = Depends(require_permission("actions.detect")),
) -> DetectionResult:
    return run_action_detection()


@router.get("/{action_id}", response_model=FinancialActionDetailResponse)
def get_action(
    action_id: UUID,
    _: RequestContext = Depends(require_permission("actions.read")),
) -> FinancialActionDetailResponse:
    action = get_financial_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Financial action not found.")
    return action


@router.patch("/{action_id}", response_model=FinancialActionResponse)
def update_action(
    action_id: UUID,
    payload: FinancialActionUpdate,
    _: RequestContext = Depends(require_permission("actions.write")),
) -> FinancialActionResponse:
    updates = payload.model_dump(mode="json", exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="No changes were provided.")
    try:
        return update_financial_action(action_id, updates)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/{action_id}/assign", response_model=FinancialActionResponse)
def assign_action(
    action_id: UUID,
    payload: FinancialActionAssignment,
    _: RequestContext = Depends(require_permission("actions.assign")),
) -> FinancialActionResponse:
    try:
        return assign_financial_action(action_id, payload.assigned_to)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Assignee must be a member of the company.",
        ) from error


@router.post("/{action_id}/transition", response_model=FinancialActionResponse)
def transition_action(
    action_id: UUID,
    payload: FinancialActionTransition,
    context: RequestContext = Depends(require_permission("actions.write")),
) -> FinancialActionResponse:
    if payload.status in {"approved", "rejected"} and not context.has_permission(
        "actions.approve"
    ):
        raise HTTPException(status_code=403, detail="Approval permission is required.")
    if payload.status == "approved":
        current = get_financial_action(action_id)
        if current is None:
            raise HTTPException(status_code=404, detail="Financial action not found.")
        if not current.requires_approval:
            raise HTTPException(status_code=409, detail="This action does not require approval.")
        if current.status != "waiting_for_approval":
            raise HTTPException(status_code=409, detail="Action is not waiting for approval.")
    try:
        return transition_financial_action(
            action_id,
            payload.status,
            payload.due_date,
            payload.note,
        )
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=409, detail="Invalid action transition.") from error


@router.post("/{action_id}/defer", response_model=FinancialActionResponse)
def defer_action(
    action_id: UUID,
    days: int = Query(default=7, ge=1, le=90),
    _: RequestContext = Depends(require_permission("actions.write")),
) -> FinancialActionResponse:
    action = get_financial_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Financial action not found.")
    due_date = date.today() + timedelta(days=days)
    target = "in_review" if action.status != "in_review" else action.status
    try:
        return transition_financial_action(
            action_id,
            target,
            due_date,
            note=f"Deferred for {days} day(s).",
        )
    except Exception as error:
        raise HTTPException(status_code=409, detail="Action cannot be deferred.") from error


@router.post("/{action_id}/execute", response_model=ActionExecutionResponse)
def execute_action(
    action_id: UUID,
    payload: ActionExecutionRequest,
    _: RequestContext = Depends(require_permission("actions.write")),
) -> ActionExecutionResponse:
    action = get_financial_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Financial action not found.")

    execution_key = hashlib.sha256(
        f"{action.id}:{payload.idempotency_key}".encode("utf-8")
    ).hexdigest()
    outcome = (
        "pending_integration"
        if action.action_type == "overdue_invoice"
        else "human_review_required"
    )

    if action.last_execution_key == execution_key:
        return ActionExecutionResponse(
            action=action,
            replayed=True,
            outcome=outcome,
        )

    if action.status != "approved":
        raise HTTPException(status_code=409, detail="Action must be approved first.")
    if (
        action.approval_expires_at is None
        or action.approval_expires_at <= datetime.now(timezone.utc)
    ):
        transition_financial_action(
            action.id,
            "expired",
            note="Approval expired before execution.",
        )
        raise HTTPException(status_code=409, detail="Approval has expired.")

    try:
        updated = record_action_execution(action.id, execution_key)
    except Exception as error:
        raise HTTPException(
            status_code=409,
            detail="Execution was already recorded or could not be started.",
        ) from error
    return ActionExecutionResponse(
        action=updated,
        replayed=False,
        outcome=outcome,
    )
