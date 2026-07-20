import { api } from "@/lib/api";

export type ChatRequest = {
  message: string;
  conversation_id?: string | null;
};

export type ChatResponse = {
  reply: string;
  conversation_id: string;
  sources: DocumentSource[];
};

export type DocumentSource = {
  document_id: string;
  file_name: string;
  chunk_index: number;
  excerpt: string;
  similarity: number | null;
};

export type ConversationSummary = {
  id: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type StoredChatMessage = {
  id: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string | null;
};

export type DeleteConversationResponse = {
  deleted: boolean;
  conversation_id: string;
};

export function sendChatMessage(
  data: ChatRequest,
) {
  return api.post<ChatResponse>(
    "/chat",
    data,
  );
}

export function getConversations() {
  return api.get<ConversationSummary[]>(
    "/chat/conversations",
  );
}

export function getConversationMessages(
  conversationId: string,
) {
  return api.get<StoredChatMessage[]>(
    `/chat/${conversationId}/messages`,
  );
}

export function deleteConversation(
  conversationId: string,
) {
  return api.delete<DeleteConversationResponse>(
    `/chat/conversations/${conversationId}`,
  );
}
