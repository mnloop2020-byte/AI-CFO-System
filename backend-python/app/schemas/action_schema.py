from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ActionType = Literal["overdue_invoice", "low_inventory", "expense_review"]
ActionSeverity = Literal["low", "medium", "high", "critical"]
ActionStatus = Literal[
    "new",
    "in_review",
    "waiting_for_approval",
    "approved",
    "rejected",
    "in_progress",
    "completed",
    "dismissed",
    "expired",
]


class FinancialActionResponse(BaseModel):
    id: UUID
    action_type: ActionType
    dedup_key: str
    title_en: str
    title_ar: str
    description_en: str
    description_ar: str
    severity: ActionSeverity
    financial_impact: Decimal | None = None
    currency: str | None = None
    source_type: Literal["invoice", "inventory", "expense"]
    source_id: UUID
    evidence: dict[str, Any]
    recommendation_en: str
    recommendation_ar: str
    assigned_to: UUID | None = None
    due_date: date | None = None
    requires_approval: bool
    proposed_action: dict[str, Any]
    status: ActionStatus
    created_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    approval_expires_at: datetime | None = None
    resolved_at: datetime | None = None
    last_execution_key: str | None = None
    created_at: datetime
    updated_at: datetime


class FinancialActionEventResponse(BaseModel):
    id: UUID
    event_type: str
    from_status: str | None = None
    to_status: str | None = None
    actor_id: UUID | None = None
    note: str | None = None
    metadata: dict[str, Any]
    created_at: datetime


class FinancialActionDetailResponse(FinancialActionResponse):
    events: list[FinancialActionEventResponse] = Field(default_factory=list)


class FinancialActionFilters(BaseModel):
    status: ActionStatus | None = None
    action_type: ActionType | None = None
    severity: ActionSeverity | None = None
    assigned_to: UUID | None = None
    search: str | None = Field(default=None, max_length=160)


class FinancialActionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title_en: str | None = Field(default=None, min_length=1, max_length=240)
    title_ar: str | None = Field(default=None, min_length=1, max_length=240)
    description_en: str | None = Field(default=None, min_length=1, max_length=4000)
    description_ar: str | None = Field(default=None, min_length=1, max_length=4000)
    recommendation_en: str | None = Field(default=None, min_length=1, max_length=4000)
    recommendation_ar: str | None = Field(default=None, min_length=1, max_length=4000)
    proposed_action: dict[str, Any] | None = None
    due_date: date | None = None


class FinancialActionAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assigned_to: UUID | None


class FinancialActionTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ActionStatus
    note: str | None = Field(default=None, max_length=4000)
    due_date: date | None = None


class DetectionResult(BaseModel):
    created: int
    existing: int
    resolved: int
    action_ids: list[UUID]


class ActionExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=12, max_length=200)


class ActionExecutionResponse(BaseModel):
    action: FinancialActionResponse
    replayed: bool
    external_executed: bool = False
    outcome: Literal["pending_integration", "human_review_required"]


class ActionMetricsResponse(BaseModel):
    open_actions: int
    completed_actions: int
    linked_financial_value: Decimal
    open_financial_value: Decimal
    overdue_invoice_actions: int
    followed_up_invoices: int
    proven_collected_amount: Decimal | None
    collection_attribution_note: str
    average_days_overdue: float | None
    low_inventory_actions: int
    expense_review_actions: int
    approvals: int
    rejections: int
    accepted_recommendation_rate: float | None
    estimated_minutes_saved: int
    estimation_method: str
    dismissed_actions: int
