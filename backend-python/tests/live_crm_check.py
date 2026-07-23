"""Explicit live CRUD check for the five financial modules.

The script uses one authenticated owner session, creates clearly named
temporary rows, restores table counts by deleting only those rows, and never
prints credentials, tokens, user IDs, record IDs, or company IDs.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

import httpx
from supabase import create_client

from app.config.settings import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


API_URL = os.getenv("CRM_CHECK_API_URL", "http://127.0.0.1:8000")
MODULES = ("customers", "sales", "expenses", "inventory", "invoices")


def require(name: str, value: str | None) -> str:
    if not value:
        raise RuntimeError(f"{name} is required for the live check")
    return value


def main() -> None:
    client = create_client(
        require("SUPABASE_URL", SUPABASE_URL),
        require("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY),
    )
    auth = client.auth.sign_in_with_password(
        {
            "email": require("BOOTSTRAP_OWNER_EMAIL", os.getenv("BOOTSTRAP_OWNER_EMAIL")),
            "password": require(
                "BOOTSTRAP_OWNER_PASSWORD",
                os.getenv("BOOTSTRAP_OWNER_PASSWORD"),
            ),
        }
    )
    if auth.session is None:
        raise RuntimeError("Live CRM sign-in did not return a session")

    headers = {"Authorization": f"Bearer {auth.session.access_token}"}

    def request(method: str, path: str, **kwargs: object) -> httpx.Response:
        return httpx.request(
            method,
            f"{API_URL}{path}",
            headers=headers,
            timeout=30,
            **kwargs,
        )

    before = {
        module: len(request("GET", f"/{module}").json())
        for module in MODULES
    }

    created: dict[str, str] = {}
    run_name = datetime.now(timezone.utc).strftime("CRM-LIVE-%Y%m%d%H%M%S")
    due_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    try:
        customer = request(
            "POST",
            "/customers",
            json={
                "name": f"{run_name} Customer",
                "email": f"{run_name.lower()}@example.com",
                "phone": "+90 555 000 0001",
            },
        )
        assert customer.status_code == 200, customer.text
        created["customers"] = customer.json()["id"]

        sale = request(
            "POST",
            "/sales",
            json={
                "customer_id": created["customers"],
                "product_name": f"{run_name} Sale",
                "quantity": 2,
                "unit_price": 15,
                "status": "Completed",
                "sale_date": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert sale.status_code == 200, sale.text
        assert sale.json()["total_amount"] == 30
        created["sales"] = sale.json()["id"]

        expense = request(
            "POST",
            "/expenses",
            json={
                "category": "Other",
                "amount": 12.5,
                "vendor": run_name,
                "expense_date": datetime.now(timezone.utc).isoformat(),
                "is_flagged": False,
            },
        )
        assert expense.status_code == 200, expense.text
        created["expenses"] = expense.json()["id"]

        inventory = request(
            "POST",
            "/inventory",
            json={
                "product_name": f"{run_name} Item",
                "sku": run_name,
                "quantity": 2,
                "reorder_level": 2,
                "cost_price": 10,
                "selling_price": 15,
            },
        )
        assert inventory.status_code == 200, inventory.text
        assert inventory.json()["quantity"] <= inventory.json()["reorder_level"]
        created["inventory"] = inventory.json()["id"]

        invoice = request(
            "POST",
            "/invoices",
            json={
                "customer_id": created["customers"],
                "invoice_number": run_name,
                "total_amount": 100,
                "vat_amount": 15,
                "status": "unpaid",
                "due_date": due_date,
            },
        )
        assert invoice.status_code == 200, invoice.text
        assert invoice.json()["status"] == "overdue"
        created["invoices"] = invoice.json()["id"]

        updates = (
            ("customers", {"notes": "temporary integration check"}),
            ("sales", {"quantity": 3, "unit_price": 20}),
            ("expenses", {"amount": 13.5}),
            ("inventory", {"quantity": 3}),
            ("invoices", {"total_amount": 110, "vat_amount": 16.5}),
        )
        for module, payload in updates:
            response = request("PATCH", f"/{module}/{created[module]}", json=payload)
            assert response.status_code == 200, response.text
            if module == "sales":
                assert response.json()["total_amount"] == 60

        assert request(
            "POST",
            "/sales",
            json={"product_name": "Invalid", "quantity": -1, "unit_price": 1},
        ).status_code == 422
        assert request(
            "POST",
            "/customers",
            json={"name": "Invalid", "company_id": "untrusted"},
        ).status_code == 422
        assert request(
            "POST",
            "/inventory",
            json={
                "product_name": "Duplicate",
                "sku": run_name,
                "quantity": 0,
                "reorder_level": 0,
                "cost_price": 0,
                "selling_price": 0,
            },
        ).status_code == 409
        assert request(
            "POST",
            "/invoices",
            json={
                "invoice_number": run_name,
                "total_amount": 10,
                "vat_amount": 1,
            },
        ).status_code == 409
    finally:
        for module in ("invoices", "sales", "inventory", "expenses", "customers"):
            record_id = created.get(module)
            if record_id:
                response = request("DELETE", f"/{module}/{record_id}")
                assert response.status_code == 200, response.text

    after = {
        module: len(request("GET", f"/{module}").json())
        for module in MODULES
    }
    assert after == before
    print(
        json.dumps(
            {
                "modules": {module: "passed" for module in MODULES},
                "validation_and_duplicates": "passed",
                "counts_before": before,
                "counts_after": after,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
