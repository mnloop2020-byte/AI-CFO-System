from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.company_schema import CompanySettingsUpdate


def valid_settings() -> dict[str, object]:
    return {
        "name": "Development Company",
        "email": "finance@example.com",
        "currency": "usd",
        "timezone": "Europe/Istanbul",
        "default_language": "en",
        "fiscal_year_start": 1,
        "opening_balance": "125.50",
        "financial_settings": {},
    }


def test_company_settings_normalizes_safe_values() -> None:
    settings = CompanySettingsUpdate.model_validate(valid_settings())

    assert settings.currency == "USD"
    assert settings.email == "finance@example.com"
    assert settings.opening_balance == Decimal("125.50")


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

