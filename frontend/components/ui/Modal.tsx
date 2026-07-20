"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId } from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({
  open,
  title,
  description,
  children,
  onClose,
}: ModalProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2
              id={titleId}
              className="text-xl font-semibold text-text-primary"
            >
              {title}
            </h2>

            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm text-text-secondary"
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? "إغلاق النافذة" : "Close dialog"}
            title={isArabic ? "إغلاق" : "Close"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface-soft hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </header>

        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}
