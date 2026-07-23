from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


_DAY_SETTING_FIELDS = (
    "invoice_high_priority_days",
    "invoice_critical_days",
)
_AMOUNT_SETTING_FIELDS = (
    "high_amount_threshold",
    "critical_amount_threshold",
    "cash_reserve_threshold",
    "large_expense_review_threshold",
)
_NORMALIZED_TEXT_FIELDS = (
    "name",
    "legal_name",
    "business_activity",
    "phone",
    "address",
    "country",
    "city",
    "timezone",
    "tax_jurisdiction",
    "tax_id",
    "bank_name",
)


def _validate_day_setting(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("Alert day thresholds must be positive integers.")
    return value


def _validate_amount_setting(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("Financial alert thresholds must be numeric.")
    numeric = Decimal(str(value))
    if not numeric.is_finite() or numeric < 0:
        raise ValueError("Financial alert thresholds must be finite and non-negative.")
    return float(numeric)


def _normalize_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    normalized = value.strip()
    return normalized or None


def _normalize_email(value: str | None) -> str | None:
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


class FinancialSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invoice_high_priority_days: int = 30
    invoice_critical_days: int = 60
    high_amount_threshold: float = 10_000.0
    critical_amount_threshold: float = 50_000.0
    cash_reserve_threshold: float = 75_000.0
    large_expense_review_threshold: float = 15_000.0

    @field_validator(*_DAY_SETTING_FIELDS, mode="before")
    @classmethod
    def validate_day_settings(cls, value: object) -> int:
        return _validate_day_setting(value)

    @field_validator(*_AMOUNT_SETTING_FIELDS, mode="before")
    @classmethod
    def validate_amount_settings(cls, value: object) -> float:
        return _validate_amount_setting(value)

    @model_validator(mode="after")
    def validate_threshold_order(self) -> FinancialSettings:
        if self.invoice_critical_days <= self.invoice_high_priority_days:
            raise ValueError(
                "Critical invoice days must exceed high-priority invoice days."
            )
        if self.critical_amount_threshold <= self.high_amount_threshold:
            raise ValueError(
                "Critical amount threshold must exceed high amount threshold."
            )
        return self


class FinancialSettingsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invoice_high_priority_days: int | None = None
    invoice_critical_days: int | None = None
    high_amount_threshold: float | None = None
    critical_amount_threshold: float | None = None
    cash_reserve_threshold: float | None = None
    large_expense_review_threshold: float | None = None

    @field_validator(*_DAY_SETTING_FIELDS, mode="before")
    @classmethod
    def validate_day_settings(cls, value: object) -> int:
        return _validate_day_setting(value)

    @field_validator(*_AMOUNT_SETTING_FIELDS, mode="before")
    @classmethod
    def validate_amount_settings(cls, value: object) -> float:
        return _validate_amount_setting(value)

    @model_validator(mode="after")
    def validate_threshold_order_when_complete(self) -> FinancialSettingsPatch:
        if (
            self.invoice_high_priority_days is not None
            and self.invoice_critical_days is not None
            and self.invoice_critical_days <= self.invoice_high_priority_days
        ):
            raise ValueError(
                "Critical invoice days must exceed high-priority invoice days."
            )
        if (
            self.high_amount_threshold is not None
            and self.critical_amount_threshold is not None
            and self.critical_amount_threshold <= self.high_amount_threshold
        ):
            raise ValueError(
                "Critical amount threshold must exceed high amount threshold."
            )
        return self


class CompanySettingsBase(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    legal_name: str | None = Field(default=None, max_length=200)
    business_activity: str | None = Field(default=None, max_length=500)
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
        allow_inf_nan=False,
    )
    balance_date: date | None = None
    financial_settings: FinancialSettings = Field(default_factory=FinancialSettings)

    @field_validator(*_NORMALIZED_TEXT_FIELDS, mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> object:
        return _normalize_text(value)

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
        return _normalize_email(value)


class CompanySettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=160)
    legal_name: str | None = Field(default=None, max_length=200)
    business_activity: str | None = Field(default=None, max_length=500)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    country: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    timezone: str | None = Field(default=None, min_length=1, max_length=100)
    default_language: Literal["en", "ar"] | None = None
    fiscal_year_start: int | None = Field(default=None, ge=1, le=12)
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
        allow_inf_nan=False,
    )
    balance_date: date | None = None
    financial_settings: FinancialSettingsPatch | None = None

    @field_validator(*_NORMALIZED_TEXT_FIELDS, mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> object:
        return _normalize_text(value)

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
        return _normalize_email(value)

    @model_validator(mode="after")
    def reject_null_for_non_nullable_fields(self) -> CompanySettingsUpdate:
        for field_name in (
            "name",
            "timezone",
            "default_language",
            "fiscal_year_start",
            "financial_settings",
        ):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self


class CompanySettingsResponse(CompanySettingsBase):
    id: str
    created_at: datetime
    updated_at: datetime
