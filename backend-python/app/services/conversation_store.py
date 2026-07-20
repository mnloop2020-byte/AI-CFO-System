from datetime import datetime, timezone

from app.schemas.chat_schema import ChatMessage, ConversationSummary
from app.services.supabase_client import get_supabase_client


CONVERSATION_TITLE_MAX_LENGTH = 120


def create_conversation(title: str | None = None) -> str:
    client = get_supabase_client()
    normalized_title = title.strip()[:CONVERSATION_TITLE_MAX_LENGTH] if title else None
    response = (
        client.table("conversations")
        .insert({"title": normalized_title or None})
        .execute()
    )

    if not response.data:
        raise RuntimeError("Supabase did not return the new conversation.")

    return response.data[0]["id"]


def conversation_exists(conversation_id: str) -> bool:
    client = get_supabase_client()
    response = (
        client.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def get_conversation_messages(conversation_id: str) -> list[ChatMessage]:
    client = get_supabase_client()
    response = (
        client.table("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    return [ChatMessage.model_validate(row) for row in response.data or []]


def save_message(
    conversation_id: str,
    role: str,
    content: str,
) -> None:
    client = get_supabase_client()
    client.table("messages").insert(
        {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
        }
    ).execute()

    client.table("conversations").update(
        {"updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", conversation_id).execute()


def get_conversations() -> list[ConversationSummary]:
    client = get_supabase_client()
    response = (
        client.table("conversations")
        .select("id, title, created_at, updated_at")
        .order("updated_at", desc=True)
        .execute()
    )

    return [
        ConversationSummary.model_validate(row)
        for row in response.data or []
    ]


def delete_conversation(conversation_id: str) -> bool:
    client = get_supabase_client()
    existing = (
        client.table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        return False

    client.table("messages").delete().eq(
        "conversation_id",
        conversation_id,
    ).execute()
    client.table("conversations").delete().eq(
        "id",
        conversation_id,
    ).execute()
    return True
