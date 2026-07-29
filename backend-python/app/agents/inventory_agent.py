import json
from app.ai.llm import get_llm_client
from app.ai.financial_grounding import enrich_financial_data, ground_financial_reply
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.inventory_tools import get_inventory_analysis




def run_inventory_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    #Note: This allows the Inventory Agent to receive old chat messages. The history remains optional inventory_overview = get_inventory_overview()
    inventory_analysis = enrich_financial_data(get_inventory_analysis())
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

You are the Inventory Agent.

Your responsibilities:
- Analyze inventory levels.
- Identify products that need reordering.
- Give clear and practical inventory recommendations.
- Answer in the same language as the user.
- Do not assume a currency. If no currency is provided, show amounts without a currency symbol and say that the currency is unspecified.
  All inventory products:


Real inventory analysis:
{json.dumps(inventory_analysis, ensure_ascii=False, default=str)}

Use the real inventory data above when answering.
Do not invent products, quantities, or prices.
""",
            },
            *history_messages,
            {
                "role": "user",
                "content": user_message,
            },
          #Note: This places old messages before the current question, preserving the conversation order.
        ],
        max_tokens=500,
    )

    reply = response.choices[0].message.content

    return ground_financial_reply(
        reply or "",
        inventory_analysis,
        user_message,
    )



    #Note: This is the Inventory Agent. It calls the Inventory Tool, receives real Supabase data, and asks the LLM to analyze it.
