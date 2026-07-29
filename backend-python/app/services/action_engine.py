from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from app.money import (
    money_to_string,
    multiply_money,
    parse_money,
    serialize_decimal_values,
)
from app.schemas.action_schema import DetectionResult
from app.schemas.company_schema import FinancialSettings
from app.schemas.customer_schema import CustomerResponse
from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.inventory_schema import InventoryResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.rag.search import search_documents
from app.services.action_store import (
    create_financial_action,
    find_open_action,
    list_open_actions,
    refresh_financial_action_detection,
    transition_financial_action,
)
from app.services.company_store import get_company_settings
from app.services.customer_store import get_customers
from app.services.expenses_store import get_expenses
from app.services.inventory_store import get_inventory_items
from app.services.invoices_store import get_invoices


@dataclass(frozen=True, slots=True)
class ActionCandidate:
    dedup_key: str
    payload: dict[str, Any]


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None


def _overdue_severity(
    days_overdue: int,
    amount: Decimal,
    settings: FinancialSettings,
) -> str:
    if (
        days_overdue >= settings.invoice_critical_days
        or amount >= settings.critical_amount_threshold
    ):
        return "critical"
    if (
        days_overdue >= settings.invoice_high_priority_days
        or amount >= settings.high_amount_threshold
    ):
        return "high"
    if days_overdue >= 7:
        return "medium"
    return "low"


