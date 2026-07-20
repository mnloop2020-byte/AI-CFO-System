from __future__ import annotations

from app.config.settings import RAG_MATCH_COUNT, RAG_MIN_SIMILARITY
from app.rag.ingest import get_embedding_model
from app.services.supabase_client import get_supabase_client


def embed_query(query: str) -> list[float]:
    model = get_embedding_model()
    embedding = model.encode(
        query,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return embedding.tolist()


def search_documents(
    query: str,
    match_count: int = RAG_MATCH_COUNT,
) -> list[dict]:
    query_embedding = embed_query(query)
    client = get_supabase_client()
    response = client.rpc(
        "match_document_chunks",
        {
            "query_embedding": query_embedding,
            "match_count": match_count,
        },
    ).execute()
    return [
        match
        for match in response.data or []
        if float(match.get("similarity") or 0) >= RAG_MIN_SIMILARITY
    ]
