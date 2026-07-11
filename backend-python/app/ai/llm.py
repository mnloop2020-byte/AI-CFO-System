from openai import OpenAI

from app.config.settings import OPENROUTER_API_KEY, OPENROUTER_BASE_URL

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY is missing. Add it to backend-python/.env")

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL,
)


def get_llm_client() -> OpenAI:
    return client


# Note: This file creates the OpenRouter LLM client using the OpenAI SDK.

# أنت = orchestrator.py
# الاستقبال = llm.py
# رقم العضوية / التصريح = API Key
# شركة الاتصال = OpenRouter
# الطبيب = LLM Model
# دور llm.py.
# هو لا يفكر مثل الطبيب، فقط يجهز الاتصال.