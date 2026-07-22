from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.action_schema import FinancialActionUpdate
from app.schemas.customer_schema import CustomerResponse
from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.inventory_schema import InventoryResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.services.action_engine import detect_action_candidates


def _invoice(status: str = "unpaid", due_date: str = "2026-01-01") -> InvoiceResponse:
    return InvoiceResponse(
        id="10000000-0000-0000-0000-000000000001",
        customer_id="20000000-0000-0000-0000-000000000001",
        invoice_number="INV-TEST",
        total_amount=1000,
        vat_amount=150,
        status=status,
        due_date=due_date,
    )


def _inventory(quantity: int = 3) -> InventoryResponse:
    return InventoryResponse(
        id="30000000-0000-0000-0000-000000000001",
        product_name="Low Product",
        sku="LOW-1",
        quantity=quantity,
        reorder_level=5,
        cost_price=10,
        selling_price=15,
    )


def _expense(flagged: bool = True) -> ExpenseResponse:
    return ExpenseResponse(
        id="40000000-0000-0000-0000-000000000001",
        category="Consulting",
        amount=500,
        vendor=None,
        is_flagged=flagged,
    )


def _customer() -> CustomerResponse:
    return CustomerResponse(
        id="20000000-0000-0000-0000-000000000001",
        name="Test Customer",
        email="customer@example.com",
    )


def test_detection_builds_three_traceable_drafts() -> None:
    candidates = detect_action_candidates(
        [_invoice()],
        [_inventory()],
        [_expense()],
        [_customer()],
        today=date(2026, 3, 5),
        currency="USD",
    )

    assert [candidate.dedup_key for candidate in candidates] == [
        "overdue_invoice:10000000-0000-0000-0000-000000000001",
        "low_inventory:30000000-0000-0000-0000-000000000001",
        "expense_review:40000000-0000-0000-0000-000000000001",
    ]

    overdue = candidates[0].payload
    assert overdue["financial_impact"] == 1000
    assert overdue["evidence"]["days_overdue"] == 63
    assert overdue["proposed_action"]["recipient"] == "customer@example.com"
    assert overdue["proposed_action"]["external_execution_allowed"] is False

    low_stock = candidates[1].payload
    assert low_stock["evidence"]["shortage_to_reorder_level"] == 2
    assert low_stock["financial_impact"] == 20
    assert low_stock["proposed_action"]["external_execution_allowed"] is False

    expense = candidates[2].payload
    assert expense["evidence"]["fraud_confirmed"] is False
    assert expense["requires_approval"] is False


def test_resolved_sources_do_not_create_candidates() -> None:
    candidates = detect_action_candidates(
        [_invoice(status="paid")],
        [_inventory(quantity=6)],
        [_expense(flagged=False)],
        [_customer()],
        today=date(2026, 3, 5),
        currency=None,
    )
    assert candidates == []


def test_due_today_is_not_overdue() -> None:
    candidates = detect_action_candidates(
        [_invoice(due_date="2026-03-05")],
        [],
        [],
        [_customer()],
        today=date(2026, 3, 5),
        currency=None,
    )
    assert candidates == []


def test_frontend_cannot_smuggle_company_id_into_action_update() -> None:
    with pytest.raises(ValidationError):
        FinancialActionUpdate.model_validate(
            {"title_en": "Changed", "company_id": "fake-company"}
        )
