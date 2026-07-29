import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)

from app.config.settings import RAG_MAX_FILE_SIZE_BYTES
from app.security.authentication import require_permission
from app.security.request_context import RequestContext
from app.rag.extract import validate_document_file
from app.rag.ingest import process_document
from app.schemas.rag_schema import (
    DeleteDocumentResponse,
    DocumentResponse,
    UploadDocumentResponse,
)
from app.services.document_store import (
    delete_document,
    get_document,
    list_documents,
    store_uploaded_document,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rag", tags=["RAG documents"])


@router.post(
    "/documents/upload",
    response_model=UploadDocumentResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    _: RequestContext = Depends(require_permission("documents.write")),
) -> UploadDocumentResponse:
    content = await file.read(RAG_MAX_FILE_SIZE_BYTES + 1)
    try:
        file_name, mime_type = validate_document_file(
            file_name=file.filename or "",
            content_type=file.content_type,
            content=content,
            max_size_bytes=RAG_MAX_FILE_SIZE_BYTES,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    finally:
        await file.close()

    try:
        document = store_uploaded_document(file_name, mime_type, content)
    except Exception as error:
        logger.exception("Unable to store uploaded RAG document.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Document storage is unavailable. Apply the private RAG "
                "Supabase migration before using this development feature."
            ),
        ) from error

    background_tasks.add_task(
        process_document,
        document.id,
        document.file_name,
        content,
    )
    return UploadDocumentResponse(
        message="Document uploaded. Text extraction and indexing have started.",
        document=document,
    )


@router.get("/documents", response_model=list[DocumentResponse])
def get_documents(
    _: RequestContext = Depends(require_permission("documents.read")),
) -> list[DocumentResponse]:
    try:
        return list_documents()
    except Exception as error:
        logger.exception("Unable to list RAG documents.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Document storage is unavailable. Apply the private RAG "
                "Supabase migration before using this development feature."
            ),
        ) from error


@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document_status(
    document_id: str,
    _: RequestContext = Depends(require_permission("documents.read")),
) -> DocumentResponse:
    try:
        document = get_document(document_id)
    except Exception as error:
        logger.exception("Unable to load RAG document %s.", document_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Document status is unavailable.",
        ) from error
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    return document


@router.delete(
    "/documents/{document_id}",
    response_model=DeleteDocumentResponse,
)
def remove_document(
    document_id: str,
    _: RequestContext = Depends(require_permission("documents.write")),
) -> DeleteDocumentResponse:
    try:
        deleted = delete_document(document_id)
    except Exception as error:
        logger.exception("Unable to delete RAG document %s.", document_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete the document and its private file.",
        ) from error
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    return DeleteDocumentResponse(deleted=True, document_id=document_id)
