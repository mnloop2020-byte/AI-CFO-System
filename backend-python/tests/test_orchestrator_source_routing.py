from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.agents.orchestrator import run_orchestrator
from app.rag.get_context import RagContext
from app.schemas.rag_schema import DocumentSource


def _llm_client_with_reply(reply: str) -> Mock:
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=reply),
            )
        ]
    )
    return client


@patch("app.agents.orchestrator.get_context")
@patch("app.agents.orchestrator.get_agent_runner")
def test_comprehensive_summary_uses_live_report_without_rag(
    get_agent_runner: Mock,
    get_context: Mock,
) -> None:
    get_agent_runner.return_value = (
        lambda *, user_message, old_messages: "## Current financial summary"
    )

    reply, sources, source_mode = run_orchestrator(
        "Show me a complete financial summary."
    )

    assert reply == "## Current financial summary"
    assert sources == []
    assert source_mode == "live_financial_data"
    get_context.assert_not_called()


@patch("app.agents.orchestrator.get_llm_client")
@patch("app.agents.orchestrator.get_context")
def test_explicit_document_question_uses_only_uploaded_documents(
    get_context: Mock,
    get_llm_client: Mock,
) -> None:
    source = DocumentSource(
        document_id="document-1",
        file_name="policy.txt",
        chunk_index=0,
        excerpt="Policy evidence",
        similarity=0.9,
    )
    get_context.return_value = RagContext(
        prompt="<UNTRUSTED_DOCUMENTS>Policy evidence</UNTRUSTED_DOCUMENTS>",
        sources=[source],
    )
    get_llm_client.return_value = _llm_client_with_reply(
        "The uploaded policy states that approval is required."
    )

    reply, sources, source_mode = run_orchestrator(
        "According to the uploaded document, what is the approval policy?"
    )

    assert "uploaded policy" in reply
    assert sources == [source]
    assert source_mode == "uploaded_documents"
    get_context.assert_called_once()


@patch("app.agents.orchestrator.get_llm_client")
@patch("app.agents.orchestrator.get_context")
def test_general_guidance_does_not_query_rag(
    get_context: Mock,
    get_llm_client: Mock,
) -> None:
    get_llm_client.return_value = _llm_client_with_reply(
        "Start by defining the financial question and required records."
    )

    reply, sources, source_mode = run_orchestrator(
        "How should I begin improving the business?"
    )

    assert reply.startswith("Start by")
    assert sources == []
    assert source_mode == "general"
    get_context.assert_not_called()
