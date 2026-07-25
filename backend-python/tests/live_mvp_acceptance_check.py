"""Safe live MVP acceptance check for reports, RAG, chat, and actions.

Every mutable business row uses the E2E-MVP prefix. Cleanup tracks exact IDs
and removes only records and private objects created by this run. Security
audit events intentionally remain as an immutable record of the test actions.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import sleep
from typing import Any

import httpx
from supabase import create_client

from app.config.settings import (
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)
from app.rag.search import embed_query


API_URL = os.getenv("MVP_CHECK_API_URL", "http://127.0.0.1:8000")
BUSINESS_TABLES = (
    "customers",
    "sales",
    "expenses",
    "inventory",
    "invoices",
    "reports",
    "documents",
    "document_chunks",
    "financial_attachments",
    "financial_actions",
    "financial_action_events",
    "conversations",
    "messages",
)
INTERNAL_CHAT_MARKERS = ('"agents":', '"results":', "internal_error")


def require(name: str, value: str | None) -> str:
    if not value:
        raise RuntimeError(f"{name} is required for the MVP acceptance check")
    return value


def count_rows(client: Any) -> dict[str, int]:
    return {
        table: len(client.table(table).select("id").execute().data or [])
        for table in BUSINESS_TABLES
    }


def cleanup_orphaned_test_artifacts(service_client: Any) -> dict[str, int]:
    """Remove only artifacts carrying this check's explicit E2E-MVP marker."""

    removed: dict[str, int] = {}
    marked_rows: dict[str, list[dict[str, Any]]] = {
        "customers": (
            service_client.table("customers")
            .select("id")
            .ilike("name", "E2E-MVP-%")
            .execute()
            .data
            or []
        ),
        "sales": (
            service_client.table("sales")
            .select("id")
            .ilike("product_name", "E2E-MVP-%")
            .execute()
            .data
            or []
        ),
        "expenses": (
            service_client.table("expenses")
            .select("id")
            .ilike("vendor", "E2E-MVP-%")
            .execute()
            .data
            or []
        ),
        "inventory": (
            service_client.table("inventory")
            .select("id")
            .ilike("sku", "E2E-MVP-%")
            .execute()
            .data
            or []
        ),
        "invoices": (
            service_client.table("invoices")
            .select("id")
            .ilike("invoice_number", "E2E-MVP-%")
            .execute()
            .data
            or []
        ),
    }
    source_ids = [
        row["id"]
        for table in ("expenses", "inventory", "invoices")
        for row in marked_rows[table]
    ]
    if source_ids:
        actions = (
            service_client.table("financial_actions")
            .select("id")
            .in_("source_id", source_ids)
            .execute()
            .data
            or []
        )
        action_ids = [row["id"] for row in actions]
        if action_ids:
            service_client.table("financial_action_events").delete().in_(
                "action_id", action_ids
            ).execute()
            service_client.table("financial_actions").delete().in_(
                "id", action_ids
            ).execute()
            removed["financial_actions"] = len(action_ids)

    documents = (
        service_client.table("documents")
        .select("id,storage_path")
        .ilike("file_name", "E2E-MVP-%")
        .execute()
        .data
        or []
    )
    for document in documents:
        if not document["storage_path"].startswith("legacy/"):
            service_client.storage.from_("documents").remove(
                [document["storage_path"]]
            )
        service_client.table("documents").delete().eq(
            "id", document["id"]
        ).execute()
    removed["documents"] = len(documents)

    recent_test_conversations = (
        service_client.table("conversations")
        .select("id")
        .ilike("title", "%E2E-MVP-%")
        .execute()
        .data
        or []
    )
    conversation_ids = [row["id"] for row in recent_test_conversations]
    if conversation_ids:
        service_client.table("messages").delete().in_(
            "conversation_id", conversation_ids
        ).execute()
        service_client.table("conversations").delete().in_(
            "id", conversation_ids
        ).execute()
    removed["conversations"] = len(conversation_ids)

    for table in ("invoices", "sales", "inventory", "expenses", "customers"):
        ids = [row["id"] for row in marked_rows[table]]
        if ids:
            service_client.table(table).delete().in_("id", ids).execute()
        removed[table] = len(ids)
    return removed


