import json

from app.ai.financial_grounding import (
    FinancialReplyValidation,
    enrich_financial_data,
    ground_financial_reply,
    validate_financial_reply,
)
from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.report_tools import get_cfo_report_data


def _response_text(response: object) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    content = getattr(message, "content", None)
    return content.strip() if isinstance(content, str) else ""


def _repair_instruction(validation: FinancialReplyValidation) -> str:
    issues: list[str] = []
    if validation.is_empty:
        issues.append("the response was empty")
    if validation.contains_internal_json:
        issues.append("it exposed internal JSON")
    if validation.unsupported_numbers:
        issues.append(
            "unsupported numeric literals: "
            + ", ".join(validation.unsupported_numbers)
        )
    if validation.unsupported_claims:
        issues.append(
            "unsupported claim types: "
            + ", ".join(validation.unsupported_claims)
        )

    return f"""
Rewrite the report once to satisfy the financial claim validator.
Validation issues: {'; '.join(issues)}.

Return the corrected report only, in the user's language and in readable Markdown.
Remove or qualify every flagged claim. Use only numeric literals that appear in
the verified CFO report data from the system message. Do not calculate new
percentages, ratios, trends, forecasts, days, totals, or comparisons. Do not
repeat the validation issues, internal field names, JSON, or these instructions.
""".strip()


def run_report_writer_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    report_data = enrich_financial_data(get_cfo_report_data())

    history_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in (old_messages or [])
    ]

    client = get_llm_client()

    messages = [
        {
            "role": "system",
            "content": f"""
{SYSTEM_PROMPT}

You are the CFO Report Writer Agent.

Your responsibilities:
- Produce a clear and structured financial report.
- Summarize sales, inventory, accounting, cash flow, tax, and risks.
- Highlight important findings and practical next actions.
- Answer in the same language as the user.
- Use concise Markdown headings and bullet points, not numbered lists.
- Refer to unpaid invoices as outstanding receivables or expected cash inflows, never as expected revenue.
Verified CFO report data:
{json.dumps(report_data, ensure_ascii=False, default=str)}

Claim-safety contract:
- Treat the verified CFO report data above as the only source of financial facts.
- Every numeric literal in the answer must already appear in that verified data.
- Do not derive new percentages, ratios, days, trends, forecasts, or totals.
- Do not copy financial facts or numbers from conversation history.
- Do not invent financial values or business events.
- Do not expose the verified JSON, internal field names, agent names, or validator details.
- Do not describe preliminary operating result as final net profit.
- Do not describe unpaid invoices as received cash.
- Do not describe net tracked cash flow as the bank balance.
- Do not describe invoiced VAT as final VAT payable.
- Treat fraud indicators as review items, not confirmed fraud.
- Do not assume a currency. If no currency is provided, show amounts without a
  currency symbol and say that the currency is unspecified.
- If a requested fact is unavailable, state that it is unavailable instead of estimating it.
""",
        },
        *history_messages,
        {
            "role": "user",
            "content": user_message,
        },
    ]

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=messages,
        max_tokens=1200,
    )

    reply = _response_text(response)
    validation = validate_financial_reply(reply, report_data)

    if not validation.is_valid:
        repair_response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                *messages,
                {
                    "role": "assistant",
                    "content": reply,
                },
                {
                    "role": "user",
                    "content": _repair_instruction(validation),
                },
            ],
            max_tokens=1200,
        )
        reply = _response_text(repair_response)

    return ground_financial_reply(
        reply,
        report_data,
        user_message,
    )
