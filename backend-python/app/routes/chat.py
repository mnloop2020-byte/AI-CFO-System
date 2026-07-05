from fastapi import APIRouter

from app.agents.orchestrator import run_orchestrator
from app.schemas.chat_schema import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    reply = run_orchestrator(request.message)

    return ChatResponse(
        reply=reply,
        conversation_id=request.conversation_id,
    )


# Note: This route receives chat messages and sends them to the orchestrator.