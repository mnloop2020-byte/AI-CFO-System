from __future__ import annotations

import json
import re
from copy import deepcopy
from decimal import Decimal, InvalidOperation
from typing import Any


_NUMBER_PATTERN = re.compile(r"(?<![\w-])-?\d[\d,]*(?:\.\d+)?")
_CURRENCY_MARKERS = ("$", "€", "£", "¥", " USD", " EUR", " SAR", " TRY")
_INTERNAL_DISPLAY_KEYS = frozenset(
    {
        "agents",
        "company_id",
        "created_at",
        "data_sources",
        "document_id",
        "embedding",
        "id",
        "metadata",
        "record_ids",
        "results",
        "updated_at",
    }
)
_ARABIC_LABELS = {
    "accounting": "المحاسبة",
    "amount": "المبلغ",
    "bank_balance_available": "توفر رصيد البنك",
    "cash_flow": "التدفق النقدي",
    "category": "الفئة",
    "company_context": "سياق الشركة",
    "completed_revenue": "إيرادات المبيعات المكتملة",
    "completed_sales_count": "عدد المبيعات المكتملة",
    "complete_liabilities_available": "توفر بيانات الالتزامات الكاملة",
    "count": "العدد",
    "currency": "العملة",
    "duplicate_expense_candidates": "مصروفات مرشحة للمراجعة كمكررة",
    "duplicate_invoice_numbers": "أرقام فواتير مرشحة للمراجعة كمكررة",
    "expected_unpaid_inflows": "التدفقات المتوقعة من الفواتير غير المدفوعة",
    "expense_categories": "فئات المصروفات",
    "flagged_expenses": "المصروفات المعلّمة للمراجعة",
    "flagged_expenses_count": "عدد المصروفات المعلّمة للمراجعة",
    "forecast_available": "توفر التوقعات",
    "fraud_confirmed": "وجود احتيال مؤكد",
    "fraud_risk": "مراجعة المخاطر",
    "input_vat_available": "توفر ضريبة المدخلات",
    "inventory": "المخزون",
    "invoice_count": "عدد الفواتير",
    "invoice_number": "رقم الفاتورة",
    "invoice_statuses": "حالات الفواتير",
    "is_bank_balance_available": "توفر رصيد البنك",
    "items": "السجلات",
    "low_inventory": "المخزون المنخفض",
    "net_tracked_cash_flow": "صافي التدفق النقدي المتتبع",
    "net_vat_payable_available": "توفر صافي ضريبة القيمة المضافة المستحقة",
    "overview": "نظرة عامة",
    "paid_invoices_count": "عدد الفواتير المدفوعة",
    "potential_gross_profit": "إجمالي الربح المحتمل من المخزون",
    "preliminary_operating_result": "النتيجة التشغيلية الأولية",
    "product_count": "عدد المنتجات",
    "product_name": "اسم المنتج",
    "quantity": "الكمية",
    "recorded_cash_outflows": "التدفقات النقدية الخارجة المسجلة",
    "review_items_count": "عدد عناصر المراجعة",
    "sales": "المبيعات",
    "status": "الحالة",
    "status_breakdown": "توزيع الحالات",
    "tax": "الضرائب",
    "tax_jurisdiction": "النطاق الضريبي",
    "tax_jurisdiction_configured": "إعداد النطاق الضريبي",
    "top_products": "المنتجات الأعلى مبيعًا",
    "total_cost_value": "إجمالي قيمة التكلفة",
    "total_expenses": "إجمالي المصروفات",
    "total_invoiced_vat": "إجمالي ضريبة القيمة المضافة المسجلة بالفواتير",
    "total_recorded_sales_value": "إجمالي قيمة المبيعات المسجلة",
    "total_sales_records": "عدد سجلات المبيعات",
    "total_selling_value": "إجمالي قيمة البيع",
    "total_units": "إجمالي الوحدات",
    "total_units_sold": "إجمالي الوحدات المباعة",
    "tracked_cash_inflows": "التدفقات النقدية الداخلة المتتبعة",
    "unpaid_invoices_count": "عدد الفواتير غير المدفوعة",
    "units_sold": "الوحدات المباعة",
    "valuation": "تقييم المخزون",
    "value": "القيمة",
    "vat_by_invoice_status": "ضريبة القيمة المضافة حسب حالة الفاتورة",
    "vat_registered": "التسجيل في ضريبة القيمة المضافة",
    "vendor": "المورّد",
    "verified_metrics": "",
}


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


def _humanize_label(key: str, is_arabic: bool) -> str:
    if is_arabic and key in _ARABIC_LABELS:
        return _ARABIC_LABELS[key]
    return key.replace("_", " ").strip().capitalize()


