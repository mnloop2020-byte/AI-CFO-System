from fastapi import APIRouter

from app.rag.ingest import ingest_document
from app.schemas.rag_schema import AddDocumentRequest, AddDocumentResponse

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/documents", response_model=AddDocumentResponse)
def add_document(request: AddDocumentRequest):
    chunks_count = ingest_document(
        content=request.content,
        metadata={
            "source": request.source or "manual",
        },
    )

    return AddDocumentResponse(
        message="Document added to RAG successfully.",
        chunks_count=chunks_count,
    )


# Note: This route lets us add documents into the RAG system through an API.