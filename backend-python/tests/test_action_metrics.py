from datetime import datetime, timezone

from app.schemas.action_schema import FinancialActionResponse
from app.services.action_metrics import calculate_action_metrics


def _action(
    *,
    action_id: str,
    action_type: str,
    status: str,
    impact: str,
    evidence: dict,
    approved: bool = False,
    followed_up: bool = False,
) -> FinancialActionResponse:
    now = datetime(2026, 7, 22, tzinfo=timezone.utc)
    return FinancialActionResponse.model_validate(
        {
            "id": action_id,
            "action_type": action_type,
            "dedup_key": f"{action_type}:{action_id}",
            "title_en": "Test action",
            "title_ar": "إجراء اختباري",
            "description_en": "Traceable test action",
            "description_ar": "إجراء اختباري قابل للتتبع",
            "severity": "medium",
            "financial_impact": impact,
            "currency": "USD",
            "source_type": {
                "overdue_invoice": "invoice",
                "low_inventory": "inventory",
                "expense_review": "expense",
            }[action_type],
            "source_id": action_id,
            "evidence": evidence,
            "recommendation_en": "Review",
            "recommendation_ar": "راجع",
            "assigned_to": None,
            "due_date": None,
            "requires_approval": True,
            "proposed_action": {"external_execution_allowed": False},
            "status": status,
            "created_by": "90000000-0000-0000-0000-000000000001",
            "approved_by": (
                "90000000-0000-0000-0000-000000000001" if approved else None
            ),
            "approved_at": now if approved else None,
            "approval_expires_at": None,
            "resolved_at": now if status == "completed" else None,
            "last_execution_key": "verified-follow-up" if followed_up else None,
            "created_at": now,
            "updated_at": now,
        }
    )


def test_value_metrics_are_deterministic_and_do_not_invent_collection() -> None:
    actions = [
        _action(
            action_id="10000000-0000-0000-0000-000000000001",
            action_type="overdue_invoice",
            status="in_progress",
            impact="1000.00",
            evidence={"days_overdue": 20},
            approved=True,
            followed_up=True,
        ),
        _action(
            action_id="20000000-0000-0000-0000-000000000001",
            action_type="low_inventory",
            status="completed",
            impact="20.00",
            evidence={},
        ),
        _action(
            action_id="30000000-0000-0000-0000-000000000001",
            action_type="expense_review",
            status="dismissed",
            impact="500.00",
            evidence={},
        ),
    ]

    metrics = calculate_action_metrics(actions)

    assert metrics.open_actions == 1
    assert metrics.completed_actions == 1
    assert metrics.linked_financial_value == 1520
    assert metrics.open_financial_value == 1000
    assert metrics.followed_up_invoices == 1
    assert metrics.average_days_overdue == 20
    assert metrics.approvals == 1
    assert metrics.dismissed_actions == 1
    assert metrics.proven_collected_amount is None
    assert "paid_at" in metrics.collection_attribution_note
    assert metrics.estimated_minutes_saved == 15
