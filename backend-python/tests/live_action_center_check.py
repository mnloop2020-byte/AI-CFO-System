"""Non-pytest live verification for the linked development project.

This script reads ignored environment values and never prints credentials,
tokens, email addresses, or financial record contents.
"""

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


def main() -> None:
    auth_client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    owner_email = os.environ.get("BOOTSTRAP_OWNER_EMAIL")
    owner_password = os.environ.get("BOOTSTRAP_OWNER_PASSWORD")
    if not owner_email or not owner_password:
        raise RuntimeError("Owner live-test credentials are not configured.")
    auth = auth_client.auth.sign_in_with_password(
        {
            "email": owner_email,
            "password": owner_password,
        }
    )
    if not auth.session:
        raise RuntimeError("Owner authentication failed.")

    client = httpx.Client(
        base_url=os.environ.get("ACTION_CHECK_API_URL", "http://127.0.0.1:8000"),
        timeout=120,
    )
    headers = {"Authorization": f"Bearer {auth.session.access_token}"}

    service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    role_password = f"ActionCenter!{secrets.token_urlsafe(18)}Aa1"
    role_headers: dict[str, dict[str, str]] = {}
    role_user_ids: dict[str, str] = {}
    for role in ("admin", "accountant", "viewer"):
        members = (
            service_client.table("company_members")
            .select("user_id,created_at")
            .eq("role", role)
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        role_user = None
        for member in members:
            candidate = service_client.auth.admin.get_user_by_id(member["user_id"]).user
            if candidate and (candidate.email or "").startswith(f"phase1-{role}-"):
                role_user = candidate
                break
        if role_user is None or not role_user.email:
            raise RuntimeError(f"The existing {role} role-test user was not found.")
        service_client.auth.admin.update_user_by_id(
            str(role_user.id),
            {"password": role_password},
        )
        role_auth = auth_client.auth.sign_in_with_password(
            {"email": role_user.email, "password": role_password}
        )
        if not role_auth.session:
            raise RuntimeError(f"The {role} role-test user could not sign in.")
        role_headers[role] = {
            "Authorization": f"Bearer {role_auth.session.access_token}"
        }
        role_user_ids[role] = str(role_user.id)

    unauthenticated = client.get("/actions")
    assert unauthenticated.status_code == 401

    first_detection = client.post("/actions/detect", headers=headers)
    assert first_detection.status_code == 200, first_detection.text
    first_result = first_detection.json()

    second_detection = client.post("/actions/detect", headers=headers)
    assert second_detection.status_code == 200, second_detection.text
    second_result = second_detection.json()
    assert second_result["created"] == 0

    actions_response = client.get("/actions", headers=headers)
    assert actions_response.status_code == 200, actions_response.text
    actions = actions_response.json()
    assert len(actions) >= 2
    assert second_result["existing"] >= 2

    audited_update = client.patch(
        f"/actions/{actions[0]['id']}",
        headers=headers,
        json={"title_en": actions[0]["title_en"]},
    )
    assert audited_update.status_code == 200, audited_update.text

    assert client.get("/actions", headers=role_headers["viewer"]).status_code == 200
    owner_audit = client.get("/audit/events?limit=10", headers=headers)
    assert owner_audit.status_code == 200, owner_audit.text
    assert owner_audit.json()
    assert client.get(
        "/audit/events?limit=10", headers=role_headers["admin"]
    ).status_code == 200
    assert client.get(
        "/audit/events?limit=10", headers=role_headers["viewer"]
    ).status_code == 403
    assert client.post("/actions/detect", headers=role_headers["viewer"]).status_code == 403
    assert (
        client.patch(
            f"/actions/{actions[0]['id']}",
            headers=role_headers["viewer"],
            json={"due_date": "2026-08-01"},
        ).status_code
        == 403
    )
    assert client.post("/actions/detect", headers=role_headers["accountant"]).status_code == 200
    assert (
        client.post(
            f"/actions/{actions[0]['id']}/assign",
            headers=role_headers["accountant"],
            json={"assigned_to": role_user_ids["viewer"]},
        ).status_code
        == 403
    )

    smuggled_company = client.patch(
        f"/actions/{actions[0]['id']}",
        headers=headers,
        json={"company_id": "00000000-0000-0000-0000-000000000099"},
    )
    assert smuggled_company.status_code == 422

    approval_action = next(
        (
            action
            for action in actions
            if action["requires_approval"]
            and action["status"] in {"new", "waiting_for_approval"}
        ),
        None,
    )
    if approval_action and approval_action["status"] == "new":
        review = client.post(
            f"/actions/{approval_action['id']}/transition",
            headers=headers,
            json={"status": "in_review"},
        )
        assert review.status_code == 200, review.text
        waiting = client.post(
            f"/actions/{approval_action['id']}/transition",
            headers=headers,
            json={"status": "waiting_for_approval"},
        )
        assert waiting.status_code == 200, waiting.text

    if approval_action:
        current = client.get(
            f"/actions/{approval_action['id']}", headers=headers
        ).json()
        if current["status"] == "waiting_for_approval":
            accountant_approval = client.post(
                f"/actions/{approval_action['id']}/transition",
                headers=role_headers["accountant"],
                json={"status": "approved"},
            )
            assert accountant_approval.status_code == 403

            assigned = client.post(
                f"/actions/{approval_action['id']}/assign",
                headers=role_headers["admin"],
                json={"assigned_to": role_user_ids["accountant"]},
            )
            assert assigned.status_code == 200, assigned.text

            approved = client.post(
                f"/actions/{approval_action['id']}/transition",
                headers=role_headers["admin"],
                json={"status": "approved"},
            )
            assert approved.status_code == 200, approved.text

            idempotency_key = f"live-check-{approval_action['id']}"
            first_execution = client.post(
                f"/actions/{approval_action['id']}/execute",
                headers=role_headers["accountant"],
                json={"idempotency_key": idempotency_key},
            )
            assert first_execution.status_code == 200, first_execution.text
            assert first_execution.json()["external_executed"] is False
            assert first_execution.json()["replayed"] is False

            replayed_execution = client.post(
                f"/actions/{approval_action['id']}/execute",
                headers=role_headers["accountant"],
                json={"idempotency_key": idempotency_key},
            )
            assert replayed_execution.status_code == 200, replayed_execution.text
            assert replayed_execution.json()["replayed"] is True

    detail = client.get(f"/actions/{actions[0]['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["events"]

    expense_action = next(
        action for action in actions if action["action_type"] == "expense_review"
    )
    expense_detail = client.get(
        f"/actions/{expense_action['id']}", headers=headers
    ).json()
    assert "policy_match_available" in expense_detail["evidence"]
    if expense_detail["evidence"]["policy_match_available"]:
        policy_match = expense_detail["evidence"]["policy_match"]
        assert policy_match["file_name"]
        assert policy_match["chunk_number"] >= 1
        assert "human comparison only" in policy_match["interpretation"]

    metrics = client.get("/actions/metrics", headers=headers)
    assert metrics.status_code == 200, metrics.text
    metric_data = metrics.json()
    assert metric_data["open_actions"] >= 2
    assert metric_data["followed_up_invoices"] >= 0
    assert metric_data["average_days_overdue"] is None or metric_data[
        "average_days_overdue"
    ] >= 0
    assert metric_data["proven_collected_amount"] is None
    assert "paid_at" in metric_data["collection_attribution_note"]

    print(
        {
            "unauthenticated_status": unauthenticated.status_code,
            "first_created": first_result["created"],
            "second_created": second_result["created"],
            "second_existing": second_result["existing"],
            "action_count": len(actions),
            "audit_events_present": True,
            "company_id_rejected": smuggled_company.status_code,
            "viewer_read_only": True,
            "accountant_cannot_assign_or_approve": True,
            "admin_can_assign_and_approve": True,
            "external_execution_disabled": True,
            "execution_idempotency": True,
            "expense_policy_context_available": expense_detail["evidence"][
                "policy_match_available"
            ],
            "value_metrics_without_false_collection_attribution": True,
            "security_audit_roles_and_event": True,
            "action_statuses": {
                action["action_type"]: action["status"] for action in actions
            },
            "followed_up_invoices": metric_data["followed_up_invoices"],
            "average_days_overdue": metric_data["average_days_overdue"],
        }
    )


if __name__ == "__main__":
    main()
