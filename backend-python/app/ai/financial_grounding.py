from __future__ import annotations

import json
import re
from copy import deepcopy
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from app.money import parse_money


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


@dataclass(frozen=True, slots=True)
class FinancialReplyValidation:
    is_empty: bool
    contains_internal_json: bool
    unsupported_numbers: tuple[str, ...]
    unsupported_claims: tuple[str, ...]

    @property
    def is_valid(self) -> bool:
        return not (
            self.is_empty
            or self.contains_internal_json
            or self.unsupported_numbers
            or self.unsupported_claims
        )


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
            "record_ids": ["single_company_context"],
            "fields": [
                "name",
                "business_activity",
                "currency",
                "timezone",
                "fiscal_year_start",
                "tax_jurisdiction_configured",
                "vat_registered",
            ],
        }
    )

    return {
        **enriched_metrics,
        "company_context": {
            "company_name": company.name,
            "business_activity": company.business_activity,
            "currency": company.currency,
            "timezone": company.timezone,
            "fiscal_year_start": company.fiscal_year_start,
            "tax_jurisdiction_configured": bool(company.tax_jurisdiction),
            "vat_registered": company.vat_registered,
            "is_bank_balance_available": False,
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


def find_unsupported_claims(
    reply: str,
    verified_data: dict[str, Any],
) -> list[str]:
    lowered = reply.casefold()
    company = verified_data.get("company_context", {})
    unsupported: list[str] = []

    if company.get("currency") is None and any(
        marker.casefold() in lowered for marker in _CURRENCY_MARKERS
    ):
        unsupported.append("unconfigured_currency")

    unavailable_claim_patterns = (
        (
            "bank_balance_claim",
            r"bank balance\s+(?:is|was|equals|of)\s+(?!unavailable|not available)",
        ),
        (
            "net_vat_payable_claim",
            r"net vat payable\s+(?:is|was|equals|of)\s+(?!unavailable|not available)",
        ),
        (
            "final_net_profit_claim",
            r"final net profit\s+(?:is|was|equals|of)\s+(?!unavailable|not available)",
        ),
    )
    unsupported.extend(
        reason
        for reason, pattern in unavailable_claim_patterns
        if re.search(pattern, lowered)
    )
    return unsupported


def _has_unsupported_claims(
    reply: str,
    verified_data: dict[str, Any],
) -> bool:
    return bool(find_unsupported_claims(reply, verified_data))


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
    if isinstance(value, (float, Decimal)):
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


def validate_financial_reply(
    reply: Any,
    verified_data: dict[str, Any],
) -> FinancialReplyValidation:
    grounded = reply.strip() if isinstance(reply, str) else ""
    return FinancialReplyValidation(
        is_empty=not grounded,
        contains_internal_json=(
            _contains_internal_json(grounded) if grounded else False
        ),
        unsupported_numbers=tuple(
            dict.fromkeys(find_unsupported_numbers(grounded, verified_data))
        ),
        unsupported_claims=tuple(
            find_unsupported_claims(grounded, verified_data)
        ),
    )


def _get_mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _format_summary_amount(value: Any, currency: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        return None
    try:
        formatted = f"{parse_money(value):,.2f}"
    except ValueError:
        return None
    if isinstance(currency, str) and currency.strip():
        return f"{formatted} {currency.strip()}"
    return formatted


def _append_metric(
    lines: list[str],
    *,
    label: str,
    value: Any,
    currency: Any = None,
    numeric_amount: bool = False,
) -> None:
    if value is None or isinstance(value, bool):
        return
    if numeric_amount:
        formatted = _format_summary_amount(value, currency)
        if formatted is None:
            return
    else:
        formatted = str(value)
    lines.append(f"- {label}: **{formatted}**")


def _safe_comprehensive_summary(
    verified_data: dict[str, Any],
    is_arabic: bool,
) -> str | None:
    section_keys = {
        "sales",
        "inventory",
        "accounting",
        "cash_flow",
        "tax",
        "fraud_risk",
    }
    if len(section_keys.intersection(verified_data)) < 3:
        return None

    company = _get_mapping(verified_data.get("company_context"))
    currency = company.get("currency")
    sales = _get_mapping(verified_data.get("sales"))
    inventory = _get_mapping(verified_data.get("inventory"))
    inventory_overview = _get_mapping(inventory.get("overview"))
    low_inventory = _get_mapping(inventory.get("low_inventory"))
    valuation = _get_mapping(inventory.get("valuation"))
    accounting = _get_mapping(verified_data.get("accounting"))
    cash_flow = _get_mapping(verified_data.get("cash_flow"))
    tax = _get_mapping(verified_data.get("tax"))
    review = _get_mapping(verified_data.get("fraud_risk"))

    if is_arabic:
        lines = [
            "### ملخص مالي متحقق منه",
            "",
            (
                "تعذر اعتماد الصياغة التفسيرية بعد التحقق، لذلك يعرض النظام "
                "خلاصة موجزة من القيم الحتمية فقط."
            ),
            "",
            "#### المبيعات",
        ]
        _append_metric(
            lines,
            label="إيرادات المبيعات المكتملة",
            value=sales.get("completed_revenue"),
            currency=currency,
            numeric_amount=True,
        )
        _append_metric(
            lines,
            label="عدد المبيعات المكتملة",
            value=sales.get("completed_sales_count"),
        )
        _append_metric(
            lines,
            label="الوحدات المباعة",
            value=sales.get("total_units_sold"),
        )
        lines.extend(["", "#### المصروفات والنتيجة التشغيلية"])
        _append_metric(
            lines,
            label="إجمالي المصروفات المسجلة",
            value=accounting.get("total_expenses"),
            currency=currency,
            numeric_amount=True,
        )
        _append_metric(
            lines,
            label="النتيجة التشغيلية الأولية",
            value=accounting.get("preliminary_operating_result"),
            currency=currency,
            numeric_amount=True,
        )
        lines.extend(["", "#### التدفق النقدي المتتبع"])
        _append_metric(
            lines,
            label="التدفقات الداخلة المتتبعة",
            value=cash_flow.get("tracked_cash_inflows"),
            currency=currency,
            numeric_amount=True,
        )
        _append_metric(
            lines,
            label="التدفقات الخارجة المسجلة",
            value=cash_flow.get("recorded_cash_outflows"),
            currency=currency,
            numeric_amount=True,
        )
        _append_metric(
            lines,
            label="صافي التدفق النقدي المتتبع",
            value=cash_flow.get("net_tracked_cash_flow"),
            currency=currency,
            numeric_amount=True,
        )
        _append_metric(
            lines,
            label="المبالغ المتوقعة من الفواتير غير المدفوعة",
            value=cash_flow.get("expected_unpaid_inflows"),
            currency=currency,
            numeric_amount=True,
        )
        lines.extend(["", "#### المخزون"])
        _append_metric(
            lines,
            label="عدد المنتجات",
            value=inventory_overview.get("count"),
        )
        _append_metric(
            lines,
            label="المنتجات عند أو دون حد إعادة الطلب",
            value=low_inventory.get("count"),
        )
        _append_metric(
            lines,
            label="قيمة تكلفة المخزون",
            value=valuation.get("total_cost_value"),
            currency=currency,
            numeric_amount=True,
        )
        lines.extend(["", "#### الضرائب والمراجعة"])
        _append_metric(
            lines,
            label="ضريبة القيمة المضافة المسجلة في الفواتير",
            value=tax.get("total_invoiced_vat"),
            currency=currency,
            numeric_amount=True,
        )
        _append_metric(
            lines,
            label="المصروفات المعلّمة للمراجعة البشرية",
            value=review.get("flagged_expenses_count"),
        )
        lines.extend(
            [
                "",
                (
                    "> النتيجة التشغيلية أولية وليست صافي ربح نهائي. "
                    "التدفق النقدي المتتبع ليس رصيد البنك، وضريبة الفواتير "
                    "ليست صافي الضريبة المستحقة. عناصر المراجعة لا تثبت الاحتيال."
                ),
                (
                    "> العملة غير محددة في إعدادات الشركة."
                    if not currency
                    else f"> العملة المعدّة: {currency}."
                ),
            ]
        )
        return "\n".join(lines)

    lines = [
        "### Verified financial summary",
        "",
        (
            "The narrative could not be approved after validation, so this "
            "concise summary shows deterministic values only."
        ),
        "",
        "#### Sales",
    ]
    _append_metric(
        lines,
        label="Completed revenue",
        value=sales.get("completed_revenue"),
        currency=currency,
        numeric_amount=True,
    )
    _append_metric(
        lines,
        label="Completed sales",
        value=sales.get("completed_sales_count"),
    )
    _append_metric(
        lines,
        label="Units sold",
        value=sales.get("total_units_sold"),
    )
    lines.extend(["", "#### Expenses and operating result"])
    _append_metric(
        lines,
        label="Recorded expenses",
        value=accounting.get("total_expenses"),
        currency=currency,
        numeric_amount=True,
    )
    _append_metric(
        lines,
        label="Preliminary operating result",
        value=accounting.get("preliminary_operating_result"),
        currency=currency,
        numeric_amount=True,
    )
    lines.extend(["", "#### Tracked cash flow"])
    _append_metric(
        lines,
        label="Tracked cash inflows",
        value=cash_flow.get("tracked_cash_inflows"),
        currency=currency,
        numeric_amount=True,
    )
    _append_metric(
        lines,
        label="Recorded cash outflows",
        value=cash_flow.get("recorded_cash_outflows"),
        currency=currency,
        numeric_amount=True,
    )
    _append_metric(
        lines,
        label="Net tracked cash flow",
        value=cash_flow.get("net_tracked_cash_flow"),
        currency=currency,
        numeric_amount=True,
    )
    _append_metric(
        lines,
        label="Expected inflows from unpaid invoices",
        value=cash_flow.get("expected_unpaid_inflows"),
        currency=currency,
        numeric_amount=True,
    )
    lines.extend(["", "#### Inventory"])
    _append_metric(
        lines,
        label="Products",
        value=inventory_overview.get("count"),
    )
    _append_metric(
        lines,
        label="Products at or below reorder level",
        value=low_inventory.get("count"),
    )
    _append_metric(
        lines,
        label="Inventory cost value",
        value=valuation.get("total_cost_value"),
        currency=currency,
        numeric_amount=True,
    )
    lines.extend(["", "#### Tax and review"])
    _append_metric(
        lines,
        label="VAT recorded on invoices",
        value=tax.get("total_invoiced_vat"),
        currency=currency,
        numeric_amount=True,
    )
    _append_metric(
        lines,
        label="Expenses flagged for human review",
        value=review.get("flagged_expenses_count"),
    )
    lines.extend(
        [
            "",
            (
                "> The operating result is preliminary, not final net profit. "
                "Tracked cash flow is not the bank balance, invoiced VAT is not "
                "net VAT payable, and review flags do not confirm fraud."
            ),
            (
                "> Company currency is not configured."
                if not currency
                else f"> Configured currency: {currency}."
            ),
        ]
    )
    return "\n".join(lines)


def _safe_fallback(verified_data: dict[str, Any], is_arabic: bool) -> str:
    comprehensive_summary = _safe_comprehensive_summary(
        verified_data,
        is_arabic,
    )
    if comprehensive_summary is not None:
        return comprehensive_summary

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

    if not validate_financial_reply(grounded, verified_data).is_valid:
        grounded = _safe_fallback(verified_data, is_arabic)

    source_heading = "### مصادر البيانات" if is_arabic else "### Data sources"
    if source_heading not in grounded:
        grounded = f"{grounded}\n\n{_source_footer(verified_data, is_arabic)}"

    return grounded
