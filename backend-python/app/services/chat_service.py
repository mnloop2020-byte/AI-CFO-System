from app.agents.orchestrator import run_orchestrator
from app.services.conversation_store import (
    create_conversation,
    get_conversation_messages,
    save_message,
)


def handle_chat(message: str, conversation_id: str | None = None) -> tuple[str, str]:
    # message: the current question/message from the user.
    # conversation_id: can be a string or None.
    # tuple[str, str]: this function returns reply and conversation_id.

    if conversation_id is None:
        conversation_id = create_conversation(title=message)
        # If this is a new chat, create a new conversation in Supabase.

    old_messages = get_conversation_messages(conversation_id)
    # Get previous messages from Supabase for this conversation.

    reply = run_orchestrator(message, old_messages)
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

    return reply, conversation_id
    # Return the AI reply and the conversation ID.


# Note: This file manages the chat flow and stores chat history permanently in Supabase.