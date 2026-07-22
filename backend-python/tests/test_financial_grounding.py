from app.ai.financial_grounding import (
    find_unsupported_claims,
    find_unsupported_numbers,
    ground_financial_reply,
    validate_financial_reply,
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

COMPREHENSIVE_DATA = {
    "sales": {
        "completed_revenue": 200.0,
        "completed_sales_count": 1,
        "total_units_sold": 2,
    },
    "inventory": {
        "overview": {"count": 1},
        "low_inventory": {"count": 1},
        "valuation": {"total_cost_value": 30.0},
    },
    "accounting": {
        "total_expenses": 550.0,
        "preliminary_operating_result": -350.0,
    },
    "cash_flow": {
        "tracked_cash_inflows": 0.0,
        "recorded_cash_outflows": 550.0,
        "net_tracked_cash_flow": -550.0,
        "expected_unpaid_inflows": 1000.0,
    },
    "tax": {"total_invoiced_vat": 150.0},
    "fraud_risk": {"flagged_expenses_count": 1},
    "company_context": {
        "currency": None,
        "bank_balance_available": False,
    },
    "data_sources": [
        {
            "table": "sales",
            "record_ids": ["sale-1"],
            "calculation": "completed revenue from completed sales",
        },
        {
            "table": "expenses",
            "record_ids": ["expense-1"],
            "calculation": "sum of recorded expenses",
        },
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
    assert "```json" not in result
    assert '"completed_revenue"' not in result
    assert "| Completed revenue | 200.00 |" in result


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


def test_validation_exposes_stable_repair_reasons() -> None:
    validation = validate_financial_reply(
        "The bank balance is $999999.",
        VERIFIED_DATA,
    )

    assert validation.is_valid is False
    assert validation.unsupported_numbers == ("999999",)
    assert set(validation.unsupported_claims) == {
        "unconfigured_currency",
        "bank_balance_claim",
    }
    assert find_unsupported_claims(
        "Bank balance is unavailable.",
        VERIFIED_DATA,
    ) == []


def test_single_agent_fallback_is_readable_english_markdown() -> None:
    result = ground_financial_reply(
        None,
        VERIFIED_DATA,
        "Show me a complete financial summary.",
    )

    assert "### Verified financial data" in result
    assert "| Metric | Value |" in result
    assert "| Completed revenue | 200.00 |" in result
    assert "```json" not in result
    assert "{" not in result


def test_multi_agent_report_hides_internal_results() -> None:
    report_data = {
        "agents": ["sales", "accounting"],
        "results": {
            "sales": {"completed_revenue": 200.0},
            "accounting": {"total_expenses": 550.0},
        },
        "sales": {"completed_revenue": 200.0},
        "accounting": {
            "total_expenses": 550.0,
            "preliminary_operating_result": -350.0,
        },
        "data_sources": [
            {
                "table": "sales",
                "record_ids": ["sale-1"],
            }
        ],
    }

    result = ground_financial_reply(
        "",
        report_data,
        "Show me a complete financial summary.",
    )

    assert "Sales › Completed revenue" in result
    assert "Accounting › Total expenses" in result
    assert "agents" not in result
    assert "results" not in result
    assert "sale-1" not in result
    assert "```json" not in result


def test_arabic_report_fallback_is_readable_markdown() -> None:
    result = ground_financial_reply(
        {"results": {"internal": True}},
        VERIFIED_DATA,
        "أعطني ملخصًا ماليًا شاملًا.",
    )

    assert "### البيانات المالية المتحقق منها" in result
    assert "| البيان | القيمة |" in result
    assert "| إيرادات المبيعات المكتملة | 200.00 |" in result
    assert "```json" not in result
    assert '"results"' not in result


def test_comprehensive_fallback_is_concise_english_markdown() -> None:
    result = ground_financial_reply(
        "Projected revenue is 999999.",
        COMPREHENSIVE_DATA,
        "Show me a complete financial summary.",
    )

    assert "### Verified financial summary" in result
    assert "#### Sales" in result
    assert "#### Tracked cash flow" in result
    assert "Completed revenue: **200.00**" in result
    assert "| Metric | Value |" not in result
    assert "overview" not in result
    assert "record_ids" not in result
    assert "999999" not in result
    assert "### Data sources" in result


def test_comprehensive_fallback_is_concise_arabic_markdown() -> None:
    result = ground_financial_reply(
        "توقع غير مدعوم 999999.",
        COMPREHENSIVE_DATA,
        "أعطني ملخصًا ماليًا شاملًا.",
    )

    assert "### ملخص مالي متحقق منه" in result
    assert "#### المبيعات" in result
    assert "إيرادات المبيعات المكتملة: **200.00**" in result
    assert "| البيان | القيمة |" not in result
    assert "record_ids" not in result
    assert "999999" not in result
    assert "### مصادر البيانات" in result


def test_raw_json_agent_reply_is_never_returned_to_user() -> None:
    result = ground_financial_reply(
        '{"agents":["sales"],"results":{"completed_revenue":200}}',
        VERIFIED_DATA,
        "Show me a complete financial summary.",
    )

    assert '"agents"' not in result
    assert '"results"' not in result
    assert "```json" not in result
    assert "| Completed revenue | 200.00 |" in result


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
