from typing import Literal

from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.rag.get_context import get_context
from app.schemas.chat_schema import ChatMessage

AgentName = Literal[
    "sales",
    "inventory",
    "cashflow",
    "tax",
    "fraud",
    "accounting",
    "general",
]


agent_keywords: dict[str, list[str]] = {
    "sales": [
        "sale",
        "sales",
        "revenue",
        "income",
        "مبيعات",
        "إيرادات",
        "ايرادات",
        "دخل",
    ],
    "inventory": [
        "inventory",
        "stock",
        "product",
        "products",
        "low inventory",
        "مخزون",
        "منتج",
        "منتجات",
        "المنتجات",
    ],
    "cashflow": [
        "cash",
        "cash flow",
        "liquidity",
        "money",
        "تدفق",
        "التدفق النقدي",
        "سيولة",
        "كاش",
        "نقد",
    ],
    "tax": [
        "tax",
        "vat",
        "zakat",
        "ضريبة",
        "الضريبة",
        "زكاة",
        "القيمة المضافة",
    ],
    "fraud": [
        "fraud",
        "suspicious",
        "duplicate",
        "unusual",
        "احتيال",
        "مشبوه",
        "مكرر",
        "تلاعب",
        "غير طبيعي",
    ],
    "accounting": [
        "profit",
        "loss",
        "expense",
        "expenses",
        "invoice",
        "invoices",
        "debt",
        "ربح",
        "أرباح",
        "ارباح",
        "خسارة",
        "مصروف",
        "مصاريف",
        "فاتورة",
        "فواتير",
        "ديون",
        "مستحقات",
    ],
}


def has_any_keyword(message: str, keywords: list[str]) -> bool:
    return any(keyword in message for keyword in keywords)


def select_agent(user_message: str) -> AgentName:
    message = user_message.lower()

    if has_any_keyword(message, agent_keywords["sales"]):
        return "sales"

    if has_any_keyword(message, agent_keywords["inventory"]):
        return "inventory"

    if has_any_keyword(message, agent_keywords["cashflow"]):
        return "cashflow"

    if has_any_keyword(message, agent_keywords["tax"]):
        return "tax"

    if has_any_keyword(message, agent_keywords["fraud"]):
        return "fraud"

    if has_any_keyword(message, agent_keywords["accounting"]):
        return "accounting"

    return "general"


def get_agent_instruction(agent_name: AgentName) -> str:
    match agent_name:
        case "sales":
            return "You are the Sales Agent. Focus on sales, revenue, products sold, and sales performance."

        case "inventory":
            return "You are the Inventory Agent. Focus on stock levels, low inventory, products, and reorder needs."

        case "cashflow":
            return "You are the Cash Flow Agent. Focus on cash movement, liquidity, and future cash needs."

        case "tax":
            return "You are the Tax Agent. Focus on VAT, tax, zakat, and tax-related summaries."

        case "fraud":
            return "You are the Fraud Detection Agent. Focus on suspicious transactions and unusual financial activity."

        case "accounting":
            return "You are the Accounting Agent. Focus on profit, loss, expenses, invoices, and debts."

        case "general":
            return "You are the General CFO Assistant. Give a helpful financial answer."


def run_orchestrator(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    selected_agent = select_agent(user_message)
    agent_instruction = get_agent_instruction(selected_agent)
    context_text = get_context(user_message)

    history_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in (old_messages or [])
    ]

    print("==============================")
    print("ORCHESTRATOR CALLED")
    print("USER MESSAGE:", user_message)
    print("SELECTED AGENT:", selected_agent)
    print("==============================")

    client = get_llm_client()

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"""
{SYSTEM_PROMPT}

You are now acting as the Orchestrator.

Selected agent: {selected_agent}

Agent instruction:
{agent_instruction}

Financial context:
{context_text}
""",
            },
            *history_messages,
            {
                "role": "user",
                "content": user_message,
            },
        ],
        max_tokens=700,
    )

    reply = response.choices[0].message.content

    return reply or "No response generated."


# Note: This file selects the right agent and sends chat history to the LLM.