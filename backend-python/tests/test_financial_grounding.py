from app.ai.financial_grounding import (
    find_unsupported_numbers,
    ground_financial_reply,
)
from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.schemas.sales_schema import SaleResponse
from app.tools.accounting_tools import get_accounting_summary
from app.tools.cashflow_tools import get_cashflow_summary
from app.tools.fraud_tools import get_fraud_risk_summary
from app.tools.sales_tools import get_sales_summary
from app.tools.tax_tools import get_tax_summary


VERIFIED_DATA = {
    "company_context": {
        "currency": None,
        "bank_balance_available": False,
    },
    "verified_metrics": {
        "completed_revenue": 200.0,
        "total_expenses": 550.0,
        "recorded_on": "2026-07-22",
    },
    "data_sources": [
        {
            "table": "sales",
            "record_ids": ["sale-1"],
            "calculation": "completed revenue from completed sales",
        }
    ],
}


def test_supported_numbers_and_date_parts_are_allowed() -> None:
    reply = "Completed revenue is 200.00. Recorded on 2026-07-22."
    assert find_unsupported_numbers(reply, VERIFIED_DATA) == []


def test_unsupported_number_forces_deterministic_fallback() -> None:
    result = ground_financial_reply(
        "Projected revenue is 999999.",
        VERIFIED_DATA,
        "Give me an executive brief",
    )
    assert "narrative was withheld" in result
    assert "999999" not in result
    assert "### Data sources" in result
    assert "`sales`" in result


def test_unconfigured_currency_symbol_is_rejected() -> None:
    result = ground_financial_reply(
        "Completed revenue is $200.",
        VERIFIED_DATA,
        "How much revenue?",
    )
    assert "narrative was withheld" in result


def test_unavailable_bank_balance_claim_is_rejected() -> None:
    result = ground_financial_reply(
        "The bank balance is 200.",
        VERIFIED_DATA,
        "How is cash?",
    )
    assert "narrative was withheld" in result


def test_deterministic_financial_tools_preserve_distinct_concepts() -> None:
    sales = [
        SaleResponse(
            id="sale-1",
            product_name="Laptop",
            quantity=2,
            unit_price=100,
            total_amount=200,
            status="completed",
        )
    ]
    expenses = [
        ExpenseResponse(
            id="expense-1",
            category="Office",
            amount=50,
            is_flagged=True,
        )
    ]
    invoices = [
        InvoiceResponse(
            id="invoice-1",
            invoice_number="INV-1",
            total_amount=1000,
            vat_amount=150,
            status="unpaid",
        )
    ]

    sales_summary = get_sales_summary(sales)
    accounting = get_accounting_summary(sales_summary, expenses, invoices)
    cash_flow = get_cashflow_summary(expenses, invoices)
    tax = get_tax_summary(invoices)
    review = get_fraud_risk_summary(expenses, invoices)

    assert sales_summary["completed_revenue"] == 200
    assert accounting["preliminary_operating_result"] == 150
    assert cash_flow["tracked_cash_inflows"] == 0
    assert cash_flow["expected_unpaid_inflows"] == 1000
    assert cash_flow["net_tracked_cash_flow"] == -50
    assert cash_flow["is_bank_balance_available"] is False
    assert tax["total_invoiced_vat"] == 150
    assert tax["net_vat_payable_available"] is False
    assert review["fraud_confirmed"] is False
    assert review["flagged_expenses_count"] == 1
