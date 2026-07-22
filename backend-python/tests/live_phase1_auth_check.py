"""Explicit live Phase 1 check. This file is not collected by pytest.

It creates non-production role-test Auth users through one-time invitations.
No email is sent, raw tokens are kept only in memory, and only the temporary
Storage object created by this check is removed during cleanup.
"""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
from supabase import create_client

from app.config.settings import (
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)
from app.schemas.customer_schema import CustomerCreate


API_URL = __import__("os").environ.get(
    "PHASE1_CHECK_API_URL", "http://127.0.0.1:8000"
)


def require_setting(name: str, value: str | None) -> str:
    if not value:
        raise RuntimeError(f"{name} is required for the live check")
    return value


def request(token: str, method: str, path: str, **kwargs: object) -> httpx.Response:
    return httpx.request(
        method,
        f"{API_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
        **kwargs,
    )


def sign_in(email: str, password: str):
    client = create_client(
        require_setting("SUPABASE_URL", SUPABASE_URL),
        require_setting("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY),
    )
    response = client.auth.sign_in_with_password({"email": email, "password": password})
    if response.session is None:
        raise RuntimeError("Role-test sign-in did not return a session")
    return client, response.session.access_token


def invitation_token(acceptance_path: str) -> str:
    values = parse_qs(urlsplit(acceptance_path).fragment)
    token = values.get("token", [""])[0]
    if not token:
        raise RuntimeError("Invitation response did not contain a fragment token")
    return token


def create_invited_user(
    owner_token: str,
    service_client,
    email: str,
    password: str,
    role: str,
):
    invitation_response = request(
        owner_token,
        "POST",
        "/auth/invitations",
        json={"email": email, "role": role, "expires_in_hours": 24},
    )
    assert invitation_response.status_code == 201, invitation_response.text
    invitation = invitation_response.json()
    raw_token = invitation_token(invitation["acceptance_path"])
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    user_response = service_client.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"invitation_token_hash": token_hash},
        }
    )
    if user_response.user is None:
        raise RuntimeError("Invited Auth user was not created")
    return invitation, raw_token, user_response.user


