from pydantic import BaseModel


class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: str | None = None
    vendor: str | None = None
    is_flagged: bool = False


class ExpenseResponse(BaseModel):
    id: str
    category: str
    amount: float
    description: str | None = None
    vendor: str | None = None
    expense_date: str | None = None
    is_flagged: bool
    created_at: str | None = None
    updated_at: str | None = None

class ExpenseUpdate(BaseModel):
    category: str | None = None
    amount: float | None = None
    description: str | None = None
    vendor: str | None = None
    is_flagged: bool | None = None


# Note: This file defines the expense request and response data shapes.