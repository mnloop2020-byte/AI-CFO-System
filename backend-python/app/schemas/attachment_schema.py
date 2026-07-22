from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


AttachmentRecordType = Literal["invoice", "expense"]


class FinancialAttachment(BaseModel):
    id: UUID
    record_type: AttachmentRecordType
    record_id: UUID
    original_file_name: str
    mime_type: Literal["application/pdf", "image/png", "image/jpeg"]
    size_bytes: int
    sha256: str
    uploaded_by: UUID
    created_at: datetime


class AttachmentDownload(BaseModel):
    url: str
    file_name: str
    expires_at: datetime
