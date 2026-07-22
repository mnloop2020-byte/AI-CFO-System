import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv(
    "OPENROUTER_BASE_URL",
    "https://openrouter.ai/api/v1",
)
LLM_MODEL = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "45"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))
CHAT_MAX_MESSAGE_CHARS = int(os.getenv("CHAT_MAX_MESSAGE_CHARS", "8000"))
CHAT_MAX_HISTORY_MESSAGES = int(os.getenv("CHAT_MAX_HISTORY_MESSAGES", "20"))
CHAT_MAX_HISTORY_CHARS = int(os.getenv("CHAT_MAX_HISTORY_CHARS", "12000"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

RAG_MATCH_COUNT = int(os.getenv("RAG_MATCH_COUNT", "5"))
RAG_MIN_SIMILARITY = float(os.getenv("RAG_MIN_SIMILARITY", "0.35"))
RAG_DOCUMENT_BUCKET = os.getenv("RAG_DOCUMENT_BUCKET", "documents")
RAG_MAX_FILE_SIZE_BYTES = int(
    os.getenv("RAG_MAX_FILE_SIZE_BYTES", str(10 * 1024 * 1024))
)
RAG_MAX_CONTEXT_CHARS = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "6000"))


# Note: This file loads OpenRouter, Supabase, and RAG settings from backend-python/.env.
