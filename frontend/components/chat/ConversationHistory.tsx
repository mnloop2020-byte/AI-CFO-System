"use client";

import {
  CircleAlert,
  LoaderCircle,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ConversationSummary } from "@/lib/chat";

type ConversationHistoryProps = {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  loading: boolean;
  error: string | null;
  deletingConversationId: string | null;
  onNewConversation: () => void;
  onOpenConversation: (conversation: ConversationSummary) => void;
  onDeleteConversation: (conversation: ConversationSummary) => void;
  onRefresh: () => void;
};

function formatConversationDate(
  value: string | null,
  isArabic: boolean,
) {
  if (!value) {
    return isArabic ? "بدون تاريخ" : "No date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return isArabic ? "بدون تاريخ" : "No date";
  }

  return new Intl.DateTimeFormat(
    isArabic ? "ar-SA" : "en-US",
    {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() === new Date().getFullYear()
          ? undefined
          : "numeric",
    },
  ).format(date);
}

export default function ConversationHistory({
  conversations,
  activeConversationId,
  loading,
  error,
  deletingConversationId,
  onNewConversation,
  onOpenConversation,
  onDeleteConversation,
  onRefresh,
}: ConversationHistoryProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  return (
    <aside className="flex max-h-72 shrink-0 flex-col border-b border-border bg-surface lg:max-h-none lg:w-80 lg:border-b-0 lg:border-e">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {isArabic ? "سجل المحادثات" : "Conversation history"}
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            {isArabic
              ? `${conversations.length} محادثة محفوظة`
              : `${conversations.length} saved conversations`}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label={isArabic ? "تحديث المحادثات" : "Refresh conversations"}
          title={isArabic ? "تحديث المحادثات" : "Refresh conversations"}
          className="flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-primary-soft hover:text-primary disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
        </button>
      </div>

      <div className="p-3">
        <button
          type="button"
          onClick={onNewConversation}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          <MessageSquarePlus size={17} />
          {isArabic ? "محادثة جديدة" : "New conversation"}
        </button>
      </div>

      {error ? (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-xl border border-red-100 bg-danger-soft p-3 text-xs text-danger">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && conversations.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-text-secondary">
            <LoaderCircle size={24} className="animate-spin text-primary" />
            <p className="mt-2 text-xs">
              {isArabic ? "جارٍ تحميل المحادثات..." : "Loading conversations..."}
            </p>
          </div>
        ) : null}

        {!loading && !error && conversations.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <MessageSquare size={20} />
            </span>
            <p className="mt-3 text-sm font-medium text-text-primary">
              {isArabic ? "لا توجد محادثات بعد" : "No conversations yet"}
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            const deleting = deletingConversationId === conversation.id;
            const title =
              conversation.title?.trim() ||
              (isArabic ? "محادثة بدون عنوان" : "Untitled conversation");

            return (
              <div
                key={conversation.id}
                className={`group flex items-start gap-1 rounded-xl border p-1 transition-colors ${
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-transparent hover:border-border hover:bg-surface-soft"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenConversation(conversation)}
                  disabled={deletingConversationId !== null}
                  className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-start disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="line-clamp-2 text-sm font-medium leading-5 text-text-primary">
                    {title}
                  </span>
                  <span className="mt-1 block text-xs text-text-secondary">
                    {formatConversationDate(
                      conversation.updated_at ?? conversation.created_at,
                      isArabic,
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteConversation(conversation)}
                  disabled={deletingConversationId !== null}
                  aria-label={
                    isArabic ? `حذف ${title}` : `Delete ${title}`
                  }
                  title={isArabic ? "حذف المحادثة" : "Delete conversation"}
                  className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary opacity-70 hover:bg-danger-soft hover:text-danger group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
