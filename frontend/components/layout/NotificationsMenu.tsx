"use client";

import {
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  LoaderCircle,
  Mail,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  getNotifications,
  type InvoiceNotification,
} from "@/lib/notifications";


function notificationCopy(
  notification: InvoiceNotification,
  isArabic: boolean,
) {
  const invoiceNumber =
    typeof notification.data.invoice_number === "string"
      ? notification.data.invoice_number
      : isArabic
        ? "الفاتورة"
        : "the invoice";

  switch (notification.event_type) {
    case "invoice_generated":
      return {
        title: isArabic ? "تم إنشاء ملف الفاتورة" : "Invoice PDF generated",
        description: isArabic
          ? `أصبح ملف ${invoiceNumber} جاهزًا للتنزيل.`
          : `${invoiceNumber} is ready to download.`,
        icon: FileText,
        tone: "bg-primary-soft text-primary",
      };
    case "invoice_emailed":
      return {
        title: isArabic ? "تم إرسال الفاتورة" : "Invoice emailed",
        description: isArabic
          ? `تم إرسال ${invoiceNumber} إلى بريد العميل المسجل.`
          : `${invoiceNumber} was sent to the registered customer email.`,
        icon: Mail,
        tone: "bg-success-soft text-success",
      };
    case "invoice_email_failed":
      return {
        title: isArabic ? "فشل إرسال الفاتورة" : "Invoice email failed",
        description: isArabic
          ? `تعذر إرسال ${invoiceNumber}. راجع إعداد البريد أو بريد العميل.`
          : `${invoiceNumber} could not be sent. Check email configuration and customer data.`,
        icon: TriangleAlert,
        tone: "bg-danger-soft text-danger",
      };
    case "invoice_overdue":
      return {
        title: isArabic ? "فاتورة متأخرة" : "Invoice overdue",
        description: isArabic
          ? `${invoiceNumber} تجاوزت تاريخ الاستحقاق وما زالت غير مدفوعة.`
          : `${invoiceNumber} is past due and remains unpaid.`,
        icon: Clock3,
        tone: "bg-warning-soft text-warning",
      };
    case "invoice_paid":
      return {
        title: isArabic ? "تم دفع الفاتورة" : "Invoice paid",
        description: isArabic
          ? `تم تحديث ${invoiceNumber} إلى مدفوعة.`
          : `${invoiceNumber} was updated to paid.`,
        icon: CheckCircle2,
        tone: "bg-success-soft text-success",
      };
  }
}

export default function NotificationsMenu() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InvoiceNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setNotifications(await getNotifications());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
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
        aria-label={isArabic ? "فتح الإشعارات" : "Open notifications"}
        aria-expanded={open}
        className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-soft hover:text-text-primary"
      >
        <Bell size={19} />
        {notifications.length > 0 ? (
          <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-danger" />
        ) : null}
      </button>

      {open ? (
        <section className="absolute end-0 top-12 z-50 w-[min(88vw,390px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-4">
            <div>
              <h2 className="font-semibold text-text-primary">
                {isArabic ? "الإشعارات" : "Notifications"}
              </h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                {isArabic
                  ? `${notifications.length} إشعار من دورة الفواتير`
                  : `${notifications.length} invoice lifecycle notification(s)`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadNotifications()}
              disabled={loading}
              aria-label={isArabic ? "تحديث الإشعارات" : "Refresh notifications"}
              className="flex size-9 items-center justify-center rounded-lg text-primary transition hover:bg-primary-soft disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </header>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-text-secondary">
                <LoaderCircle size={18} className="animate-spin" />
                {isArabic ? "جارٍ تحميل الإشعارات..." : "Loading notifications..."}
              </div>
            ) : null}

            {error ? (
              <div className="px-4 py-10 text-center text-sm text-danger">
                {isArabic
                  ? "تعذر تحميل الإشعارات. حاول مرة أخرى."
                  : "Notifications could not be loaded. Try again."}
              </div>
            ) : null}

            {!loading && !error && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-text-secondary">
                {isArabic
                  ? "لا توجد إشعارات فواتير حتى الآن."
                  : "No invoice notifications yet."}
              </div>
            ) : null}

            {!error
              ? notifications.map((notification) => {
                  const copy = notificationCopy(notification, isArabic);
                  const Icon = copy.icon;
                  return (
                    <Link
                      key={notification.id}
                      href="/crm/invoices"
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 border-b border-border px-4 py-4 transition last:border-b-0 hover:bg-surface-soft"
                    >
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${copy.tone}`}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-primary">
                          {copy.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-text-secondary">
                          {copy.description}
                        </span>
                      </span>
                    </Link>
                  );
                })
              : null}
          </div>

          <footer className="border-t border-border bg-surface-soft px-4 py-3 text-center text-xs text-text-secondary">
            {isArabic
              ? "الإشعارات محفوظة داخل الشركة ومحمية بالصلاحيات."
              : "Notifications are company-scoped and permission protected."}
          </footer>
        </section>
      ) : null}
    </div>
  );
}
