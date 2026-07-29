from datetime import datetime, timezone
from io import BytesIO

import pytest
from PIL import Image

from app.services.attachment_service import (
    MAX_ATTACHMENT_BYTES,
    AttachmentValidationError,
    validate_attachment,
)
from app.services.report_pdf_service import create_report_pdf


def image_bytes(image_format: str) -> bytes:
    output = BytesIO()
    Image.new("RGB", (8, 8), color="white").save(output, format=image_format)
    return output.getvalue()


def test_valid_pdf_png_and_jpeg_signatures_are_accepted() -> None:
    pdf = create_report_pdf(
        "sales_performance",
        "en",
        "Verified attachment test.",
        datetime.now(timezone.utc),
    )

    assert validate_attachment("invoice.pdf", "application/pdf", pdf)[1] == "application/pdf"
    assert validate_attachment("receipt.png", "image/png", image_bytes("PNG"))[1] == "image/png"
    assert validate_attachment("receipt.jpg", "image/jpeg", image_bytes("JPEG"))[1] == "image/jpeg"


@pytest.mark.parametrize(
    ("name", "mime_type", "content"),
    [
        ("fake.pdf", "application/pdf", b"%PDF-not-a-real-pdf"),
        ("fake.png", "image/png", b"\x89PNG\r\n\x1a\nnot-an-image"),
        ("script.jpg", "image/jpeg", b"<script>alert(1)</script>"),
        ("receipt.exe", "image/png", image_bytes("PNG")),
        ("receipt.png", "image/jpeg", image_bytes("PNG")),
    ],
)
def test_spoofed_or_mismatched_files_are_rejected(
    name: str,
    mime_type: str,
    content: bytes,
) -> None:
    with pytest.raises(AttachmentValidationError):
        validate_attachment(name, mime_type, content)


def test_attachment_size_limit_is_enforced_before_storage() -> None:
    with pytest.raises(AttachmentValidationError, match="5 MB"):
        validate_attachment(
            "oversized.pdf",
            "application/pdf",
            b"%PDF-" + b"0" * MAX_ATTACHMENT_BYTES,
        )
