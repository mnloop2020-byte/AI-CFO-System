"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  FileClock,
  Package,
  ShieldAlert,
} from "lucide-react";

const notifications = [
  {
    title: "Flagged expense requires review",
    description: "An expense of 500.00 is waiting for human review.",
    href: "/crm/expenses",
    icon: ShieldAlert,
    tone: "red",
  },
  {
    title: "Low inventory level",
    description: "One product is below its configured reorder level.",
    href: "/crm/inventory",
    icon: Package,
    tone: "amber",
  },
  {
    title: "Unpaid invoice",
    description: "An expected inflow of 1,000.00 remains unpaid.",
    href: "/crm/invoices",
    icon: FileClock,
    tone: "blue",
  },
];

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [readAll, setReadAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open notifications"
        aria-expanded={open}
        className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary"
      >
        <Bell size={19} />

        {!readAll && (
          <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-danger" />
        )}
      </button>

      {open && (
        <section className="absolute right-0 top-12 z-50 w-[min(88vw,380px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-4">
            <div>
              <h2 className="font-semibold text-text-primary">
                Notifications
              </h2>

              <p className="mt-0.5 text-xs text-text-secondary">
                {readAll
                  ? "No unread notifications"
                  : "3 items require attention"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReadAll(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
          </header>

          <div className="divide-y divide-border">
            {notifications.map((notification) => {
              const Icon = notification.icon;

              const iconClasses =
                notification.tone === "red"
                  ? "bg-danger-soft text-danger"
                  : notification.tone === "amber"
                    ? "bg-warning-soft text-warning"
                    : "bg-primary-soft text-primary";

              return (
                <Link
                  key={notification.title}
                  href={notification.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-4 transition hover:bg-surface-soft"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClasses}`}
                  >
                    <Icon size={19} />
                  </span>

                  <span>
                    <span className="block text-sm font-medium text-text-primary">
                      {notification.title}
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-text-secondary">
                      {notification.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <footer className="border-t border-border bg-surface-soft px-4 py-3 text-center text-xs text-text-secondary">
            Notifications are based on the current test data.
          </footer>
        </section>
      )}
    </div>
  );
}