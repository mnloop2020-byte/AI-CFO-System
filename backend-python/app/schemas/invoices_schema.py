from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.money import MAX_STANDARD_MONEY, MoneyDecimal


InvoiceStatus = Literal["paid", "unpaid", "overdue", "cancelled"]


class InvoiceInput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )

    @field_validator("status", mode="before", check_fields=False)
    @classmethod
    def normalize_status(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("due_date", check_fields=False)
    @classmethod
    def validate_due_date(cls, value: str | None) -> str | None:
        if not value:
            return None
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value

    @field_validator("vat_amount", check_fields=False)
    @classmethod
    def validate_vat_not_above_total(cls, value: Decimal, info) -> Decimal:
        total = info.data.get("total_amount")
        if total is not None and value > total:
            raise ValueError("VAT amount cannot exceed total amount.")
        return value


class InvoiceCreate(InvoiceInput):
    customer_id: str | None = None
    invoice_number: str = Field(min_length=1, max_length=100)
    total_amount: MoneyDecimal = Field(
        ge=Decimal("0"),
        le=MAX_STANDARD_MONEY,
    )
    vat_amount: MoneyDecimal = Field(
        default=Decimal("0.00"),
        ge=Decimal("0"),
        le=MAX_STANDARD_MONEY,
    )
    status: InvoiceStatus = "unpaid"
    due_date: str | None = None


class InvoiceUpdate(InvoiceInput):
    customer_id: str | None = None
    invoice_number: str | None = Field(default=None, min_length=1, max_length=100)
    total_amount: MoneyDecimal | None = Field(
        default=None,
        ge=Decimal("0"),
        le=MAX_STANDARD_MONEY,
    )
    vat_amount: MoneyDecimal | None = Field(
        default=None,
        ge=Decimal("0"),
        le=MAX_STANDARD_MONEY,
    )
    status: InvoiceStatus | None = None
    due_date: str | None = None


class InvoiceResponse(BaseModel):
    id: str
    customer_id: str | None = None
    invoice_number: str
    total_amount: MoneyDecimal
    vat_amount: MoneyDecimal
    status: str
    due_date: str | None = None
    file_url: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class InvoicePdfRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Literal["en", "ar"] = "en"


class InvoicePdfDownload(BaseModel):
    url: str
    file_name: str
    expires_at: datetime
    generated: bool


class InvoiceEmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Literal["en", "ar"] = "en"


class InvoiceEmailResult(BaseModel):
    status: Literal["sent"]
    message: str
