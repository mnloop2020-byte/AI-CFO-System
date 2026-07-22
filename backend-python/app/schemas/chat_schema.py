from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.config.settings import CHAT_MAX_MESSAGE_CHARS
from app.schemas.rag_schema import DocumentSource


ChatSourceMode = Literal[
    "live_financial_data",
    "uploaded_documents",
    "general",
]


class ChatMessage(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=CHAT_MAX_MESSAGE_CHARS)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    response_version: Literal["1"] = "1"
    reply: str
    conversation_id: str
    source_mode: ChatSourceMode
    sources: list[DocumentSource] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    id: str
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DeleteConversationResponse(BaseModel):
    deleted: bool
    conversation_id: str
