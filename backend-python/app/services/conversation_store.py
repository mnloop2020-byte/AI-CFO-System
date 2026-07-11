from supabase import Client, create_client
from datetime import datetime, timezone
from app.config.settings import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from app.schemas.chat_schema import ChatMessage , ConversationSummary
#Note: This imports the message shape used for chat history.



def get_supabase_client() -> Client:
    # the function of this file is to create a Supabase client using the Supabase URL and Service Role Key from the .env file.
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing. Add it to backend-python/.env")

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to backend-python/.env"
        )

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    # Creates and returns the Supabase client.


def create_conversation(title: str | None = None) -> str:
    # title gonna be the topice of the conversation, if the user doesn't provide a title, it will be None.
    # the function of this file is to create a new conversation in Supabase.
    supabase = get_supabase_client()
# here means gvie me the supabase client, which is the connection to the database, and then we can use it to insert a new conversation into the conversations table. 
    response = (
        supabase
        .table("conversations")
        .insert({"title": title})
        .execute()
    )

    return response.data[0]["id"]
    # Creates a new conversation in Supabase and returns its ID.


def get_conversation_messages(conversation_id: str) -> list[ChatMessage]:
#Note: This function gets old messages for one conversation from Supabase.
# 
    supabase = get_supabase_client()

    response = (
        supabase
        .table("messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        #Note: This filters messages by the current conversation ID.
        .order("created_at")
        .execute()
    )

    return [
        ChatMessage(
            role=row["role"],
            content=row["content"],
        )
        for row in response.data
    ]
    # Gets old messages from Supabase and converts them to ChatMessage objects.


def save_message(
    conversation_id: str,
    role: str,
    content: str,
) -> None:
    supabase = get_supabase_client()

    supabase.table("messages").insert(
        {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
        }
    ).execute()
    # Save one message inside the messages table.

    supabase.table("conversations").update(
        {
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    ).eq("id", conversation_id).execute()
    # Update the conversation time after saving a message.

    
def get_conversations() -> list[ConversationSummary]:
    supabase = get_supabase_client()

    response = (
        supabase
        .table("conversations")
        .select("id, title, created_at, updated_at")
        .order("created_at", desc=True)
        .execute()
    )

    return [
        ConversationSummary(
            id=row["id"],
            title=row.get("title"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
        for row in response.data
    ]
# Note: This function gets all saved conversations from Supabase.







