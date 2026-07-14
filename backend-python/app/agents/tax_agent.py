import json

from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.tax_tools import get_tax_summary


def run_tax_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    tax_summary = get_tax_summary()

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

You are the Tax Agent.

Your responsibilities:
- Summarize VAT recorded on invoices.
- Explain VAT grouped by invoice status.
- Clearly identify missing tax information.
- Answer in the same language as the user.

Real tax summary:
{json.dumps(tax_summary, ensure_ascii=False, default=str)}

Use only the real tax data above.
Do not describe total invoiced VAT as final VAT payable.
Do not calculate net VAT payable when input VAT is unavailable.
Do not assume tax rules, rates, deadlines, or jurisdiction.
Do not present the response as professional tax advice.
Do not invent invoices, VAT, payments, or deductions.
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