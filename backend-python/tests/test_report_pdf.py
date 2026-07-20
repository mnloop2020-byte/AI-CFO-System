from datetime import datetime, timezone
from io import BytesIO

from pypdf import PdfReader

from app.services.report_pdf_service import build_report_filename, create_report_pdf


def test_english_report_pdf_is_valid() -> None:
    generated_at = datetime(2026, 7, 21, 10, 30, tzinfo=timezone.utc)
    pdf = create_report_pdf(
        report_type="sales_performance",
        language="en",
        content="# Verified sales\n\n- Completed revenue: 200.00\n- Units: 2",
        generated_at=generated_at,
    )

    assert pdf.startswith(b"%PDF-")
    assert len(PdfReader(BytesIO(pdf)).pages) == 1
    assert build_report_filename("sales_performance", generated_at).endswith(".pdf")


def test_arabic_report_pdf_is_valid_and_paginated() -> None:
    generated_at = datetime(2026, 7, 21, 10, 30, tzinfo=timezone.utc)
    content = "# تقرير موثق\n\n" + "الإيراد المكتمل 200 والوحدات المباعة 2.\n\n" * 180

    pdf = create_report_pdf(
        report_type="complete_cfo",
        language="ar",
        content=content,
        generated_at=generated_at,
    )

    assert pdf.startswith(b"%PDF-")
    assert len(PdfReader(BytesIO(pdf)).pages) > 1
