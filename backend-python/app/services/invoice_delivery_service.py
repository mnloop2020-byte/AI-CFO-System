from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from app.money import parse_money
from app.schemas.invoices_schema import InvoicePdfDownload
from app.security.request_context import get_request_context
from app.services.attachment_service import (
    ATTACHMENTS_BUCKET,
    SIGNED_URL_LIFETIME_SECONDS,
)
from app.services.company_store import get_company_settings
from app.services.email_service import (
    EmailDeliveryError,
    EmailNotConfiguredError,
    EmailProvider,
    InvoiceEmail,
    get_email_provider,
    normalize_recipient,
)
from app.services.invoice_pdf_service import (
    InvoiceLanguage,
    InvoicePdfData,
    build_invoice_filename,
    create_invoice_pdf,
)
from app.services.notification_store import (
    create_notification,
    record_delivery_event,
)
from app.services.store_errors import (
    RecordConflictError,
    RecordNotFoundError,
    is_constraint_error,
)
from app.services.supabase_client import get_supabase_client


logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class InvoiceDocument:
    invoice_id: str
    invoice_number: str
    customer_id: str | None
    customer_email: str | None
    customer_name: str | None
    revision: str
    pdf_data: InvoicePdfData


def _parse_datetime(value: object, *, fallback: datetime | None = None) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif value:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    elif fallback is not None:
        parsed = fallback
    else:
        parsed = datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _load_invoice_document(invoice_id: UUID) -> InvoiceDocument:
    client = get_supabase_client()
    response = (
        client.table("invoices")
        .select(
            "id,customer_id,invoice_number,total_amount,vat_amount,status,"
            "due_date,created_at,updated_at"
        )
        .eq("id", str(invoice_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise RecordNotFoundError("Invoice not found")
    invoice = response.data[0]

    customer: dict[str, Any] = {}
    if invoice.get("customer_id"):
        customer_response = (
            client.table("customers")
            .select("id,name,company_name,email,phone")
            .eq("id", str(invoice["customer_id"]))
            .limit(1)
            .execute()
        )
        if customer_response.data:
            customer = customer_response.data[0]

    company = get_company_settings()
    issued_at = _parse_datetime(invoice.get("created_at"))
    revision_at = _parse_datetime(invoice.get("updated_at"), fallback=issued_at)
    due_at = (
        _parse_datetime(invoice["due_date"])
        if invoice.get("due_date")
        else None
    )
    revision = revision_at.isoformat()
    return InvoiceDocument(
        invoice_id=str(invoice["id"]),
        invoice_number=str(invoice["invoice_number"]),
        customer_id=(
            str(invoice["customer_id"]) if invoice.get("customer_id") else None
        ),
        customer_email=(
            str(customer["email"]) if customer.get("email") else None
        ),
        customer_name=(
            str(customer["name"]) if customer.get("name") else None
        ),
        revision=revision,
        pdf_data=InvoicePdfData(
            invoice_number=str(invoice["invoice_number"]),
            status=str(invoice["status"]),
            total_amount=parse_money(invoice["total_amount"]),
            vat_amount=parse_money(invoice["vat_amount"]),
            currency=company.currency or "XXX",
            issued_at=issued_at,
            due_at=due_at,
            revision_at=revision_at,
            company_name=company.name,
            company_legal_name=company.legal_name,
            company_email=company.email,
            company_phone=company.phone,
            company_address=company.address,
            company_city=company.city,
            company_country=company.country,
            company_tax_id=company.tax_id,
            customer_name=(
                str(customer["name"]) if customer.get("name") else None
            ),
            customer_company=(
                str(customer["company_name"])
                if customer.get("company_name")
                else None
            ),
            customer_email=(
                str(customer["email"]) if customer.get("email") else None
            ),
            customer_phone=(
                str(customer["phone"]) if customer.get("phone") else None
            ),
            notes=None,
        ),
    )


def _extract_signed_url(response: object) -> str | None:
    if isinstance(response, dict):
        return (
            response.get("signedURL")
            or response.get("signedUrl")
            or response.get("signed_url")
        )
    return getattr(response, "signed_url", None)


def _create_signed_download(
    *,
    storage_path: str,
    file_name: str,
    generated: bool,
) -> InvoicePdfDownload:
    response = (
        get_supabase_client()
        .storage.from_(ATTACHMENTS_BUCKET)
        .create_signed_url(
            storage_path,
            SIGNED_URL_LIFETIME_SECONDS,
            {"download": file_name},
        )
    )
    signed_url = _extract_signed_url(response)
    if not signed_url:
        raise RuntimeError("Storage did not return a signed download URL.")
    return InvoicePdfDownload(
        url=signed_url,
        file_name=file_name,
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=SIGNED_URL_LIFETIME_SECONDS),
        generated=generated,
    )


def _find_pdf_attachment(
    *,
    invoice_id: str,
    sha256: str,
) -> dict[str, Any] | None:
    response = (
        get_supabase_client()
        .table("financial_attachments")
        .select("id,storage_path,original_file_name,sha256")
        .eq("invoice_id", invoice_id)
        .eq("sha256", sha256)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def ensure_invoice_pdf(
    invoice_id: UUID,
    *,
    language: InvoiceLanguage,
    allow_generate: bool,
) -> tuple[InvoicePdfDownload, InvoiceDocument, bytes]:
    document = _load_invoice_document(invoice_id)
    pdf_bytes = create_invoice_pdf(document.pdf_data, language=language)
    digest = hashlib.sha256(pdf_bytes).hexdigest()
    existing = _find_pdf_attachment(
        invoice_id=document.invoice_id,
        sha256=digest,
    )
    if existing:
        return (
            _create_signed_download(
                storage_path=str(existing["storage_path"]),
                file_name=str(existing["original_file_name"]),
                generated=False,
            ),
            document,
            pdf_bytes,
        )

    if not allow_generate:
        raise RecordConflictError(
            "The current invoice PDF has not been generated yet."
        )

    context = get_request_context()
    file_name = build_invoice_filename(document.invoice_number)
    attachment_id = uuid4()
    storage_path = (
        f"{context.company_id}/invoice/{document.invoice_id}/generated/"
        f"{digest[:16]}/{file_name}"
    )
    client = get_supabase_client()
    try:
        client.storage.from_(ATTACHMENTS_BUCKET).upload(
            storage_path,
            pdf_bytes,
            {
                "content-type": "application/pdf",
                "cache-control": "3600",
                "upsert": "false",
            },
        )
    except Exception as error:
        concurrent = _find_pdf_attachment(
            invoice_id=document.invoice_id,
            sha256=digest,
        )
        if concurrent:
            return (
                _create_signed_download(
                    storage_path=str(concurrent["storage_path"]),
                    file_name=str(concurrent["original_file_name"]),
                    generated=False,
                ),
                document,
                pdf_bytes,
            )
        raise RuntimeError("Invoice PDF storage is unavailable.") from error

    try:
        response = (
            client.table("financial_attachments")
            .insert(
                {
                    "id": str(attachment_id),
                    "invoice_id": document.invoice_id,
                    "original_file_name": file_name,
                    "storage_path": storage_path,
                    "mime_type": "application/pdf",
                    "size_bytes": len(pdf_bytes),
                    "sha256": digest,
                }
            )
            .execute()
        )
    except Exception as error:
        try:
            client.storage.from_(ATTACHMENTS_BUCKET).remove([storage_path])
        except Exception:
            logger.warning("Unable to remove an unreferenced invoice PDF.")
        if is_constraint_error(error, "23505"):
            concurrent = _find_pdf_attachment(
                invoice_id=document.invoice_id,
                sha256=digest,
            )
            if concurrent:
                return (
                    _create_signed_download(
                        storage_path=str(concurrent["storage_path"]),
                        file_name=str(concurrent["original_file_name"]),
                        generated=False,
                    ),
                    document,
                    pdf_bytes,
                )
        raise RuntimeError("Invoice PDF metadata could not be stored.") from error

    if not response.data:
        try:
            client.storage.from_(ATTACHMENTS_BUCKET).remove([storage_path])
        except Exception:
            logger.warning("Unable to remove an unreferenced invoice PDF.")
        raise RuntimeError("Invoice PDF metadata could not be stored.")

    record_delivery_event(
        invoice_id=document.invoice_id,
        event_type="pdf_generated",
        idempotency_key=f"pdf-generated:{document.invoice_id}:{digest}",
        metadata={"language": language, "sha256_prefix": digest[:12]},
    )
    create_notification(
        invoice_id=document.invoice_id,
        event_type="invoice_generated",
        dedupe_key=f"invoice-generated:{document.invoice_id}:{digest}",
        data={"invoice_number": document.invoice_number},
    )
    return (
        _create_signed_download(
            storage_path=storage_path,
            file_name=file_name,
            generated=True,
        ),
        document,
        pdf_bytes,
    )


def create_invoice_pdf_download(
    invoice_id: UUID,
    *,
    language: InvoiceLanguage,
) -> InvoicePdfDownload:
    context = get_request_context()
    download, document, _ = ensure_invoice_pdf(
        invoice_id,
        language=language,
        allow_generate=context.has_permission("financial.write"),
    )
    record_delivery_event(
        invoice_id=document.invoice_id,
        event_type="pdf_downloaded",
        idempotency_key=f"pdf-download:{document.invoice_id}:{uuid4()}",
        metadata={"language": language},
    )
    return download


def send_invoice_email(
    invoice_id: UUID,
    *,
    language: InvoiceLanguage,
    provider: EmailProvider | None = None,
    now: datetime | None = None,
) -> None:
    moment = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    _, document, pdf_bytes = ensure_invoice_pdf(
        invoice_id,
        language=language,
        allow_generate=True,
    )
    recipient = normalize_recipient(document.customer_email)
    recipient_hash = hashlib.sha256(recipient.encode("utf-8")).hexdigest()[:16]
    window = int(moment.timestamp()) // 300
    request_key = (
        f"email-request:{document.invoice_id}:{document.revision}:"
        f"{recipient_hash}:{window}"
    )
    if not record_delivery_event(
        invoice_id=document.invoice_id,
        event_type="email_requested",
        idempotency_key=request_key,
        metadata={"language": language},
    ):
        raise RecordConflictError(
            "An email delivery request for this invoice is already in progress."
        )

    file_name = build_invoice_filename(document.invoice_number)
    if language == "ar":
        subject = f"فاتورة {document.invoice_number}"
        body = (
            f"مرحبًا {document.customer_name or ''},\n\n"
            "يرجى العثور على الفاتورة المرفقة بصيغة PDF.\n"
            "هذه رسالة آلية، يرجى التواصل مع الشركة عند وجود أي استفسار."
        )
    else:
        subject = f"Invoice {document.invoice_number}"
        body = (
            f"Hello {document.customer_name or ''},\n\n"
            "Please find the invoice attached as a PDF.\n"
            "This is an automated message; contact the company with any questions."
        )
    message = InvoiceEmail(
        recipient=recipient,
        subject=subject,
        body=body,
        attachment_name=file_name,
        attachment_bytes=pdf_bytes,
    )

    try:
        selected_provider = provider or get_email_provider()
        selected_provider.send_invoice(message)
    except (EmailNotConfiguredError, EmailDeliveryError) as error:
        record_delivery_event(
            invoice_id=document.invoice_id,
            event_type="email_failed",
            idempotency_key=f"email-failed:{request_key}",
            metadata={"reason": error.__class__.__name__},
        )
        create_notification(
            invoice_id=document.invoice_id,
            event_type="invoice_email_failed",
            dedupe_key=f"invoice-email-failed:{request_key}",
            data={"invoice_number": document.invoice_number},
        )
        raise

    record_delivery_event(
        invoice_id=document.invoice_id,
        event_type="email_sent",
        idempotency_key=f"email-sent:{request_key}",
        metadata={"language": language},
    )
    create_notification(
        invoice_id=document.invoice_id,
        event_type="invoice_emailed",
        dedupe_key=f"invoice-emailed:{request_key}",
        data={"invoice_number": document.invoice_number},
    )
