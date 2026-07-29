"""Start one hardened Uvicorn worker for a Pilot or Production container."""

from __future__ import annotations

import os

import uvicorn

from app.config.settings import (
    APP_ENV,
    DEPLOYED_ENVIRONMENTS,
    FORWARDED_ALLOW_IPS,
)


def bounded_integer(name: str, default: int, minimum: int, maximum: int) -> int:
    raw_value = os.getenv(name, str(default)).strip()
    try:
        value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer.") from error
    if not minimum <= value <= maximum:
        raise RuntimeError(
            f"{name} must be between {minimum} and {maximum}."
        )
    return value


def main() -> None:
    if APP_ENV not in DEPLOYED_ENVIRONMENTS:
        raise RuntimeError(
            "The Production runner requires APP_ENV=pilot or production."
        )
    port = bounded_integer("PORT", 8000, 1, 65535)
    concurrency = bounded_integer(
        "UVICORN_LIMIT_CONCURRENCY",
        200,
        10,
        5000,
    )
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        proxy_headers=True,
        forwarded_allow_ips=",".join(FORWARDED_ALLOW_IPS),
        access_log=False,
        server_header=False,
        date_header=False,
        timeout_keep_alive=5,
        timeout_graceful_shutdown=30,
        limit_concurrency=concurrency,
    )


if __name__ == "__main__":
    main()
