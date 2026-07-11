from datetime import datetime, timezone

from supabase import Client, create_client

from app.config.settings import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from app.schemas.expenses_schema import ExpenseCreate, ExpenseResponse ,ExpenseUpdate


def get_supabase_client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing. Add it to backend-python/.env")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to backend-python/.env"
        )

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    # Creates and returns the Supabase client.


def create_expense(expense: ExpenseCreate) -> ExpenseResponse:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("expenses")
        .insert(expense.model_dump())
        .execute()
    )

    row = response.data[0]

    return ExpenseResponse(
        id=row["id"],
        category=row["category"],
        amount=float(row["amount"]),
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
            amount=float(row["amount"]),
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

    update_data = expense.model_dump(exclude_none=True)
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
        raise ValueError("Expense not found")
    # Stop if no expense was found with this ID.

    row = response.data[0]

    return ExpenseResponse(
        id=row["id"],
        category=row["category"],
        amount=float(row["amount"]),
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
        raise ValueError("Expense not found")
    # Stop if no expense was found with this ID.


# Note: This function deletes one expense from Supabase.


# Note: This file saves and reads expenses from Supabase.