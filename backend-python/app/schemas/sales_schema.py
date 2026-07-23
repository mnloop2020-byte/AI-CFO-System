from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


SaleStatus = Literal["completed", "pending", "refunded", "cancelled"]


class SaleInput(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
        allow_inf_nan=False,
    )

    @field_validator("status", mode="before", check_fields=False)
    @classmethod
    def normalize_status(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("sale_date", check_fields=False)
    @classmethod
    def validate_sale_date(cls, value: str | None) -> str | None:
        if not value:
            return None
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


class SaleCreate(SaleInput):
    customer_id: str | None = None
    product_name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(gt=0, le=1_000_000)
    unit_price: float = Field(ge=0, le=1_000_000_000)
    status: SaleStatus = "completed"
    sale_date: str | None = None


class SaleUpdate(SaleInput):
    customer_id: str | None = None
    product_name: str | None = Field(default=None, min_length=1, max_length=200)
    quantity: int | None = Field(default=None, gt=0, le=1_000_000)
    unit_price: float | None = Field(default=None, ge=0, le=1_000_000_000)
    status: SaleStatus | None = None
    sale_date: str | None = None


class SaleResponse(BaseModel):
    id: str
    customer_id: str | None = None
    product_name: str
    quantity: int
    unit_price: float
    total_amount: float
    status: str
    sale_date: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
