"""Read-only HTTP readiness gate for local and target Pilot environments.

The check never authenticates, mutates business data, or prints response
bodies, credentials, tokens, cookies, or environment values.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from typing import Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen


SECURITY_HEADERS = (
    "content-security-policy",
    "permissions-policy",
    "referrer-policy",
    "x-content-type-options",
    "x-frame-options",
)
LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


@dataclass(frozen=True, slots=True)
class HttpResult:
    status: int
    headers: Mapping[str, str]
    body: bytes


@dataclass(frozen=True, slots=True)
class CheckResult:
    name: str
    status: str
    detail: str


def normalize_base_url(value: str, *, name: str) -> str:
    normalized = value.strip().rstrip("/")
    parsed = urlsplit(normalized)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(f"{name} must be an exact HTTP(S) origin.")
    try:
        parsed.port
    except ValueError as error:
        raise ValueError(f"{name} must use a valid port.") from error
    return normalized


def fetch(
    url: str,
    *,
    timeout: float,
    method: str = "GET",
    headers: Mapping[str, str] | None = None,
) -> HttpResult:
    request = Request(
        url,
        method=method,
        headers=dict(headers or {}),
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return HttpResult(
                status=response.status,
                headers={key.lower(): value for key, value in response.headers.items()},
                body=response.read(),
            )
    except HTTPError as error:
        return HttpResult(
            status=error.code,
            headers={key.lower(): value for key, value in error.headers.items()},
            body=error.read(),
        )


def check_json_status(
    *,
    name: str,
    result: HttpResult,
    expected_status: str,
) -> CheckResult:
    if result.status != 200:
        return CheckResult(name, "fail", f"HTTP {result.status}")
    try:
        payload = json.loads(result.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return CheckResult(name, "fail", "Response is not valid JSON.")
    if payload != {"status": expected_status}:
        return CheckResult(name, "fail", "Unexpected health response contract.")
    return CheckResult(name, "pass", f"HTTP 200 ({expected_status})")


def check_target_url(name: str, url: str, *, mode: str) -> CheckResult:
    parsed = urlsplit(url)
    if mode == "target" and (
        parsed.scheme != "https" or parsed.hostname in LOOPBACK_HOSTS
    ):
        return CheckResult(
            name,
            "fail",
            "Target Pilot origins must use HTTPS and a non-loopback host.",
        )
    return CheckResult(name, "pass", "Origin format is valid.")


def run_checks(
    *,
    api_url: str,
    frontend_url: str,
    mode: str,
    timeout: float,
) -> list[CheckResult]:
    checks = [
        check_target_url("api_origin", api_url, mode=mode),
        check_target_url("frontend_origin", frontend_url, mode=mode),
    ]
    if any(check.status == "fail" for check in checks):
        return checks

    live = fetch(urljoin(f"{api_url}/", "health/live"), timeout=timeout)
    ready = fetch(urljoin(f"{api_url}/", "health/ready"), timeout=timeout)
    checks.extend(
        (
            check_json_status(
                name="backend_liveness",
                result=live,
                expected_status="ok",
            ),
            check_json_status(
                name="backend_readiness",
                result=ready,
                expected_status="ready",
            ),
        )
    )

    request_id = live.headers.get("x-request-id", "").strip()
    checks.append(
        CheckResult(
            "backend_request_id",
            "pass" if request_id else "fail",
            "Present." if request_id else "Missing X-Request-ID.",
        )
    )

    preflight = fetch(
        urljoin(f"{api_url}/", "health/live"),
        timeout=timeout,
        method="OPTIONS",
        headers={
            "Origin": frontend_url,
            "Access-Control-Request-Method": "GET",
        },
    )
    allowed_origin = preflight.headers.get("access-control-allow-origin")
    checks.append(
        CheckResult(
            "exact_cors_origin",
            "pass"
            if preflight.status == 200 and allowed_origin == frontend_url
            else "fail",
            "Exact frontend origin allowed."
            if preflight.status == 200 and allowed_origin == frontend_url
            else "Backend CORS does not allow the exact frontend origin.",
        )
    )

    login = fetch(urljoin(f"{frontend_url}/", "login"), timeout=timeout)
    checks.append(
        CheckResult(
            "frontend_login",
            "pass" if login.status == 200 else "fail",
            "HTTP 200" if login.status == 200 else f"HTTP {login.status}",
        )
    )
    missing_headers = [
        header for header in SECURITY_HEADERS if not login.headers.get(header)
    ]
    checks.append(
        CheckResult(
            "frontend_security_headers",
            "pass" if not missing_headers else "fail",
            "Required headers present."
            if not missing_headers
            else f"Missing: {', '.join(missing_headers)}",
        )
    )

    hsts_present = bool(login.headers.get("strict-transport-security"))
    checks.append(
        CheckResult(
            "frontend_hsts",
            "pass" if hsts_present else ("warn" if mode == "local" else "fail"),
            "Present."
            if hsts_present
            else (
                "Expected to be absent on local HTTP."
                if mode == "local"
                else "Missing Strict-Transport-Security."
            ),
        )
    )
    return checks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a read-only AI CFO Pilot HTTP readiness gate."
    )
    parser.add_argument(
        "--api-url",
        default="http://127.0.0.1:8000",
        help="Exact backend origin.",
    )
    parser.add_argument(
        "--frontend-url",
        default="http://localhost:3000",
        help="Exact frontend origin.",
    )
    parser.add_argument(
        "--mode",
        choices=("local", "target"),
        default="local",
        help="Target mode requires non-loopback HTTPS and HSTS.",
    )
    parser.add_argument("--timeout", type=float, default=10.0)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        api_url = normalize_base_url(args.api_url, name="api_url")
        frontend_url = normalize_base_url(
            args.frontend_url,
            name="frontend_url",
        )
        checks = run_checks(
            api_url=api_url,
            frontend_url=frontend_url,
            mode=args.mode,
            timeout=args.timeout,
        )
    except (ValueError, URLError, TimeoutError) as error:
        checks = [
            CheckResult(
                "readiness_execution",
                "fail",
                f"{type(error).__name__}: connectivity or URL validation failed.",
            )
        ]

    summary = {
        "status": (
            "pass"
            if all(check.status != "fail" for check in checks)
            else "fail"
        ),
        "mode": args.mode,
        "checks": [asdict(check) for check in checks],
    }
    print(json.dumps(summary, indent=2))
    return 0 if summary["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
