from fastapi import APIRouter, Body, Depends, HTTPException
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.schemas.expenses_schema import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services.store_errors import RecordNotFoundError
from app.services.expenses_store import (
    create_expense,
    delete_expense,
    get_expenses,
    update_expense,
    delete_expense
)
router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("", response_model=ExpenseResponse)
def add_expense(
    expense: ExpenseCreate,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    new_expense = create_expense(expense)

    return new_expense
    # Create a new expense and return it.


@router.get("", response_model=list[ExpenseResponse])
def list_expenses(
    _: RequestContext = Depends(require_permission("financial.read")),
):
    expenses = get_expenses()

    return expenses
    # Get all expenses from Supabase.
@router.patch("/{expense_id}", response_model=ExpenseResponse)
def edit_expense(
    expense_id: str,
    expense: ExpenseUpdate = Body(...),
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        updated_expense = update_expense(
            expense_id=expense_id,
            expense=expense,
        )

        return updated_expense
        # Update one expense and return it.

    except RecordNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Expense not found",
        )
        # Return 404 if the expense ID does not exist.

@router.delete("/{expense_id}")
def remove_expense(
    expense_id: str,
    _: RequestContext = Depends(require_permission("financial.write")),
):
    try:
        delete_expense(expense_id)

        return {
            "message": "Expense deleted successfully",
            "expense_id": expense_id,
        }
        # Delete one expense and return a success message.

    except RecordNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Expense not found",
        )
        # Return 404 if the expense ID does not exist.


# Note: This route file handles expenses API requests.
