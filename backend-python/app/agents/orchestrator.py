from typing import Literal

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
            return "You are the Sales Agent. Focus on sales and revenue."

        case "inventory":
            return "You are the Inventory Agent. Focus on stock and low inventory."

        case "cashflow":
            return "You are the Cash Flow Agent. Focus on cash and liquidity."

        case "tax":
            return "You are the Tax Agent. Focus on VAT, tax, and zakat."

        case "fraud":
            return "You are the Fraud Agent. Focus on suspicious activity."

        case "accounting":
            return "You are the Accounting Agent. Focus on profit, loss, and expenses."

        case "general":
            return "You are the General CFO Assistant."


def run_orchestrator(user_message: str) -> str:
    selected_agent = select_agent(user_message)
    agent_instruction = get_agent_instruction(selected_agent)

    print("==============================")
    print("ORCHESTRATOR CALLED")
    print("USER MESSAGE:", user_message)
    print("SELECTED AGENT:", selected_agent)
    print("==============================")

    return (
        f"Selected agent: {selected_agent}\n"
        f"Instruction: {agent_instruction}\n"
        f"Message received: {user_message}"
    )


# Note: This file selects the correct AI agent based on the user's message.