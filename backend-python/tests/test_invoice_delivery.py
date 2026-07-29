from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID

import pytest
from pypdf import PdfReader

from app.schemas.invoices_schema import (
    InvoiceEmailRequest,
    InvoicePdfDownload,
    InvoicePdfRequest,
    InvoiceResponse,
)
from app.security.request_context import RequestContext
from app.services import email_service, invoice_delivery_service, notification_store
from app.services.email_service import (
    EmailNotConfiguredError,
    InvoiceEmail,
    normalize_recipient,
)
from app.services.invoice_delivery_service import InvoiceDocument
from app.services.invoice_pdf_service import (
    InvoicePdfData,
    build_invoice_filename,
    create_invoice_pdf,
)
from app.services.store_errors import RecordConflictError


INVOICE_ID = UUID("00000000-0000-0000-0000-000000000020")


def pdf_data(*, arabic: bool = False) -> InvoicePdfData:
    now = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    return InvoicePdfData(
        invoice_number="INV-TEST-001",
        status="unpaid",
        total_amount=1150,
        vat_amount=150,
        currency="TRY",
        issued_at=now,
        due_at=now,
        revision_at=now,
        company_name="شركة زمام التجريبية" if arabic else "Zemam Trading Demo",
        company_email="billing@example.com",
        company_address="Istanbul",
        customer_name="عميل تجريبي" if arabic else "Demo Customer",
        customer_email="customer@example.com",
    )


def invoice_document(*, email: str | None = "customer@example.com") -> InvoiceDocument:
    data = pdf_data()
    return InvoiceDocument(
        invoice_id=str(INVOICE_ID),
        invoice_number=data.invoice_number,
        customer_id="00000000-0000-0000-0000-000000000030",
        customer_email=email,
        customer_name=data.customer_name,
        revision=data.revision_at.isoformat(),
        pdf_data=data,
    )


def context(*permissions: str) -> RequestContext:
    return RequestContext(
        user_id="00000000-0000-0000-0000-000000000010",
        email="owner@example.com",
        company_id="00000000-0000-0000-0000-000000000001",
        company_name="Development Company",
        company_role="owner",
        permissions=frozenset(permissions),
        access_token="not-a-real-token",
    )


@pytest.mark.parametrize("language", ["en", "ar"])
def test_invoice_pdf_is_valid_and_contains_core_data(language: str) -> None:
    content = create_invoice_pdf(
        pdf_data(arabic=language == "ar"),
        language=language,
    )
    reader = PdfReader(BytesIO(content), strict=True)

    assert content.startswith(b"%PDF-")
    assert len(reader.pages) == 1
    assert "INV-TEST-001" in (reader.pages[0].extract_text() or "")


@pytest.mark.parametrize(
    ("unsafe", "expected"),
    [
        ("../../INV 001", "invoice-INV-001.pdf"),
        ("..\\..\\", "invoice-document.pdf"),
        ("فاتورة ١", "invoice-document.pdf"),
    ],
)
def test_invoice_filename_blocks_path_traversal(
    unsafe: str,
    expected: str,
) -> None:
    file_name = build_invoice_filename(unsafe)

    assert file_name == expected
    assert "/" not in file_name
    assert "\\" not in file_name
    assert ".." not in file_name


class FakeBucket:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes, dict[str, str]]] = []

    def upload(self, path: str, content: bytes, options: dict[str, str]) -> None:
        self.uploads.append((path, content, options))

    def create_signed_url(
        self,
        path: str,
        lifetime: int,
        options: dict[str, str],
    ) -> dict[str, str]:
        assert path
        assert lifetime <= 300
        assert options["download"].endswith(".pdf")
        return {"signedURL": "https://storage.example.test/signed"}


class FakeTable:
    def __init__(self) -> None:
        self.payload: dict[str, object] | None = None

    def insert(self, payload: dict[str, object]) -> FakeTable:
        self.payload = payload
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=[self.payload])


class FakeClient:
    def __init__(self) -> None:
        self.bucket = FakeBucket()
        self.table_client = FakeTable()
        self.storage = SimpleNamespace(from_=lambda _: self.bucket)

    def table(self, name: str) -> FakeTable:
        assert name == "financial_attachments"
        return self.table_client


def test_generated_pdf_uses_company_scoped_private_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = FakeClient()
    monkeypatch.setattr(
        invoice_delivery_service,
        "_load_invoice_document",
        lambda _: invoice_document(),
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "_find_pdf_attachment",
        lambda **_: None,
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "get_request_context",
        lambda: context("financial.read", "financial.write"),
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "get_supabase_client",
        lambda: client,
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "record_delivery_event",
        lambda **_: True,
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "create_notification",
        lambda **_: True,
    )

    download, _, _ = invoice_delivery_service.ensure_invoice_pdf(
        INVOICE_ID,
        language="en",
        allow_generate=True,
    )

    path, content, options = client.bucket.uploads[0]
    assert path.startswith(
        "00000000-0000-0000-0000-000000000001/invoice/"
        "00000000-0000-0000-0000-000000000020/generated/"
    )
    assert ".." not in path
    assert content.startswith(b"%PDF-")
    assert options["content-type"] == "application/pdf"
    assert options["upsert"] == "false"
    assert download.url == "https://storage.example.test/signed"


