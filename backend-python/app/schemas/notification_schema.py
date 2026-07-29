from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel


NotificationEventType = Literal[
    "invoice_generated",
    "invoice_emailed",
    "invoice_email_failed",
    "invoice_overdue",
    "invoice_paid",
]


class NotificationResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    event_type: NotificationEventType
    data: dict[str, Any]
    created_at: datetime


class NotificationScanResult(BaseModel):
    created: int