def _format_public_value(value: Any, is_arabic: bool) -> str:
    if value is None:
        return "غير متاح" if is_arabic else "Unavailable"
    if isinstance(value, bool):
        if is_arabic:
            return "نعم" if value else "لا"
        return "Yes" if value else "No"
    if isinstance(value, float):
        return f"{value:,.2f}"
    return str(value)


def _escape_markdown_table(value: str) -> str:
    return value.replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def _flatten_public_metrics(
    value: Any,
    *,
    is_arabic: bool,
    path: tuple[str, ...] = (),
) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []

    if isinstance(value, dict):
        for raw_key, nested_value in value.items():
            key = str(raw_key)
            if key in _INTERNAL_DISPLAY_KEYS:
                continue

            label = _humanize_label(key, is_arabic)
            next_path = path if key == "verified_metrics" else (*path, label)
            rows.extend(
                _flatten_public_metrics(
                    nested_value,
                    is_arabic=is_arabic,
                    path=next_path,
                )
            )
        return rows

    if isinstance(value, (list, tuple)):
        if not value:
            if path:
                rows.append(
                    (
                        " › ".join(path),
                        "لا توجد سجلات" if is_arabic else "No records",
                    )
                )
            return rows

        for index, nested_value in enumerate(value, start=1):
            item_label = (
                f"السجل {index}" if is_arabic else f"Record {index}"
            )
            rows.extend(
                _flatten_public_metrics(
                    nested_value,
                    is_arabic=is_arabic,
                    path=(*path, item_label),
                )
            )
        return rows

    if path:
        rows.append(
            (
                " › ".join(part for part in path if part),
                _format_public_value(value, is_arabic),
            )
        )
    return rows


def _contains_internal_json(reply: str) -> bool:
    stripped = reply.strip()
    candidates: list[str] = []

    if stripped.startswith(("{", "[")):
        candidates.append(stripped)

    candidates.extend(
        match.group(1).strip()
        for match in re.finditer(
            r"```json\s*([\s\S]*?)```",
            stripped,
            flags=re.IGNORECASE,
        )
    )

    for candidate in candidates:
        try:
            payload = json.loads(candidate)
        except (json.JSONDecodeError, TypeError):
            continue

        if isinstance(payload, (dict, list)):
            return True

    return False


def _safe_fallback(verified_data: dict[str, Any], is_arabic: bool) -> str:
    heading = "### البيانات المالية المتحقق منها" if is_arabic else "### Verified financial data"
    note = (
        "تعذر اعتماد الصياغة التفسيرية لأنها احتوت ادعاءً غير مدعوم. "
        "فيما يلي ملخص واضح للبيانات الحتمية فقط."
        if is_arabic
        else "The narrative was withheld because it contained an unsupported claim. "
        "A readable summary of deterministic data is shown below."
    )
    metrics = verified_data.get("verified_metrics", verified_data)
    rows = _flatten_public_metrics(metrics, is_arabic=is_arabic)

    if not rows:
        empty = (
            "لا تتوفر بيانات مالية متحقق منها لعرضها حاليًا."
            if is_arabic
            else "No verified financial data is currently available to display."
        )
        return f"{heading}\n\n{note}\n\n{empty}"

    metric_heading = "البيان" if is_arabic else "Metric"
    value_heading = "القيمة" if is_arabic else "Value"
    table_lines = [
        f"| {metric_heading} | {value_heading} |",
        "|---|---:|",
        *(
            f"| {_escape_markdown_table(label)} | "
            f"{_escape_markdown_table(value)} |"
            for label, value in rows
        ),
    ]
    return f"{heading}\n\n{note}\n\n" + "\n".join(table_lines)


def ground_financial_reply(
    reply: Any,
    verified_data: dict[str, Any],
    user_message: str,
) -> str:
    """Reject unsupported numeric/categorical claims and append provenance."""
    is_arabic = any("\u0600" <= character <= "\u06ff" for character in user_message)
    grounded = reply.strip() if isinstance(reply, str) else ""

    if (
        not grounded
        or _contains_internal_json(grounded)
        or find_unsupported_numbers(grounded, verified_data)
        or _has_unsupported_claims(grounded, verified_data)
    ):
        grounded = _safe_fallback(verified_data, is_arabic)

    source_heading = "### مصادر البيانات" if is_arabic else "### Data sources"
    if source_heading not in grounded:
        grounded = f"{grounded}\n\n{_source_footer(verified_data, is_arabic)}"

    return grounded
