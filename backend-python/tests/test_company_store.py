from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.company_schema import CompanySettingsUpdate
from app.services import company_store


COMPANY_ID = "10000000-0000-0000-0000-000000000001"


class FakeCompanyQuery:
    def __init__(self) -> None:
        self.updated_payload: dict[str, object] | None = None
        self.mode = "select"
        self.company = {
            "id": COMPANY_ID,
            "name": "Development Company",
            "city": "Old City",
            "financial_settings": {
                "invoice_high_priority_days": 30,
                "invoice_critical_days": 60,
                "high_amount_threshold": 10000,
                "critical_amount_threshold": 50000,
                "cash_reserve_threshold": 75000,
                "large_expense_review_threshold": 15000,
            },
            "created_at": "2026-07-20T00:00:00Z",
            "updated_at": "2026-07-20T00:00:00Z",
        }

    def table(self, table_name: str) -> "FakeCompanyQuery":
        assert table_name == "companies"
        return self

    def select(self, _columns: str) -> "FakeCompanyQuery":
        self.mode = "select"
        return self

    def update(self, payload: dict[str, object]) -> "FakeCompanyQuery":
        self.mode = "update"
        self.updated_payload = payload
        return self

    def eq(self, field: str, value: str) -> "FakeCompanyQuery":
        assert field == "id"
        assert value == COMPANY_ID
        return self

    def single(self) -> "FakeCompanyQuery":
        return self

    def execute(self) -> SimpleNamespace:
        if self.mode == "select":
            return SimpleNamespace(data=self.company)
        assert self.updated_payload is not None
        return SimpleNamespace(data=[self.company | self.updated_payload])


def _install_fake_store(monkeypatch) -> FakeCompanyQuery:
    query = FakeCompanyQuery()
    monkeypatch.setattr(
        company_store,
        "get_request_context",
        lambda: SimpleNamespace(company_id=COMPANY_ID),
    )
    monkeypatch.setattr(company_store, "get_supabase_client", lambda: query)
    return query


def test_store_sends_only_fields_present_in_partial_update(monkeypatch) -> None:
    query = _install_fake_store(monkeypatch)

    response = company_store.update_company_settings(
        CompanySettingsUpdate.model_validate({"city": None})
    )

    assert query.updated_payload == {"city": None}
    assert "company_id" not in query.updated_payload
    assert response.city is None


def test_store_merges_partial_financial_settings_with_existing_values(
    monkeypatch,
) -> None:
    query = _install_fake_store(monkeypatch)

    response = company_store.update_company_settings(
        CompanySettingsUpdate.model_validate(
            {"financial_settings": {"invoice_high_priority_days": 45}}
        )
    )

    assert query.updated_payload is not None
    assert query.updated_payload["financial_settings"] == {
        "invoice_high_priority_days": 45,
        "invoice_critical_days": 60,
        "high_amount_threshold": 10000.0,
        "critical_amount_threshold": 50000.0,
        "cash_reserve_threshold": 75000.0,
        "large_expense_review_threshold": 15000.0,
    }
    assert response.financial_settings.invoice_high_priority_days == 45


def test_empty_partial_update_does_not_issue_database_update(monkeypatch) -> None:
    query = _install_fake_store(monkeypatch)

    company_store.update_company_settings(CompanySettingsUpdate())

    assert query.updated_payload is None


def test_partial_financial_update_is_validated_against_existing_values(
    monkeypatch,
) -> None:
    query = _install_fake_store(monkeypatch)

    with pytest.raises(ValidationError):
        company_store.update_company_settings(
            CompanySettingsUpdate.model_validate(
                {"financial_settings": {"high_amount_threshold": 60_000}}
            )
        )

    assert query.updated_payload is None
