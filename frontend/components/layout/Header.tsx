"use client";

import {
  Bell,
  CheckCheck,
  ChevronRight,
  Clock3,
  Languages,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

type HeaderProps = {
  title: string;
  description?: string;
};

const titleKeys: Record<string, string> = {
  "AI CFO Chat": "aiCfoChat",
  Customers: "customers",
  Sales: "sales",
  Expenses: "expenses",
  Inventory: "inventory",
  Invoices: "invoices",
  Reports: "reports",
  "Profile & Security": "profileSecurity",
};

const arabicTitles: Record<string, string> = {
  "Financial Overview": "النظرة المالية",
  "Company Settings": "إعدادات الشركة",
};

const arabicDescriptions: Record<string, string> = {
  "Financial Overview":
    "راقب الوضع المالي لشركتك وتحليلات الذكاء الاصطناعي.",

  "AI CFO Chat":
    "اطرح أسئلتك واحصل على تحليلات مالية من وكلاء الذكاء الاصطناعي المتخصصين.",

  Customers:
    "إدارة سجلات العملاء ومعلومات التواصل ونشاط المشتريات.",

  Sales:
    "مراقبة المبيعات والإيرادات المكتملة وأداء المنتجات.",

  Expenses:
    "تتبع المصروفات وفئات الإنفاق والسجلات التي تحتاج إلى مراجعة.",

  Inventory:
    "مراقبة كميات المخزون ومستويات إعادة الطلب وقيمة المنتجات.",

  Invoices:
    "تتبع إجماليات الفواتير وحالة الدفع والضريبة والمستندات.",

  Reports:
    "إنشاء ومراجعة التحليلات المالية التي يعدها وكلاء الذكاء الاصطناعي.",

  "Company Settings":
    "إعداد معلومات الشركة والعملة والضرائب والأرصدة الافتتاحية.",

  "Profile & Security":
    "إدارة معلوماتك الشخصية ومستوى الوصول وأمان الحساب.",
};

export default function Header({
  title,
  description,
}: HeaderProps) {
  const router = useRouter();
  const {
    language,
    toggleLanguage,
    t,
  } = useLanguage();

  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

  const [notificationsRead, setNotificationsRead] =
    useState(false);

  const [accountName, setAccountName] = useState("User");

  const notificationsRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(
          event.target as Node,
        )
      ) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const fullName = data.user?.user_metadata?.full_name;
      const email = data.user?.email;
      setAccountName(
        typeof fullName === "string" && fullName.trim()
          ? fullName.trim()
          : email?.split("@")[0] ?? "User",
      );
    });
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const titleKey = titleKeys[title];

  const displayedTitle =
    language === "ar"
      ? arabicTitles[title] ??
        (titleKey ? t(titleKey) : title)
      : title;

  const displayedDescription =
    language === "ar"
      ? arabicDescriptions[title] ?? description
      : description;

  const notifications =
    language === "ar"
      ? [
          {
            title: "مصروف يحتاج إلى مراجعة",
            description:
              "يوجد مصروف بقيمة 500.00 بانتظار المراجعة البشرية.",
            icon: ShieldAlert,
            iconStyle:
              "bg-danger-soft text-danger",
          },
          {
            title: "انخفاض مستوى المخزون",
            description:
              "يوجد منتج أقل من مستوى إعادة الطلب المحدد.",
            icon: Package,
            iconStyle:
              "bg-warning-soft text-warning",
          },
          {
            title: "فاتورة غير مدفوعة",
            description:
              "لا تزال فاتورة بقيمة 1,000.00 غير مدفوعة.",
            icon: Clock3,
            iconStyle:
              "bg-primary-soft text-primary",
          },
        ]
      : [
          {
            title: "Flagged expense requires review",
            description:
              "An expense of 500.00 is waiting for human review.",
            icon: ShieldAlert,
            iconStyle:
              "bg-danger-soft text-danger",
          },
          {
            title: "Low inventory level",
            description:
              "One product is below its configured reorder level.",
            icon: Package,
            iconStyle:
              "bg-warning-soft text-warning",
          },
          {
            title: "Unpaid invoice",
            description:
              "An expected inflow of 1,000.00 remains unpaid.",
            icon: Clock3,
            iconStyle:
              "bg-primary-soft text-primary",
          },
        ];

  function openMobileSidebar() {
    window.dispatchEvent(
      new Event("open-mobile-sidebar"),
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex min-h-20 items-center justify-between gap-3 px-4 sm:gap-6 sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openMobileSidebar}
            aria-label={
              language === "ar"
                ? "فتح القائمة"
                : "Open navigation"
            }
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-text-primary sm:text-xl">
              {displayedTitle}
            </h1>

            {displayedDescription ? (
              <p className="mt-1 hidden max-w-xl truncate text-sm text-text-secondary sm:block">
                {displayedDescription}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <label className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-app-background px-3 transition-colors focus-within:border-primary xl:flex">
            <Search
              size={18}
              className="shrink-0 text-text-secondary"
            />

            <input
              type="search"
              placeholder={t("searchFinancialData")}
              aria-label={t("searchFinancialData")}
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </label>

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={
              language === "en"
                ? "Switch to Arabic"
                : "التبديل إلى الإنجليزية"
            }
            title={
              language === "en"
                ? "العربية"
                : "English"
            }
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-sm font-medium text-text-secondary transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary sm:px-3"
          >
            <Languages size={18} />

            <span className="hidden sm:inline">
              {language === "en"
                ? "العربية"
                : "English"}
            </span>
          </button>

          <div
            ref={notificationsRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() =>
                setNotificationsOpen(
                  (currentValue) => !currentValue,
                )
              }
              aria-label={t("openNotifications")}
              aria-expanded={notificationsOpen}
              className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary"
            >
              <Bell size={19} />

              {!notificationsRead ? (
                <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-danger" />
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute end-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-4">
                  <div>
                    <p className="font-semibold text-text-primary">
                      {language === "ar"
                        ? "الإشعارات"
                        : "Notifications"}
                    </p>

                    <p className="mt-0.5 text-xs text-text-secondary">
                      {notificationsRead
                        ? language === "ar"
                          ? "تمت قراءة جميع الإشعارات"
                          : "All notifications are read"
                        : language === "ar"
                          ? "3 عناصر تحتاج إلى الانتباه"
                          : "3 items require attention"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setNotificationsRead(true)
                    }
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
                  >
                    <CheckCheck size={16} />

                    {language === "ar"
                      ? "تحديد الكل كمقروء"
                      : "Mark all read"}
                  </button>
                </div>

                <div>
                  {notifications.map(
                    (notification) => {
                      const Icon = notification.icon;

                      return (
                        <button
                          key={notification.title}
                          type="button"
                          className="flex w-full items-start gap-3 border-b border-border px-4 py-4 text-start transition-colors last:border-b-0 hover:bg-surface-soft"
                        >
                          <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${notification.iconStyle}`}
                          >
                            <Icon
                              size={19}
                              strokeWidth={1.8}
                            />
                          </span>

                          <span>
                            <span className="block text-sm font-medium text-text-primary">
                              {notification.title}
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-text-secondary">
                              {notification.description}
                            </span>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="bg-surface-soft px-4 py-3 text-center text-xs text-text-secondary">
                  {language === "ar"
                    ? "تعتمد الإشعارات على البيانات المالية الحالية."
                    : "Notifications are based on the current financial data."}
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/profile"
            aria-label={t("openAccountMenu")}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-1.5 py-1.5 transition-colors hover:bg-surface-soft sm:gap-3 sm:px-2"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-semibold text-primary">
              {accountName.slice(0, 1).toUpperCase()}
            </span>

            <span className="hidden text-start md:block">
              <span className="block text-sm font-medium text-text-primary">
                {accountName}
              </span>

              <span className="block text-xs text-text-secondary">
                {t("administrator")}
              </span>
            </span>

            <ChevronRight
              size={16}
              className={`hidden text-text-secondary md:block ${
                language === "ar"
                  ? "rotate-180"
                  : ""
              }`}
            />
          </Link>

          <button
            type="button"
            onClick={() => void signOut()}
            aria-label={
              language === "ar" ? "تسجيل الخروج" : "Sign out"
            }
            title={language === "ar" ? "تسجيل الخروج" : "Sign out"}
            className="flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
