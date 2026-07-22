export const CHAT_RESPONSE_VERSION = "1" as const;

export type ChatLanguage = "ar" | "en";

export type DocumentSource = {
  document_id: string;
  file_name: string;
  chunk_index: number;
  excerpt: string;
  similarity: number | null;
};

export type ChatResponse = {
  response_version: typeof CHAT_RESPONSE_VERSION;
  reply: string;
  conversation_id: string;
  sources: DocumentSource[];
};

const INTERNAL_RESPONSE_KEYS = new Set([
  "agents",
  "company_context",
  "data_sources",
  "embedding",
  "metadata",
  "overview",
  "record_ids",
  "results",
  "verified_metrics",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsInternalKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsInternalKey);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      INTERNAL_RESPONSE_KEYS.has(key) || containsInternalKey(nestedValue),
  );
}

function parseJsonCandidate(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function containsInternalJson(content: string): boolean {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = parseJsonCandidate(trimmed);
    if (isRecord(parsed) || Array.isArray(parsed)) {
      return true;
    }
  }

  const fencedJsonPattern = /```json\s*([\s\S]*?)```/giu;
  for (const match of content.matchAll(fencedJsonPattern)) {
    const parsed = parseJsonCandidate(match[1].trim());
    if (containsInternalKey(parsed)) {
      return true;
    }
  }

  return false;
}

export function getSafeAssistantContent(
  value: unknown,
  language: ChatLanguage,
): string {
  if (
    typeof value === "string" &&
    value.trim() &&
    !containsInternalJson(value)
  ) {
    return value.trim();
  }

  return language === "ar"
    ? "تعذر عرض الرد المالي النهائي بأمان. يرجى إعادة المحاولة."
    : "The final financial response could not be displayed safely. Please try again.";
}

function isDocumentSource(value: unknown): value is DocumentSource {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.document_id === "string" &&
    typeof value.file_name === "string" &&
    typeof value.chunk_index === "number" &&
    typeof value.excerpt === "string" &&
    (typeof value.similarity === "number" || value.similarity === null)
  );
}

export function parseChatResponse(
  payload: unknown,
  language: ChatLanguage,
): ChatResponse {
  if (
    !isRecord(payload) ||
    payload.response_version !== CHAT_RESPONSE_VERSION ||
    typeof payload.conversation_id !== "string" ||
    !payload.conversation_id.trim()
  ) {
    throw new Error(
      language === "ar"
        ? "أعاد الخادم استجابة محادثة غير متوافقة."
        : "The server returned an incompatible chat response.",
    );
  }

  return {
    response_version: CHAT_RESPONSE_VERSION,
    reply: getSafeAssistantContent(payload.reply, language),
    conversation_id: payload.conversation_id,
    sources: Array.isArray(payload.sources)
      ? payload.sources.filter(isDocumentSource)
      : [],
  };
}
