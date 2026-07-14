import json
from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.cashflow_tools import get_cashflow_summary


def run_cashflow_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    cashflow_summary = get_cashflow_summary()

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

You are the Cash Flow Agent.

Your responsibilities:
- Analyze tracked cash inflows and recorded cash outflows.
- Explain net tracked cash flow.
- Identify expected inflows from unpaid invoices.
- Explain cash flow limitations clearly.
- Answer in the same language as the user.

Real cash flow summary:
{json.dumps(cashflow_summary, ensure_ascii=False, default=str)}

Use only the real cash flow data above.
Do not treat unpaid invoices as received cash.
Do not describe net tracked cash flow as the bank balance.
Do not claim to know available cash when bank balance data is unavailable.
Do not invent payments, balances, expenses, or invoices.
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
# file explain the cash flow agent's function, which analyzes cash inflows and outflows, explains net tracked cash flow, identifies expected inflows from unpaid invoices, and provides clear explanations of cash flow limitations. It uses real cash flow data and avoids making assumptions or inventing information.    