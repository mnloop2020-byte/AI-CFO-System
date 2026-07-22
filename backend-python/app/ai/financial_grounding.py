from __future__ import annotations

import json
import re
from copy import deepcopy
from decimal import Decimal, InvalidOperation
from typing import Any


_NUMBER_PATTERN = re.compile(r"(?<![\w-])-?\d[\d,]*(?:\.\d+)?")
_CURRENCY_MARKERS = ("$", "€", "£", "¥", " USD", " EUR", " SAR", " TRY")


def enrich_financial_data(metrics: dict[str, Any]) -> dict[str, Any]:
    """Attach trusted company context without accepting it from the caller."""
    from app.services.company_store import get_company_settings

    company = get_company_settings()
    enriched_metrics = deepcopy(metrics)
    tax_metrics = enriched_metrics.get("tax", enriched_metrics)
    if "tax_jurisdiction_configured" in tax_metrics:
        tax_metrics["tax_jurisdiction_configured"] = bool(
            company.tax_jurisdiction
        )

    sources = list(enriched_metrics.get("data_sources", []))
    sources.append(
        {
            "table": "companies",
            "record_ids": [company.id],
            "fields": [
                "currency",
                "tax_jurisdiction",
                "vat_registered",
            ],
        }
    )

    return {
        **enriched_metrics,
        "company_context": {
            "currency": company.currency,
            "tax_jurisdiction": company.tax_jurisdiction,
            "vat_registered": company.vat_registered,
            "bank_balance_available": False,
            "complete_liabilities_available": False,
            "forecast_available": False,
        },
        "data_sources": sources,
    }


def _collect_numbers(value: Any) -> set[Decimal]:
    numbers: set[Decimal] = set()

    if isinstance(value, bool) or value is None:
        return numbers

    if isinstance(value, (int, float, Decimal)):
        try:
            numbers.add(Decimal(str(value)).normalize())
        except InvalidOperation:
            pass
        return numbers

    if isinstance(value, str):
        for token in _NUMBER_PATTERN.findall(value):
            try:
                numbers.add(Decimal(token.replace(",", "")).normalize())
            except InvalidOperation:
                continue
        return numbers

    if isinstance(value, dict):
        for nested in value.values():
            numbers.update(_collect_numbers(nested))
    elif isinstance(value, (list, tuple)):
        for nested in value:
            numbers.update(_collect_numbers(nested))

    return numbers


def find_unsupported_numbers(
    reply: str,
    verified_data: dict[str, Any],
) -> list[str]:
    allowed = _collect_numbers(verified_data)
    unsupported: list[str] = []

    for token in _NUMBER_PATTERN.findall(reply):
        normalized = token.replace(",", "")
        try:
            number = Decimal(normalized).normalize()
        except InvalidOperation:
            continue

        # Single digits are allowed for Markdown numbering and source labels.
        if number in allowed or (number == number.to_integral() and 0 <= number <= 9):
            continue
        unsupported.append(token)

    return unsupported


def _has_unsupported_claims(
    reply: str,
    verified_data: dict[str, Any],
) -> bool:
    lowered = reply.casefold()
    company = verified_data.get("company_context", {})

    if company.get("currency") is None and any(
        marker.casefold() in lowered for marker in _CURRENCY_MARKERS
    ):
        return True

    unavailable_claim_patterns = (
        r"bank balance\s+(?:is|was|equals|of)\s+(?!unavailable|not available)",
        r"net vat payable\s+(?:is|was|equals|of)\s+(?!unavailable|not available)",
        r"final net profit\s+(?:is|was|equals|of)\s+(?!unavailable|not available)",
    )
    return any(re.search(pattern, lowered) for pattern in unavailable_claim_patterns)


def _source_footer(verified_data: dict[str, Any], is_arabic: bool) -> str:
    sources = verified_data.get("data_sources", [])
    heading = "### مصادر البيانات" if is_arabic else "### Data sources"

    if not sources:
        empty = "- لا توجد مصادر بيانات مسجلة." if is_arabic else "- No data sources recorded."
        return f"{heading}\n{empty}"

    lines: list[str] = []
    seen: set[str] = set()
    for source in sources:
        table = str(source.get("table", "unknown"))
        record_ids = source.get("record_ids", [])
        calculation = source.get("calculation")
        signature = json.dumps(source, sort_keys=True, default=str)
        if signature in seen:
            continue
        seen.add(signature)

        count_text = (
            f"{len(record_ids)} سجل" if is_arabic else f"{len(record_ids)} record(s)"
        )
        line = f"- `{table}` — {count_text}"
        if calculation:
            line += f" — {calculation}"
        lines.append(line)

    return f"{heading}\n" + "\n".join(lines)


def _safe_fallback(verified_data: dict[str, Any], is_arabic: bool) -> str:
    heading = "### البيانات المالية المتحقق منها" if is_arabic else "### Verified financial data"
    note = (
        "تعذر اعتماد الصياغة التفسيرية لأنها احتوت ادعاءً غير مدعوم. "
        "فيما يلي البيانات الحتمية فقط."
        if is_arabic
        else "The narrative was withheld because it contained an unsupported claim. "
        "Only deterministic data is shown below."
    )
    metrics = verified_data.get("verified_metrics", verified_data)
    payload = json.dumps(metrics, ensure_ascii=False, default=str, indent=2)
    return f"{heading}\n\n{note}\n\n```json\n{payload}\n```"


def ground_financial_reply(
    reply: str,
    verified_data: dict[str, Any],
    user_message: str,
) -> str:
    """Reject unsupported numeric/categorical claims and append provenance."""
    is_arabic = any("\u0600" <= character <= "\u06ff" for character in user_message)
    grounded = reply.strip()

    if (
        not grounded
        or find_unsupported_numbers(grounded, verified_data)
        or _has_unsupported_claims(grounded, verified_data)
    ):
        grounded = _safe_fallback(verified_data, is_arabic)

    source_heading = "### مصادر البيانات" if is_arabic else "### Data sources"
    if source_heading not in grounded:
        grounded = f"{grounded}\n\n{_source_footer(verified_data, is_arabic)}"

    return grounded
