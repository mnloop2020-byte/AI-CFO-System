import json

from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.report_tools import get_cfo_report_data


def run_report_writer_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    report_data = get_cfo_report_data()

    history_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in (old_messages or [])
    ]

    client = get_llm_client()

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
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
- Use concise Markdown headings and bullet points.
- Refer to unpaid invoices as outstanding receivables or expected cash inflows, never as expected revenue.
Verified CFO report data:
{json.dumps(report_data, ensure_ascii=False, default=str)}

Use only the verified data above.
Do not invent financial values or business events.
Do not describe preliminary operating result as final net profit.
Do not describe unpaid invoices as received cash.
Do not describe net tracked cash flow as the bank balance.
Do not describe invoiced VAT as final VAT payable.
Treat fraud indicators as review items, not confirmed fraud.
Do not assume a currency. If no currency is provided, show amounts
without a currency symbol and say that the currency is unspecified.
""",
            },
            *history_messages,
            {
                "role": "user",
                "content": user_message,
            },
        ],
        max_tokens=1200,
    )

    reply = response.choices[0].message.content

    return reply or "No response generated."