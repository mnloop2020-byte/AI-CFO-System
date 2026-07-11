from functools import lru_cache

from sentence_transformers import SentenceTransformer
from supabase import Client, create_client

from app.config.settings import (
    EMBEDDING_MODEL,
    RAG_MATCH_COUNT,
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


def embed_query(query: str) -> list[float]:
    model = get_embedding_model()
    embedding = model.encode(query)

    return embedding.tolist()


def search_documents(
    query: str,
    match_count: int = RAG_MATCH_COUNT,
) -> list[dict]:
    query_embedding = embed_query(query)
    supabase = get_supabase_client()

    response = supabase.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_count": match_count,
        },
    ).execute()

    return response.data or []


# Note: This file searches Supabase pgvector for chunks related to the user question.س