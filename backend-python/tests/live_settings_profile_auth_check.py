"""Live integration check for company settings, profile, and auth.

This script is intentionally excluded from pytest collection. It uses the
linked development project, restores company values and owner profile metadata,
and never prints credentials, access tokens, email addresses, or company data.
"""

from __future__ import annotations

import json
import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from supabase import create_client

from app.config.settings import (
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)


API_URL = os.environ.get(
    "SETTINGS_PROFILE_CHECK_API_URL",
    "http://127.0.0.1:8000",
)


def require_setting(name: str, value: str | None) -> str:
    if not value:
        raise RuntimeError(f"{name} is required for the live check")
    return value


def api_request(
    token: str | None,
    method: str,
    path: str,
    **kwargs: object,
) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.request(
        method,
        f"{API_URL}{path}",
        headers=headers,
        timeout=30,
        **kwargs,
    )


def editable_company_payload(settings: dict[str, object]) -> dict[str, object]:
    immutable = {"id", "created_at", "updated_at"}
    return {
        key: value
        for key, value in settings.items()
        if key not in immutable
    }


def main() -> None:
    url = require_setting("SUPABASE_URL", SUPABASE_URL)
    publishable_key = require_setting(
        "SUPABASE_PUBLISHABLE_KEY",
        SUPABASE_PUBLISHABLE_KEY,
    )
    service_key = require_setting(
        "SUPABASE_SERVICE_ROLE_KEY",
        SUPABASE_SERVICE_ROLE_KEY,
    )
    owner_email = require_setting(
        "BOOTSTRAP_OWNER_EMAIL",
        os.environ.get("BOOTSTRAP_OWNER_EMAIL"),
    )
    owner_password = require_setting(
        "BOOTSTRAP_OWNER_PASSWORD",
        os.environ.get("BOOTSTRAP_OWNER_PASSWORD"),
    )

    owner_client = create_client(url, publishable_key)
    owner_auth = owner_client.auth.sign_in_with_password(
        {"email": owner_email, "password": owner_password}
    )
    if owner_auth.session is None or owner_auth.user is None:
        raise RuntimeError("Owner authentication did not return a session.")
    owner_token = owner_auth.session.access_token
    original_metadata = dict(owner_auth.user.user_metadata or {})

    service_client = create_client(url, service_key)
    original_settings: dict[str, object] | None = None
    password_restored = False
    profile_restored = False

    try:
        unauthenticated = api_request(None, "GET", "/auth/me")
        assert unauthenticated.status_code == 401, unauthenticated.text

        invalid_token = api_request("invalid-token", "GET", "/auth/me")
        assert invalid_token.status_code == 401, invalid_token.text

        auth_me = api_request(owner_token, "GET", "/auth/me")
        assert auth_me.status_code == 200, auth_me.text
        identity = auth_me.json()
        assert identity["role"] == "owner"
        assert identity["company_id"]
        assert identity["company_name"]
        assert "company.read" in identity["permissions"]
        assert "company.update" in identity["permissions"]
        assert "actions.approve" in identity["permissions"]

        settings_response = api_request(
            owner_token,
            "GET",
            "/company/settings",
        )
        assert settings_response.status_code == 200, settings_response.text
        original_settings = settings_response.json()

        alternative_currency = (
            "EUR" if original_settings.get("currency") == "USD" else "USD"
        )
        original_vat = original_settings.get("vat_registered")
        alternative_vat = not original_vat if isinstance(original_vat, bool) else True
        original_fiscal_month = int(original_settings["fiscal_year_start"])
        alternative_fiscal_month = 2 if original_fiscal_month != 2 else 3
        test_settings = {
            "name": "Integration Settings Check",
            "business_activity": "Temporary integration verification activity.",
            "currency": alternative_currency,
            "vat_registered": alternative_vat,
            "fiscal_year_start": alternative_fiscal_month,
        }
        updated_settings = api_request(
            owner_token,
            "PATCH",
            "/company/settings",
            json=test_settings,
        )
        assert updated_settings.status_code == 200, updated_settings.text
        updated_payload = updated_settings.json()
        for field, expected in test_settings.items():
            assert updated_payload[field] == expected

        invalid_payloads = (
            {"currency": "US"},
            {"fiscal_year_start": 13},
            {"company_id": "00000000-0000-0000-0000-000000000099"},
            {
                "financial_settings": {
                    "invoice_high_priority_days": 60,
                    "invoice_critical_days": 30,
                }
            },
        )
        for invalid_payload in invalid_payloads:
            rejected = api_request(
                owner_token,
                "PATCH",
                "/company/settings",
                json=invalid_payload,
            )
            assert rejected.status_code == 422, rejected.text

        role_password = f"SettingsCheck!{secrets.token_urlsafe(18)}Aa1"
        auth_users_by_id = {
            str(user.id): user
            for user in service_client.auth.admin.list_users()
        }
        viewer_members = (
            service_client.table("company_members")
            .select("user_id")
            .eq("company_id", identity["company_id"])
            .eq("role", "viewer")
            .execute()
            .data
            or []
        )
        assert viewer_members
        viewer_user = auth_users_by_id[str(viewer_members[0]["user_id"])]
        assert viewer_user.email
        service_client.auth.admin.update_user_by_id(
            str(viewer_user.id),
            {"password": role_password},
        )
        viewer_auth = create_client(url, publishable_key).auth.sign_in_with_password(
            {"email": viewer_user.email, "password": role_password}
        )
        assert viewer_auth.session is not None
        viewer_token = viewer_auth.session.access_token
        assert (
            api_request(viewer_token, "GET", "/company/settings").status_code
            == 200
        )
        assert (
            api_request(
                viewer_token,
                "PATCH",
                "/company/settings",
                json={"name": "Viewer must not update"},
            ).status_code
            == 403
        )

        test_name = "AI CFO Integration Owner"
        test_avatar = "https://example.com/ai-cfo-profile-check.png"
        profile_update = owner_client.auth.update_user(
            {
                "data": {
                    "full_name": test_name,
                    "avatar_url": test_avatar,
                }
            }
        )
        assert profile_update.user is not None
        assert profile_update.user.user_metadata.get("full_name") == test_name
        assert profile_update.user.user_metadata.get("avatar_url") == test_avatar

        temporary_password = f"ProfileCheck!{secrets.token_urlsafe(20)}Aa1"
        password_update = owner_client.auth.update_user(
            {"password": temporary_password}
        )
        assert password_update.user is not None
        changed_sign_in = create_client(
            url,
            publishable_key,
        ).auth.sign_in_with_password(
            {"email": owner_email, "password": temporary_password}
        )
        assert changed_sign_in.session is not None

        restored_password = changed_sign_in.session
        restoring_client = create_client(url, publishable_key)
        restoring_client.auth.set_session(
            restored_password.access_token,
            restored_password.refresh_token,
        )
        restore_password_response = restoring_client.auth.update_user(
            {"password": owner_password}
        )
        assert restore_password_response.user is not None
        password_restored = True

        restored_metadata = {
            "full_name": original_metadata.get("full_name"),
            "avatar_url": original_metadata.get("avatar_url"),
        }
        restore_profile_response = restoring_client.auth.update_user(
            {"data": restored_metadata}
        )
        assert restore_profile_response.user is not None
        profile_restored = True

        restored_sign_in = create_client(
            url,
            publishable_key,
        ).auth.sign_in_with_password(
            {"email": owner_email, "password": owner_password}
        )
        assert restored_sign_in.session is not None
    finally:
        cleanup_errors: list[str] = []
        if not password_restored:
            owner_user = next(
                (
                    user
                    for user in service_client.auth.admin.list_users()
                    if (user.email or "").lower() == owner_email.lower()
                ),
                None,
            )
            if owner_user is not None:
                service_client.auth.admin.update_user_by_id(
                    str(owner_user.id),
                    {"password": owner_password},
                )
        current_auth = create_client(
            url,
            publishable_key,
        ).auth.sign_in_with_password(
            {"email": owner_email, "password": owner_password}
        )
        if current_auth.session is None:
            cleanup_errors.append("Owner session could not be restored.")
        else:
            if original_settings is not None:
                restored = api_request(
                    current_auth.session.access_token,
                    "PATCH",
                    "/company/settings",
                    json=editable_company_payload(original_settings),
                )
                if restored.status_code != 200:
                    cleanup_errors.append(
                        "Original company settings could not be restored."
                    )
            if not profile_restored:
                current_client = create_client(url, publishable_key)
                current_client.auth.set_session(
                    current_auth.session.access_token,
                    current_auth.session.refresh_token,
                )
                current_client.auth.update_user(
                    {
                        "data": {
                            "full_name": original_metadata.get("full_name"),
                            "avatar_url": original_metadata.get("avatar_url"),
                        }
                    }
                )
        if cleanup_errors:
            raise RuntimeError(" ".join(cleanup_errors))

    print(
        json.dumps(
            {
                "settings_read_and_update": "passed",
                "settings_original_values_restored": "passed",
                "invalid_settings_rejected": "passed",
                "viewer_settings_read_only": "passed",
                "auth_me_identity_company_role_permissions": "passed",
                "missing_and_invalid_tokens_rejected": "passed",
                "profile_name_and_avatar_metadata": "passed",
                "password_change_and_restore": "passed",
                "secrets_printed": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
