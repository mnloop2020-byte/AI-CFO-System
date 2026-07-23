from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.company_schema import (
    CompanySettingsResponse,
    CompanySettingsUpdate,
    FinancialSettings,
)


def valid_settings() -> dict[str, object]:
    return {
        "name": "Development Company",
        "business_activity": "Software services",
        "email": "finance@example.com",
        "currency": "usd",
        "timezone": "Europe/Istanbul",
        "default_language": "en",
        "fiscal_year_start": 1,
        "opening_balance": "125.50",
        "financial_settings": {},
    }


def test_financial_settings_defaults_are_stable() -> None:
    settings = FinancialSettings.model_validate({})

    assert settings.invoice_high_priority_days == 30
    assert settings.invoice_critical_days == 60
    assert settings.high_amount_threshold == 10_000
    assert settings.critical_amount_threshold == 50_000
    assert settings.cash_reserve_threshold == 75_000
    assert settings.large_expense_review_threshold == 15_000


def test_company_settings_normalizes_safe_values() -> None:
    settings = CompanySettingsUpdate.model_validate(valid_settings())

    assert settings.currency == "USD"
    assert settings.email == "finance@example.com"
    assert settings.opening_balance == Decimal("125.50")
    assert settings.business_activity == "Software services"


def test_partial_update_distinguishes_absent_from_explicit_null() -> None:
    absent = CompanySettingsUpdate.model_validate({"city": "Istanbul"})
    explicit_null = CompanySettingsUpdate.model_validate({"city": None})

    assert absent.model_dump(exclude_unset=True) == {"city": "Istanbul"}
    assert explicit_null.model_dump(exclude_unset=True) == {"city": None}


@pytest.mark.parametrize(
    "payload",
    [
        {"name": None},
        {"timezone": None},
        {"default_language": None},
        {"fiscal_year_start": None},
        {"financial_settings": None},
    ],
)
def test_partial_update_rejects_null_for_required_fields(
    payload: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        CompanySettingsUpdate.model_validate(payload)


def test_company_settings_response_applies_defaults_to_legacy_empty_json() -> None:
    response = CompanySettingsResponse.model_validate(
        {
            "id": "10000000-0000-0000-0000-000000000001",
            "name": "Development Company",
            "financial_settings": {},
            "created_at": "2026-07-20T00:00:00Z",
            "updated_at": "2026-07-20T00:00:00Z",
        }
    )

    assert response.financial_settings == FinancialSettings()


def test_company_settings_rejects_frontend_company_id() -> None:
    payload = valid_settings() | {
        "company_id": "00000000-0000-0000-0000-000000000099"
    }

    with pytest.raises(ValidationError):
        CompanySettingsUpdate.model_validate(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("currency", "US"),
        ("default_language", "tr"),
        ("fiscal_year_start", 13),
        ("email", "not-an-email"),
    ],
)
def test_company_settings_rejects_invalid_values(field: str, value: object) -> None:
    payload = valid_settings()
    payload[field] = value

    with pytest.raises(ValidationError):
        CompanySettingsUpdate.model_validate(payload)


@pytest.mark.parametrize(
    "financial_settings",
    [
        {"unknown_setting": 1},
        {"invoice_high_priority_days": 0},
        {"invoice_high_priority_days": 1.5},
        {"invoice_high_priority_days": "30"},
        {"high_amount_threshold": -1},
        {"high_amount_threshold": "10000"},
        {"high_amount_threshold": float("nan")},
        {"high_amount_threshold": float("inf")},
        {
            "invoice_high_priority_days": 60,
            "invoice_critical_days": 30,
        },
        {
            "high_amount_threshold": 50_000,
            "critical_amount_threshold": 10_000,
        },
    ],
)
def test_financial_settings_reject_invalid_payloads(
    financial_settings: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        CompanySettingsUpdate.model_validate(
            {"financial_settings": financial_settings}
        )
