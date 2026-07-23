from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.customer_schema import CustomerCreate
from app.schemas.expenses_schema import ExpenseCreate
from app.schemas.inventory_schema import InventoryCreate
from app.schemas.invoices_schema import InvoiceCreate, InvoiceUpdate
from app.schemas.sales_schema import SaleCreate
from app.services.invoices_store import _effective_status


def test_customer_validation_and_company_id_rejection() -> None:
    customer = CustomerCreate(
        name="  Pilot Customer  ",
        email=" PILOT@EXAMPLE.COM ",
        phone="+90 555 123 4567",
    )
    assert customer.name == "Pilot Customer"
    assert customer.email == "pilot@example.com"

    with pytest.raises(ValidationError):
        CustomerCreate(name="Customer", email="invalid")
    with pytest.raises(ValidationError):
        CustomerCreate(name="Customer", company_id="untrusted")


@pytest.mark.parametrize(
    ("model", "payload"),
    [
        (SaleCreate, {"product_name": "Sale", "quantity": -1, "unit_price": 10}),
        (ExpenseCreate, {"category": "Office", "amount": -1}),
        (InventoryCreate, {"product_name": "Item", "quantity": -1}),
        (
            InvoiceCreate,
            {"invoice_number": "INV-X", "total_amount": -1, "vat_amount": 0},
        ),
    ],
)
def test_negative_financial_values_are_rejected(model, payload) -> None:
    with pytest.raises(ValidationError):
        model(**payload)


def test_sale_total_is_not_accepted_and_status_is_canonical() -> None:
    sale = SaleCreate(
        product_name="Pilot Sale",
        quantity=2,
        unit_price=15,
        status="Completed",
        sale_date="2026-07-23T00:00:00Z",
    )
    assert sale.status == "completed"
    assert sale.sale_date == "2026-07-23T00:00:00Z"

    with pytest.raises(ValidationError):
        SaleCreate(
            product_name="Pilot Sale",
            quantity=2,
            unit_price=15,
            total_amount=1,
        )


def test_expense_date_and_invoice_rules_are_validated() -> None:
    expense = ExpenseCreate(
        category="Office",
        amount=10,
        expense_date="2026-07-23T00:00:00Z",
    )
    assert expense.expense_date

    with pytest.raises(ValidationError):
        ExpenseCreate(category="Office", amount=10, expense_date="not-a-date")
    with pytest.raises(ValidationError):
        InvoiceCreate(
            invoice_number="INV-X",
            total_amount=100,
            vat_amount=101,
        )
    with pytest.raises(ValidationError):
        InvoiceUpdate(status="unknown")
    with pytest.raises(ValidationError):
        InvoiceCreate(
            invoice_number="INV-X",
            total_amount=100,
            company_id="untrusted",
        )


def test_invoice_overdue_status_is_derived_in_backend() -> None:
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    assert _effective_status("unpaid", yesterday) == "overdue"
    assert _effective_status("unpaid", tomorrow) == "unpaid"
    assert _effective_status("paid", yesterday) == "paid"


def test_low_stock_boundary_is_quantity_at_or_below_reorder_level() -> None:
    item = InventoryCreate(
        product_name="Pilot Item",
        quantity=5,
        reorder_level=5,
        cost_price=10,
        selling_price=15,
    )
    assert item.quantity <= item.reorder_level
