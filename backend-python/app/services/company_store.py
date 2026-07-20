from __future__ import annotations

from app.schemas.company_schema import CompanySettingsResponse, CompanySettingsUpdate
from app.security.request_context import get_request_context
from app.services.supabase_client import get_supabase_client


_COMPANY_COLUMNS = (
    "id,name,legal_name,email,phone,address,country,city,currency,timezone,"
    "default_language,fiscal_year_start,tax_jurisdiction,tax_id,"
    "vat_registered,bank_name,opening_balance,balance_date,financial_settings,"
    "created_at,updated_at"
)


def get_company_settings() -> CompanySettingsResponse:
    context = get_request_context()
    response = (
        get_supabase_client()
        .table("companies")
        .select(_COMPANY_COLUMNS)
        .eq("id", context.company_id)
        .single()
        .execute()
    )
    if not response.data:
        raise LookupError("Company settings were not found.")
    return CompanySettingsResponse.model_validate(response.data)


def update_company_settings(
    settings: CompanySettingsUpdate,
) -> CompanySettingsResponse:
    context = get_request_context()
    payload = settings.model_dump(mode="json")
    response = (
        get_supabase_client()
        .table("companies")
        .update(payload)
        .eq("id", context.company_id)
        .execute()
    )
    if not response.data:
        raise LookupError("Company settings were not found.")
    return CompanySettingsResponse.model_validate(response.data[0])

