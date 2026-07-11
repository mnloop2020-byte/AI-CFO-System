from functools import lru_cache

from sentence_transformers import SentenceTransformer
from supabase import Client, create_client

from app.config.settings import (
    EMBEDDING_MODEL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer(EMBEDDING_MODEL)


def get_supabase_client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing. Add it to backend-python/.env")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to backend-python/.env"
        )

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> list[str]:
    clean_text = text.strip()

    if not clean_text:
        return []

    chunks: list[str] = []
    start = 0

    while start < len(clean_text):
        end = start + chunk_size
        chunk = clean_text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start = end - overlap

    return chunks


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    embeddings = model.encode(chunks)

    return [embedding.tolist() for embedding in embeddings]


def ingest_document(
    content: str,
    metadata: dict | None = None,
) -> int:
    chunks = chunk_text(content)
    embeddings = embed_chunks(chunks)

    rows = []

    for chunk, embedding in zip(chunks, embeddings):
        rows.append(
            {
                "content": chunk,
                "embedding": embedding,
                "metadata": metadata or {},
            }
        )

    if not rows:
        return 0

    supabase = get_supabase_client()
    supabase.table("documents").insert(rows).execute()

    return len(rows)


# Note: This file chunks documents, creates embeddings, and saves them into Supabase.