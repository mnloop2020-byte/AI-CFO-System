"use client";

import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Database,
  LoaderCircle,
  MessageSquarePlus,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useLanguage } from "@/components/providers/LanguageProvider";
import ConversationHistory from "@/components/chat/ConversationHistory";
import {
  deleteConversation,
  getConversationMessages,
  getConversations,
  sendChatMessage,
  type ConversationSummary,
} from "@/lib/chat";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversationId?: string;
};

const CONVERSATION_STORAGE_KEY =
  "ai-cfo-current-conversation-id";

function createMessageId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function createInitialMessages(
  welcomeMessage: string,
): ChatMessage[] {
  return [
    {
      id: "welcome-message",
      role: "assistant",
      content: welcomeMessage,
    },
  ];
}

function MarkdownContent({
  content,
}: {
  content: string;
}) {
  return (
    <div
      dir="auto"
      className="text-sm leading-7 text-text-secondary"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 text-xl font-semibold text-text-primary first:mt-0">
              {children}
            </h1>
          ),

          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 text-lg font-semibold text-text-primary first:mt-0">
              {children}
            </h2>
          ),

          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold text-text-primary first:mt-0">
              {children}
            </h3>
          ),

          p: ({ children }) => (
            <p className="mb-3 last:mb-0">
              {children}
            </p>
          ),

          strong: ({ children }) => (
            <strong className="font-semibold text-text-primary">
              {children}
            </strong>
          ),

          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1.5 ps-6">
              {children}
            </ul>
          ),

          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1.5 ps-6">
              {children}
            </ol>
          ),

          li: ({ children }) => (
            <li className="ps-1">
              {children}
            </li>
          ),

          blockquote: ({ children }) => (
            <blockquote className="my-4 border-s-4 border-primary bg-primary-soft px-4 py-3 text-text-secondary">
              {children}
            </blockquote>
          ),

          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:text-primary-hover"
            >
              {children}
            </a>
          ),

          code: ({ className, children }) => (
            <code
              className={`rounded-md bg-surface-soft px-1.5 py-0.5 font-mono text-xs text-text-primary ${
                className ?? ""
              }`}
            >
              {children}
            </code>
          ),

          pre: ({ children }) => (
            <pre
              dir="ltr"
              className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-left text-sm leading-6 text-slate-100"
            >
              {children}
            </pre>
          ),

          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),

          th: ({ children }) => (
            <th className="border-b border-border bg-surface-soft px-4 py-3 text-start font-semibold text-text-primary">
              {children}
            </th>
          ),

          td: ({ children }) => (
            <td className="border-b border-border px-4 py-3 text-text-secondary">
              {children}
            </td>
          ),

          hr: () => (
            <hr className="my-5 border-border" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatWindow() {
  const {
    language,
    t,
  } = useLanguage();

  const [messages, setMessages] =
    useState<ChatMessage[]>(() =>
      createInitialMessages(
        t("welcomeMessage"),
      ),
    );

  const [message, setMessage] = useState("");

  const [conversationId, setConversationId] =
    useState<string | null>(null);

  const [conversations, setConversations] =
    useState<ConversationSummary[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [historyError, setHistoryError] =
    useState<string | null>(null);

  const [isLoadingConversation, setIsLoadingConversation] =
    useState(false);

  const [deletingConversationId, setDeletingConversationId] =
    useState<string | null>(null);

  const [isSending, setIsSending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    lastFailedMessage,
    setLastFailedMessage,
  ] = useState<string | null>(null);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const suggestedPrompts = [
    t("promptCashFlow"),
    t("promptInvoices"),
    t("promptInventory"),
    t("promptReport"),
  ];

  const loadConversationHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      setConversations(await getConversations());
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : language === "ar"
            ? "تعذر تحميل سجل المحادثات."
            : "Unable to load conversation history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [language]);

  const loadConversation = useCallback(
    async (selectedConversationId: string) => {
      setIsLoadingConversation(true);
      setError(null);
      setLastFailedMessage(null);

      try {
        const storedMessages = await getConversationMessages(
          selectedConversationId,
        );
        const restoredMessages: ChatMessage[] = storedMessages.map(
          (storedMessage) => ({
            id: storedMessage.id ?? createMessageId(),
            role: storedMessage.role,
            content: storedMessage.content,
            conversationId:
              storedMessage.role === "assistant"
                ? selectedConversationId
                : undefined,
          }),
        );

        setConversationId(selectedConversationId);
        setMessages(
          restoredMessages.length > 0
            ? restoredMessages
            : createInitialMessages(t("welcomeMessage")),
        );
        window.sessionStorage.setItem(
          CONVERSATION_STORAGE_KEY,
          selectedConversationId,
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : language === "ar"
              ? "تعذر فتح المحادثة المحفوظة."
              : "Unable to open the stored conversation.",
        );
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [language, t],
  );

  useEffect(() => {
    void loadConversationHistory();
  }, [loadConversationHistory]);

  useEffect(() => {
    const savedConversationId = window.sessionStorage.getItem(
      CONVERSATION_STORAGE_KEY,
    );

    if (savedConversationId) {
      void loadConversation(savedConversationId);
    }
  }, [loadConversation]);

  useEffect(() => {
    setMessages((currentMessages) => {
      const onlyWelcomeMessage =
        currentMessages.length === 1 &&
        currentMessages[0].id ===
          "welcome-message";

      if (!onlyWelcomeMessage) {
        return currentMessages;
      }

      return createInitialMessages(
        t("welcomeMessage"),
      );
    });
  }, [language, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  async function submitMessage(
    messageText: string,
    appendUserMessage = true,
  ) {
    const cleanMessage = messageText.trim();

    if (!cleanMessage || isSending) {
      return;
    }

    if (appendUserMessage) {
      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: cleanMessage,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        userMessage,
      ]);

      setMessage("");
    }

    setIsSending(true);
    setError(null);
    setLastFailedMessage(cleanMessage);

    try {
      const response = await sendChatMessage({
        message: cleanMessage,
        conversation_id: conversationId,
      });

      setConversationId(
        response.conversation_id,
      );

      window.sessionStorage.setItem(
        CONVERSATION_STORAGE_KEY,
        response.conversation_id,
      );

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: response.reply,
        conversationId:
          response.conversation_id,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);

      setLastFailedMessage(null);
      void loadConversationHistory();
    } catch (requestError) {
      const errorMessage =
        requestError instanceof Error
          ? requestError.message
          : language === "ar"
            ? "تعذر الاتصال بالباك إند الخاص بالمدير المالي الذكي."
            : "Unable to contact the AI CFO backend.";

      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void submitMessage(message);
  }

  function handleTextareaKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submitMessage(message);
    }
  }

  function handleRetry() {
    if (!lastFailedMessage) {
      return;
    }

    void submitMessage(
      lastFailedMessage,
      false,
    );
  }

  function handleNewConversation() {
    setConversationId(null);

    setMessages(
      createInitialMessages(
        t("welcomeMessage"),
      ),
    );

    setMessage("");
    setError(null);
    setLastFailedMessage(null);

    window.sessionStorage.removeItem(
      CONVERSATION_STORAGE_KEY,
    );
  }

  function handleOpenConversation(
    conversation: ConversationSummary,
  ) {
    if (isSending || isLoadingConversation) {
      return;
    }

    void loadConversation(conversation.id);
  }

  async function handleDeleteConversation(
    conversation: ConversationSummary,
  ) {
    if (isSending || deletingConversationId) {
      return;
    }

    const title =
      conversation.title?.trim() ||
      (language === "ar"
        ? "المحادثة المحددة"
        : "the selected conversation");
    const confirmed = window.confirm(
      language === "ar"
        ? `هل تريد حذف ${title}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete ${title}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingConversationId(conversation.id);
    setHistoryError(null);

    try {
      await deleteConversation(conversation.id);
      setConversations((currentConversations) =>
        currentConversations.filter(
          (currentConversation) =>
            currentConversation.id !== conversation.id,
        ),
      );

      if (conversationId === conversation.id) {
        handleNewConversation();
      }
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : language === "ar"
            ? "تعذر حذف المحادثة."
            : "Unable to delete the conversation.",
      );
    } finally {
      setDeletingConversationId(null);
    }
  }

  return (
    <section className="flex h-[calc(100vh-10rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ConversationHistory
          conversations={conversations}
          activeConversationId={conversationId}
          loading={historyLoading}
          error={historyError}
          deletingConversationId={deletingConversationId}
          onNewConversation={handleNewConversation}
          onOpenConversation={handleOpenConversation}
          onDeleteConversation={(conversation) =>
            void handleDeleteConversation(conversation)
          }
          onRefresh={() => void loadConversationHistory()}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Sparkles size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-text-primary">
              {t("chatTitle")}
            </h2>

            <div className="mt-1 flex items-center gap-1.5 text-xs text-success">
              <span className="size-2 rounded-full bg-success" />

              {isSending
                ? t("chatAnalyzing")
                : t("chatConnected")}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
            <CheckCircle2 size={14} />
            {t("chatLiveData")}
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            disabled={isSending}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquarePlus size={16} />
            {t("chatNewConversation")}
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto bg-app-background p-5 lg:p-7">
        {isLoadingConversation ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-text-secondary">
            <LoaderCircle size={28} className="animate-spin text-primary" />
            <p className="mt-3 text-sm">
              {language === "ar"
                ? "جارٍ فتح المحادثة المحفوظة..."
                : "Opening stored conversation..."}
            </p>
          </div>
        ) : null}

        {!isLoadingConversation && messages.map((chatMessage) => {
          if (chatMessage.role === "user") {
            return (
              <div
                key={chatMessage.id}
                className="flex justify-end gap-3"
              >
                <div
                  dir="auto"
                  className="max-w-2xl rounded-2xl rounded-se-md bg-primary px-4 py-3 text-sm leading-6 text-white"
                >
                  {chatMessage.content}
                </div>

                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-text-secondary">
                  <User size={18} />
                </div>
              </div>
            );
          }

          return (
            <div
              key={chatMessage.id}
              className="flex gap-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Bot size={18} />
              </div>

              <div className="max-w-4xl flex-1">
                <div className="rounded-2xl rounded-ss-md border border-border bg-surface px-5 py-4 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      AI CFO
                    </p>

                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
                      {chatMessage.conversationId
                        ? t(
                            "chatLiveAgentResponse",
                          )
                        : t("chatAssistant")}
                    </span>
                  </div>

                  <MarkdownContent
                    content={
                      chatMessage.content
                    }
                  />

                  {chatMessage.conversationId ? (
                    <div className="mt-5 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
                        <div className="flex items-center gap-2">
                          <Database size={14} />

                          {language === "ar"
                            ? "تم الإنشاء باستخدام السجلات المالية المتاحة"
                            : "Generated using available financial records"}
                        </div>

                        <span
                          dir="ltr"
                          className="font-mono"
                        >
                          {language === "ar"
                            ? "المحادثة"
                            : "Conversation"}
                          :{" "}
                          {chatMessage.conversationId.slice(
                            0,
                            8,
                          )}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {chatMessage.conversationId ? (
                  <p className="mt-2 px-1 text-xs text-text-secondary">
                    {language === "ar"
                      ? "تم إنشاء الإجابة من باك إند المدير المالي الذكي والسجلات المالية المتاحة."
                      : "Generated from the AI CFO backend and available financial records."}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}

        {isSending ? (
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Bot size={18} />
            </div>

            <div className="flex items-center gap-3 rounded-2xl rounded-ss-md border border-border bg-surface px-5 py-4 text-sm text-text-secondary shadow-sm">
              <LoaderCircle
                size={18}
                className="animate-spin text-primary"
              />

              {t("chatGenerating")}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-danger-soft p-4">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={20}
                className="mt-0.5 shrink-0 text-danger"
              />

              <div className="flex-1">
                <p className="text-sm font-semibold text-danger">
                  {t("chatErrorTitle")}
                </p>

                <p className="mt-1 text-sm text-text-secondary">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={handleRetry}
                disabled={
                  !lastFailedMessage ||
                  isSending
                }
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-surface px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={15} />
                {t("chatRetry")}
              </button>
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border bg-surface p-4">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() =>
                setMessage(prompt)
              }
              disabled={isSending}
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-3 rounded-2xl border border-border bg-app-background p-2 focus-within:border-primary"
        >
          <textarea
            dir="auto"
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            onKeyDown={
              handleTextareaKeyDown
            }
            disabled={isSending}
            rows={1}
            placeholder={t(
              "chatPlaceholder",
            )}
            aria-label={t("chatSend")}
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={
              !message.trim() ||
              isSending
            }
            aria-label={t("chatSend")}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>

        <p className="mt-2 text-center text-xs text-text-secondary">
          {t("chatFooter")}
        </p>
      </div>
        </div>
      </div>
    </section>
  );
}
