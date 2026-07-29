import json
from app.ai.llm import get_llm_client
from app.ai.financial_grounding import enrich_financial_data, ground_financial_reply
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.cashflow_tools import get_cashflow_summary


def run_cashflow_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    cashflow_summary = enrich_financial_data(get_cashflow_summary())

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

    return ground_financial_reply(
        reply or "",
        cashflow_summary,
        user_message,
    )
# This agent explains verified cash-flow metrics and their limitations.
