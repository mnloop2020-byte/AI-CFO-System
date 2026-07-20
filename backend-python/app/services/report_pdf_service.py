from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from app.schemas.report_schema import ReportLanguage, ReportType


FONT_DIRECTORY = Path(__file__).resolve().parents[1] / "assets" / "fonts"
REGULAR_FONT_PATH = FONT_DIRECTORY / "DejaVuSans.ttf"
BOLD_FONT_PATH = FONT_DIRECTORY / "DejaVuSans-Bold.ttf"
REGULAR_FONT_NAME = "DejaVuSans"
BOLD_FONT_NAME = "DejaVuSans-Bold"

PAGE_WIDTH, PAGE_HEIGHT = A4
LEFT_MARGIN = 48
RIGHT_MARGIN = 48
TOP_CONTENT_Y = PAGE_HEIGHT - 112
BOTTOM_CONTENT_Y = 68
CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN

COLOR_PRIMARY = HexColor("#2563EB")
COLOR_TEXT = HexColor("#0F172A")
COLOR_SECONDARY = HexColor("#64748B")
COLOR_BORDER = HexColor("#E2E8F0")
COLOR_SURFACE = HexColor("#F8FAFC")

REPORT_TITLES: dict[ReportType, dict[ReportLanguage, str]] = {
    "complete_cfo": {
        "en": "Complete CFO Report",
        "ar": "تقرير المدير المالي الشامل",
    },
    "executive_brief": {
        "en": "Executive Brief",
        "ar": "الملخص التنفيذي",
    },
    "sales_performance": {
        "en": "Sales Performance Report",
        "ar": "تقرير أداء المبيعات",
    },
    "cash_flow_summary": {
        "en": "Cash Flow Summary",
        "ar": "ملخص التدفق النقدي",
    },
    "tax_summary": {
        "en": "Tax Summary",
        "ar": "الملخص الضريبي",
    },
    "risk_review": {
        "en": "Risk Review",
        "ar": "مراجعة المخاطر",
    },
}

INLINE_LINK_PATTERN = re.compile(r"\[([^\]]+)]\([^\)]+\)")
INLINE_MARKUP_PATTERN = re.compile(r"(\*\*|__|\*|_|`|~~)")
ORDERED_LIST_PATTERN = re.compile(r"^\s*(\d+)[\.)]\s+(.*)$")
UNORDERED_LIST_PATTERN = re.compile(r"^\s*[-*+]\s+(.*)$")
TABLE_SEPARATOR_PATTERN = re.compile(
    r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$"
)


@dataclass(frozen=True)
class TextBlock:
    text: str
    font_size: float
    leading: float
    bold: bool = False
    before: float = 0
    after: float = 0
    indent: float = 0
    kind: str = "paragraph"


def _register_fonts() -> None:
    if REGULAR_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(REGULAR_FONT_NAME, REGULAR_FONT_PATH))

    if BOLD_FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(BOLD_FONT_NAME, BOLD_FONT_PATH))


def _safe_text(value: str) -> str:
    normalized = unicodedata.normalize("NFC", value)
    normalized = normalized.replace("—", "-").replace("–", "-")
    normalized = normalized.replace("•", "-")

    return "".join(
        character
        for character in normalized
        if character in "\n\t"
        or (
            unicodedata.category(character)[0] != "C"
            and ord(character) <= 0xFFFF
        )
    )


def _strip_inline_markdown(value: str) -> str:
    text = INLINE_LINK_PATTERN.sub(r"\1", value)
    text = INLINE_MARKUP_PATTERN.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _visual_text(value: str, language: ReportLanguage) -> str:
    if language != "ar":
        return value

    return get_display(arabic_reshaper.reshape(value))


