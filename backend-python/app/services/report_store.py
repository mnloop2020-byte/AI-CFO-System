from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from app.schemas.report_schema import (
    ReportDownloadResponse,
    StoredReport,
    StoreReportRequest,
)
from app.services.report_pdf_service import (
    build_report_filename,
    create_report_pdf,
)
from app.security.request_context import get_current_company_id
from app.services.supabase_client import get_supabase_client


REPORTS_BUCKET = "reports"
SIGNED_URL_LIFETIME_SECONDS = 300
REPORT_LIST_LIMIT = 100


def _report_from_row(row: dict[str, Any]) -> StoredReport:
    return StoredReport.model_validate(row)


def store_report(request: StoreReportRequest) -> StoredReport:
    client = get_supabase_client()
    company_id = get_current_company_id()
    report_id = uuid4()
    filename = build_report_filename(request.report_type, request.generated_at)
    generated_at_utc = request.generated_at.astimezone(timezone.utc)
    storage_path = (
        f"{company_id}/{generated_at_utc:%Y/%m}/{report_id}/{filename}"
    )
    pdf_bytes = create_report_pdf(
        report_type=request.report_type,
        language=request.language,
        content=request.content,
        generated_at=request.generated_at,
    )

    client.storage.from_(REPORTS_BUCKET).upload(
        storage_path,
        pdf_bytes,
        {
            "content-type": "application/pdf",
            "cache-control": "3600",
            "upsert": "false",
        },
    )

    row = {
        "id": str(report_id),
        "report_type": request.report_type,
        "generator": request.generator,
        "language": request.language,
        "content": request.content,
        "generated_at": request.generated_at.isoformat(),
        "storage_path": storage_path,
        "file_name": filename,
    }

    try:
        response = client.table("reports").insert(row).execute()
    except Exception:
        client.storage.from_(REPORTS_BUCKET).remove([storage_path])
        raise

    if not response.data:
        client.storage.from_(REPORTS_BUCKET).remove([storage_path])
        raise RuntimeError("Supabase did not return the stored report record.")

    return _report_from_row(response.data[0])


def list_reports() -> list[StoredReport]:
    client = get_supabase_client()
    response = (
        client.table("reports")
        .select(
            "id,report_type,generator,language,generated_at,file_name,created_at"
        )
        .order("generated_at", desc=True)
        .limit(REPORT_LIST_LIMIT)
        .execute()
    )

    return [_report_from_row(row) for row in response.data or []]


def create_report_download(
    report_id: UUID,
) -> ReportDownloadResponse:
    client = get_supabase_client()
    response = (
        client.table("reports")
        .select("storage_path,file_name")
        .eq("id", str(report_id))
        .limit(1)
        .execute()
    )

    if not response.data:
        raise LookupError("Stored report not found.")

    row = response.data[0]
    signed_response = client.storage.from_(REPORTS_BUCKET).create_signed_url(
        row["storage_path"],
        SIGNED_URL_LIFETIME_SECONDS,
        {"download": row["file_name"]},
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

    return ReportDownloadResponse(
        url=signed_url,
        file_name=row["file_name"],
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=SIGNED_URL_LIFETIME_SECONDS),
    )
