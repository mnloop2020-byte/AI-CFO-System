"use client";

import {
  ChevronRight,
  Languages,
  LogOut,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
} from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import NotificationsMenu from "@/components/layout/NotificationsMenu";
import {
  clearAuthMeCache,
  getAuthMe,
  type CompanyRole,
} from "@/lib/auth";
import { normalizeAvatarUrl } from "@/lib/profile-validation";
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
  "Members and invitations": "الأعضاء والدعوات",
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

  const [accountName, setAccountName] = useState("User");
  const [accountRole, setAccountRole] = useState<CompanyRole | null>(null);
  const [accountRoleLoaded, setAccountRoleLoaded] = useState(false);
  const [accountAvatarUrl, setAccountAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([supabase.auth.getUser(), getAuthMe()])
      .then(([{ data }, identity]) => {
        const fullName = data.user?.user_metadata?.full_name;
        setAccountName(
          typeof fullName === "string" && fullName.trim()
            ? fullName.trim()
            : identity.email.split("@")[0] || "User",
        );
        try {
          const avatarUrl = data.user?.user_metadata?.avatar_url;
          setAccountAvatarUrl(
            typeof avatarUrl === "string" ? normalizeAvatarUrl(avatarUrl) : null,
          );
        } catch {
          setAccountAvatarUrl(null);
        }
        setAccountRole(identity.role);
        setAccountRoleLoaded(true);
      })
      .catch(() => setAccountRoleLoaded(true));
  }, []);

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<{
        fullName?: unknown;
        avatarUrl?: unknown;
      }>).detail;
      if (typeof detail?.fullName === "string" && detail.fullName.trim()) {
        setAccountName(detail.fullName.trim());
      }
      try {
        setAccountAvatarUrl(
          typeof detail?.avatarUrl === "string"
            ? normalizeAvatarUrl(detail.avatarUrl)
            : null,
        );
      } catch {
        setAccountAvatarUrl(null);
      }
    }

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAuthMeCache();
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

  const displayedRole = accountRole
    ? language === "ar"
      ? {
          owner: "المالك",
          admin: "المدير",
          accountant: "المحاسب",
          viewer: "المشاهد",
        }[accountRole]
      : accountRole
    : accountRoleLoaded
      ? language === "ar"
        ? "الدور غير متاح"
        : "Role unavailable"
      : language === "ar"
        ? "جارٍ تحميل الدور..."
        : "Loading role...";

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

          <NotificationsMenu />

          <Link
            href="/profile"
            aria-label={t("openAccountMenu")}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-1.5 py-1.5 transition-colors hover:bg-surface-soft sm:gap-3 sm:px-2"
          >
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary-soft text-sm font-semibold text-primary">
              {accountAvatarUrl ? (
                // User metadata is restricted to an HTTPS URL before rendering.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={accountAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                accountName.slice(0, 1).toUpperCase()
              )}
            </span>

            <span className="hidden text-start md:block">
              <span className="block text-sm font-medium text-text-primary">
                {accountName}
              </span>

              <span className="block text-xs text-text-secondary">
                {displayedRole}
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
