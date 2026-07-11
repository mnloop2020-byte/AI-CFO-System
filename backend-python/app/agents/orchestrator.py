from typing import Literal
#Note: This imports Literal, which lets us restrict a value to specific allowed strings.
from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.rag.get_context import get_context
from app.schemas.chat_schema import ChatMessage
from app.agents.inventory_agent import run_inventory_agent
from app.agents.sales_agent import run_sales_agent
AgentName = Literal[
    # literal restricts the agent name to one of the following strings.
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
    # this line tells us if any of the keywords are present in the message. It returns True if at least one keyword is found, otherwise False.
    return any(keyword in message for keyword in keywords)

def select_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
    ) -> AgentName:
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

    for old_message in reversed(old_messages or []):
        if old_message.role != "user":
            continue

        previous_agent = select_agent(old_message.content, old_messages)
        if previous_agent != "general":
            return previous_agent

        break

    return "general"
    #Note: If the current message has no clear keyword, this checks the most recent user message and continues with its specialized agent.



def get_agent_instruction(agent_name: AgentName) -> str:
    match agent_name:
        # match means like a switch statement. It checks the value of agent_name and executes the corresponding case.
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
    selected_agent = select_agent(
    user_message=user_message,
    old_messages=old_messages,
)
    #Note: This sends conversation history from the Orchestrator to the agent-selection function.

    if selected_agent == "inventory":
        print("DELEGATING TO INVENTORY AGENT")
        return run_inventory_agent(
    user_message=user_message,
    old_messages=old_messages,
)    
    #Note: This passes both the current question and previous conversation messages to the Inventory Agent.
    if selected_agent == "sales":
        print("DELEGATING TO SALES AGENT")
        return run_sales_agent(
            user_message=user_message,
            old_messages=old_messages,
        )
        
    agent_instruction = get_agent_instruction(selected_agent)
    context_text = get_context(user_message)
    

    history_messages = [
        {
            "role": message.role,
            "content": message.content,
        }
        for message in (old_messages or [])
        # the lesson called  list Comprehension
        # here we gonna covert to message format to let the LLM understand the chat history. 
        # If old_messages is None, we use an empty list instead. 
    ]

    print("==============================")
    print("ORCHESTRATOR CALLED")
    print("USER MESSAGE:", user_message)
    print("SELECTED AGENT:", selected_agent)
    print("==============================")

    client = get_llm_client()
# we call the get_llm_client function to get a client object that allows us to interact with the LLM API.

    response = client.chat.completions.create(
        # Note: This uses the client to send a message to the LLM.
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
            # The star unpacks the list items into another list.
            {
                "role": "user",
                "content": user_message,
            },
        ],
        max_tokens=700,
        # This limits how long the AI response can be
    )

    reply = response.choices[0].message.content

    return reply or "No response generated."



# 1. select_agent
# 2. get_agent_instruction
# 3. get_context
# 4. prepare history_messages
# 5. print debug logs
# 6. get LLM client
# 7. send messages to LLM
# 8. extract reply
# 9. return reply