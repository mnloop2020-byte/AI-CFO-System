from __future__ import annotations

from typing import Any

from app.schemas.notification_schema import NotificationResponse
from app.security.request_context import get_request_context
from app.services.invoices_store import get_invoices
from app.services.store_errors import is_constraint_error
from app.services.supabase_client import get_supabase_client


NOTIFICATION_LIST_LIMIT = 50


def create_notification(
    *,
    invoice_id: str,
    event_type: str,
    dedupe_key: str,
    data: dict[str, Any],
) -> bool:
    try:
        response = (
            get_supabase_client()
            .table("notifications")
            .insert(
                {
                    "invoice_id": invoice_id,
                    "event_type": event_type,
                    "dedupe_key": dedupe_key,
                    "data": data,
                }
            )
            .execute()
        )
    except Exception as error:
        if is_constraint_error(error, "23505"):
            return False
        raise
    return bool(response.data)


def list_notifications() -> list[NotificationResponse]:
    response = (
        get_supabase_client()
        .table("notifications")
        .select("id,invoice_id,event_type,data,created_at")
        .order("created_at", desc=True)
        .limit(NOTIFICATION_LIST_LIMIT)
        .execute()
    )
    return [
        NotificationResponse.model_validate(row)
        for row in (response.data or [])
    ]


def record_delivery_event(
    *,
    invoice_id: str,
    event_type: str,
    idempotency_key: str,
    metadata: dict[str, Any] | None = None,
) -> bool:
    try:
        response = (
            get_supabase_client()
            .table("invoice_delivery_events")
            .insert(
                {
                    "invoice_id": invoice_id,
                    "event_type": event_type,
                    "idempotency_key": idempotency_key,
                    "metadata": metadata or {},
                }
            )
            .execute()
        )
    except Exception as error:
        if is_constraint_error(error, "23505"):
            return False
        raise
    return bool(response.data)


def create_paid_notification(
    *,
    invoice_id: str,
    invoice_number: str,
    revision: str,
) -> bool:
    key = f"invoice-paid:{invoice_id}:{revision}"
    created = create_notification(
        invoice_id=invoice_id,
        event_type="invoice_paid",
        dedupe_key=key,
        data={"invoice_number": invoice_number},
    )
    if created:
        record_delivery_event(
            invoice_id=invoice_id,
            event_type="paid_notification_created",
            idempotency_key=f"paid-notification-event:{invoice_id}:{revision}",
        )
    return created


def scan_overdue_invoice_notifications() -> int:
    context = get_request_context()
    created_count = 0
    for invoice in get_invoices():
        if invoice.status != "overdue":
            continue
        due_marker = invoice.due_date or "unknown"
        dedupe_key = f"invoice-overdue:{invoice.id}:{due_marker}"
        created = create_notification(
            invoice_id=invoice.id,
            event_type="invoice_overdue",
            dedupe_key=dedupe_key,
            data={"invoice_number": invoice.invoice_number},
        )
        if created:
            created_count += 1
            record_delivery_event(
                invoice_id=invoice.id,
                event_type="overdue_notification_created",
                idempotency_key=(
                    f"overdue-notification-event:{invoice.id}:{due_marker}"
                ),
                metadata={"actor_role": context.company_role},
            )
    return created_count
