from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ExpenseInput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )

    @field_validator("expense_date", check_fields=False)
    @classmethod
    def validate_expense_date(cls, value: str | None) -> str | None:
        if not value:
            return None
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


class ExpenseCreate(ExpenseInput):
    category: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0, le=1_000_000_000)
    description: str | None = Field(default=None, max_length=4000)
    vendor: str | None = Field(default=None, max_length=200)
    expense_date: str | None = None
    is_flagged: bool = False


class ExpenseUpdate(ExpenseInput):
    category: str | None = Field(default=None, min_length=1, max_length=100)
    amount: float | None = Field(default=None, gt=0, le=1_000_000_000)
    description: str | None = Field(default=None, max_length=4000)
    vendor: str | None = Field(default=None, max_length=200)
    expense_date: str | None = None
    is_flagged: bool | None = None


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
