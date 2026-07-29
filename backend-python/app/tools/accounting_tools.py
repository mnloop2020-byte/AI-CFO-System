from decimal import Decimal

from app.money import parse_money, subtract_money, sum_money
from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.services.expenses_store import get_expenses
from app.services.invoices_store import get_invoices
from app.tools.sales_tools import get_sales_summary

def get_accounting_summary(
    sales_summary: dict | None = None,
    expenses: list[ExpenseResponse] | None = None,
    invoices: list[InvoiceResponse] | None = None,
) -> dict:
    if sales_summary is None:
        sales_summary = get_sales_summary()

    if expenses is None:
        expenses = get_expenses()

    if invoices is None:
        invoices = get_invoices()

    total_expenses = sum_money(
        expense.amount for expense in expenses
    )

    expense_categories: dict[str, Decimal] = {}

    for expense in expenses:
        category = expense.category

        if category not in expense_categories:
            expense_categories[category] = Decimal("0.00")

        expense_categories[category] += expense.amount

    invoice_statuses: dict[str, dict] = {}

    for invoice in invoices:
        status = invoice.status.lower()

        if status not in invoice_statuses:
            invoice_statuses[status] = {
                "count": 0,
                "amount": Decimal("0.00"),
            }

        invoice_statuses[status]["count"] += 1
        invoice_statuses[status]["amount"] += invoice.total_amount

    completed_revenue = parse_money(sales_summary["completed_revenue"])

    return {
        "completed_revenue": completed_revenue,
        "total_expenses": total_expenses,
        "preliminary_operating_result": subtract_money(
            completed_revenue,
            total_expenses,
        ),
        "expense_categories": expense_categories,
        "flagged_expenses_count": sum(
            1 for expense in expenses if expense.is_flagged
        ),
        "invoice_statuses": invoice_statuses,
        "total_invoiced_vat": sum_money(
            invoice.vat_amount for invoice in invoices
        ),
        "data_sources": [
            *sales_summary.get("data_sources", []),
            {
                "table": "expenses",
                "record_ids": [expense.id for expense in expenses],
                "calculation": "total_expenses = sum(amount)",
            },
            {
                "table": "invoices",
                "record_ids": [invoice.id for invoice in invoices],
                "calculation": "total_invoiced_vat = sum(vat_amount)",
            },
        ],
    }


# Note: This tool combines sales, expenses, and invoice data without double-counting invoice revenue.
