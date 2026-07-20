"use client";

import {
  BarChart3,
  FileText,
  Files,
  LayoutDashboard,
  MessageSquareText,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";

type SidebarContentProps = {
  mobile?: boolean;
  onNavigate?: () => void;
};

function SidebarContent({
  mobile = false,
  onNavigate,
}: SidebarContentProps) {
  const pathname = usePathname();
  const {
    language,
    t,
  } = useLanguage();

  const navigationGroups = [
    {
      title: t("overview"),
      items: [
        {
          label: t("dashboard"),
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          label: t("aiCfoChat"),
          href: "/chat",
          icon: MessageSquareText,
        },
      ],
    },
    {
      title: t("management"),
      items: [
        {
          label: t("customers"),
          href: "/crm/customers",
          icon: Users,
        },
        {
          label: t("sales"),
          href: "/crm/sales",
          icon: ShoppingCart,
        },
        {
          label: t("expenses"),
          href: "/crm/expenses",
          icon: WalletCards,
        },
        {
          label: t("inventory"),
          href: "/crm/inventory",
          icon: Package,
        },
        {
          label: t("invoices"),
          href: "/crm/invoices",
          icon: ReceiptText,
        },
      ],
    },
    {
      title: t("insights"),
      items: [
        {
          label: t("reports"),
          href: "/reports",
          icon: FileText,
        },
        {
          label:
            language === "ar"
              ? "مستندات المعرفة"
              : "Knowledge documents",
          href: "/documents",
          icon: Files,
        },
      ],
    },
    {
      title: t("system"),
      items: [
        {
          label:
            language === "ar"
              ? "الأعضاء والدعوات"
              : "Members & invitations",
          href: "/members",
          icon: Users,
        },
        {
          label: t("settings"),
          href: "/settings",
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-5 lg:border-b-0 lg:px-6 lg:py-6">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
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

        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label={
              language === "ar"
                ? "إغلاق القائمة"
                : "Close navigation"
            }
            className="flex size-10 items-center justify-center rounded-xl border border-border text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary"
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-4 pb-6">
        {navigationGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {group.title}
            </p>

            <nav
              className="space-y-1"
              aria-label={group.title}
            >
              {group.items.map((item) => {
                const Icon = item.icon;

                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(
                    `${item.href}/`,
                  );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={
                      isActive ? "page" : undefined
                    }
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "text-text-secondary hover:bg-surface-soft hover:text-text-primary"
                    }`}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.8}
                    />

                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {mobile ? (
        <div className="border-t border-border p-4">
          <Link
            href="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-2xl bg-primary-soft p-3 transition-colors hover:bg-blue-100"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-primary">
              <UserRound size={19} />
            </span>

            <span>
              <span className="block text-sm font-semibold text-text-primary">
                {language === "ar" ? "الحساب" : "Account"}
              </span>

              <span className="block text-xs text-text-secondary">
                {t("profileSecurity")}
              </span>
            </span>
          </Link>
        </div>
      ) : (
        <div className="m-4 rounded-2xl border border-border bg-primary-soft p-4">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <BarChart3 size={18} />

            <p className="text-sm font-semibold">
              {t("financialWorkspace")}
            </p>
          </div>

          <p className="text-xs leading-5 text-text-secondary">
            {t(
              "financialWorkspaceDescription",
            )}
          </p>
        </div>
      )}
    </>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] =
    useState(false);

  const pathname = usePathname();
  const { language } = useLanguage();

  useEffect(() => {
    function handleOpenSidebar() {
      setMobileOpen(true);
    }

    window.addEventListener(
      "open-mobile-sidebar",
      handleOpenSidebar,
    );

    return () => {
      window.removeEventListener(
        "open-mobile-sidebar",
        handleOpenSidebar,
      );
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [mobileOpen]);

  return (
    <>
      <aside
        className={`hidden h-screen w-64 shrink-0 bg-surface lg:sticky lg:top-0 lg:flex lg:flex-col ${
          language === "ar"
            ? "border-l border-border"
            : "border-r border-border"
        }`}
      >
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={
              language === "ar"
                ? "إغلاق القائمة"
                : "Close navigation"
            }
            className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
          />

          <aside
            className={`absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col bg-surface shadow-2xl ${
              language === "ar"
                ? "border-l border-border"
                : "border-r border-border"
            }`}
          >
            <SidebarContent
              mobile
              onNavigate={() =>
                setMobileOpen(false)
              }
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
