from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config.settings import RAG_DOCUMENT_BUCKET
from app.schemas.rag_schema import DocumentResponse
from app.security.request_context import get_current_company_id
from app.services.supabase_client import get_supabase_client


DOCUMENT_COLUMNS = (
    "id,company_id,file_name,mime_type,size_bytes,status,chunk_count,"
    "error_message,created_at,updated_at"
)


def _document_from_row(row: dict[str, Any]) -> DocumentResponse:
    return DocumentResponse.model_validate(row)


def store_uploaded_document(
    file_name: str,
    mime_type: str,
    content: bytes,
) -> DocumentResponse:
    client = get_supabase_client()
    company_id = get_current_company_id()
    document_id = uuid4()
    suffix = Path(file_name).suffix.lower()
    storage_path = f"{company_id}/{document_id}/source{suffix}"

    client.storage.from_(RAG_DOCUMENT_BUCKET).upload(
        storage_path,
        content,
        {
            "content-type": mime_type,
            "cache-control": "3600",
            "upsert": "false",
        },
    )

    row = {
        "id": str(document_id),
        "file_name": file_name,
        "mime_type": mime_type,
        "size_bytes": len(content),
        "storage_path": storage_path,
        "sha256": sha256(content).hexdigest(),
        "status": "uploaded",
        "chunk_count": 0,
    }

    try:
        response = client.table("documents").insert(row).execute()
    except Exception:
        client.storage.from_(RAG_DOCUMENT_BUCKET).remove([storage_path])
        raise

    if not response.data:
        client.storage.from_(RAG_DOCUMENT_BUCKET).remove([storage_path])
        raise RuntimeError("Supabase did not return the uploaded document record.")
    return _document_from_row(response.data[0])


def list_documents() -> list[DocumentResponse]:
    client = get_supabase_client()
    response = (
        client.table("documents")
        .select(DOCUMENT_COLUMNS)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    return [_document_from_row(row) for row in response.data or []]


def get_document(document_id: str) -> DocumentResponse | None:
    client = get_supabase_client()
    response = (
        client.table("documents")
        .select(DOCUMENT_COLUMNS)
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return _document_from_row(response.data[0])


def delete_document(document_id: str) -> bool:
    client = get_supabase_client()
    response = (
        client.table("documents")
        .select("id,storage_path")
        .eq("id", document_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return False

    storage_path = response.data[0]["storage_path"]
    if not storage_path.startswith("legacy/"):
        client.storage.from_(RAG_DOCUMENT_BUCKET).remove([storage_path])

    client.table("documents").delete().eq("id", document_id).execute()
    return True