def detect_action_candidates(
    invoices: list[InvoiceResponse],
    inventory: list[InventoryResponse],
    expenses: list[ExpenseResponse],
    customers: list[CustomerResponse],
    *,
    today: date,
    currency: str | None,
    financial_settings: FinancialSettings | None = None,
    expense_policy_matches: dict[str, dict[str, Any]] | None = None,
) -> list[ActionCandidate]:
    candidates: list[ActionCandidate] = []
    customer_map = {customer.id: customer for customer in customers}
    settings = financial_settings or FinancialSettings()

    for invoice in invoices:
        due_date = _parse_date(invoice.due_date)
        status = invoice.status.strip().casefold()
        if status not in {"unpaid", "overdue"} or due_date is None or due_date >= today:
            continue

        days_overdue = (today - due_date).days
        customer = customer_map.get(invoice.customer_id or "")
        customer_name = customer.name if customer else "Customer not linked"
        recipient = customer.email if customer else None
        candidates.append(
            ActionCandidate(
                dedup_key=f"overdue_invoice:{invoice.id}",
                payload={
                    "action_type": "overdue_invoice",
                    "dedup_key": f"overdue_invoice:{invoice.id}",
                    "title_en": f"Collect overdue invoice {invoice.invoice_number}",
                    "title_ar": f"تحصيل الفاتورة المتأخرة {invoice.invoice_number}",
                    "description_en": (
                        f"Invoice {invoice.invoice_number} is {days_overdue} days overdue "
                        f"with {invoice.total_amount:.2f} outstanding."
                    ),
                    "description_ar": (
                        f"الفاتورة {invoice.invoice_number} متأخرة {days_overdue} يومًا "
                        f"وبمبلغ مستحق {invoice.total_amount:.2f}."
                    ),
                    "severity": _overdue_severity(
                        days_overdue,
                        invoice.total_amount,
                        settings,
                    ),
                    "financial_impact": invoice.total_amount,
                    "currency": currency,
                    "source_type": "invoice",
                    "source_id": invoice.id,
                    "evidence": {
                        "invoice_number": invoice.invoice_number,
                        "invoice_status": invoice.status,
                        "due_date": due_date.isoformat(),
                        "days_overdue": days_overdue,
                        "outstanding_amount": invoice.total_amount,
                        "customer_id": invoice.customer_id,
                        "customer_name": customer_name,
                        "source": {"table": "invoices", "id": invoice.id},
                    },
                    "recommendation_en": "Review the invoice and approve a reminder draft.",
                    "recommendation_ar": "راجع الفاتورة ووافق على مسودة تذكير عند ملاءمتها.",
                    "due_date": today.isoformat(),
                    "requires_approval": True,
                    "proposed_action": {
                        "kind": "email_reminder_draft",
                        "recipient": recipient,
                        "subject_en": f"Payment reminder: {invoice.invoice_number}",
                        "subject_ar": f"تذكير بسداد الفاتورة {invoice.invoice_number}",
                        "message_en": (
                            f"Hello {customer_name}, this is a reminder that invoice "
                            f"{invoice.invoice_number} is overdue. Please review the "
                            "invoice and contact us if a payment arrangement is needed."
                        ),
                        "message_ar": (
                            f"مرحبًا {customer_name}، هذا تذكير بأن الفاتورة "
                            f"{invoice.invoice_number} متأخرة. يرجى مراجعتها والتواصل "
                            "معنا إذا كان يلزم ترتيب خطة دفع."
                        ),
                        "delivery_status": "pending_integration",
                        "external_execution_allowed": False,
                    },
                },
            )
        )

    for item in inventory:
        if item.quantity > item.reorder_level:
            continue
        shortage = max(item.reorder_level - item.quantity, 0)
        estimated_cost = (
            multiply_money(item.cost_price, shortage) if shortage > 0 else None
        )
        candidates.append(
            ActionCandidate(
                dedup_key=f"low_inventory:{item.id}",
                payload={
                    "action_type": "low_inventory",
                    "dedup_key": f"low_inventory:{item.id}",
                    "title_en": f"Review low stock: {item.product_name}",
                    "title_ar": f"مراجعة المخزون المنخفض: {item.product_name}",
                    "description_en": (
                        f"Current quantity {item.quantity} is at or below reorder level "
                        f"{item.reorder_level}."
                    ),
                    "description_ar": (
                        f"الكمية الحالية {item.quantity} عند حد إعادة الطلب "
                        f"{item.reorder_level} أو أقل منه."
                    ),
                    "severity": "high" if item.quantity == 0 else "medium",
                    "financial_impact": estimated_cost,
                    "currency": currency,
                    "source_type": "inventory",
                    "source_id": item.id,
                    "evidence": {
                        "product_name": item.product_name,
                        "sku": item.sku,
                        "quantity": item.quantity,
                        "reorder_level": item.reorder_level,
                        "shortage_to_reorder_level": shortage,
                        "unit_cost": item.cost_price,
                        "estimated_restock_cost": estimated_cost,
                        "cost_limitation": (
                            None
                            if estimated_cost is not None
                            else "A target quantity above the reorder level is not configured."
                        ),
                        "source": {"table": "inventory", "id": item.id},
                    },
                    "recommendation_en": "Review a replenishment request; no purchase is created.",
                    "recommendation_ar": "راجع طلب تزويد مقترحًا؛ لن يتم إنشاء عملية شراء.",
                    "requires_approval": True,
                    "proposed_action": {
                        "kind": "purchase_review_draft",
                        "quantity_to_reorder_level": shortage,
                        "estimated_cost": estimated_cost,
                        "external_execution_allowed": False,
                    },
                },
            )
        )

    for expense in expenses:
        exceeds_review_threshold = (
            expense.amount >= settings.large_expense_review_threshold
        )
        if not expense.is_flagged and not exceeds_review_threshold:
            continue
        policy_match = (expense_policy_matches or {}).get(expense.id)
        policy_evidence = (
            {
                "document_id": policy_match.get("document_id"),
                "file_name": policy_match.get("file_name") or "Unknown document",
                "chunk_number": int(policy_match.get("chunk_index") or 0) + 1,
                "excerpt": str(policy_match.get("content") or "")[:500],
                "similarity": float(policy_match.get("similarity") or 0),
                "interpretation": (
                    "Policy context is provided for human comparison only; "
                    "it does not establish a violation or fraud."
                ),
            }
            if policy_match
            else None
        )
        candidates.append(
            ActionCandidate(
                dedup_key=f"expense_review:{expense.id}",
                payload={
                    "action_type": "expense_review",
                    "dedup_key": f"expense_review:{expense.id}",
                    "title_en": f"Review {expense.category} expense",
                    "title_ar": f"مراجعة مصروف ضمن {expense.category}",
                    "description_en": (
                        "This expense meets a configured review rule and requires human "
                        "review. The alert does not confirm fraud or misconduct."
                    ),
                    "description_ar": (
                        "يستوفي هذا المصروف قاعدة مراجعة مهيأة ويحتاج إلى مراجعة "
                        "بشرية. لا يعني التنبيه إثبات احتيال أو مخالفة."
                    ),
                    "severity": "medium",
                    "financial_impact": expense.amount,
                    "currency": currency,
                    "source_type": "expense",
                    "source_id": expense.id,
                    "evidence": {
                        "category": expense.category,
                        "amount": expense.amount,
                        "vendor": expense.vendor,
                        "expense_date": expense.expense_date,
                        "is_flagged": expense.is_flagged,
                        "large_amount_rule_matched": exceeds_review_threshold,
                        "large_expense_review_threshold": (
                            settings.large_expense_review_threshold
                        ),
                        "review_triggers": [
                            trigger
                            for trigger, matched in (
                                ("source_record_flag", expense.is_flagged),
                                ("configured_amount_threshold", exceeds_review_threshold),
                            )
                            if matched
                        ],
                        "flag_reason_available": False,
                        "fraud_confirmed": False,
                        "policy_match": policy_evidence,
                        "policy_match_available": policy_evidence is not None,
                        "source": {"table": "expenses", "id": expense.id},
                    },
                    "recommendation_en": (
                        "Review the receipt, approval, business purpose, and vendor details."
                    ),
                    "recommendation_ar": (
                        "راجع الإيصال والموافقة والغرض التجاري وبيانات المورّد."
                    ),
                    "requires_approval": False,
                    "proposed_action": {
                        "kind": "human_expense_review",
                        "external_execution_allowed": False,
                    },
                },
            )
        )

    return candidates


