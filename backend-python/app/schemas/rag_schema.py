from datetime import datetime
from typing import Literal

from pydantic import BaseModel


DocumentStatus = Literal["uploaded", "processing", "ready", "failed"]


class DocumentResponse(BaseModel):
    id: str
    file_name: str
    mime_type: str
    size_bytes: int
    status: DocumentStatus
    chunk_count: int = 0
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class UploadDocumentResponse(BaseModel):
    message: str
    document: DocumentResponse


class DeleteDocumentResponse(BaseModel):
    deleted: bool
    document_id: str


class DocumentSource(BaseModel):
    document_id: str
    file_name: str
    chunk_index: int
    excerpt: str
    similarity: float | None = None
