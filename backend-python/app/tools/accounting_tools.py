from app.services.expenses_store import get_expenses
from app.services.invoices_store import get_invoices
from app.tools.sales_tools import get_sales_summary
from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.invoices_schema import InvoiceResponse

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

    total_expenses = sum(
        float(expense.amount)
        for expense in expenses
    )

    expense_categories: dict[str, float] = {}

    for expense in expenses:
        category = expense.category

        if category not in expense_categories:
            expense_categories[category] = 0.0

        expense_categories[category] += float(expense.amount)

    expense_categories = {
        category: round(amount, 2)
        for category, amount in expense_categories.items()
    }

    invoice_statuses: dict[str, dict] = {}

    for invoice in invoices:
        status = invoice.status.lower()

        if status not in invoice_statuses:
            invoice_statuses[status] = {
                "count": 0,
                "amount": 0.0,
            }

        invoice_statuses[status]["count"] += 1
        invoice_statuses[status]["amount"] += float(
            invoice.total_amount
        )

    for status_data in invoice_statuses.values():
        status_data["amount"] = round(status_data["amount"], 2)

    completed_revenue = float(
        sales_summary["completed_revenue"]
    )

    return {
        "completed_revenue": completed_revenue,
        "total_expenses": round(total_expenses, 2),
        "preliminary_operating_result": round(
            completed_revenue - total_expenses,
            2,
        ),
        "expense_categories": expense_categories,
        "flagged_expenses_count": sum(
            1 for expense in expenses if expense.is_flagged
        ),
        "invoice_statuses": invoice_statuses,
        "total_invoiced_vat": round(
            sum(float(invoice.vat_amount) for invoice in invoices),
            2,
        ),
    }


# Note: This tool combines sales, expenses, and invoice data into one accounting summary without double-counting invoice revenue. 