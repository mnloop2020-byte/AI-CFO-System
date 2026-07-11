
from fastapi import APIRouter
# ChatRequest  = شكل البيانات القادمة من المستخدم
# ChatResponse = شكل البيانات التي سنرجعها للمستخدم
from app.services.chat_service import handle_chat
from app.schemas.chat_schema import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ConversationSummary,
)

from app.services.conversation_store import (
    get_conversation_messages,
    get_conversations,
)






router = APIRouter(prefix="/chat", tags=["chat"])
# Note: This creates a router object for chat endpoints.



@router.post("", response_model=ChatResponse)
# Note: This tells FastAPI that the response should match ChatResponse.
def chat(request: ChatRequest):
    reply, conversation_id = handle_chat(

        message=request.message,
        conversation_id=request.conversation_id,
    )

    return ChatResponse(
        reply=reply,
        conversation_id=conversation_id,
    )
# Note: This route receives chat messages and returns reply with conversation_id.


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations():
    conversations = get_conversations()

    return conversations


# Note: This route returns all saved conversations for the frontend sidebar.


@router.get("/{conversation_id}/messages", response_model=list[ChatMessage])
def get_chat_messages(conversation_id: str):
    messages = get_conversation_messages(conversation_id)

    return messages
# Note: This route returns old messages for one conversation from Supabase.