import logging

import httpx
from openai import OpenAI

from app.config.settings import (
    LLM_MAX_RETRIES,
    LLM_TIMEOUT_SECONDS,
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
)
from app.monitoring.metrics import metrics


logger = logging.getLogger("ai_cfo_backend.llm")

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY is missing. Add it to backend-python/.env")

def _record_llm_usage(response: httpx.Response) -> None:
    try:
        response.read()
        payload = response.json()
        usage = payload.get("usage") or {}
        model = str(payload.get("model") or "unknown")[:120]
        metrics.record_llm(
            model=model,
            status_code=response.status_code,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
        )
        logger.info(
            "llm_request_complete",
            extra={
                "model": model,
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "total_tokens": usage.get("total_tokens"),
                "status_code": response.status_code,
            },
        )
    except Exception:
        metrics.record_llm(
            model="unknown",
            status_code=response.status_code,
        )
        logger.info(
            "llm_request_complete_without_usage",
            extra={"status_code": response.status_code},
        )


http_client = httpx.Client(
    timeout=httpx.Timeout(LLM_TIMEOUT_SECONDS),
    event_hooks={"response": [_record_llm_usage]},
)

client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL,
    timeout=LLM_TIMEOUT_SECONDS,
    max_retries=LLM_MAX_RETRIES,
    http_client=http_client,
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
