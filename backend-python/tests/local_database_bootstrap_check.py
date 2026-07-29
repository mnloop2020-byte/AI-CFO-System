"""Local-only migration, RLS/RBAC, Storage, and backend CRUD smoke test.

The script refuses every database/API host except localhost. It creates only
disposable Supabase Local users and records. A subsequent local database reset
removes them.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient
from supabase import Client, create_client


LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def require_local_url(name: str) -> str:
    value = os.environ.get(name, "")
    parsed = urlparse(value)
    if parsed.hostname not in LOCAL_HOSTS:
        raise RuntimeError(f"{name} must point to Supabase Local.")
    return value


def require_setting(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"{name} is required for the local test.")
    return value


API_URL = require_local_url("LOCAL_SUPABASE_URL")
DB_URL = require_local_url("LOCAL_SUPABASE_DB_URL")
PUBLISHABLE_KEY = require_setting("LOCAL_SUPABASE_PUBLISHABLE_KEY")
SERVICE_ROLE_KEY = require_setting("LOCAL_SUPABASE_SERVICE_ROLE_KEY")

os.environ["SUPABASE_URL"] = API_URL
os.environ["SUPABASE_PUBLISHABLE_KEY"] = PUBLISHABLE_KEY
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_ROLE_KEY

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def user_client(token: str) -> Client:
    client = create_client(API_URL, PUBLISHABLE_KEY)
    client.options.headers["Authorization"] = f"Bearer {token}"
    return client


def sign_up(
    client: Client,
    *,
    email: str,
    password: str,
    metadata: dict[str, str] | None = None,
) -> tuple[str, str]:
    response = client.auth.sign_up(
        {
            "email": email,
            "password": password,
            "options": {"data": metadata or {}},
        }
    )
    if response.user is None or response.session is None:
        raise AssertionError(f"Local sign-up did not create a session for {email}.")
    return str(response.user.id), response.session.access_token


def invite_role(
    api: TestClient,
    owner_token: str,
    *,
    role: str,
    email: str,
    password: str,
) -> tuple[str, str]:
    invitation = api.post(
        "/auth/invitations",
        headers=bearer(owner_token),
        json={"email": email, "role": role, "expires_in_hours": 24},
    )
    assert invitation.status_code == 201, invitation.text
    raw_token = invitation.json()["acceptance_path"].split("#token=", 1)[1]
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return sign_up(
        create_client(API_URL, PUBLISHABLE_KEY),
        email=email,
        password=password,
        metadata={"invitation_token_hash": token_hash},
    )


def expect_supabase_failure(operation, label: str) -> None:
    try:
        operation()
    except Exception:
        return
    raise AssertionError(f"Expected Supabase to reject: {label}")


def schema_fingerprint(connection: psycopg.Connection) -> str:
    catalog_query = """
        select jsonb_build_object(
            'columns', (
                select jsonb_agg(to_jsonb(columns_row) order by
                    columns_row.table_schema,
                    columns_row.table_name,
                    columns_row.ordinal_position
                )
                from (
                    select
                        table_schema,
                        table_name,
                        ordinal_position,
                        column_name,
                        data_type,
                        udt_name,
                        is_nullable,
                        column_default,
                        numeric_precision,
                        numeric_scale
                    from information_schema.columns
                    where table_schema in ('public', 'private')
                ) as columns_row
            ),
            'constraints', (
                select jsonb_agg(to_jsonb(constraints_row) order by
                    constraints_row.schema_name,
                    constraints_row.table_name,
                    constraints_row.constraint_name
                )
                from (
                    select
                        namespace.nspname as schema_name,
                        class.relname as table_name,
                        constraint_record.conname as constraint_name,
                        constraint_record.contype as constraint_type,
                        pg_get_constraintdef(constraint_record.oid, true) as definition
                    from pg_constraint as constraint_record
                    join pg_class as class
                      on class.oid = constraint_record.conrelid
                    join pg_namespace as namespace
                      on namespace.oid = class.relnamespace
                    where namespace.nspname in ('public', 'private')
                ) as constraints_row
            ),
            'indexes', (
                select jsonb_agg(to_jsonb(indexes_row) order by
                    indexes_row.schemaname,
                    indexes_row.tablename,
                    indexes_row.indexname
                )
                from (
                    select schemaname, tablename, indexname, indexdef
                    from pg_indexes
                    where schemaname in ('public', 'private')
                ) as indexes_row
            ),
            'policies', (
                select jsonb_agg(to_jsonb(policies_row) order by
                    policies_row.schemaname,
                    policies_row.tablename,
                    policies_row.policyname
                )
                from (
                    select
                        schemaname,
                        tablename,
                        policyname,
                        permissive,
                        roles,
                        cmd,
                        qual,
                        with_check
                    from pg_policies
                    where schemaname in ('public', 'storage')
                ) as policies_row
            )
        )
    """
    catalog = connection.execute(catalog_query).fetchone()[0]
    normalized = json.dumps(catalog, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def main() -> None:
    run_id = uuid4().hex[:12]
    password = f"Local-{run_id}-Aa1!"
    owner_email = f"owner-{run_id}@local.test"
    bootstrap_token = f"bootstrap-{uuid4().hex}-{uuid4().hex}"

    service = create_client(API_URL, SERVICE_ROLE_KEY)
    service.rpc(
        "configure_owner_bootstrap",
        {
            "configured_email": owner_email,
            "bootstrap_token": bootstrap_token,
        },
    ).execute()

    owner_id, owner_token = sign_up(
        create_client(API_URL, PUBLISHABLE_KEY),
        email=owner_email,
        password=password,
    )
    owner_user_client = user_client(owner_token)
    owner_user_client.rpc(
        "claim_owner_bootstrap",
        {"bootstrap_token": bootstrap_token},
    ).execute()

    with TestClient(app) as api:
        unauthenticated = api.get("/customers")
        assert unauthenticated.status_code == 401, unauthenticated.text

        owner_me = api.get("/auth/me", headers=bearer(owner_token))
        assert owner_me.status_code == 200, owner_me.text
        owner_identity = owner_me.json()
        assert owner_identity["role"] == "owner"
        company_id = owner_identity["company_id"]

        role_tokens: dict[str, str] = {}
        role_ids: dict[str, str] = {}
        for role in ("admin", "accountant", "viewer"):
            user_id, token = invite_role(
                api,
                owner_token,
                role=role,
                email=f"{role}-{run_id}@local.test",
                password=password,
            )
            role_ids[role] = user_id
            role_tokens[role] = token
            identity = api.get("/auth/me", headers=bearer(token))
            assert identity.status_code == 200, identity.text
            assert identity.json()["role"] == role

        owner_permissions = set(owner_identity["permissions"])
        admin_permissions = set(
            api.get("/auth/me", headers=bearer(role_tokens["admin"])).json()[
                "permissions"
            ]
        )
        accountant_permissions = set(
            api.get("/auth/me", headers=bearer(role_tokens["accountant"])).json()[
                "permissions"
            ]
        )
        viewer_permissions = set(
            api.get("/auth/me", headers=bearer(role_tokens["viewer"])).json()[
                "permissions"
            ]
        )
        assert "actions.approve" in owner_permissions
        assert "actions.approve" in admin_permissions
        assert "financial.write" in accountant_permissions
        assert "members.manage" not in accountant_permissions
        assert "financial.write" not in viewer_permissions

        admin_owner_change = api.patch(
            f"/auth/members/{owner_id}",
            headers=bearer(role_tokens["admin"]),
            json={"role": "viewer"},
        )
        assert admin_owner_change.status_code == 403, admin_owner_change.text

        viewer_write = api.post(
            "/customers",
            headers=bearer(role_tokens["viewer"]),
            json={"name": "Viewer must not write"},
        )
        assert viewer_write.status_code == 403, viewer_write.text

        accountant_members = api.get(
            "/auth/members",
            headers=bearer(role_tokens["accountant"]),
        )
        assert accountant_members.status_code == 403, accountant_members.text

        smuggled_company = api.post(
            "/customers",
            headers=bearer(owner_token),
            json={
                "name": "Rejected company identifier",
                "company_id": "00000000-0000-0000-0000-000000000099",
            },
        )
        assert smuggled_company.status_code == 422, smuggled_company.text

        customer = api.post(
            "/customers",
            headers=bearer(owner_token),
            json={
                "name": f"Local Customer {run_id}",
                "email": f"customer-{run_id}@local.test",
            },
        )
        assert customer.status_code == 200, customer.text
        customer_id = customer.json()["id"]

        accountant_headers = bearer(role_tokens["accountant"])
        sale = api.post(
            "/sales",
            headers=accountant_headers,
            json={
                "customer_id": customer_id,
                "product_name": "Local Decimal Sale",
                "quantity": 3,
                "unit_price": "0.10",
                "status": "completed",
            },
        )
        assert sale.status_code == 200, sale.text
        assert sale.json()["total_amount"] == "0.30"

        expense = api.post(
            "/expenses",
            headers=accountant_headers,
            json={
                "category": "Local test",
                "amount": "0.01",
                "vendor": "Local Vendor",
                "is_flagged": False,
            },
        )
        assert expense.status_code == 200, expense.text

        inventory = api.post(
            "/inventory",
            headers=accountant_headers,
            json={
                "product_name": "Local Product",
                "sku": f"LOCAL-{run_id}",
                "quantity": 2,
                "reorder_level": 5,
                "cost_price": "10.00",
                "selling_price": "15.00",
            },
        )
        assert inventory.status_code == 200, inventory.text

        invoice = api.post(
            "/invoices",
            headers=accountant_headers,
            json={
                "customer_id": customer_id,
                "invoice_number": f"LOCAL-{run_id}",
                "total_amount": "100.00",
                "vat_amount": "15.00",
                "status": "unpaid",
            },
        )
        assert invoice.status_code == 200, invoice.text

        for route in ("customers", "sales", "expenses", "inventory", "invoices"):
            readable = api.get(f"/{route}", headers=bearer(role_tokens["viewer"]))
            assert readable.status_code == 200, readable.text

        viewer_actions = api.get("/actions", headers=bearer(role_tokens["viewer"]))
        assert viewer_actions.status_code == 200, viewer_actions.text
        viewer_detect = api.post(
            "/actions/detect",
            headers=bearer(role_tokens["viewer"]),
        )
        assert viewer_detect.status_code == 403, viewer_detect.text

        owner_direct = user_client(owner_token)
        forged = (
            owner_direct.table("customers")
            .insert(
                {
                    "name": f"Company trigger {run_id}",
                    "company_id": "00000000-0000-0000-0000-000000000099",
                }
            )
            .execute()
        )
        assert forged.data[0]["company_id"] == company_id

        expect_supabase_failure(
            lambda: service.table("companies")
            .insert({"name": "Forbidden second company", "singleton_key": True})
            .execute(),
            "second company",
        )
        expect_supabase_failure(
            lambda: service.table("sales")
            .insert(
                {
                    "company_id": company_id,
                    "product_name": "Invalid deterministic total",
                    "quantity": 3,
                    "unit_price": "0.10",
                    "total_amount": "0.31",
                    "status": "completed",
                }
            )
            .execute(),
            "incorrect sale total",
        )
        expect_supabase_failure(
            lambda: service.table("expenses")
            .insert(
                {
                    "company_id": company_id,
                    "category": "Invalid negative amount",
                    "amount": "-0.01",
                }
            )
            .execute(),
            "negative expense",
        )
        expect_supabase_failure(
            lambda: service.table("invoices")
            .insert(
                {
                    "company_id": company_id,
                    "invoice_number": f"INVALID-VAT-{run_id}",
                    "total_amount": "10.00",
                    "vat_amount": "10.01",
                    "status": "unpaid",
                }
            )
            .execute(),
            "VAT above invoice total",
        )
        expect_supabase_failure(
            lambda: service.table("inventory")
            .insert(
                {
                    "company_id": company_id,
                    "product_name": "Duplicate SKU",
                    "sku": f"local-{run_id}",
                    "quantity": 1,
                    "reorder_level": 1,
                    "cost_price": "1.00",
                    "selling_price": "2.00",
                }
            )
            .execute(),
            "case-insensitive duplicate SKU",
        )
        expect_supabase_failure(
            lambda: service.table("invoices")
            .insert(
                {
                    "company_id": company_id,
                    "invoice_number": f"local-{run_id}",
                    "total_amount": "1.00",
                    "vat_amount": "0.00",
                    "status": "unpaid",
                }
            )
            .execute(),
            "case-insensitive duplicate invoice number",
        )
        expect_supabase_failure(
            lambda: owner_direct.table("company_members")
            .update({"role": "viewer"})
            .eq("user_id", owner_id)
            .execute(),
            "last owner demotion",
        )

        viewer_storage = user_client(role_tokens["viewer"])
        storage_path = f"{company_id}/local-bootstrap/{run_id}.txt"
        expect_supabase_failure(
            lambda: viewer_storage.storage.from_("documents").upload(
                storage_path,
                b"viewer cannot write",
                {"content-type": "text/plain"},
            ),
            "viewer Storage write",
        )

        accountant_storage = user_client(role_tokens["accountant"])
        accountant_storage.storage.from_("documents").upload(
            storage_path,
            b"local isolated storage test",
            {"content-type": "text/plain"},
        )
        accountant_storage.storage.from_("documents").remove([storage_path])

        no_member_id, no_member_token = invite_role(
            api,
            owner_token,
            role="viewer",
            email=f"no-member-{run_id}@local.test",
            password=password,
        )
        with psycopg.connect(DB_URL, autocommit=True) as connection:
            connection.execute(
                "delete from public.company_members where user_id = %s",
                (no_member_id,),
            )
        no_membership = api.get("/auth/me", headers=bearer(no_member_token))
        assert no_membership.status_code == 403, no_membership.text

    with psycopg.connect(DB_URL) as connection:
        fingerprint = schema_fingerprint(connection)

    print(
        json.dumps(
            {
                "auth_roles": ["owner", "admin", "accountant", "viewer"],
                "backend_crud": "passed",
                "company_id_spoofing": "rejected_or_overwritten",
                "constraints": "passed",
                "last_owner": "protected",
                "no_membership": 403,
                "rls_rbac": "passed",
                "storage_roles": "passed",
                "schema_fingerprint": fingerprint,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
