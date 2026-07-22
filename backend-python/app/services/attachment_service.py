from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import PurePosixPath
from typing import Any
from uuid import UUID, uuid4

from pypdf import PdfReader
from PIL import Image

from app.schemas.attachment_schema import (
    AttachmentDownload,
    AttachmentRecordType,
    FinancialAttachment,
)
from app.security.request_context import get_current_company_id
from app.services.supabase_client import get_supabase_client


ATTACHMENTS_BUCKET = "financial-attachments"
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
SIGNED_URL_LIFETIME_SECONDS = 180

_MIME_EXTENSIONS = {
    "application/pdf": {".pdf"},
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
}

Image.MAX_IMAGE_PIXELS = 40_000_000


class AttachmentValidationError(ValueError):
    pass


def _clean_file_name(file_name: str) -> str:
    base_name = PurePosixPath(file_name.replace("\\", "/")).name.strip()
    cleaned = "".join(
        character
        for character in base_name
        if character.isprintable() and character not in {"/", "\\", "\x00"}
    )
    if not cleaned or len(cleaned) > 255:
        raise AttachmentValidationError("A valid file name is required.")
    return cleaned


def validate_attachment(
    file_name: str,
    declared_mime_type: str | None,
    content: bytes,
) -> tuple[str, str, str]:
    clean_name = _clean_file_name(file_name)
    if not content:
        raise AttachmentValidationError("The attachment is empty.")
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise AttachmentValidationError("The attachment exceeds the 5 MB limit.")

    detected_mime: str
    if content.startswith(b"%PDF-"):
        try:
            PdfReader(BytesIO(content), strict=True)
        except Exception as error:
            raise AttachmentValidationError("The PDF file is invalid.") from error
        detected_mime = "application/pdf"
    elif content.startswith(b"\x89PNG\r\n\x1a\n") or content.startswith(b"\xff\xd8\xff"):
        try:
            with Image.open(BytesIO(content)) as image:
                image.verify()
                detected_format = image.format
        except Exception as error:
            raise AttachmentValidationError("The image file is invalid.") from error
        if detected_format == "PNG":
            detected_mime = "image/png"
        elif detected_format == "JPEG":
            detected_mime = "image/jpeg"
        else:
            raise AttachmentValidationError("Only PNG and JPEG images are accepted.")
    else:
        raise AttachmentValidationError(
            "Only valid PDF, PNG, and JPEG files are accepted."
        )

    normalized_declared = (declared_mime_type or "").split(";", 1)[0].strip().lower()
    if normalized_declared != detected_mime:
        raise AttachmentValidationError("The declared MIME type does not match the file.")

    extension = PurePosixPath(clean_name).suffix.lower()
    if extension not in _MIME_EXTENSIONS[detected_mime]:
        raise AttachmentValidationError("The file extension does not match the file type.")

    return clean_name, detected_mime, extension


def _attachment_from_row(row: dict[str, Any]) -> FinancialAttachment:
    if row.get("invoice_id"):
        record_type: AttachmentRecordType = "invoice"
        record_id = row["invoice_id"]
    else:
        record_type = "expense"
        record_id = row["expense_id"]

    return FinancialAttachment(
        id=row["id"],
        record_type=record_type,
        record_id=record_id,
        original_file_name=row["original_file_name"],
        mime_type=row["mime_type"],
        size_bytes=row["size_bytes"],
        sha256=row["sha256"],
        uploaded_by=row["uploaded_by"],
        created_at=row["created_at"],
    )


def _record_column(record_type: AttachmentRecordType) -> tuple[str, str]:
    if record_type == "invoice":
        return "invoices", "invoice_id"
    return "expenses", "expense_id"


def _require_record(record_type: AttachmentRecordType, record_id: UUID) -> None:
    table, _ = _record_column(record_type)
    response = (
        get_supabase_client()
        .table(table)
        .select("id")
        .eq("id", str(record_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise LookupError(f"{record_type.title()} record not found.")


def upload_attachment(
    record_type: AttachmentRecordType,
    record_id: UUID,
    file_name: str,
    declared_mime_type: str | None,
    content: bytes,
) -> FinancialAttachment:
    _require_record(record_type, record_id)
    clean_name, detected_mime, extension = validate_attachment(
        file_name,
        declared_mime_type,
        content,
    )
    client = get_supabase_client()
    company_id = get_current_company_id()
    attachment_id = uuid4()
    storage_path = (
        f"{company_id}/{record_type}/{record_id}/{attachment_id}{extension}"
    )

    client.storage.from_(ATTACHMENTS_BUCKET).upload(
        storage_path,
        content,
        {
            "content-type": detected_mime,
            "cache-control": "3600",
            "upsert": "false",
        },
    )

    _, record_column = _record_column(record_type)
    try:
        response = (
            client.table("financial_attachments")
            .insert(
                {
                    "id": str(attachment_id),
                    record_column: str(record_id),
                    "original_file_name": clean_name,
                    "storage_path": storage_path,
                    "mime_type": detected_mime,
                    "size_bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
            .execute()
        )
    except Exception:
        client.storage.from_(ATTACHMENTS_BUCKET).remove([storage_path])
        raise

    if not response.data:
        client.storage.from_(ATTACHMENTS_BUCKET).remove([storage_path])
        raise RuntimeError("Supabase did not return the attachment record.")
    return _attachment_from_row(response.data[0])


def list_attachments(
    record_type: AttachmentRecordType,
    record_id: UUID,
) -> list[FinancialAttachment]:
    _require_record(record_type, record_id)
    _, record_column = _record_column(record_type)
    response = (
        get_supabase_client()
        .table("financial_attachments")
        .select(
            "id,invoice_id,expense_id,original_file_name,mime_type,size_bytes,"
            "sha256,uploaded_by,created_at"
        )
        .eq(record_column, str(record_id))
        .order("created_at", desc=True)
        .execute()
    )
    return [_attachment_from_row(row) for row in response.data or []]


def create_attachment_download(attachment_id: UUID) -> AttachmentDownload:
    client = get_supabase_client()
    response = (
        client.table("financial_attachments")
        .select("storage_path,original_file_name")
        .eq("id", str(attachment_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise LookupError("Attachment not found.")
    row = response.data[0]
    signed_response = client.storage.from_(ATTACHMENTS_BUCKET).create_signed_url(
        row["storage_path"],
        SIGNED_URL_LIFETIME_SECONDS,
        {"download": row["original_file_name"]},
    )
    if isinstance(signed_response, dict):
        signed_url = (
            signed_response.get("signedURL")
            or signed_response.get("signedUrl")
            or signed_response.get("signed_url")
        )
    else:
        signed_url = getattr(signed_response, "signed_url", None)
    if not signed_url:
        raise RuntimeError("Supabase did not return a signed download URL.")
    return AttachmentDownload(
        url=signed_url,
        file_name=row["original_file_name"],
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=SIGNED_URL_LIFETIME_SECONDS),
    )


def delete_attachment(attachment_id: UUID) -> None:
    client = get_supabase_client()
    response = (
        client.table("financial_attachments")
        .select("id,storage_path")
        .eq("id", str(attachment_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise LookupError("Attachment not found.")
    row = response.data[0]
    client.storage.from_(ATTACHMENTS_BUCKET).remove([row["storage_path"]])
    deleted = (
        client.table("financial_attachments")
        .delete()
        .eq("id", str(attachment_id))
        .execute()
    )
    if not deleted.data:
        raise RuntimeError("Attachment metadata could not be removed.")