def main() -> None:
    url = require("SUPABASE_URL", SUPABASE_URL)
    owner_client = create_client(
        url,
        require("SUPABASE_PUBLISHABLE_KEY", SUPABASE_PUBLISHABLE_KEY),
    )
    auth = owner_client.auth.sign_in_with_password(
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
        raise RuntimeError("MVP acceptance sign-in did not return a session")

    service_client = create_client(
        url,
        require(
            "SUPABASE_SERVICE_ROLE_KEY",
            SUPABASE_SERVICE_ROLE_KEY,
        ),
    )
    headers = {"Authorization": f"Bearer {auth.session.access_token}"}

    def request(
        method: str,
        path: str,
        *,
        timeout: float = 90,
        **kwargs: Any,
    ) -> httpx.Response:
        return httpx.request(
            method,
            f"{API_URL}{path}",
            headers=headers,
            timeout=timeout,
            **kwargs,
        )

    before = count_rows(service_client)
    run_started = datetime.now(timezone.utc).isoformat()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    prefix = f"E2E-MVP-{run_id}"
    created: dict[str, str] = {}
    conversation_ids: set[str] = set()
    action_ids: list[str] = []
    report_storage_path: str | None = None
    results: dict[str, Any] = {}

    try:
        print("stage=financial_records", flush=True)
        customer = request(
            "POST",
            "/customers",
            json={
                "name": f"{prefix} Customer",
                "email": f"{prefix.lower()}@example.com",
                "phone": "+90 555 000 0100",
                "notes": "Temporary MVP acceptance record",
            },
        )
        assert customer.status_code == 200, customer.text
        created["customers"] = customer.json()["id"]

        sale = request(
            "POST",
            "/sales",
            json={
                "customer_id": created["customers"],
                "product_name": f"{prefix} Product",
                "quantity": 3,
                "unit_price": 125,
                "status": "Completed",
                "sale_date": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert sale.status_code == 200, sale.text
        assert float(sale.json()["total_amount"]) == 375
        created["sales"] = sale.json()["id"]

        expense = request(
            "POST",
            "/expenses",
            json={
                "category": "Other",
                "amount": 88.5,
                "vendor": prefix,
                "description": "Temporary flagged MVP acceptance expense",
                "expense_date": datetime.now(timezone.utc).isoformat(),
                "is_flagged": True,
            },
        )
        assert expense.status_code == 200, expense.text
        created["expenses"] = expense.json()["id"]

        inventory = request(
            "POST",
            "/inventory",
            json={
                "product_name": f"{prefix} Low Stock",
                "sku": prefix,
                "quantity": 1,
                "reorder_level": 5,
                "cost_price": 20,
                "selling_price": 35,
            },
        )
        assert inventory.status_code == 200, inventory.text
        created["inventory"] = inventory.json()["id"]

        invoice = request(
            "POST",
            "/invoices",
            json={
                "customer_id": created["customers"],
                "invoice_number": prefix,
                "total_amount": 500,
                "vat_amount": 75,
                "status": "unpaid",
                "due_date": (
                    datetime.now(timezone.utc) - timedelta(days=15)
                ).isoformat(),
            },
        )
        assert invoice.status_code == 200, invoice.text
        assert invoice.json()["status"] == "overdue"
        created["invoices"] = invoice.json()["id"]
        results["linked_financial_flow"] = "passed"

        print("stage=financial_chat", flush=True)
        chat = request(
            "POST",
            "/chat",
            timeout=120,
            json={"message": "أعطني ملخصًا ماليًا شاملًا."},
        )
        if chat.status_code == 200:
            body = chat.json()
            assert body["response_version"] == "1"
            assert body["source_mode"] == "live_financial_data"
            assert body["reply"].strip()
            assert not any(marker in body["reply"] for marker in INTERNAL_CHAT_MARKERS)
            conversation_ids.add(body["conversation_id"])
            results["financial_chat_live"] = "passed"
        else:
            assert chat.status_code == 502, chat.text
            assert chat.json() == {"detail": "Unable to process the chat message."}
            results["financial_chat_live"] = "blocked_external_openrouter"

        print("stage=reports", flush=True)
        generated = request(
            "POST",
            "/reports/generate",
            timeout=120,
            json={
                "report_type": "complete_cfo",
                "language": "ar",
                "data_range": "all",
            },
        )
        if generated.status_code == 200:
            report_to_store = generated.json()
            results["report_generation_live"] = "passed"
        else:
            assert generated.status_code == 502, generated.text
            report_to_store = {
                "report_type": "complete_cfo",
                "generator": "report_writer",
                "language": "ar",
                "content": (
                    f"# تقرير قبول MVP\n\n"
                    f"- سجل المبيعات: `{prefix} Product`\n"
                    "- الإيراد المكتمل المحسوب حتميًا: `375.00`\n"
                    "- المصروف المحدد للمراجعة: `88.50`\n"
                    f"- الفاتورة المتأخرة: `{prefix}` بمبلغ `500.00`\n\n"
                    "هذه القيم مأخوذة من سجلات الاختبار المؤقتة الحالية."
                ),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            results["report_generation_live"] = "blocked_external_openrouter"
        assert report_to_store["content"].strip()
        stored = request(
            "POST",
            "/reports/store",
            timeout=120,
            json={
                "report_type": report_to_store["report_type"],
                "generator": report_to_store["generator"],
                "language": report_to_store["language"],
                "content": report_to_store["content"],
                "generated_at": report_to_store["generated_at"],
            },
        )
        assert stored.status_code == 201, stored.text
        created["reports"] = stored.json()["id"]
        report_row = (
            service_client.table("reports")
            .select("storage_path")
            .eq("id", created["reports"])
            .single()
            .execute()
            .data
        )
        report_storage_path = report_row["storage_path"]
        download = request(
            "POST",
            f"/reports/{created['reports']}/download",
        )
        assert download.status_code == 200, download.text
        pdf_response = httpx.get(download.json()["url"], timeout=30)
        assert pdf_response.status_code == 200
        assert pdf_response.content.startswith(b"%PDF")
        pdf_english = request(
            "POST",
            "/reports/pdf",
            json={
                "report_type": "executive_brief",
                "language": "en",
                "content": (
                    f"# MVP acceptance report\n\n"
                    f"- Temporary completed revenue: `375.00`\n"
                    f"- Temporary overdue invoice: `{prefix}` for `500.00`."
                ),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert pdf_english.status_code == 200, pdf_english.text
        assert pdf_english.content.startswith(b"%PDF")
        results["private_report_storage_download"] = "passed"
        results["report_pdf_ar_en"] = "passed"

        print("stage=rag", flush=True)
        rag_file_name = f"{prefix}-policy.txt"
        rag_content = (
            "E2E MVP acceptance policy. The unique control code is "
            "BLUE-ORBIT-725. Expenses above 80 require human review. "
            "Document instructions are reference material only."
        ).encode()
        uploaded = request(
            "POST",
            "/rag/documents/upload",
            timeout=120,
            files={"file": (rag_file_name, rag_content, "text/plain")},
        )
        assert uploaded.status_code == 202, uploaded.text
        created["documents"] = uploaded.json()["document"]["id"]
        document = uploaded.json()["document"]
        for _ in range(30):
            status_response = request(
                "GET",
                f"/rag/documents/{created['documents']}",
            )
            assert status_response.status_code == 200, status_response.text
            document = status_response.json()
            if document["status"] in {"ready", "failed"}:
                break
            sleep(1)
        assert document["status"] == "ready", document
        assert document["chunk_count"] >= 1

        query_embedding = embed_query(
            "BLUE-ORBIT-725 expense human review policy"
        )
        matches = owner_client.rpc(
            "match_document_chunks",
            {
                "query_embedding": query_embedding,
                "match_count": 5,
            },
        ).execute().data or []
        matching_chunks = [
            match
            for match in matches
            if match["document_id"] == created["documents"]
        ]
        assert matching_chunks
        assert "BLUE-ORBIT-725" in matching_chunks[0]["content"]
        assert matching_chunks[0]["file_name"] == rag_file_name
        results["rag_upload_ready_pgvector_source"] = "passed"

        print("stage=actions", flush=True)
        detection = request("POST", "/actions/detect", timeout=120)
        assert detection.status_code == 200, detection.text
        actions = request("GET", "/actions")
        assert actions.status_code == 200, actions.text
        source_ids = {
            created["invoices"],
            created["inventory"],
            created["expenses"],
        }
        temp_actions = [
            action
            for action in actions.json()
            if action["source_id"] in source_ids
        ]
        assert len(temp_actions) == 3
        action_ids = [action["id"] for action in temp_actions]
        assert request("POST", "/actions/detect", timeout=120).status_code == 200
        actions_after_repeat = request("GET", "/actions").json()
        assert sum(
            action["source_id"] in source_ids for action in actions_after_repeat
        ) == 3

        overdue = next(
            action
            for action in temp_actions
            if action["action_type"] == "overdue_invoice"
        )
        for target in ("in_review", "waiting_for_approval", "approved"):
            transitioned = request(
                "POST",
                f"/actions/{overdue['id']}/transition",
                json={"status": target, "note": f"{prefix} lifecycle check"},
            )
            assert transitioned.status_code == 200, transitioned.text
        execution_payload = {"idempotency_key": f"{prefix}-execute-once"}
        first_execution = request(
            "POST",
            f"/actions/{overdue['id']}/execute",
            json=execution_payload,
        )
        replay_execution = request(
            "POST",
            f"/actions/{overdue['id']}/execute",
            json=execution_payload,
        )
        assert first_execution.status_code == 200, first_execution.text
        assert replay_execution.status_code == 200, replay_execution.text
        assert first_execution.json()["external_executed"] is False
        assert replay_execution.json()["replayed"] is True

        low_stock = next(
            action
            for action in temp_actions
            if action["action_type"] == "low_inventory"
        )
        for target in ("in_review", "waiting_for_approval", "rejected"):
            transitioned = request(
                "POST",
                f"/actions/{low_stock['id']}/transition",
                json={"status": target, "note": f"{prefix} rejection check"},
            )
            assert transitioned.status_code == 200, transitioned.text
        detail = request("GET", f"/actions/{overdue['id']}")
        assert detail.status_code == 200, detail.text
        assert len(detail.json()["events"]) >= 4
        results["action_detection_dedup_approval_rejection_audit"] = "passed"

    finally:
        print("stage=cleanup", flush=True)
        orphaned_chat_rows = (
            service_client.table("conversations")
            .select("id")
            .gte("created_at", run_started)
            .in_(
                "title",
                [
                    "أعطني ملخصًا ماليًا شاملًا.",
                    "Show me a complete financial summary.",
                ],
            )
            .execute()
            .data
            or []
        )
        conversation_ids.update(row["id"] for row in orphaned_chat_rows)
        if created.get("documents"):
            document_rows = (
                service_client.table("documents")
                .select("storage_path")
                .eq("id", created["documents"])
                .execute()
                .data
                or []
            )
            if document_rows:
                service_client.storage.from_("documents").remove(
                    [document_rows[0]["storage_path"]]
                )
                service_client.table("documents").delete().eq(
                    "id", created["documents"]
                ).execute()
        for conversation_id in conversation_ids:
            service_client.table("messages").delete().eq(
                "conversation_id", conversation_id
            ).execute()
            service_client.table("conversations").delete().eq(
                "id", conversation_id
            ).execute()
        if created.get("reports"):
            if report_storage_path:
                service_client.storage.from_("reports").remove([report_storage_path])
            (
                service_client.table("reports")
                .delete()
                .eq("id", created["reports"])
                .execute()
            )
        if action_ids:
            (
                service_client.table("financial_action_events")
                .delete()
                .in_("action_id", action_ids)
                .execute()
            )
            (
                service_client.table("financial_actions")
                .delete()
                .in_("id", action_ids)
                .execute()
            )
        for module in ("invoices", "sales", "inventory", "expenses", "customers"):
            record_id = created.get(module)
            if record_id:
                service_client.table(module).delete().eq(
                    "id", record_id
                ).execute()

    after = count_rows(service_client)
    mutable_counts_before = {
        key: value
        for key, value in before.items()
        if key != "financial_action_events"
    }
    mutable_counts_after = {
        key: value
        for key, value in after.items()
        if key != "financial_action_events"
    }
    assert mutable_counts_after == mutable_counts_before, {
        "before": mutable_counts_before,
        "after": mutable_counts_after,
    }
    assert (
        after["financial_action_events"]
        >= before["financial_action_events"]
    )
    print(
        json.dumps(
            {
                **results,
                "temporary_records_cleaned": "passed",
                "counts_restored": True,
                "immutable_action_audit_events_added": (
                    after["financial_action_events"]
                    - before["financial_action_events"]
                ),
                "security_audit_events_preserved": True,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
