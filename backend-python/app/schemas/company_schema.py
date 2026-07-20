from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CompanySettingsBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    legal_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    country: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    timezone: str = Field(default="UTC", min_length=1, max_length=100)
    default_language: Literal["en", "ar"] = "en"
    fiscal_year_start: int = Field(default=1, ge=1, le=12)
    tax_jurisdiction: str | None = Field(default=None, max_length=160)
    tax_id: str | None = Field(default=None, max_length=100)
    vat_registered: bool | None = None
    bank_name: str | None = Field(default=None, max_length=160)
    opening_balance: Decimal | None = Field(
        default=None,
        ge=Decimal("-9999999999999999.99"),
        le=Decimal("9999999999999999.99"),
        max_digits=18,
        decimal_places=2,
    )
    balance_date: date | None = None
    financial_settings: dict[str, Any] = Field(default_factory=dict)

    @field_validator(
        "name",
        "legal_name",
        "phone",
        "address",
        "country",
        "city",
        "timezone",
        "tax_jurisdiction",
        "tax_id",
        "bank_name",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str | None) -> str:
        if not value:
            raise ValueError("Company name is required.")
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip().upper()
        return normalized or None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if (
            not normalized
            or normalized.count("@") != 1
            or "." not in normalized.rsplit("@", 1)[1]
            or any(character.isspace() for character in normalized)
        ):
            raise ValueError("A valid business email is required.")
        return normalized

    @field_validator("financial_settings")
    @classmethod
    def limit_financial_settings(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 25:
            raise ValueError("Too many financial settings were provided.")
        return value


class CompanySettingsUpdate(CompanySettingsBase):
    model_config = ConfigDict(extra="forbid")


class CompanySettingsResponse(CompanySettingsBase):
    id: str
    created_at: datetime
    updated_at: datetime
