from __future__ import annotations

from functools import lru_cache
from typing import Any

from sentence_transformers import SentenceTransformer

from app.config.settings import EMBEDDING_MODEL
from app.rag.extract import extract_document_text
from app.services.supabase_client import get_service_supabase_client


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL)


def chunk_text(text: str, chunk_size: int = 1_000, overlap: int = 150) -> list[str]:
    clean_text = text.strip()
    if not clean_text:
        return []

    chunks: list[str] = []
    start = 0
    text_length = len(clean_text)

    while start < text_length:
        hard_end = min(start + chunk_size, text_length)
        end = hard_end
        if hard_end < text_length:
            paragraph_break = clean_text.rfind("\n", start + chunk_size // 2, hard_end)
            sentence_break = clean_text.rfind(". ", start + chunk_size // 2, hard_end)
            end = max(paragraph_break + 1, sentence_break + 2, start + chunk_size // 2)

        chunk = clean_text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_length:
            break
        start = max(end - overlap, start + 1)

    return chunks


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    if not chunks:
        return []
    model = get_embedding_model()
    embeddings = model.encode(
        chunks,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [embedding.tolist() for embedding in embeddings]


def process_document(document_id: str, file_name: str, content: bytes) -> None:
    # Processing runs after the HTTP request finishes. It uses service_role
    # only after loading the document's trusted, stored company_id.
    client = get_service_supabase_client()
    try:
        document_response = (
            client.table("documents")
            .select("id,company_id")
            .eq("id", document_id)
            .limit(1)
            .execute()
        )
        if not document_response.data:
            return

        company_id = document_response.data[0]["company_id"]
        client.table("documents").update(
            {"status": "processing", "error_message": None}
        ).eq("id", document_id).execute()

        text = extract_document_text(file_name, content)
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("The document did not produce any searchable text chunks.")

        embeddings = embed_chunks(chunks)
        client.table("document_chunks").delete().eq("document_id", document_id).execute()

        rows: list[dict[str, Any]] = []
        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            rows.append(
                {
                    "document_id": document_id,
                    "company_id": company_id,
                    "chunk_index": index,
                    "content": chunk,
                    "embedding": embedding,
                    "metadata": {"file_name": file_name},
                }
            )

        for offset in range(0, len(rows), 100):
            client.table("document_chunks").insert(rows[offset : offset + 100]).execute()

        client.table("documents").update(
            {"status": "ready", "chunk_count": len(rows), "error_message": None}
        ).eq("id", document_id).execute()
    except Exception as error:
        client.table("document_chunks").delete().eq("document_id", document_id).execute()
        client.table("documents").update(
            {
                "status": "failed",
                "chunk_count": 0,
                "error_message": str(error)[:500],
            }
        ).eq("id", document_id).execute()
