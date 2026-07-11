from app.rag.search import search_documents


def format_context(matches: list[dict]) -> str:
    if not matches:
        return "No relevant financial context found."

    context_parts: list[str] = []

    for index, match in enumerate(matches, start=1):
        content = match.get("content", "")
        metadata = match.get("metadata", {})
        similarity = match.get("similarity", None)

        context_parts.append(
            f"""
Context chunk {index}:
Source metadata: {metadata}
Similarity: {similarity}

Content:
{content}
""".strip()
        )

    return "\n\n---\n\n".join(context_parts)


def get_context(user_message: str) -> str:
    matches = search_documents(user_message)

    return format_context(matches)


# Note: This file prepares the final RAG context that will be sent to the LLM.