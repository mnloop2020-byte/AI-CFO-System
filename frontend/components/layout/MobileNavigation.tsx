"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const navigationGroups = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "AI CFO Chat",
        href: "/chat",
        icon: MessageSquareText,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "Customers",
        href: "/crm/customers",
        icon: Users,
      },
      {
        label: "Sales",
        href: "/crm/sales",
        icon: ShoppingCart,
      },
      {
        label: "Expenses",
        href: "/crm/expenses",
        icon: WalletCards,
      },
      {
        label: "Inventory",
        href: "/crm/inventory",
        icon: Package,
      },
      {
        label: "Invoices",
        href: "/crm/invoices",
        icon: ReceiptText,
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: FileText,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition hover:bg-surface-soft hover:text-text-primary lg:hidden"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
          />

          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-border bg-surface shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-5 py-5">
              <Link
                href="/dashboard"
                className="flex items-center gap-3"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
                  <Sparkles size={21} />
                </span>

                <span>
                  <span className="block font-semibold text-text-primary">
                    Zemam
                  </span>

                  <span className="block text-xs text-text-secondary">
                    AI CFO System
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex size-10 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-soft hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
              {navigationGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    {group.title}
                  </p>

                  <nav
                    className="space-y-1"
                    aria-label={`${group.title} mobile navigation`}
                  >
                    {group.items.map((item) => {
                      const Icon = item.icon;

                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={
                            isActive ? "page" : undefined
                          }
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive
                              ? "bg-primary-soft text-primary"
                              : "text-text-secondary hover:bg-surface-soft hover:text-text-primary"
                          }`}
                        >
                          <Icon size={19} strokeWidth={1.8} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            <footer className="border-t border-border p-4">
              <Link
                href="/profile"
                className="flex items-center gap-3 rounded-xl bg-primary-soft p-3"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-surface font-semibold text-primary">
                  M
                </span>

                <span>
                  <span className="block text-sm font-medium text-text-primary">
                    Mohammed
                  </span>

                  <span className="block text-xs text-text-secondary">
                    Profile & Security
                  </span>
                </span>
              </Link>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}