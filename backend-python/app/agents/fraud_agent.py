import json

from app.ai.llm import get_llm_client
from app.ai.prompts import SYSTEM_PROMPT
from app.config.settings import LLM_MODEL
from app.schemas.chat_schema import ChatMessage
from app.tools.fraud_tools import get_fraud_risk_summary


def run_fraud_agent(
    user_message: str,
    old_messages: list[ChatMessage] | None = None,
) -> str:
    fraud_summary = get_fraud_risk_summary()
    recent_user_messages = [
    {
        "role": "user",
        "content": message.content,
    }
    for message in (old_messages or [])
    if message.role == "user"
][-3:]
    client = get_llm_client()

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": f"""
{SYSTEM_PROMPT}

You are the Fraud Detection Agent.

Your responsibilities:
- Explain flagged expenses that require review.
- Identify exact duplicate expense candidates.
- Identify duplicate invoice numbers.
- Recommend practical review steps.
- Answer in the same language as the user.

Verified fraud-risk summary:
{json.dumps(fraud_summary, ensure_ascii=False, default=str)}

Strict data rules:
- Use only the verified fraud-risk summary above.
- Ignore financial values, invoices, customers, vendors, and examples
  from previous conversation messages.
- Treat every result as a review indicator, not confirmed fraud.
- Never accuse a customer, vendor, or employee of fraud.
- Do not invent suspicious transactions, invoice numbers, customer
  names, vendors, amounts, dates, or evidence.
- If duplicate_expense_candidates is empty, clearly state that no exact
  duplicate expense candidates were found.
- If duplicate_invoice_numbers is empty, clearly state that no duplicate
  invoice numbers were found.
- If fraud_confirmed is false, clearly state that fraud is not confirmed.
- Do not assume a currency.
- If no currency is provided, show amounts without a currency symbol and
  state that the currency is unspecified.
  - Do not infer or explain why an expense was flagged unless the verified
  data contains an explicit flag reason.
- A missing or unknown vendor is incomplete data, not evidence of fraud,
  concealment, or wrongdoing.
- Never infer intent, misconduct, legitimacy, or criminal behavior.
- Keep recommendations neutral and procedural, such as checking receipts,
  vendor records, approvals, and supporting documents.
""",
            },
            *recent_user_messages,
            {
                "role": "user",
                "content": user_message,
            },
        ],
        max_tokens=600,
    )

    reply = response.choices[0].message.content

    return reply or "No response generated."


# Note: This agent uses only the current verified fraud data and does not
# send old conversation messages to the LLM, preventing unrelated historical
# information from contaminating fraud-risk results.