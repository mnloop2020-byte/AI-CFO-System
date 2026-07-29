import { api } from "@/lib/api";
import {
  parseChatResponse,
  type ChatLanguage,
  type ChatResponse,
} from "@/lib/chat-contract";

export type {
  ChatResponse,
  DocumentSource,
} from "@/lib/chat-contract";

export type ChatRequest = {
  message: string;
  conversation_id?: string | null;
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

export async function sendChatMessage(
  data: ChatRequest,
  language: ChatLanguage,
): Promise<ChatResponse> {
  const payload = await api.post<unknown>(
    "/chat",
    data,
  );

  return parseChatResponse(payload, language);
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