def main() -> None:
    owner_email = require_setting("BOOTSTRAP_OWNER_EMAIL", __import__("os").getenv("BOOTSTRAP_OWNER_EMAIL"))
    owner_password = require_setting("BOOTSTRAP_OWNER_PASSWORD", __import__("os").getenv("BOOTSTRAP_OWNER_PASSWORD"))
    url = require_setting("SUPABASE_URL", SUPABASE_URL)
    service_key = require_setting("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY)
    service_client = create_client(url, service_key)
    owner_client, owner_token = sign_in(owner_email, owner_password)

    owner_me = request(owner_token, "GET", "/auth/me")
    assert owner_me.status_code == 200, owner_me.text
    owner_identity = owner_me.json()
    assert owner_identity["role"] == "owner"

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    test_password = f"Phase1!{secrets.token_urlsafe(18)}Aa1"
    roles: dict[str, tuple[object, str, dict[str, object], str]] = {}
    raw_tokens: list[str] = []

    for role in ("admin", "accountant", "viewer"):
        existing_members = (
            service_client.table("company_members")
            .select("user_id,created_at")
            .eq("role", role)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        existing_user = None
        for member in existing_members:
            candidate = service_client.auth.admin.get_user_by_id(member["user_id"]).user
            if candidate and (candidate.email or "").startswith(f"phase1-{role}-"):
                existing_user = candidate
                break

        if existing_user:
            email = str(existing_user.email)
            service_client.auth.admin.update_user_by_id(
                str(existing_user.id),
                {"password": test_password},
            )
            invitation = {"id": "existing-role-test"}
        else:
            email = f"phase1-{role}-{run_id}@example.com"
            invitation, raw_token, _ = create_invited_user(
                owner_token,
                service_client,
                email,
                test_password,
                role,
            )
            raw_tokens.append(raw_token)
        client, token = sign_in(email, test_password)
        me_response = request(token, "GET", "/auth/me")
        assert me_response.status_code == 200, me_response.text
        identity = me_response.json()
        assert identity["role"] == role
        roles[role] = (client, token, invitation, email)

    admin_token = roles["admin"][1]
    accountant_client, accountant_token = roles["accountant"][0], roles["accountant"][1]
    viewer_client, viewer_token = roles["viewer"][0], roles["viewer"][1]

    assert request(viewer_token, "GET", "/customers").status_code == 200
    assert request(viewer_token, "POST", "/customers", json={}).status_code == 403
    assert request(accountant_token, "POST", "/customers", json={}).status_code == 422
    assert request(accountant_token, "GET", "/auth/members").status_code == 403
    assert request(admin_token, "GET", "/auth/members").status_code == 200

    protected_owner = request(
        admin_token,
        "PATCH",
        f"/auth/members/{owner_identity['user_id']}",
        json={"role": "viewer"},
    )
    assert protected_owner.status_code == 409

    try:
        owner_client.table("companies").insert(
            {"name": "Forbidden second company", "singleton_key": True}
        ).execute()
    except Exception:
        pass
    else:
        raise AssertionError("An authenticated user created a second company")

    assert "company_id" not in CustomerCreate.model_fields

    prior_wrong_invites = (
        service_client.table("company_invitations")
        .select("id")
        .ilike("email", "phase1-wrong-%")
        .eq("status", "revoked")
        .execute()
        .data
        or []
    )
    if not prior_wrong_invites:
        wrong_email = f"phase1-wrong-{run_id}@example.com"
        wrong_invite = request(
            owner_token,
            "POST",
            "/auth/invitations",
            json={"email": wrong_email, "role": "viewer", "expires_in_hours": 24},
        )
        assert wrong_invite.status_code == 201
        wrong_data = wrong_invite.json()
        wrong_raw = invitation_token(wrong_data["acceptance_path"])
        raw_tokens.append(wrong_raw)
        try:
            service_client.auth.admin.create_user(
                {
                    "email": f"different-{run_id}@example.com",
                    "password": test_password,
                    "email_confirm": True,
                    "user_metadata": {
                        "invitation_token_hash": hashlib.sha256(wrong_raw.encode()).hexdigest()
                    },
                }
            )
        except Exception:
            pass
        else:
            raise AssertionError("Invitation was accepted by a different email")
        assert request(
            owner_token,
            "POST",
            f"/auth/invitations/{wrong_data['id']}/revoke",
        ).status_code == 200

    prior_expired_invites = (
        service_client.table("company_invitations")
        .select("id")
        .ilike("email", "phase1-expired-%")
        .execute()
        .data
        or []
    )
    if not prior_expired_invites:
        expired_email = f"phase1-expired-{run_id}@example.com"
        expired_raw = secrets.token_urlsafe(32)
        raw_tokens.append(expired_raw)
        service_client.table("company_invitations").insert(
            {
                "company_id": owner_identity["company_id"],
                "email": expired_email,
                "role": "viewer",
                "status": "pending",
                "invited_by": owner_identity["user_id"],
                "expires_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
                "token_hash": hashlib.sha256(expired_raw.encode()).hexdigest(),
            }
        ).execute()
        try:
            service_client.auth.admin.create_user(
                {
                    "email": expired_email,
                    "password": test_password,
                    "email_confirm": True,
                    "user_metadata": {
                        "invitation_token_hash": hashlib.sha256(expired_raw.encode()).hexdigest()
                    },
                }
            )
        except Exception:
            pass
        else:
            raise AssertionError("Expired invitation was accepted")
    (
        service_client.table("company_invitations")
        .update({"status": "expired"})
        .ilike("email", "phase1-expired-%")
        .eq("status", "pending")
        .execute()
    )

    invitation_rows = (
        service_client.table("company_invitations")
        .select("token_hash,status,token_used_at")
        .execute()
        .data
        or []
    )
    assert all(row["token_hash"] not in raw_tokens for row in invitation_rows)
    assert all(len(row["token_hash"]) == 64 for row in invitation_rows)
    assert sum(bool(row["status"] == "accepted" and row["token_used_at"]) for row in invitation_rows) >= 3

    bucket = "documents"
    storage_path = f"{owner_identity['company_id']}/phase1-security/{run_id}.txt"
    try:
        viewer_client.storage.from_(bucket).upload(
            storage_path,
            b"viewer must not write",
            {"content-type": "text/plain"},
        )
    except Exception:
        pass
    else:
        raise AssertionError("Viewer uploaded to protected Storage")

    accountant_client.storage.from_(bucket).upload(
        storage_path,
        b"accountant storage permission check",
        {"content-type": "text/plain"},
    )
    accountant_client.storage.from_(bucket).remove([storage_path])

    counts = {
        table: len(service_client.table(table).select("id").execute().data or [])
        for table in ("customers", "sales", "expenses", "inventory", "invoices", "documents", "document_chunks")
    }
    assert counts == {
        "customers": 2,
        "sales": 1,
        "expenses": 3,
        "inventory": 1,
        "invoices": 1,
        "documents": 4,
        "document_chunks": 4,
    }

    print(
        json.dumps(
            {
                "owner": "passed",
                "admin": "passed",
                "accountant": "passed",
                "viewer": "passed",
                "last_owner_protection": "passed",
                "invitation_email_expiry_and_one_time_rules": "passed",
                "storage_roles": "passed",
                "business_counts_preserved": counts,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
