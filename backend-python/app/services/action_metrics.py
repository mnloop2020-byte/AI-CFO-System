from __future__ import annotations

from decimal import Decimal

from app.schemas.action_schema import ActionMetricsResponse, FinancialActionResponse


_CLOSED_STATUSES = {"completed", "dismissed", "rejected", "expired"}


def calculate_action_metrics(
    actions: list[FinancialActionResponse],
) -> ActionMetricsResponse:
    completed = [action for action in actions if action.status == "completed"]
    open_actions = [action for action in actions if action.status not in _CLOSED_STATUSES]
    approvals = sum(1 for action in actions if action.approved_at is not None)
    rejections = sum(1 for action in actions if action.status == "rejected")
    decisions = approvals + rejections
    overdue_days = [
        int(action.evidence["days_overdue"])
        for action in actions
        if action.action_type == "overdue_invoice"
        and isinstance(action.evidence.get("days_overdue"), (int, float))
    ]

    return ActionMetricsResponse(
        open_actions=len(open_actions),
        completed_actions=len(completed),
        linked_financial_value=sum(
            (action.financial_impact or Decimal("0")) for action in actions
        ),
        open_financial_value=sum(
            (action.financial_impact or Decimal("0")) for action in open_actions
        ),
        overdue_invoice_actions=sum(
            1 for action in actions if action.action_type == "overdue_invoice"
        ),
        followed_up_invoices=sum(
            1
            for action in actions
            if action.action_type == "overdue_invoice"
            and action.last_execution_key is not None
        ),
        proven_collected_amount=None,
        collection_attribution_note=(
            "Collection is not attributed because invoices do not yet record a "
            "verifiable paid_at timestamp and payment transaction reference."
        ),
        average_days_overdue=(
            round(sum(overdue_days) / len(overdue_days), 1) if overdue_days else None
        ),
        low_inventory_actions=sum(
            1 for action in actions if action.action_type == "low_inventory"
        ),
        expense_review_actions=sum(
            1 for action in actions if action.action_type == "expense_review"
        ),
        approvals=approvals,
        rejections=rejections,
        accepted_recommendation_rate=(
            round(approvals / decisions * 100, 1) if decisions else None
        ),
        estimated_minutes_saved=len(actions) * 5,
        estimation_method=(
            "Estimate: five minutes of manual signal identification and evidence "
            "assembly per detected action; this is not measured labor time."
        ),
        dismissed_actions=sum(1 for action in actions if action.status == "dismissed"),
    )
