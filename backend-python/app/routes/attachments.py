import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.schemas.attachment_schema import (
    AttachmentDownload,
    AttachmentRecordType,
    FinancialAttachment,
)
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.services.attachment_service import (
    MAX_ATTACHMENT_BYTES,
    AttachmentValidationError,
    create_attachment_download,
    delete_attachment,
    list_attachments,
    upload_attachment,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.get(
    "/records/{record_type}/{record_id}",
    response_model=list[FinancialAttachment],
)
def get_record_attachments(
    record_type: AttachmentRecordType,
    record_id: UUID,
    _: RequestContext = Depends(require_permission("financial.read")),
) -> list[FinancialAttachment]:
    try:
        return list_attachments(record_type, record_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unable to list financial attachments.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Financial attachments are unavailable.",
        ) from error


@router.post(
    "/records/{record_type}/{record_id}",
    response_model=FinancialAttachment,
    status_code=status.HTTP_201_CREATED,
)
async def add_record_attachment(
    record_type: AttachmentRecordType,
    record_id: UUID,
    file: UploadFile = File(...),
    _: RequestContext = Depends(require_permission("financial.write")),
) -> FinancialAttachment:
    content = await file.read(MAX_ATTACHMENT_BYTES + 1)
    try:
        return upload_attachment(
            record_type=record_type,
            record_id=record_id,
            file_name=file.filename or "attachment",
            declared_mime_type=file.content_type,
            content=content,
        )
    except AttachmentValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unable to upload a financial attachment.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The attachment could not be stored.",
        ) from error
    finally:
        await file.close()


@router.post("/{attachment_id}/download", response_model=AttachmentDownload)
def download_record_attachment(
    attachment_id: UUID,
    _: RequestContext = Depends(require_permission("financial.read")),
) -> AttachmentDownload:
    try:
        return create_attachment_download(attachment_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unable to create an attachment download URL.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The attachment download is unavailable.",
        ) from error


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_record_attachment(
    attachment_id: UUID,
    _: RequestContext = Depends(require_permission("financial.write")),
) -> None:
    try:
        delete_attachment(attachment_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except Exception as error:
        logger.exception("Unable to delete a financial attachment.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The attachment could not be deleted.",
        ) from error
