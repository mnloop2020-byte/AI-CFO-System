from app.schemas.expenses_schema import ExpenseResponse
from app.schemas.invoices_schema import InvoiceResponse
from app.services.expenses_store import get_expenses
from app.services.invoices_store import get_invoices


def get_fraud_risk_summary(
    expenses: list[ExpenseResponse] | None = None,
    invoices: list[InvoiceResponse] | None = None,
) -> dict:
    if expenses is None:
        expenses = get_expenses()

    if invoices is None:
        invoices = get_invoices()
    flagged_expenses = [
        {
            "id": expense.id,
            "category": expense.category,
            "amount": expense.amount,
            "vendor": expense.vendor,
            "expense_date": expense.expense_date,
        }
        for expense in expenses
        if expense.is_flagged
    ]

    expense_groups: dict[tuple, list] = {}

    for expense in expenses:
        key = (
            expense.category.lower(),
            round(float(expense.amount), 2),
            (expense.vendor or "").lower(),
            expense.expense_date or "",
            (expense.description or "").lower(),
        )

        if key not in expense_groups:
            expense_groups[key] = []

        expense_groups[key].append(expense)

    duplicate_expense_candidates = [
        {
            "expense_ids": [
                expense.id
                for expense in grouped_expenses
            ],
            "category": grouped_expenses[0].category,
            "amount": grouped_expenses[0].amount,
            "vendor": grouped_expenses[0].vendor,
            "expense_date": grouped_expenses[0].expense_date,
            "count": len(grouped_expenses),
        }
        for grouped_expenses in expense_groups.values()
        if len(grouped_expenses) > 1
    ]

    invoice_number_groups: dict[str, list[str]] = {}

    for invoice in invoices:
        number = invoice.invoice_number.lower()

        if number not in invoice_number_groups:
            invoice_number_groups[number] = []

        invoice_number_groups[number].append(invoice.id)

    duplicate_invoice_numbers = [
        {
            "invoice_number": number,
            "invoice_ids": invoice_ids,
            "count": len(invoice_ids),
        }
        for number, invoice_ids in invoice_number_groups.items()
        if len(invoice_ids) > 1
    ]

    return {
        "flagged_expenses": flagged_expenses,
        "flagged_expenses_count": len(flagged_expenses),
        "duplicate_expense_candidates": duplicate_expense_candidates,
        "duplicate_invoice_numbers": duplicate_invoice_numbers,
        "review_items_count": (
            len(flagged_expenses)
            + len(duplicate_expense_candidates)
            + len(duplicate_invoice_numbers)
        ),
        "fraud_confirmed": False,
    }

    