"""Live LLM smoke check using a synthetic, verified financial fixture."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.agents import report_writer_agent


PROMPTS = (
    ("ar", "أعطني ملخصًا ماليًا شاملًا."),
    ("en", "Show me a complete financial summary."),
)
INTERNAL_MARKERS = (
    "```json",
    '"agents"',
    '"results"',
    '"data_sources"',
)
VERIFIED_REPORT = {
    "sales": {
        "completed_revenue": 200.0,
        "completed_sales_count": 1,
        "total_units_sold": 2,
    },
    "inventory": {
        "low_inventory": {"count": 1},
        "valuation": {"total_units": 3, "total_cost_value": 30.0},
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
        "is_bank_balance_available": False,
    },
    "tax": {
        "total_invoiced_vat": 150.0,
        "net_vat_payable_available": False,
    },
    "fraud_risk": {
        "flagged_expenses_count": 1,
        "fraud_confirmed": False,
    },
    "company_context": {
        "currency": None,
        "bank_balance_available": False,
        "complete_liabilities_available": False,
        "forecast_available": False,
    },
    "data_sources": [
        {
            "table": "synthetic_financial_fixture",
            "record_ids": ["fixture-1"],
            "calculation": "deterministic live chat output check",
        }
    ],
}


def main() -> None:
    report_writer_agent.get_cfo_report_data = lambda: VERIFIED_REPORT
    report_writer_agent.enrich_financial_data = lambda metrics: metrics

    for language, prompt in PROMPTS:
        reply = report_writer_agent.run_report_writer_agent(prompt)
        nonempty = bool(reply.strip())
        markdown = any(token in reply for token in ("##", "|"))
        internal_json = any(marker in reply for marker in INTERNAL_MARKERS)
        print(
            f"{language}: nonempty={nonempty} markdown={markdown} "
            f"internal_json={internal_json} length={len(reply)}"
        )

        if not nonempty or internal_json:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
