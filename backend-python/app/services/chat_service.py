from uuid import uuid4

from app.agents.orchestrator import run_orchestrator
from app.schemas.chat_schema import ChatMessage

conversations: dict[str, list[ChatMessage]] = {}


def handle_chat(message: str, conversation_id: str | None = None) -> tuple[str, str]:
    if conversation_id is None:
        conversation_id = str(uuid4())

    if conversation_id not in conversations:
        conversations[conversation_id] = []

    old_messages = conversations[conversation_id]

    reply = run_orchestrator(message, old_messages)

    conversations[conversation_id].append(
        ChatMessage(role="user", content=message)
    )

    conversations[conversation_id].append(
        ChatMessage(role="assistant", content=reply)
    )

    return reply, conversation_id


# Note: This file manages temporary chat history before we connect the database.