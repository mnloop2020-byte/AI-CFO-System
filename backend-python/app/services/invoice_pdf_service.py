from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Literal

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas


InvoiceLanguage = Literal["en", "ar"]

FONT_DIRECTORY = Path(__file__).resolve().parents[1] / "assets" / "fonts"
REGULAR_FONT_PATH = FONT_DIRECTORY / "DejaVuSans.ttf"
BOLD_FONT_PATH = FONT_DIRECTORY / "DejaVuSans-Bold.ttf"
REGULAR_FONT_NAME = "Invoice-DejaVuSans"
BOLD_FONT_NAME = "Invoice-DejaVuSans-Bold"

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 48
CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)
MAX_PDF_BYTES = 5 * 1024 * 1024

COLOR_PRIMARY = HexColor("#2563EB")
COLOR_TEXT = HexColor("#0F172A")
COLOR_MUTED = HexColor("#64748B")
COLOR_BORDER = HexColor("#E2E8F0")
COLOR_SURFACE = HexColor("#F8FAFC")
COLOR_WHITE = HexColor("#FFFFFF")

_SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass(frozen=True, slots=True)
class InvoicePdfData:
    invoice_number: str
    status: str
    total_amount: float
    vat_amount: float
    currency: str
    issued_at: datetime
    due_at: datetime | None
    revision_at: datetime
    company_name: str
    company_legal_name: str | None = None
    company_email: str | None = None
    company_phone: str | None = None
    company_address: str | None = None
    company_city: str | None = None
    company_country: str | None = None
    company_tax_id: str | None = None
    customer_name: str | None = None
    customer_company: str | None = None
    customer_email: str | None = None
    customer_phone: str | None = None
    notes: str | None = None


def _register_fonts() -> None:
    if REGULAR_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(REGULAR_FONT_NAME, REGULAR_FONT_PATH))
    if BOLD_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(BOLD_FONT_NAME, BOLD_FONT_PATH))


def _safe_text(value: object, *, maximum: int = 500) -> str:
    normalized = unicodedata.normalize("NFC", str(value or ""))
    normalized = normalized.replace("—", "-").replace("–", "-")
    clean = "".join(
        character
        for character in normalized
        if unicodedata.category(character)[0] != "C" and ord(character) <= 0xFFFF
    )
    return re.sub(r"\s+", " ", clean).strip()[:maximum]


def _visual(value: str, language: InvoiceLanguage) -> str:
    if language != "ar":
        return value
    return get_display(arabic_reshaper.reshape(value))


def build_invoice_filename(invoice_number: str) -> str:
    normalized = unicodedata.normalize("NFKD", invoice_number)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    safe_number = _SAFE_FILENAME_PATTERN.sub("-", ascii_value).strip("._-")
    safe_number = re.sub(r"-+", "-", safe_number)[:80]
    if not safe_number:
        safe_number = "document"
    return f"invoice-{safe_number}.pdf"


def _format_date(value: datetime | None, language: InvoiceLanguage) -> str:
    if value is None:
        return "-" if language == "en" else "غير متاح"
    utc_value = value.astimezone(timezone.utc)
    return utc_value.strftime("%Y-%m-%d")


def _format_amount(value: float, currency: str) -> str:
    return f"{value:,.2f} {currency}"


def _wrap(
    canvas: Canvas,
    value: str,
    *,
    language: InvoiceLanguage,
    font_name: str,
    font_size: float,
    width: float,
) -> list[str]:
    words = _safe_text(value).split()
    if not words:
        return []
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        if current and canvas.stringWidth(
            _visual(candidate, language),
            font_name,
            font_size,
        ) > width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines[:4]


def _draw_text(
    canvas: Canvas,
    value: str,
    x: float,
    y: float,
    *,
    language: InvoiceLanguage,
    font_name: str = REGULAR_FONT_NAME,
    font_size: float = 10,
    color=COLOR_TEXT,
    right_aligned: bool | None = None,
) -> None:
    canvas.setFillColor(color)
    canvas.setFont(font_name, font_size)
    text = _visual(_safe_text(value), language)
    align_right = language == "ar" if right_aligned is None else right_aligned
    if align_right:
        canvas.drawRightString(x, y, text)
    else:
        canvas.drawString(x, y, text)


