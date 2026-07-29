from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace

from pypdf import PdfReader

from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.inventory_schema import InventoryResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.schemas.sales_schema import SaleResponse
from app.schemas.sales_schema import SaleCreate
from app.services.sales_store import create_sale
from app.services.invoice_pdf_service import (
    InvoicePdfData,
    create_invoice_pdf,
)
from app.tools.accounting_tools import get_accounting_summary
from app.tools.inventory_tools import get_inventory_valuation
from app.tools.sales_tools import get_sales_summary
from app.tools.tax_tools import get_tax_summary


def _sale(
    identifier: str,
    amount: str,
    unit_price: str,
) -> SaleResponse:
    return SaleResponse(
        id=identifier,
        product_name="Precision item",
        quantity=1,
        unit_price=unit_price,
        total_amount=amount,
        status="completed",
    )


def test_agent_tools_add_decimal_money_without_binary_drift() -> None:
    sales = [
        _sale("sale-1", "0.10", "0.10"),
        _sale("sale-2", "0.20", "0.20"),
    ]
    sales_summary = get_sales_summary(sales)
    expenses = [
        ExpenseResponse(
            id="expense-1",
            category="Office",
            amount="0.10",
            is_flagged=False,
        ),
        ExpenseResponse(
            id="expense-2",
            category="Office",
            amount="0.20",
            is_flagged=True,
        ),
    ]
    invoices = [
        InvoiceResponse(
            id="invoice-1",
            invoice_number="INV-PRECISION",
            total_amount="10.005",
            vat_amount="1.005",
            status="unpaid",
        )
    ]

    accounting = get_accounting_summary(
        sales_summary=sales_summary,
        expenses=expenses,
        invoices=invoices,
    )
    tax = get_tax_summary(invoices)

    assert sales_summary["completed_revenue"] == Decimal("0.30")
    assert accounting["total_expenses"] == Decimal("0.30")
    assert accounting["preliminary_operating_result"] == Decimal("0.00")
    assert accounting["total_invoiced_vat"] == Decimal("1.01")
    assert tax["total_invoiced_vat"] == Decimal("1.01")
    assert invoices[0].total_amount == Decimal("10.01")


def test_inventory_agent_uses_rounded_prices_and_exact_integer_quantity(
    monkeypatch,
) -> None:
    items = [
        InventoryResponse(
            id="inventory-1",
            product_name="Precision stock",
            quantity=3,
            reorder_level=1,
            cost_price="0.335",
            selling_price="0.675",
        )
    ]
    monkeypatch.setattr(
        "app.tools.inventory_tools.get_inventory_items",
        lambda: items,
    )

    valuation = get_inventory_valuation()

    assert items[0].cost_price == Decimal("0.34")
    assert items[0].selling_price == Decimal("0.68")
    assert valuation["total_cost_value"] == Decimal("1.02")
    assert valuation["total_selling_value"] == Decimal("2.04")
    assert valuation["potential_gross_profit"] == Decimal("1.02")


def test_financial_responses_serialize_money_as_fixed_strings() -> None:
    invoice = InvoiceResponse(
        id="invoice-json",
        invoice_number="INV-JSON",
        total_amount="999999999.999",
        vat_amount="0.001",
        status="paid",
    )

    assert invoice.model_dump_json() == (
        '{"id":"invoice-json","customer_id":null,'
        '"invoice_number":"INV-JSON",'
        '"total_amount":"1000000000.00",'
        '"vat_amount":"0.00","status":"paid",'
        '"due_date":null,"file_url":null,'
        '"created_at":null,"updated_at":null}'
    )


def test_sales_store_derives_total_from_server_validated_inputs(
    monkeypatch,
) -> None:
    captured: dict[str, object] = {}

    class InsertQuery:
        def insert(self, payload):
            captured.update(payload)
            return self

        def execute(self):
            return SimpleNamespace(
                data=[
                    {
                        "id": "sale-server-total",
                        **captured,
                    }
                ]
            )

    class FakeClient:
        def table(self, name):
            assert name == "sales"
            return InsertQuery()

    monkeypatch.setattr(
        "app.services.sales_store.get_supabase_client",
        lambda: FakeClient(),
    )

    sale = create_sale(
        SaleCreate(
            product_name="Server total",
            quantity=3,
            unit_price="0.335",
        )
    )

    assert captured["unit_price"] == "0.34"
    assert captured["total_amount"] == "1.02"
    assert sale.total_amount == Decimal("1.02")


def test_invoice_pdf_renders_decimal_vat_and_total_without_float_drift() -> None:
    timestamp = datetime(
        2026,
        7,
        28,
        tzinfo=timezone.utc,
    )
    pdf = create_invoice_pdf(
        InvoicePdfData(
            invoice_number="INV-DECIMAL",
            status="unpaid",
            total_amount=Decimal("10.01"),
            vat_amount=Decimal("1.01"),
            currency="USD",
            issued_at=timestamp,
            due_at=timestamp,
            revision_at=timestamp,
            company_name="Decimal Pilot",
        ),
        language="en",
    )
    text = (
        PdfReader(BytesIO(pdf))
        .pages[0]
        .extract_text()
        or ""
    )

    assert "Amount before VAT\n9.00 USD" in text
    assert "Recorded VAT\n1.01 USD" in text
    assert "Total due\n10.01 USD" in text
