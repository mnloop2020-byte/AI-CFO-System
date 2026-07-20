from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.rag_schema import DocumentSource


class ChatMessage(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    sources: list[DocumentSource] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    id: str
    title: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DeleteConversationResponse(BaseModel):
    deleted: bool
    conversation_id: str
