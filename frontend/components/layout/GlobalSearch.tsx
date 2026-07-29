"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const searchItems = [
  {
    title: "Financial Overview",
    description: "Dashboard and business snapshot",
    category: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "AI CFO Chat",
    description: "Ask your specialized financial agents",
    category: "AI",
    href: "/chat",
    icon: MessageSquareText,
  },
  {
    title: "Customers",
    description: "Customer records and purchase activity",
    category: "Management",
    href: "/crm/customers",
    icon: Users,
  },
  {
    title: "Sales",
    description: "Revenue, units sold, and sales records",
    category: "Management",
    href: "/crm/sales",
    icon: ShoppingCart,
  },
  {
    title: "Expenses",
    description: "Spending and records requiring review",
    category: "Management",
    href: "/crm/expenses",
    icon: WalletCards,
  },
  {
    title: "Inventory",
    description: "Stock quantities and reorder levels",
    category: "Management",
    href: "/crm/inventory",
    icon: Package,
  },
  {
    title: "Invoices",
    description: "Payment status, VAT, and documents",
    category: "Management",
    href: "/crm/invoices",
    icon: ReceiptText,
  },
  {
    title: "Reports",
    description: "Financial and executive report templates",
    category: "Insights",
    href: "/reports",
    icon: FileText,
  },
  {
    title: "Company Settings",
    description: "Currency, tax, and company configuration",
    category: "System",
    href: "/settings",
    icon: Settings,
  },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return searchItems.slice(0, 6);
    }

    return searchItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query]);

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

  const openMobileSearch = () => {
    setOpen(true);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={openMobileSearch}
        aria-label="Open search"
        className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary hover:bg-surface-soft hover:text-text-primary xl:hidden"
      >
        <Search size={19} />
      </button>

      <label className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-app-background px-3 transition-colors focus-within:border-primary xl:flex">
        <Search
          size={18}
          className="shrink-0 text-text-secondary"
        />

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search financial data..."
          aria-label="Search financial data"
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={16} />
          </button>
        )}
      </label>

      {open && (
        <section className="fixed left-4 right-4 top-20 z-50 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl sm:left-auto sm:right-4 sm:w-[420px] xl:absolute xl:right-0 xl:top-12">
          <div className="border-b border-border p-3 xl:hidden">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-soft px-3 focus-within:border-primary">
              <Search
                size={18}
                className="shrink-0 text-text-secondary"
              />

              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search financial data..."
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="text-text-secondary hover:text-text-primary"
              >
                <X size={18} />
              </button>
            </label>
          </div>

          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {query ? "Search results" : "Quick navigation"}
            </h2>

            <p className="mt-0.5 text-xs text-text-secondary">
              {filteredItems.length} available destinations
            </p>
          </header>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {filteredItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-surface-soft"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon size={19} />
                  </span>

                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-primary">
                        {item.title}
                      </span>

                      <span className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] text-text-secondary">
                        {item.category}
                      </span>
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-text-secondary">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Search
                  size={24}
                  className="mx-auto text-text-secondary"
                />

                <p className="mt-3 text-sm font-medium text-text-primary">
                  No matching page
                </p>

                <p className="mt-1 text-xs text-text-secondary">
                  Try searching for sales, invoices, or reports.
                </p>
              </div>
            )}
          </div>

          <footer className="border-t border-border bg-surface-soft px-4 py-3 text-xs text-text-secondary">
            Financial record search will be connected to the backend later.
          </footer>
        </section>
      )}
    </div>
  );
}