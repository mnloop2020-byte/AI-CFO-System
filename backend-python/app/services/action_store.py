from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from app.money import serialize_decimal_values
from app.schemas.action_schema import (
    FinancialActionDetailResponse,
    FinancialActionEventResponse,
    FinancialActionFilters,
    FinancialActionResponse,
)
from app.services.supabase_client import get_supabase_client


_ACTION_COLUMNS = (
    "id,action_type,dedup_key,title_en,title_ar,description_en,description_ar,"
    "severity,financial_impact,currency,source_type,source_id,evidence,"
    "recommendation_en,recommendation_ar,assigned_to,due_date,"
    "requires_approval,proposed_action,status,created_by,approved_by,"
    "approved_at,approval_expires_at,resolved_at,last_execution_key,created_at,updated_at"
)
_OPEN_STATUSES = [
    "new",
    "in_review",
    "waiting_for_approval",
    "approved",
    "in_progress",
]


def _serialize_action(row: dict[str, Any]) -> FinancialActionResponse:
    return FinancialActionResponse.model_validate(row)


def list_financial_actions(
    filters: FinancialActionFilters | None = None,
) -> list[FinancialActionResponse]:
    query = (
        get_supabase_client()
        .table("financial_actions")
        .select(_ACTION_COLUMNS)
        .order("created_at", desc=True)
    )
    filters = filters or FinancialActionFilters()
    if filters.status:
        query = query.eq("status", filters.status)
    if filters.action_type:
        query = query.eq("action_type", filters.action_type)
    if filters.severity:
        query = query.eq("severity", filters.severity)
    if filters.assigned_to:
        query = query.eq("assigned_to", str(filters.assigned_to))

    rows = query.execute().data or []
    if filters.search:
        needle = filters.search.strip().casefold()
        rows = [
            row
            for row in rows
            if needle
            in " ".join(
                str(row.get(field) or "")
                for field in (
                    "title_en",
                    "title_ar",
                    "description_en",
                    "description_ar",
                    "dedup_key",
                )
            ).casefold()
        ]
    return [_serialize_action(row) for row in rows]


def get_financial_action(action_id: UUID) -> FinancialActionDetailResponse | None:
    client = get_supabase_client()
    response = (
        client.table("financial_actions")
        .select(_ACTION_COLUMNS)
        .eq("id", str(action_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        return None

    events_response = (
        client.table("financial_action_events")
        .select("id,event_type,from_status,to_status,actor_id,note,metadata,created_at")
        .eq("action_id", str(action_id))
        .order("created_at")
        .execute()
    )
    action = _serialize_action(response.data[0])
    return FinancialActionDetailResponse(
        **action.model_dump(),
        events=[
            FinancialActionEventResponse.model_validate(row)
            for row in (events_response.data or [])
        ],
    )


def find_open_action(dedup_key: str) -> FinancialActionResponse | None:
    response = (
        get_supabase_client()
        .table("financial_actions")
        .select(_ACTION_COLUMNS)
        .eq("dedup_key", dedup_key)
        .in_("status", _OPEN_STATUSES)
        .limit(1)
        .execute()
    )
    return _serialize_action(response.data[0]) if response.data else None


def create_financial_action(payload: dict[str, Any]) -> FinancialActionResponse:
    response = (
        get_supabase_client()
        .table("financial_actions")
        .insert(serialize_decimal_values(payload))
        .execute()
    )
    if not response.data:
        raise RuntimeError("Financial action was not created.")
    return _serialize_action(response.data[0])


def update_financial_action(
    action_id: UUID,
    payload: dict[str, Any],
) -> FinancialActionResponse:
    response = (
        get_supabase_client()
        .table("financial_actions")
        .update(serialize_decimal_values(payload))
        .eq("id", str(action_id))
        .execute()
    )
    if not response.data:
        raise LookupError("Financial action not found.")
    return _serialize_action(response.data[0])


def refresh_financial_action_detection(
    action_id: UUID,
    payload: dict[str, Any],
) -> FinancialActionResponse:
    allowed_fields = {
        "title_en",
        "title_ar",
        "description_en",
        "description_ar",
        "severity",
        "financial_impact",
        "currency",
        "evidence",
        "recommendation_en",
        "recommendation_ar",
        "due_date",
    }
    return update_financial_action(
        action_id,
        {key: value for key, value in payload.items() if key in allowed_fields},
    )


def assign_financial_action(
    action_id: UUID,
    assigned_to: UUID | None,
) -> FinancialActionResponse:
    return update_financial_action(
        action_id,
        {"assigned_to": str(assigned_to) if assigned_to else None},
    )


def transition_financial_action(
    action_id: UUID,
    status: str,
    due_date: date | None = None,
    note: str | None = None,
) -> FinancialActionResponse:
    payload: dict[str, Any] = {"status": status, "last_note": note}
    if due_date is not None:
        payload["due_date"] = due_date.isoformat()
    return update_financial_action(action_id, payload)


def record_action_execution(
    action_id: UUID,
    execution_key: str,
) -> FinancialActionResponse:
    return update_financial_action(
        action_id,
        {
            "status": "in_progress",
            "last_execution_key": execution_key,
            "last_note": (
                "Approved draft recorded for follow-up. External execution is not configured."
            ),
        },
    )


def list_open_actions() -> list[FinancialActionResponse]:
    response = (
        get_supabase_client()
        .table("financial_actions")
        .select(_ACTION_COLUMNS)
        .in_("status", _OPEN_STATUSES)
        .execute()
    )
    return [_serialize_action(row) for row in (response.data or [])]