def _load_expense_policy_matches(
    expenses: list[ExpenseResponse],
    large_expense_review_threshold: Decimal,
) -> dict[str, dict[str, Any]]:
    """Retrieve policy context as untrusted evidence, never executable instructions."""

    matches: dict[str, dict[str, Any]] = {}
    for expense in expenses:
        if (
            not expense.is_flagged
            and expense.amount < large_expense_review_threshold
        ):
            continue
        query_parts = [
            "company expense policy approval receipt vendor business purpose",
            expense.category,
            expense.vendor or "",
            expense.description or "",
        ]
        try:
            candidates = search_documents(" ".join(query_parts), match_count=3)
        except Exception:
            candidates = []
        if candidates:
            matches[expense.id] = candidates[0]
    return matches


def _source_is_resolved(action: Any, source_map: dict[str, dict[str, Any]]) -> bool:
    source = source_map.get(f"{action.source_type}:{action.source_id}")
    if source is None:
        return False
    if action.source_type == "invoice":
        return str(source["status"]).casefold() == "paid"
    if action.source_type == "inventory":
        return int(source["quantity"]) > int(source["reorder_level"])
    if action.source_type == "expense":
        return (
            not bool(source["is_flagged"])
            and parse_money(source["amount"])
            < parse_money(source["large_expense_review_threshold"])
        )
    return False


def run_action_detection(today: date | None = None) -> DetectionResult:
    today = today or datetime.now(timezone.utc).date()
    company = get_company_settings()
    invoices = get_invoices()
    inventory = get_inventory_items()
    expenses = get_expenses()
    customers = get_customers()
    candidates = detect_action_candidates(
        invoices,
        inventory,
        expenses,
        customers,
        today=today,
        currency=company.currency,
        financial_settings=company.financial_settings,
        expense_policy_matches=_load_expense_policy_matches(
            expenses,
            company.financial_settings.large_expense_review_threshold,
        ),
    )

    created_ids = []
    existing = 0
    for candidate in candidates:
        current = find_open_action(candidate.dedup_key)
        if current:
            refreshed_fields = {
                "title_en": candidate.payload["title_en"],
                "title_ar": candidate.payload["title_ar"],
                "description_en": candidate.payload["description_en"],
                "description_ar": candidate.payload["description_ar"],
                "severity": candidate.payload["severity"],
                "financial_impact": candidate.payload["financial_impact"],
                "currency": candidate.payload["currency"],
                "evidence": candidate.payload["evidence"],
                "recommendation_en": candidate.payload["recommendation_en"],
                "recommendation_ar": candidate.payload["recommendation_ar"],
                "due_date": candidate.payload.get("due_date"),
            }
            refreshed_fields = serialize_decimal_values(refreshed_fields)
            current_fields = {
                "title_en": current.title_en,
                "title_ar": current.title_ar,
                "description_en": current.description_en,
                "description_ar": current.description_ar,
                "severity": current.severity,
                "financial_impact": (
                    money_to_string(current.financial_impact)
                    if current.financial_impact is not None
                    else None
                ),
                "currency": current.currency,
                "evidence": current.evidence,
                "recommendation_en": current.recommendation_en,
                "recommendation_ar": current.recommendation_ar,
                "due_date": current.due_date.isoformat() if current.due_date else None,
            }
            if current_fields != refreshed_fields:
                refresh_financial_action_detection(current.id, refreshed_fields)
            existing += 1
            continue
        try:
            created_ids.append(create_financial_action(candidate.payload).id)
        except Exception:
            # The partial unique index is the final race-condition guard.
            current = find_open_action(candidate.dedup_key)
            if current:
                existing += 1
                continue
            raise

    source_map: dict[str, dict[str, Any]] = {
        **{
            f"invoice:{invoice.id}": {"status": invoice.status}
            for invoice in invoices
        },
        **{
            f"inventory:{item.id}": {
                "quantity": item.quantity,
                "reorder_level": item.reorder_level,
            }
            for item in inventory
        },
        **{
            f"expense:{expense.id}": {
                "is_flagged": expense.is_flagged,
                "amount": expense.amount,
                "large_expense_review_threshold": (
                    company.financial_settings.large_expense_review_threshold
                ),
            }
            for expense in expenses
        },
    }
    resolved = 0
    for action in list_open_actions():
        if (
            action.status == "approved"
            and action.approval_expires_at is not None
            and action.approval_expires_at <= datetime.now(timezone.utc)
        ):
            transition_financial_action(
                action.id,
                "expired",
                note="Approval expired before execution.",
            )
            resolved += 1
            continue
        if not _source_is_resolved(action, source_map):
            continue
        if action.status != "in_review":
            transition_financial_action(
                action.id,
                "in_review",
                note="Source record is resolved; preparing automatic closure.",
            )
        transition_financial_action(
            action.id,
            "completed",
            note="Closed because the source record no longer requires action.",
        )
        resolved += 1

    return DetectionResult(
        created=len(created_ids),
        existing=existing,
        resolved=resolved,
        action_ids=created_ids,
        cash_reserve_evaluated=False,
        cash_reserve_evaluation_reason="bank_balance_unavailable",
    )
