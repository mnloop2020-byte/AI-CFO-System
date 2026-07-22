from app.agents.orchestrator import run_orchestrator
from app.config.settings import CHAT_MAX_HISTORY_CHARS, CHAT_MAX_HISTORY_MESSAGES
from app.schemas.chat_schema import ChatMessage
from app.schemas.rag_schema import DocumentSource
from app.services.conversation_store import (
    create_conversation,
    get_conversation_messages,
    save_message,
)


def _append_source_list(
    reply: str,
    sources: list[DocumentSource],
    user_message: str,
) -> str:
    if not sources:
        return reply

    all_sources_are_cited = all(
        source.file_name in reply
        and (
            f"chunk {source.chunk_index + 1}" in reply.lower()
            or f"المقطع {source.chunk_index + 1}" in reply
        )
        for source in sources
    )
    if all_sources_are_cited:
        return reply

    is_arabic = any("\u0600" <= character <= "\u06ff" for character in user_message)
    heading = "### المصادر" if is_arabic else "### Sources"
    source_lines = [
        f"- `{source.file_name}` — "
        + (f"المقطع {source.chunk_index + 1}" if is_arabic else f"chunk {source.chunk_index + 1}")
        for source in sources
    ]
    return f"{reply.rstrip()}\n\n{heading}\n" + "\n".join(source_lines)


def _bounded_llm_history(messages: list[ChatMessage]) -> list[ChatMessage]:
    selected: list[ChatMessage] = []
    used_chars = 0
    for message in reversed(messages[-CHAT_MAX_HISTORY_MESSAGES:]):
        remaining = CHAT_MAX_HISTORY_CHARS - used_chars
        if remaining <= 0:
            break
        content = message.content[-remaining:]
        selected.append(message.model_copy(update={"content": content}))
        used_chars += len(content)
    return list(reversed(selected))


def handle_chat(
    message: str,
    conversation_id: str | None = None,
) -> tuple[str, str, list[DocumentSource]]:
    # message: the current question/message from the user.
    # conversation_id: can be a string or None.
    # tuple[str, str]: this function returns reply and conversation_id.

    if conversation_id is None:
        conversation_id = create_conversation(title=message)
        # If this is a new chat, create a new conversation in Supabase.

    old_messages = get_conversation_messages(conversation_id)
    # Get previous messages from Supabase for this conversation.

    reply, sources = run_orchestrator(message, _bounded_llm_history(old_messages))
    reply = _append_source_list(reply, sources, message)
    # Send the current user message and old messages to the Orchestrator.

    save_message(
        conversation_id=conversation_id,
        role="user",
        content=message,
    )
    # Save the user's message in Supabase.

    save_message(
        conversation_id=conversation_id,
        role="assistant",
        content=reply,
    )
    # Save the assistant's reply in Supabase.

    return reply, conversation_id, sources
    # Return the AI reply and the conversation ID.


# Note: This file manages the chat flow and stores chat history permanently in Supabase.
