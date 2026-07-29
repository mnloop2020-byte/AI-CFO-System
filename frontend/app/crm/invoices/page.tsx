"use client";

import {
  CircleDollarSign,
  Clock3,
  FileText,
  ReceiptText,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import InvoicesTable from "@/components/crm/InvoicesTable";
import DashboardWidget from "@/components/dashboard/DashboardWidget";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { subscribeToDataChanges } from "@/lib/data-events";
import {
  getInvoices,
  type Invoice,
} from "@/lib/invoices";
import {
  addMoney,
  formatMoney,
} from "@/lib/money";

const UNKNOWN_LOAD_ERROR =
  "Unable to load invoice metrics.";

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function formatNumber(
  value: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale).format(
    value,
  );
}

function getInvoiceCountDescription(
  count: number,
  isArabic: boolean,
  locale: string,
) {
  if (!isArabic) {
    return count === 1
      ? "One recorded invoice"
      : `${count} recorded invoices`;
  }

  if (count === 0) {
    return "لا توجد فواتير مسجلة";
  }

  if (count === 1) {
    return "فاتورة مسجلة واحدة";
  }

  if (count === 2) {
    return "فاتورتان مسجلتان";
  }

  return `${formatNumber(
    count,
    locale,
  )} فواتير مسجلة`;
}

function getOutstandingDescription(
  count: number,
  isArabic: boolean,
  locale: string,
) {
  if (!isArabic) {
    return count === 1
      ? "One expected inflow not yet received"
      : `${count} expected inflows not yet received`;
  }

  if (count === 0) {
    return "لا توجد تدفقات متوقعة غير مستلمة";
  }

  if (count === 1) {
    return "تدفق متوقع واحد لم يُستلم بعد";
  }

  if (count === 2) {
    return "تدفقان متوقعان لم يُستَلما بعد";
  }

  return `${formatNumber(
    count,
    locale,
  )} تدفقات متوقعة لم تُستلم بعد`;
}

export default function InvoicesPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [invoices, setInvoices] = useState<
    Invoice[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const loadInvoiceMetrics =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await getInvoices();
        setInvoices(response);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : UNKNOWN_LOAD_ERROR;

        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadInvoiceMetrics();
  }, [loadInvoiceMetrics]);

  useEffect(
    () =>
      subscribeToDataChanges(
        ["invoices"],
        () => {
          void loadInvoiceMetrics();
        },
      ),
    [loadInvoiceMetrics],
  );

  const invoiceSummary = useMemo(() => {
    const totalInvoicedAmount = addMoney(
      invoices.map(
        (invoice) => invoice.total_amount,
      ),
    );

    const outstandingInvoices =
      invoices.filter((invoice) => {
        const status = normalizeStatus(
          invoice.status,
        );

        return (
          status === "unpaid" ||
          status === "overdue"
        );
      });

    const outstandingAmount = addMoney(
      outstandingInvoices.map(
        (invoice) => invoice.total_amount,
      ),
    );

    const totalInvoicedVat = addMoney(
      invoices.map(
        (invoice) => invoice.vat_amount,
      ),
    );

    return {
      invoiceCount: invoices.length,
      totalInvoicedAmount,
      outstandingCount:
        outstandingInvoices.length,
      outstandingAmount,
      totalInvoicedVat,
    };
  }, [invoices]);

  const invoiceMetrics = useMemo(
    () => [
      {
        title: isArabic
          ? "عدد الفواتير"
          : "Invoice Count",
        value: loading
          ? "—"
          : formatNumber(
              invoiceSummary.invoiceCount,
              numberLocale,
            ),
        description:
          getInvoiceCountDescription(
            invoiceSummary.invoiceCount,
            isArabic,
            numberLocale,
          ),
        icon: FileText,
        tone: "blue" as const,
      },
      {
        title: isArabic
          ? "إجمالي قيمة الفواتير"
          : "Total Invoiced Amount",
        value: loading
          ? "—"
          : formatMoney(
              invoiceSummary.totalInvoicedAmount,
              numberLocale,
            ),
        description: isArabic
          ? "إجمالي القيمة عبر جميع الفواتير"
          : "Total amount across invoices",
        icon: CircleDollarSign,
        tone: "blue" as const,
      },
      {
        title: isArabic
          ? "مستحقات غير مدفوعة"
          : "Outstanding Unpaid",
        value: loading
          ? "—"
          : formatMoney(
              invoiceSummary.outstandingAmount,
              numberLocale,
            ),
        description: getOutstandingDescription(
          invoiceSummary.outstandingCount,
          isArabic,
          numberLocale,
        ),
        icon: Clock3,
        tone:
          invoiceSummary.outstandingCount > 0
            ? ("amber" as const)
            : ("green" as const),
      },
      {
        title: isArabic
          ? "ضريبة القيمة المضافة في الفواتير"
          : "Invoiced VAT",
        value: loading
          ? "—"
          : formatMoney(
              invoiceSummary.totalInvoicedVat,
              numberLocale,
            ),
        description: isArabic
          ? "ليست ضريبة القيمة المضافة النهائية المستحقة"
          : "Not the final VAT payable",
        icon: ReceiptText,
        tone: "amber" as const,
      },
    ],
    [
      invoiceSummary,
      isArabic,
      loading,
      numberLocale,
    ],
  );

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل مؤشرات الفواتير."
      : loadError;

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={
            isArabic ? "الفواتير" : "Invoices"
          }
          description={
            isArabic
              ? "تابع إجماليات الفواتير وحالة الدفع وضريبة القيمة المضافة والمستندات المرفقة."
              : "Track invoice totals, payment status, VAT, and attached documents."
          }
        />

        <main className="space-y-6 p-5 lg:p-8">
          {loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-100 bg-danger-soft px-5 py-4">
              <div className="flex items-start gap-3 text-danger">
                <WifiOff
                  size={20}
                  className="mt-0.5 shrink-0"
                />

                <div>
                  <p className="font-medium">
                    {isArabic
                      ? "تعذر تحميل مؤشرات الفواتير"
                      : "Unable to load invoice metrics"}
                  </p>

                  <p className="mt-1 text-sm">
                    {displayedLoadError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadInvoiceMetrics()
                }
                className="flex items-center gap-2 rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
              >
                <RefreshCw size={17} />

                {isArabic
                  ? "إعادة المحاولة"
                  : "Try again"}
              </button>
            </div>
          ) : null}

          <section>
            <div className="mb-4 flex justify-end">
              <span className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
                <span className="size-2 rounded-full bg-success" />

                {isArabic
                  ? "مؤشرات مباشرة من الخادم"
                  : "Live backend metrics"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {invoiceMetrics.map(
                (metric) => (
                  <DashboardWidget
                    key={metric.title}
                    title={metric.title}
                    value={metric.value}
                    description={
                      metric.description
                    }
                    icon={metric.icon}
                    tone={metric.tone}
                  />
                ),
              )}
            </div>
          </section>

          <InvoicesTable />
        </main>
      </div>
    </div>
  );
}
