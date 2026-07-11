from pydantic import BaseModel


class AddDocumentRequest(BaseModel):
    content: str
    source: str | None = None


class AddDocumentResponse(BaseModel):
    message: str
    chunks_count: int


# Note: This file defines request and response shapes for adding RAG documents.