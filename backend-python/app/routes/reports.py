import logging
from io import BytesIO

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.schemas.report_schema import (
    CreateReportPdfRequest,
    GenerateReportRequest,
    GenerateReportResponse,
    ReportDownloadResponse,
    StoredReport,
    StoreReportRequest,
)
from app.services.report_pdf_service import (
    build_report_filename,
    create_report_pdf,
)
from app.services.report_service import generate_report
from app.services.report_store import (
    create_report_download,
    list_reports,
    store_report,
)
from uuid import UUID


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post(
    "/generate",
    response_model=GenerateReportResponse,
)
def generate_financial_report(
    request: GenerateReportRequest,
) -> GenerateReportResponse:
    try:
        return generate_report(request)
    except Exception as error:
        logger.exception(
            "Report generation failed for report type %s",
            request.report_type,
        )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to generate the report.",
        ) from error


@router.post("/pdf", response_class=StreamingResponse)
def download_report_pdf(
    request: CreateReportPdfRequest,
) -> StreamingResponse:
    try:
        pdf_bytes = create_report_pdf(
            report_type=request.report_type,
            language=request.language,
            content=request.content,
            generated_at=request.generated_at,
        )
        filename = build_report_filename(
            request.report_type,
            request.generated_at,
        )

        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )
    except Exception as error:
        logger.exception(
            "PDF generation failed for report type %s",
            request.report_type,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the PDF report.",
        ) from error


@router.post(
    "/store",
    response_model=StoredReport,
    status_code=status.HTTP_201_CREATED,
)
def save_financial_report(
    request: StoreReportRequest,
) -> StoredReport:
    try:
        return store_report(request)
    except Exception as error:
        logger.exception(
            "Report storage failed for report type %s",
            request.report_type,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Report storage is unavailable.",
        ) from error


@router.get("", response_model=list[StoredReport])
def get_stored_reports() -> list[StoredReport]:
    try:
        return list_reports()
    except Exception as error:
        logger.exception("Unable to list stored reports.")

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stored report history is unavailable.",
        ) from error


@router.post(
    "/{report_id}/download",
    response_model=ReportDownloadResponse,
)
def get_report_download(
    report_id: UUID,
) -> ReportDownloadResponse:
    try:
        return create_report_download(report_id)
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except Exception as error:
        logger.exception(
            "Unable to create a signed URL for report %s",
            report_id,
        )

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stored report download is unavailable.",
        ) from error


# Storage endpoints use a private bucket and short-lived signed download URLs.
