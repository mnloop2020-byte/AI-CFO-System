from app.schemas.chat_schema import ChatResponse


def test_chat_response_contract_is_versioned_and_user_facing() -> None:
    response = ChatResponse(
        reply="## Financial summary\n\n- Completed revenue: 200.00",
        conversation_id="conversation-1",
        source_mode="live_financial_data",
    )

    assert response.model_dump() == {
        "response_version": "1",
        "reply": "## Financial summary\n\n- Completed revenue: 200.00",
        "conversation_id": "conversation-1",
        "source_mode": "live_financial_data",
        "sources": [],
    }
