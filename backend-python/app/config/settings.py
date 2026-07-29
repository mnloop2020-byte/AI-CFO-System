import os
import ipaddress
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH)

LOCAL_CORS_ALLOWED_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)
DEPLOYED_ENVIRONMENTS = {"pilot", "production"}


def normalize_app_environment(value: str | None) -> str:
    environment = (value or "development").strip().lower()
    if environment not in {"development", "test", *DEPLOYED_ENVIRONMENTS}:
        raise RuntimeError(
            "APP_ENV must be development, test, pilot, or production."
        )
    return environment


def parse_cors_allowed_origins(
    raw_value: str | None,
    *,
    app_environment: str,
) -> tuple[str, ...]:
    if raw_value is None or not raw_value.strip():
        if app_environment in DEPLOYED_ENVIRONMENTS:
            raise RuntimeError(
                "CORS_ALLOWED_ORIGINS is required for pilot and production."
            )
        return LOCAL_CORS_ALLOWED_ORIGINS

    origins: list[str] = []
    for candidate in raw_value.split(","):
        origin = candidate.strip().rstrip("/")
        if not origin:
            continue
        if origin == "*" or "*" in origin:
            raise RuntimeError("CORS_ALLOWED_ORIGINS cannot contain wildcards.")

        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise RuntimeError(
                "Each CORS origin must be an exact HTTP(S) origin without "
                "credentials, path, query, or fragment."
            )
        try:
            parsed.port
        except ValueError as error:
            raise RuntimeError("Each CORS origin must use a valid port.") from error
        if app_environment in DEPLOYED_ENVIRONMENTS and parsed.scheme != "https":
            raise RuntimeError(
                "Pilot and production CORS origins must use HTTPS."
            )
        if origin not in origins:
            origins.append(origin)

    if not origins:
        raise RuntimeError("CORS_ALLOWED_ORIGINS must contain at least one origin.")
    return tuple(origins)


def parse_rate_limit_backend(
    raw_value: str | None,
    *,
    app_environment: str,
) -> str:
    backend = (raw_value or "memory").strip().lower()
    if backend not in {"memory", "redis"}:
        raise RuntimeError("RATE_LIMIT_BACKEND must be memory or redis.")
    if app_environment in DEPLOYED_ENVIRONMENTS and backend != "redis":
        raise RuntimeError(
            "Pilot and production require RATE_LIMIT_BACKEND=redis."
        )
    return backend


def validate_rate_limit_redis_url(
    raw_value: str | None,
    *,
    backend: str,
    app_environment: str,
) -> str | None:
    if backend == "memory":
        return None
    value = (raw_value or "").strip()
    if not value:
        raise RuntimeError(
            "RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_BACKEND=redis."
        )
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"redis", "rediss"}
        or parsed.hostname is None
        or parsed.fragment
    ):
        raise RuntimeError("RATE_LIMIT_REDIS_URL must be a valid Redis URL.")
    try:
        parsed.port
    except ValueError as error:
        raise RuntimeError(
            "RATE_LIMIT_REDIS_URL must use a valid port."
        ) from error
    if app_environment in DEPLOYED_ENVIRONMENTS and parsed.scheme != "rediss":
        raise RuntimeError(
            "Pilot and production require a TLS Redis URL using rediss://."
        )
    return value


def validate_metrics_bearer_token(
    raw_value: str | None,
    *,
    app_environment: str,
) -> str | None:
    value = (raw_value or "").strip()
    if not value:
        if app_environment in DEPLOYED_ENVIRONMENTS:
            raise RuntimeError(
                "METRICS_BEARER_TOKEN is required for pilot and production."
            )
        return None
    if len(value) < 32:
        raise RuntimeError(
            "METRICS_BEARER_TOKEN must contain at least 32 characters."
        )
    return value


def parse_forwarded_allow_ips(
    raw_value: str | None,
    *,
    app_environment: str,
) -> tuple[str, ...]:
    value = (raw_value or "").strip()
    if not value:
        if app_environment in DEPLOYED_ENVIRONMENTS:
            raise RuntimeError(
                "FORWARDED_ALLOW_IPS is required for pilot and production."
            )
        return ("127.0.0.1",)

    networks: list[str] = []
    for candidate in value.split(","):
        network = candidate.strip()
        if not network or network == "*":
            raise RuntimeError(
                "FORWARDED_ALLOW_IPS must contain explicit IP addresses or CIDRs."
            )
        try:
            normalized = str(ipaddress.ip_network(network, strict=False))
        except ValueError as error:
            raise RuntimeError(
                "FORWARDED_ALLOW_IPS contains an invalid IP address or CIDR."
            ) from error
        if normalized not in networks:
            networks.append(normalized)
    return tuple(networks)


APP_ENV = normalize_app_environment(os.getenv("APP_ENV"))
CORS_ALLOWED_ORIGINS = parse_cors_allowed_origins(
    os.getenv("CORS_ALLOWED_ORIGINS"),
    app_environment=APP_ENV,
)
RATE_LIMIT_BACKEND = parse_rate_limit_backend(
    os.getenv("RATE_LIMIT_BACKEND"),
    app_environment=APP_ENV,
)
RATE_LIMIT_REDIS_URL = validate_rate_limit_redis_url(
    os.getenv("RATE_LIMIT_REDIS_URL"),
    backend=RATE_LIMIT_BACKEND,
    app_environment=APP_ENV,
)
METRICS_BEARER_TOKEN = validate_metrics_bearer_token(
    os.getenv("METRICS_BEARER_TOKEN"),
    app_environment=APP_ENV,
)
FORWARDED_ALLOW_IPS = parse_forwarded_allow_ips(
    os.getenv("FORWARDED_ALLOW_IPS"),
    app_environment=APP_ENV,
)

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

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip().lower() in {
    "1",
    "true",
    "yes",
}
SMTP_TIMEOUT_SECONDS = float(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))


# Note: This file loads backend service settings without exposing their values.