def _parse_markdown(content: str) -> list[TextBlock]:
    blocks: list[TextBlock] = []

    for raw_line in _safe_text(content).splitlines():
        line = raw_line.strip()

        if not line:
            if blocks and blocks[-1].after < 5:
                previous = blocks[-1]
                blocks[-1] = TextBlock(
                    **{
                        **previous.__dict__,
                        "after": 5,
                    }
                )
            continue

        if TABLE_SEPARATOR_PATTERN.match(line):
            continue

        if line.startswith("### "):
            blocks.append(
                TextBlock(
                    _strip_inline_markdown(line[4:]),
                    font_size=13,
                    leading=18,
                    bold=True,
                    before=8,
                    after=3,
                    kind="heading",
                )
            )
            continue

        if line.startswith("## "):
            blocks.append(
                TextBlock(
                    _strip_inline_markdown(line[3:]),
                    font_size=15,
                    leading=21,
                    bold=True,
                    before=10,
                    after=4,
                    kind="heading",
                )
            )
            continue

        if line.startswith("# "):
            blocks.append(
                TextBlock(
                    _strip_inline_markdown(line[2:]),
                    font_size=17,
                    leading=23,
                    bold=True,
                    before=10,
                    after=5,
                    kind="heading",
                )
            )
            continue

        unordered_match = UNORDERED_LIST_PATTERN.match(line)
        if unordered_match:
            blocks.append(
                TextBlock(
                    f"- {_strip_inline_markdown(unordered_match.group(1))}",
                    font_size=11,
                    leading=17,
                    after=2,
                    indent=14,
                    kind="list",
                )
            )
            continue

        ordered_match = ORDERED_LIST_PATTERN.match(line)
        if ordered_match:
            blocks.append(
                TextBlock(
                    f"{ordered_match.group(1)}. "
                    f"{_strip_inline_markdown(ordered_match.group(2))}",
                    font_size=11,
                    leading=17,
                    after=2,
                    indent=14,
                    kind="list",
                )
            )
            continue

        if line.startswith(">"):
            blocks.append(
                TextBlock(
                    _strip_inline_markdown(line.lstrip("> ")),
                    font_size=10.5,
                    leading=17,
                    before=3,
                    after=4,
                    indent=12,
                    kind="quote",
                )
            )
            continue

        if "|" in line:
            cells = [
                _strip_inline_markdown(cell)
                for cell in line.strip("|").split("|")
                if _strip_inline_markdown(cell)
            ]
            line = " | ".join(cells)

        blocks.append(
            TextBlock(
                _strip_inline_markdown(line),
                font_size=11,
                leading=17,
                after=3,
            )
        )

    return [block for block in blocks if block.text]


def _wrap_text(
    canvas: Canvas,
    text: str,
    language: ReportLanguage,
    font_name: str,
    font_size: float,
    available_width: float,
) -> list[str]:
    words = text.split()
    if not words:
        return []

    lines: list[str] = []
    current_words: list[str] = []

    for word in words:
        candidate_words = [*current_words, word]
        candidate = " ".join(candidate_words)
        visual_candidate = _visual_text(candidate, language)

        if (
            current_words
            and canvas.stringWidth(
                visual_candidate,
                font_name,
                font_size,
            )
            > available_width
        ):
            lines.append(" ".join(current_words))
            current_words = [word]
        else:
            current_words = candidate_words

    if current_words:
        lines.append(" ".join(current_words))

    return lines


def _draw_header(
    canvas: Canvas,
    title: str,
    language: ReportLanguage,
    generated_at: datetime,
) -> None:
    canvas.setFillColor(COLOR_PRIMARY)
    canvas.rect(0, PAGE_HEIGHT - 12, PAGE_WIDTH, 12, stroke=0, fill=1)

    canvas.setFillColor(COLOR_TEXT)
    canvas.setFont(BOLD_FONT_NAME, 18)
    title_text = _visual_text(title, language)

    if language == "ar":
        canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 51, title_text)
    else:
        canvas.drawString(LEFT_MARGIN, PAGE_HEIGHT - 51, title_text)

    utc_generated_at = generated_at.astimezone(timezone.utc)
    if language == "ar":
        arabic_months = (
            "يناير",
            "فبراير",
            "مارس",
            "أبريل",
            "مايو",
            "يونيو",
            "يوليو",
            "أغسطس",
            "سبتمبر",
            "أكتوبر",
            "نوفمبر",
            "ديسمبر",
        )
        arabic_digits = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
        timestamp = (
            f"{utc_generated_at.day} "
            f"{arabic_months[utc_generated_at.month - 1]} "
            f"{utc_generated_at.year}، "
            f"{utc_generated_at:%H:%M} UTC"
        ).translate(arabic_digits)
        label = f"تاريخ الإنشاء: {timestamp}"
    else:
        timestamp = utc_generated_at.strftime("%Y-%m-%d %H:%M UTC")
        label = f"Generated: {timestamp}"
    canvas.setFillColor(COLOR_SECONDARY)
    canvas.setFont(REGULAR_FONT_NAME, 9)

    if language == "ar":
        canvas.drawRightString(
            PAGE_WIDTH - RIGHT_MARGIN,
            PAGE_HEIGHT - 72,
            _visual_text(label, language),
        )
    else:
        canvas.drawString(LEFT_MARGIN, PAGE_HEIGHT - 72, label)

    canvas.setStrokeColor(COLOR_BORDER)
    canvas.line(LEFT_MARGIN, PAGE_HEIGHT - 89, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 89)


