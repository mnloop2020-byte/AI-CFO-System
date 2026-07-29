from app.money import subtract_money, sum_money
from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.services.expenses_store import get_expenses
from app.services.invoices_store import get_invoices


def get_cashflow_summary(
    expenses: list[ExpenseResponse] | None = None,
    invoices: list[InvoiceResponse] | None = None,
) -> dict:
    if expenses is None:
        expenses = get_expenses()

    if invoices is None:
        invoices = get_invoices()

    paid_invoices = [
        invoice
        for invoice in invoices
        if invoice.status.lower() == "paid"
    ]

    unpaid_invoices = [
        invoice
        for invoice in invoices
        if invoice.status.lower() == "unpaid"
    ]

    tracked_cash_inflows = sum_money(
        invoice.total_amount for invoice in paid_invoices
    )

    recorded_cash_outflows = sum_money(
        expense.amount for expense in expenses
    )

    expected_unpaid_inflows = sum_money(
        invoice.total_amount for invoice in unpaid_invoices
    )

    return {
        "paid_invoices_count": len(paid_invoices),
        "tracked_cash_inflows": tracked_cash_inflows,
        "recorded_cash_outflows": recorded_cash_outflows,
        "net_tracked_cash_flow": subtract_money(
            tracked_cash_inflows,
            recorded_cash_outflows,
        ),
        "unpaid_invoices_count": len(unpaid_invoices),
        "expected_unpaid_inflows": expected_unpaid_inflows,
        "is_bank_balance_available": False,
        "data_sources": [
            {
                "table": "invoices",
                "record_ids": [invoice.id for invoice in invoices],
                "calculation": (
                    "tracked inflows use paid invoices; expected inflows use unpaid invoices"
                ),
            },
            {
                "table": "expenses",
                "record_ids": [expense.id for expense in expenses],
                "calculation": "recorded_cash_outflows = sum(expense.amount)",
            },
        ],
    }

#Note: This tool calculates tracked cash flow from paid invoices and recorded expenses without pretending it knows the bank balance.
