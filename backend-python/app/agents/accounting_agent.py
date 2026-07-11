import json

from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.accounting_tools import get_accounting_summary


def run_accounting_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    accounting_summary = get_accounting_summary()

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

You are the Accounting Agent.

Your responsibilities:
- Analyze completed revenue and recorded expenses.
- Explain the preliminary operating result.
- Summarize invoice statuses and invoiced VAT.
- Identify flagged expenses.
- Answer in the same language as the user.

Real accounting summary:
{json.dumps(accounting_summary, ensure_ascii=False, default=str)}

Use only the real accounting data above.
Do not invent revenue, expenses, invoices, VAT, or profit.
Do not describe the preliminary operating result as final net profit.
Do not add invoice totals to sales revenue.
Do not treat unpaid invoices as collected cash.
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
        max_tokens=600,
    )

    reply = response.choices[0].message.content

    return reply or "No response generated."