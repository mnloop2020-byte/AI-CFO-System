from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone


_UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-"
    r"[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b"
)
_EMAIL_PATTERN = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
_BEARER_PATTERN = re.compile(r"(?i)bearer\s+[a-z0-9._~+/-]+")


def sanitize_log_text(value: str) -> str:
    value = _BEARER_PATTERN.sub("Bearer <redacted>", value)
    value = _EMAIL_PATTERN.sub("<email>", value)
    return _UUID_PATTERN.sub("<id>", value)


class SafeJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "event": sanitize_log_text(record.getMessage()),
        }
        for key in (
            "request_id",
            "method",
            "route",
            "status_code",
            "duration_ms",
            "agent",
            "model",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
        ):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = sanitize_log_text(value) if isinstance(value, str) else value
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging() -> None:
    root = logging.getLogger()
    if getattr(root, "_zemam_safe_logging", False):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(SafeJsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    root._zemam_safe_logging = True  # type: ignore[attr-defined]


logger = logging.getLogger("ai_cfo_backend")
