"""Explicit live check for secure invoice PDF delivery and notifications.

The check creates one temporary customer and invoice, exercises only the
authenticated backend endpoints, removes the generated attachment, and then
deletes only the two temporary records. It never prints credentials, tokens,
record identifiers, company identifiers, signed URLs, or customer data.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

import httpx
from supabase import create_client

from app.config.settings import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


API_URL = os.getenv("INVOICE_DELIVERY_CHECK_API_URL", "http://127.0.0.1:8000")


def require(name: str, value: str | None) -> str:
    if not value:
        raise RuntimeError(f"{name} is required for the live check")
    return value


def main() -> None:
    auth_client = create_client(
        require("SUPABASE_URL", SUPABASE_URL),
        require("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY),
    )
    auth = auth_client.auth.sign_in_with_password(
        {
            "email": require(
                "BOOTSTRAP_OWNER_EMAIL",
                os.getenv("BOOTSTRAP_OWNER_EMAIL"),
            ),
            "password": require(
                "BOOTSTRAP_OWNER_PASSWORD",
                os.getenv("BOOTSTRAP_OWNER_PASSWORD"),
            ),
        }
    )
    if auth.session is None:
        raise RuntimeError("Live invoice delivery sign-in did not return a session")

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
        "customers": len(request("GET", "/customers").json()),
        "invoices": len(request("GET", "/invoices").json()),
    }
    created: dict[str, str] = {}
    run_name = datetime.now(timezone.utc).strftime("INVOICE-LIVE-%Y%m%d%H%M%S")
    due_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    try:
        customer = request(
            "POST",
            "/customers",
            json={
                "name": f"{run_name} Customer",
                "email": f"{run_name.lower()}@example.com",
                "phone": "+90 555 000 0025",
            },
        )
        assert customer.status_code == 200, customer.text
        created["customer"] = customer.json()["id"]

        invoice = request(
            "POST",
            "/invoices",
            json={
                "customer_id": created["customer"],
                "invoice_number": run_name,
                "total_amount": 125,
                "vat_amount": 18.75,
                "status": "unpaid",
                "due_date": due_date,
            },
        )
        assert invoice.status_code == 200, invoice.text
        created["invoice"] = invoice.json()["id"]

        download = request(
            "POST",
            f"/invoices/{created['invoice']}/pdf/download",
            json={"language": "ar"},
        )
        assert download.status_code == 200, download.text
        download_data = download.json()
        assert download_data["file_name"].startswith("invoice-")
        assert download_data["file_name"].endswith(".pdf")
        assert download_data["url"].startswith("https://")
        pdf_response = httpx.get(download_data["url"], timeout=30)
        assert pdf_response.status_code == 200
        assert pdf_response.content.startswith(b"%PDF-")
        assert len(pdf_response.content) <= 5 * 1024 * 1024

        email = request(
            "POST",
            f"/invoices/{created['invoice']}/email",
            json={"language": "en"},
        )
        assert email.status_code == 503, email.text
        assert "not configured" in email.json()["detail"].lower()

        overdue = request("POST", "/notifications/scan-overdue")
        assert overdue.status_code == 200, overdue.text
        assert overdue.json()["created"] >= 1

        notifications = request("GET", "/notifications")
        assert notifications.status_code == 200, notifications.text
        event_types = {
            item["event_type"]
            for item in notifications.json()
            if item["invoice_id"] == created["invoice"]
        }
        assert {
            "invoice_generated",
            "invoice_email_failed",
            "invoice_overdue",
        }.issubset(event_types)

        attachments = request(
            "GET",
            f"/attachments/records/invoice/{created['invoice']}",
        )
        assert attachments.status_code == 200, attachments.text
        generated_attachments = attachments.json()
        assert len(generated_attachments) >= 1
        assert all(
            attachment["mime_type"] == "application/pdf"
            for attachment in generated_attachments
        )
        for attachment in generated_attachments:
            removed = request("DELETE", f"/attachments/{attachment['id']}")
            assert removed.status_code == 204, removed.text
    finally:
        invoice_id = created.get("invoice")
        if invoice_id:
            remaining_attachments = request(
                "GET",
                f"/attachments/records/invoice/{invoice_id}",
            )
            if remaining_attachments.status_code == 200:
                for attachment in remaining_attachments.json():
                    request("DELETE", f"/attachments/{attachment['id']}")
            removed_invoice = request("DELETE", f"/invoices/{invoice_id}")
            assert removed_invoice.status_code == 200, removed_invoice.text

        customer_id = created.get("customer")
        if customer_id:
            removed_customer = request("DELETE", f"/customers/{customer_id}")
            assert removed_customer.status_code == 200, removed_customer.text

    after = {
        "customers": len(request("GET", "/customers").json()),
        "invoices": len(request("GET", "/invoices").json()),
    }
    assert after == before
    print(
        json.dumps(
            {
                "authenticated_pdf_generation": "passed",
                "private_signed_download": "passed",
                "email_unconfigured_safe_failure": "passed",
                "invoice_notifications": "passed",
                "temporary_records_cleaned": "passed",
                "business_counts_before": before,
                "business_counts_after": after,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