def _draw_wrapped(
    canvas: Canvas,
    value: str,
    x: float,
    y: float,
    *,
    language: InvoiceLanguage,
    width: float,
    font_name: str = REGULAR_FONT_NAME,
    font_size: float = 10,
    leading: float = 15,
    color=COLOR_TEXT,
) -> float:
    lines = _wrap(
        canvas,
        value,
        language=language,
        font_name=font_name,
        font_size=font_size,
        width=width,
    )
    for line in lines:
        draw_x = x + width if language == "ar" else x
        _draw_text(
            canvas,
            line,
            draw_x,
            y,
            language=language,
            font_name=font_name,
            font_size=font_size,
            color=color,
        )
        y -= leading
    return y


def create_invoice_pdf(
    data: InvoicePdfData,
    *,
    language: InvoiceLanguage,
) -> bytes:
    _register_fonts()
    labels = {
        "en": {
            "title": "INVOICE",
            "number": "Invoice number",
            "issued": "Issue date",
            "due": "Due date",
            "status": "Status",
            "from": "From",
            "bill_to": "Bill to",
            "subtotal": "Amount before VAT",
            "vat": "Recorded VAT",
            "total": "Total due",
            "notes": "Notes",
            "generated": "Document revision",
            "future": "Line items are not available in the current invoice model.",
        },
        "ar": {
            "title": "فاتورة",
            "number": "رقم الفاتورة",
            "issued": "تاريخ الإصدار",
            "due": "تاريخ الاستحقاق",
            "status": "الحالة",
            "from": "من",
            "bill_to": "فاتورة إلى",
            "subtotal": "المبلغ قبل الضريبة",
            "vat": "ضريبة القيمة المضافة المسجلة",
            "total": "إجمالي المبلغ المستحق",
            "notes": "ملاحظات",
            "generated": "نسخة المستند",
            "future": "بنود الفاتورة التفصيلية غير متاحة في نموذج الفاتورة الحالي.",
        },
    }[language]

    buffer = BytesIO()
    canvas = Canvas(
        buffer,
        pagesize=A4,
        pageCompression=1,
        invariant=1,
    )
    canvas.setTitle(_safe_text(f"Invoice {data.invoice_number}"))
    canvas.setAuthor(_safe_text(data.company_name))

    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, PAGE_HEIGHT - 14, PAGE_WIDTH, 14, stroke=0, fill=1)

    title_x = PAGE_WIDTH - MARGIN if language == "ar" else MARGIN
    _draw_text(
        canvas,
        labels["title"],
        title_x,
        PAGE_HEIGHT - 62,
        language=language,
        font_name=BOLD_FONT_NAME,
        font_size=24,
        color=COLOR_PRIMARY,
    )
    _draw_text(
        canvas,
        data.company_name,
        title_x,
        PAGE_HEIGHT - 91,
        language=language,
        font_name=BOLD_FONT_NAME,
        font_size=13,
    )
    legal_line = data.company_legal_name or ""
    if legal_line and legal_line != data.company_name:
        _draw_text(
            canvas,
            legal_line,
            title_x,
            PAGE_HEIGHT - 109,
            language=language,
            font_size=9,
            color=COLOR_MUTED,
        )

    card_y = PAGE_HEIGHT - 188
    canvas.setFillColor(COLOR_SURFACE)
    canvas.roundRect(MARGIN, card_y, CONTENT_WIDTH, 58, 8, stroke=0, fill=1)
    detail_values = (
        (labels["number"], data.invoice_number),
        (labels["issued"], _format_date(data.issued_at, language)),
        (labels["due"], _format_date(data.due_at, language)),
        (labels["status"], data.status),
    )
    column_width = CONTENT_WIDTH / 4
    for index, (label, value) in enumerate(detail_values):
        left = MARGIN + (column_width * index)
        if language == "ar":
            left = PAGE_WIDTH - MARGIN - (column_width * (index + 1))
        text_x = left + column_width - 12 if language == "ar" else left + 12
        _draw_text(
            canvas,
            label,
            text_x,
            card_y + 36,
            language=language,
            font_size=8,
            color=COLOR_MUTED,
        )
        _draw_text(
            canvas,
            value,
            text_x,
            card_y + 17,
            language=language,
            font_name=BOLD_FONT_NAME,
            font_size=9,
        )

    address_y = card_y - 43
    block_gap = 22
    block_width = (CONTENT_WIDTH - block_gap) / 2
    from_x = MARGIN if language == "en" else MARGIN + block_width + block_gap
    customer_x = MARGIN + block_width + block_gap if language == "en" else MARGIN

    for x, heading in ((from_x, labels["from"]), (customer_x, labels["bill_to"])):
        canvas.setStrokeColor(COLOR_BORDER)
        canvas.roundRect(x, address_y - 125, block_width, 142, 8, stroke=1, fill=0)
        heading_x = x + block_width - 14 if language == "ar" else x + 14
        _draw_text(
            canvas,
            heading,
            heading_x,
            address_y - 7,
            language=language,
            font_name=BOLD_FONT_NAME,
            font_size=10,
            color=COLOR_PRIMARY,
        )

    company_lines = [
        data.company_name,
        data.company_address,
        ", ".join(
            part for part in (data.company_city, data.company_country) if part
        ),
        data.company_email,
        data.company_phone,
        f"Tax ID: {data.company_tax_id}" if data.company_tax_id else None,
    ]
    customer_lines = [
        data.customer_name or ("Unlinked customer" if language == "en" else "عميل غير مرتبط"),
        data.customer_company,
        data.customer_email,
        data.customer_phone,
    ]
    for x, lines in ((from_x, company_lines), (customer_x, customer_lines)):
        line_y = address_y - 31
        for line in (item for item in lines if item):
            line_y = _draw_wrapped(
                canvas,
                line,
                x + 14,
                line_y,
                language=language,
                width=block_width - 28,
                font_size=9,
                leading=14,
                color=COLOR_TEXT,
            )

    summary_y = address_y - 177
    canvas.setStrokeColor(COLOR_BORDER)
    canvas.setFillColor(COLOR_SURFACE)
    canvas.roundRect(MARGIN, summary_y - 108, CONTENT_WIDTH, 126, 8, stroke=1, fill=1)
    subtotal = max(0.0, data.total_amount - data.vat_amount)
    summary_rows = (
        (labels["subtotal"], _format_amount(subtotal, data.currency)),
        (labels["vat"], _format_amount(data.vat_amount, data.currency)),
        (labels["total"], _format_amount(data.total_amount, data.currency)),
    )
    for index, (label, amount) in enumerate(summary_rows):
        row_y = summary_y - 9 - (index * 34)
        label_x = PAGE_WIDTH - MARGIN - 18 if language == "ar" else MARGIN + 18
        amount_x = MARGIN + 18 if language == "ar" else PAGE_WIDTH - MARGIN - 18
        _draw_text(
            canvas,
            label,
            label_x,
            row_y,
            language=language,
            font_name=BOLD_FONT_NAME if index == 2 else REGULAR_FONT_NAME,
            font_size=11 if index == 2 else 9,
            color=COLOR_TEXT if index == 2 else COLOR_MUTED,
        )
        _draw_text(
            canvas,
            amount,
            amount_x,
            row_y,
            language=language,
            font_name=BOLD_FONT_NAME if index == 2 else REGULAR_FONT_NAME,
            font_size=12 if index == 2 else 10,
            right_aligned=language != "ar",
        )

    footer_y = summary_y - 142
    if data.notes:
        heading_x = PAGE_WIDTH - MARGIN if language == "ar" else MARGIN
        _draw_text(
            canvas,
            labels["notes"],
            heading_x,
            footer_y,
            language=language,
            font_name=BOLD_FONT_NAME,
            font_size=10,
        )
        _draw_wrapped(
            canvas,
            data.notes,
            MARGIN,
            footer_y - 19,
            language=language,
            width=CONTENT_WIDTH,
            font_size=9,
            leading=14,
            color=COLOR_MUTED,
        )

    canvas.setStrokeColor(COLOR_BORDER)
    canvas.line(MARGIN, 65, PAGE_WIDTH - MARGIN, 65)
    footer_x = PAGE_WIDTH - MARGIN if language == "ar" else MARGIN
    _draw_text(
        canvas,
        labels["future"],
        footer_x,
        47,
        language=language,
        font_size=7.5,
        color=COLOR_MUTED,
    )
    _draw_text(
        canvas,
        f'{labels["generated"]}: {_format_date(data.revision_at, language)}',
        footer_x,
        31,
        language=language,
        font_size=7.5,
        color=COLOR_MUTED,
    )

    canvas.showPage()
    canvas.save()
    pdf_bytes = buffer.getvalue()
    if not pdf_bytes.startswith(b"%PDF-"):
        raise RuntimeError("Invoice PDF generation did not produce a valid PDF.")
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise RuntimeError("Generated invoice PDF exceeds the 5 MB safety limit.")
    return pdf_bytes
