from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from app.agents.report_writer_agent import run_report_writer_agent


REPORT_DATA = {
    "sales": {
        "completed_revenue": 200.0,
        "completed_sales_count": 1,
        "total_units_sold": 2,
    },
    "inventory": {
        "overview": {"count": 1},
        "low_inventory": {"count": 1},
        "valuation": {"total_cost_value": 30.0},
    },
    "accounting": {
        "total_expenses": 550.0,
        "preliminary_operating_result": -350.0,
    },
    "cash_flow": {
        "tracked_cash_inflows": 0.0,
        "recorded_cash_outflows": 550.0,
        "net_tracked_cash_flow": -550.0,
        "expected_unpaid_inflows": 1000.0,
    },
    "tax": {"total_invoiced_vat": 150.0},
    "fraud_risk": {"flagged_expenses_count": 1},
    "company_context": {
        "currency": None,
        "bank_balance_available": False,
    },
    "data_sources": [
        {
            "table": "synthetic_financial_fixture",
            "record_ids": ["fixture-1"],
            "calculation": "deterministic report writer test",
        }
    ],
}


def _response(content: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def _run_with_replies(prompt: str, *replies: str | None) -> tuple[str, Mock]:
    client = Mock()
    client.chat.completions.create.side_effect = [
        _response(reply) for reply in replies
    ]

    with (
        patch(
            "app.agents.report_writer_agent.get_cfo_report_data",
            return_value=REPORT_DATA,
        ),
        patch(
            "app.agents.report_writer_agent.enrich_financial_data",
            side_effect=lambda metrics: metrics,
        ),
        patch(
            "app.agents.report_writer_agent.get_llm_client",
            return_value=client,
        ),
    ):
        result = run_report_writer_agent(prompt)

    return result, client


def test_valid_report_is_returned_without_repair() -> None:
    result, client = _run_with_replies(
        "Show me a complete financial summary.",
        "## Financial summary\n\n- Completed revenue: **200.00**",
    )

    assert "## Financial summary" in result
    assert "Completed revenue: **200.00**" in result
    assert "### Data sources" in result
    assert client.chat.completions.create.call_count == 1


@pytest.mark.parametrize(
    ("prompt", "repaired", "expected_heading"),
    (
        (
            "Show me a complete financial summary.",
            "## Financial summary\n\n- Completed revenue: **200.00**",
            "## Financial summary",
        ),
        (
            "أعطني ملخصًا ماليًا شاملًا.",
            "## الملخص المالي\n\n- إيرادات المبيعات المكتملة: **200.00**",
            "## الملخص المالي",
        ),
    ),
)
def test_invalid_draft_is_repaired_once_in_user_language(
    prompt: str,
    repaired: str,
    expected_heading: str,
) -> None:
    result, client = _run_with_replies(
        prompt,
        "Projected revenue is 999999.",
        repaired,
    )

    assert expected_heading in result
    assert "999999" not in result
    assert "| Metric | Value |" not in result
    assert client.chat.completions.create.call_count == 2

    repair_messages = client.chat.completions.create.call_args_list[1].kwargs[
        "messages"
    ]
    assert "unsupported numeric literals: 999999" in repair_messages[-1]["content"]


def test_second_invalid_draft_uses_concise_deterministic_summary() -> None:
    result, client = _run_with_replies(
        "Show me a complete financial summary.",
        "Projected revenue is 999999.",
        "The bank balance is 888888.",
    )

    assert "### Verified financial summary" in result
    assert "#### Sales" in result
    assert "Completed revenue: **200.00**" in result
    assert "| Metric | Value |" not in result
    assert "999999" not in result
    assert "888888" not in result
    assert client.chat.completions.create.call_count == 2


def test_empty_or_unexpected_responses_do_not_expose_internal_data() -> None:
    result, client = _run_with_replies(
        "Show me a complete financial summary.",
        None,
        '{"agents":["sales"],"results":{"completed_revenue":200}}',
    )

    assert "### Verified financial summary" in result
    assert '"agents"' not in result
    assert '"results"' not in result
    assert "```json" not in result
    assert client.chat.completions.create.call_count == 2