def test_viewer_cannot_generate_a_missing_pdf(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        invoice_delivery_service,
        "_load_invoice_document",
        lambda _: invoice_document(),
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "_find_pdf_attachment",
        lambda **_: None,
    )

    with pytest.raises(RecordConflictError, match="not been generated"):
        invoice_delivery_service.ensure_invoice_pdf(
            INVOICE_ID,
            language="en",
            allow_generate=False,
        )


class FakeEmailProvider:
    def __init__(self) -> None:
        self.messages: list[InvoiceEmail] = []

    def send_invoice(self, message: InvoiceEmail) -> None:
        self.messages.append(message)


def test_email_uses_customer_address_and_mock_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider = FakeEmailProvider()
    download = InvoicePdfDownload(
        url="https://storage.example.test/signed",
        file_name="invoice-INV-TEST-001.pdf",
        expires_at=datetime.now(timezone.utc),
        generated=False,
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "ensure_invoice_pdf",
        lambda *_, **__: (download, invoice_document(), b"%PDF-test"),
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "record_delivery_event",
        lambda **_: True,
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "create_notification",
        lambda **_: True,
    )

    invoice_delivery_service.send_invoice_email(
        INVOICE_ID,
        language="en",
        provider=provider,
        now=datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc),
    )

    assert len(provider.messages) == 1
    assert provider.messages[0].recipient == "customer@example.com"
    assert provider.messages[0].attachment_bytes == b"%PDF-test"


def test_email_rejects_invalid_customer_and_duplicate_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    download = InvoicePdfDownload(
        url="https://storage.example.test/signed",
        file_name="invoice.pdf",
        expires_at=datetime.now(timezone.utc),
        generated=False,
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "ensure_invoice_pdf",
        lambda *_, **__: (download, invoice_document(email="bad"), b"%PDF-test"),
    )
    with pytest.raises(ValueError, match="valid email"):
        invoice_delivery_service.send_invoice_email(
            INVOICE_ID,
            language="en",
            provider=FakeEmailProvider(),
        )

    monkeypatch.setattr(
        invoice_delivery_service,
        "ensure_invoice_pdf",
        lambda *_, **__: (download, invoice_document(), b"%PDF-test"),
    )
    monkeypatch.setattr(
        invoice_delivery_service,
        "record_delivery_event",
        lambda **_: False,
    )
    with pytest.raises(RecordConflictError, match="already in progress"):
        invoice_delivery_service.send_invoice_email(
            INVOICE_ID,
            language="en",
            provider=FakeEmailProvider(),
        )


def test_unconfigured_email_provider_fails_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(email_service, "SMTP_HOST", None)
    monkeypatch.setattr(email_service, "SMTP_FROM_EMAIL", None)

    with pytest.raises(EmailNotConfiguredError, match="not configured"):
        email_service.get_email_provider()

    assert normalize_recipient(" Customer@Example.COM ") == "customer@example.com"


def test_delivery_requests_reject_untrusted_recipient_path_and_company() -> None:
    with pytest.raises(ValueError):
        InvoiceEmailRequest.model_validate(
            {
                "language": "en",
                "recipient": "attacker@example.com",
                "company_id": "untrusted",
            }
        )
    with pytest.raises(ValueError):
        InvoicePdfRequest.model_validate(
            {
                "language": "ar",
                "storage_path": "../../private.pdf",
            }
        )


def test_overdue_notification_scan_uses_central_invoice_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    invoices = [
        InvoiceResponse(
            id=str(INVOICE_ID),
            invoice_number="INV-OVERDUE",
            total_amount=100,
            vat_amount=15,
            status="overdue",
            due_date="2026-07-20T00:00:00+00:00",
        ),
        InvoiceResponse(
            id="00000000-0000-0000-0000-000000000021",
            invoice_number="INV-PAID",
            total_amount=100,
            vat_amount=15,
            status="paid",
        ),
    ]
    created: list[str] = []
    monkeypatch.setattr(notification_store, "get_invoices", lambda: invoices)
    monkeypatch.setattr(
        notification_store,
        "get_request_context",
        lambda: context("financial.read", "financial.write"),
    )
    monkeypatch.setattr(
        notification_store,
        "create_notification",
        lambda **kwargs: created.append(kwargs["event_type"]) or True,
    )
    monkeypatch.setattr(
        notification_store,
        "record_delivery_event",
        lambda **_: True,
    )

    assert notification_store.scan_overdue_invoice_notifications() == 1
    assert created == ["invoice_overdue"]