def _draw_footer(
    canvas: Canvas,
    page_number: int,
    language: ReportLanguage,
) -> None:
    canvas.setStrokeColor(COLOR_BORDER)
    canvas.line(LEFT_MARGIN, 49, PAGE_WIDTH - RIGHT_MARGIN, 49)

    note = (
        "تقرير مولد بالذكاء الاصطناعي - يتطلب مراجعة بشرية."
        if language == "ar"
        else "AI-generated report - human review required."
    )
    page_label = (
        f"صفحة {page_number}"
        if language == "ar"
        else f"Page {page_number}"
    )

    canvas.setFillColor(COLOR_SECONDARY)
    canvas.setFont(REGULAR_FONT_NAME, 8)

    if language == "ar":
        canvas.drawRightString(
            PAGE_WIDTH - RIGHT_MARGIN,
            32,
            _visual_text(note, language),
        )
        canvas.drawString(
            LEFT_MARGIN,
            32,
            _visual_text(page_label, language),
        )
    else:
        canvas.drawString(LEFT_MARGIN, 32, note)
        canvas.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, 32, page_label)


def create_report_pdf(
    report_type: ReportType,
    language: ReportLanguage,
    content: str,
    generated_at: datetime,
) -> bytes:
    _register_fonts()

    output = BytesIO()
    canvas = Canvas(output, pagesize=A4, pageCompression=1)
    title = REPORT_TITLES[report_type][language]
    canvas.setTitle(title)
    canvas.setAuthor("AI CFO System")
    canvas.setSubject("AI-generated financial report requiring human review")
    blocks = _parse_markdown(content)
    page_number = 1
    current_y = TOP_CONTENT_Y

    def start_page() -> None:
        nonlocal current_y
        _draw_header(canvas, title, language, generated_at)
        current_y = TOP_CONTENT_Y

    def finish_page() -> None:
        _draw_footer(canvas, page_number, language)

    start_page()

    for block in blocks:
        font_name = BOLD_FONT_NAME if block.bold else REGULAR_FONT_NAME
        available_width = CONTENT_WIDTH - block.indent
        lines = _wrap_text(
            canvas,
            block.text,
            language,
            font_name,
            block.font_size,
            available_width,
        )

        required_height = block.before + len(lines) * block.leading + block.after
        if current_y - required_height < BOTTOM_CONTENT_Y:
            finish_page()
            canvas.showPage()
            page_number += 1
            start_page()

        current_y -= block.before

        canvas.setFont(font_name, block.font_size)
        canvas.setFillColor(
            COLOR_PRIMARY if block.kind == "heading" else COLOR_TEXT
        )

        for line in lines:
            if current_y - block.leading < BOTTOM_CONTENT_Y:
                finish_page()
                canvas.showPage()
                page_number += 1
                start_page()
                canvas.setFont(font_name, block.font_size)
                canvas.setFillColor(
                    COLOR_PRIMARY if block.kind == "heading" else COLOR_TEXT
                )

            visual_line = _visual_text(line, language)

            if language == "ar":
                canvas.drawRightString(
                    PAGE_WIDTH - RIGHT_MARGIN - block.indent,
                    current_y,
                    visual_line,
                )
            else:
                canvas.drawString(
                    LEFT_MARGIN + block.indent,
                    current_y,
                    visual_line,
                )

            current_y -= block.leading

        current_y -= block.after

    if not blocks:
        canvas.setFillColor(COLOR_SECONDARY)
        canvas.setFont(REGULAR_FONT_NAME, 11)
        empty_label = "لا يوجد محتوى للتقرير." if language == "ar" else "No report content."
        if language == "ar":
            canvas.drawRightString(
                PAGE_WIDTH - RIGHT_MARGIN,
                current_y,
                _visual_text(empty_label, language),
            )
        else:
            canvas.drawString(LEFT_MARGIN, current_y, empty_label)

    finish_page()
    canvas.save()
    return output.getvalue()


def build_report_filename(
    report_type: ReportType,
    generated_at: datetime,
) -> str:
    timestamp = generated_at.astimezone(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"ai-cfo-{report_type.replace('_', '-')}-{timestamp}.pdf"
