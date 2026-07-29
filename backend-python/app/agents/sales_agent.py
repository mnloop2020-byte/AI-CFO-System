import json

from app.ai.llm import get_llm_client
from app.ai.financial_grounding import enrich_financial_data, ground_financial_reply
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.sales_tools import get_sales_summary


def run_sales_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    sales_summary = enrich_financial_data(get_sales_summary())

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

You are the Sales Agent.

Your responsibilities:
- Analyze sales and completed revenue.
- Explain units sold and sales status.
- Give clear and practical sales insights.
- Answer in the same language as the user.

Real sales summary:
{json.dumps(sales_summary, ensure_ascii=False, default=str)}

Use only the real sales data above.
Do not invent sales, quantities, revenue, or customers.
Treat only completed sales as completed revenue.
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
        max_tokens=500,
    )

    reply = response.choices[0].message.content

    return ground_financial_reply(
        reply or "",
        sales_summary,
        user_message,
    )



# Note: This Sales Agent uses the Sales Summary Tool, conversation history, and the LLM to answer questions using real Supabase sales data.
