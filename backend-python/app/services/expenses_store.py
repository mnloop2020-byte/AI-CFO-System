from datetime import datetime, timezone

from app.money import parse_money
from app.schemas.expenses_schema import ExpenseCreate, ExpenseResponse ,ExpenseUpdate
from app.services.supabase_client import get_supabase_client
from app.services.store_errors import RecordNotFoundError


def create_expense(expense: ExpenseCreate) -> ExpenseResponse:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("expenses")
        .insert(expense.model_dump(mode="json"))
        .execute()
    )

    row = response.data[0]

    return ExpenseResponse(
        id=row["id"],
        category=row["category"],
        amount=parse_money(row["amount"]),
        description=row.get("description"),
        vendor=row.get("vendor"),
        expense_date=row.get("expense_date"),
        is_flagged=row["is_flagged"],
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Creates a new expense in Supabase and returns it.


def get_expenses() -> list[ExpenseResponse]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("expenses")
        .select(
            "id, category, amount, description, vendor, expense_date, is_flagged, created_at, updated_at"
        )
        .order("expense_date", desc=True)
        .execute()
    )

    return [
        ExpenseResponse(
            id=row["id"],
            category=row["category"],
            amount=parse_money(row["amount"]),
            description=row.get("description"),
            vendor=row.get("vendor"),
            expense_date=row.get("expense_date"),
            is_flagged=row["is_flagged"],
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in response.data
    ]
    # Gets all expenses from Supabase.

def update_expense(
    expense_id: str,
    expense: ExpenseUpdate,
) -> ExpenseResponse:
    supabase = get_supabase_client()

    update_data = expense.model_dump(mode="json", exclude_none=True)
    # Keep only the fields the user wants to update.

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Update the last modified time.

    response = (
        supabase
        .table("expenses")
        .update(update_data)
        .eq("id", expense_id)
        .execute()
    )

    if not response.data:
        raise RecordNotFoundError("Expense not found")
    # Stop if no expense was found with this ID.

    row = response.data[0]

    return ExpenseResponse(
        id=row["id"],
        category=row["category"],
        amount=parse_money(row["amount"]),
        description=row.get("description"),
        vendor=row.get("vendor"),
        expense_date=row.get("expense_date"),
        is_flagged=row["is_flagged"],
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )
    # Updates one expense in Supabase and returns the updated expense.

def delete_expense(expense_id: str) -> None:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("expenses")
        .delete()
        .eq("id", expense_id)
        .execute()
    )

    if not response.data:
        raise RecordNotFoundError("Expense not found")
    # Stop if no expense was found with this ID.


# Note: This function deletes one expense from Supabase.


# Note: This file saves and reads expenses from Supabase.
