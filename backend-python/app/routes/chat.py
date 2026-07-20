import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.chat_schema import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    DeleteConversationResponse,
)
from app.services.chat_service import handle_chat
from app.services.conversation_store import (
    conversation_exists,
    delete_conversation,
    get_conversation_messages,
    get_conversations,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    try:
        reply, conversation_id, sources = handle_chat(
            message=request.message,
            conversation_id=request.conversation_id,
        )
        return ChatResponse(
            reply=reply,
            conversation_id=conversation_id,
            sources=sources,
        )
    except Exception as error:
        logger.exception("Chat request failed.")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to process the chat message.",
        ) from error


@router.get(
    "/conversations",
    response_model=list[ConversationSummary],
)
def list_conversations() -> list[ConversationSummary]:
    try:
        return get_conversations()
    except Exception as error:
        logger.exception("Unable to list conversations.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation history is unavailable.",
        ) from error


@router.get(
    "/{conversation_id}/messages",
    response_model=list[ChatMessage],
)
def get_chat_messages(conversation_id: str) -> list[ChatMessage]:
    try:
        if not conversation_exists(conversation_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        return get_conversation_messages(conversation_id)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception(
            "Unable to load messages for conversation %s.",
            conversation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Conversation messages are unavailable.",
        ) from error


@router.delete(
    "/conversations/{conversation_id}",
    response_model=DeleteConversationResponse,
)
def remove_conversation(
    conversation_id: str,
) -> DeleteConversationResponse:
    try:
        if not delete_conversation(conversation_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )
        return DeleteConversationResponse(
            deleted=True,
            conversation_id=conversation_id,
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception(
            "Unable to delete conversation %s.",
            conversation_id,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete the conversation.",
        ) from error
