from fastapi import APIRouter

from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.chat_service import handle_chat

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
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