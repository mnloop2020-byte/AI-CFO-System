"use client";

import {
  CircleDollarSign,
  Landmark,
  LoaderCircle,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ActionCenter from "@/components/dashboard/ActionCenter";
import CashFlowCard from "@/components/dashboard/CashFlowCard";
import DashboardWidget from "@/components/dashboard/DashboardWidget";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { subscribeToDataChanges } from "@/lib/data-events";
import { getExpenses } from "@/lib/expenses";
import { getInventoryItems } from "@/lib/inventory";
import { getInvoices } from "@/lib/invoices";
import {
  addMoney,
  compareMoney,
  formatMoney,
  subtractMoney,
  type MoneyString,
} from "@/lib/money";
import { getSales } from "@/lib/sales";

type DashboardSummary = {
  completedRevenue: MoneyString;
  completedUnits: number;
  totalExpenses: MoneyString;
  flaggedExpenseCount: number;
  flaggedExpenseAmount: MoneyString;
  operatingResult: MoneyString;
  outstandingReceivables: MoneyString;
  outstandingInvoiceCount: number;
  trackedInflows: MoneyString;
  expectedInflows: MoneyString;
  netCashFlow: MoneyString;
  lowStockCount: number;
  lowStockQuantity: number;
  reorderLevel: number;
  invoicedVat: MoneyString;
};

const emptySummary: DashboardSummary = {
  completedRevenue: "0.00",
  completedUnits: 0,
  totalExpenses: "0.00",
  flaggedExpenseCount: 0,
  flaggedExpenseAmount: "0.00",
  operatingResult: "0.00",
  outstandingReceivables: "0.00",
  outstandingInvoiceCount: 0,
  trackedInflows: "0.00",
  expectedInflows: "0.00",
  netCashFlow: "0.00",
  lowStockCount: 0,
  lowStockQuantity: 0,
  reorderLevel: 0,
  invoicedVat: "0.00",
};

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function formatAmount(
  amount: MoneyString,
  language: "en" | "ar",
) {
  const locale =
    language === "ar"
      ? "ar-SA-u-nu-latn"
      : "en-US";

  return formatMoney(amount, locale);
}

function pluralize(
  count: number,
  singular: string,
  plural: string,
) {
  return count === 1 ? singular : plural;
}

export default function DashboardPage() {
  const { language } = useLanguage();

  const [summary, setSummary] =
    useState<DashboardSummary>(emptySummary);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const loadDashboardData =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [
          sales,
          expenses,
          inventoryItems,
          invoices,
        ] = await Promise.all([
          getSales(),
          getExpenses(),
          getInventoryItems(),
          getInvoices(),
        ]);

        const completedSales = sales.filter(
          (sale) =>
            normalizeStatus(sale.status) ===
            "completed",
        );

        const completedRevenue = addMoney(
          completedSales.map(
            (sale) => sale.total_amount,
          ),
        );

        const completedUnits =
          completedSales.reduce(
            (total, sale) =>
              total + Number(sale.quantity),
            0,
          );

        const totalExpenses = addMoney(
          expenses.map(
            (expense) => expense.amount,
          ),
        );

        const flaggedExpenses =
          expenses.filter(
            (expense) =>
              expense.is_flagged,
          );

        const flaggedExpenseAmount = addMoney(
          flaggedExpenses.map(
            (expense) => expense.amount,
          ),
        );

        const paidInvoices =
          invoices.filter(
            (invoice) =>
              normalizeStatus(
                invoice.status,
              ) === "paid",
          );

        const outstandingInvoices =
          invoices.filter((invoice) => {
            const status =
              normalizeStatus(
                invoice.status,
              );

            return (
              status === "unpaid" ||
              status === "overdue"
            );
          });

        const trackedInflows = addMoney(
          paidInvoices.map(
            (invoice) => invoice.total_amount,
          ),
        );

        const expectedInflows = addMoney(
          outstandingInvoices.map(
            (invoice) => invoice.total_amount,
          ),
        );

        const lowStockItems =
          inventoryItems.filter(
            (item) =>
              Number(item.quantity) <=
              Number(
                item.reorder_level,
              ),
          );

        const firstLowStockItem =
          lowStockItems[0] ?? null;

        const invoicedVat = addMoney(
          invoices.map(
            (invoice) => invoice.vat_amount,
          ),
        );

        setSummary({
          completedRevenue,
          completedUnits,
          totalExpenses,
          flaggedExpenseCount:
            flaggedExpenses.length,
          flaggedExpenseAmount,
          operatingResult: subtractMoney(
            completedRevenue,
            totalExpenses,
          ),
          outstandingReceivables:
            expectedInflows,
          outstandingInvoiceCount:
            outstandingInvoices.length,
          trackedInflows,
          expectedInflows,
          netCashFlow: subtractMoney(
            trackedInflows,
            totalExpenses,
          ),
          lowStockCount:
            lowStockItems.length,
          lowStockQuantity:
            firstLowStockItem
              ?.quantity ?? 0,
          reorderLevel:
            firstLowStockItem
              ?.reorder_level ?? 0,
          invoicedVat,
        });
      } catch (requestError) {
        const errorMessage =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the financial dashboard.";

        setLoadError(errorMessage);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(
    () =>
      subscribeToDataChanges(
        [
          "sales",
          "expenses",
          "inventory",
          "invoices",
        ],
        () => {
          void loadDashboardData();
        },
      ),
    [loadDashboardData],
  );

  const dashboardMetrics = useMemo(
    () => [
      {
        title:
          language === "ar"
            ? "الإيرادات المكتملة"
            : "Completed Revenue",

        value: loading
          ? "—"
          : formatAmount(
              summary.completedRevenue,
              language,
            ),

        description: loading
          ? language === "ar"
            ? "جارٍ تحميل المبيعات المكتملة..."
            : "Loading completed sales..."
          : language === "ar"
            ? `${summary.completedUnits} وحدة مكتملة مباعة`
            : `${summary.completedUnits} ${pluralize(
                summary.completedUnits,
                "completed unit sold",
                "completed units sold",
              )}`,

        icon: CircleDollarSign,
        tone: "green" as const,
      },

      {
        title:
          language === "ar"
            ? "المصروفات المسجلة"
            : "Recorded Expenses",

        value: loading
          ? "—"
          : formatAmount(
              summary.totalExpenses,
              language,
            ),

        description: loading
          ? language === "ar"
            ? "جارٍ تحميل سجلات المصروفات..."
            : "Loading expense records..."
          : summary.flaggedExpenseCount >
              0
            ? language === "ar"
              ? `تتضمن ${summary.flaggedExpenseCount} مصروف يحتاج إلى المراجعة`
              : `Includes ${
                  summary.flaggedExpenseCount
                } ${pluralize(
                  summary.flaggedExpenseCount,
                  "flagged expense",
                  "flagged expenses",
                )}`
            : language === "ar"
              ? "لا توجد مصروفات محددة للمراجعة"
              : "No expenses currently flagged",

        icon: ReceiptText,
        tone: "amber" as const,
      },

      {
        title:
          language === "ar"
            ? "النتيجة التشغيلية الأولية"
            : "Preliminary Operating Result",

        value: loading
          ? "—"
          : formatAmount(
              summary.operatingResult,
              language,
            ),

        description:
          language === "ar"
            ? "الإيرادات المكتملة ناقص المصروفات المسجلة"
            : "Completed revenue minus recorded expenses",

        icon: TriangleAlert,

        tone:
          compareMoney(
            summary.operatingResult,
            "0.00",
          ) < 0
            ? ("red" as const)
            : ("green" as const),
      },

      {
        title:
          language === "ar"
            ? "المبالغ المستحقة القبض"
            : "Outstanding Receivables",

        value: loading
          ? "—"
          : formatAmount(
              summary.outstandingReceivables,
              language,
            ),

        description: loading
          ? language === "ar"
            ? "جارٍ تحميل سجلات الفواتير..."
            : "Loading invoice records..."
          : language === "ar"
            ? `${summary.outstandingInvoiceCount} فاتورة غير مدفوعة`
            : `${
                summary.outstandingInvoiceCount
              } ${pluralize(
                summary.outstandingInvoiceCount,
                "unpaid invoice",
                "unpaid invoices",
              )}`,

        icon: Landmark,
        tone: "blue" as const,
      },
    ],
    [language, loading, summary],
  );

  const aiObservation = useMemo(() => {
    if (loading) {
      return language === "ar"
        ? {
            title:
              "جارٍ إعداد الملاحظة المالية",
            description:
              "يتم تحميل أحدث السجلات المالية من الباك إند.",
          }
        : {
            title:
              "Preparing financial observation",
            description:
              "The latest financial records are being loaded from the backend.",
          };
    }

    if (loadError) {
      return language === "ar"
        ? {
            title:
              "الملاحظة المالية غير متاحة مؤقتًا",
            description:
              "أعد الاتصال بالباك إند ثم حمّل أحدث السجلات المالية.",
          }
        : {
            title:
              "Financial observation is temporarily unavailable",
            description:
              "Reconnect to the backend and reload the latest financial records.",
          };
    }

    if (
      compareMoney(
        summary.netCashFlow,
        "0.00",
      ) < 0 &&
      summary.flaggedExpenseCount > 0
    ) {
      return language === "ar"
        ? {
            title:
              "التدفق النقدي والمصروفات يحتاجان إلى الانتباه",
            description:
              "التدفق النقدي المسجل سالب ويوجد مصروف واحد على الأقل يحتاج إلى مراجعة بشرية. راجع المصروفات المحددة والمبالغ المستحقة قبل اتخاذ قرارات إنفاق إضافية.",
          }
        : {
            title:
              "Cash flow and expenses require attention",
            description:
              "Tracked cash flow is negative and at least one expense requires human review. Review the flagged expense and outstanding receivables before additional spending decisions.",
          };
    }

    if (
      compareMoney(
        summary.operatingResult,
        "0.00",
      ) < 0
    ) {
      return language === "ar"
        ? {
            title:
              "المصروفات المسجلة أعلى من الإيرادات المكتملة",
            description:
              "راجع المصروفات الحالية والمبيعات المكتملة ومدفوعات الفواتير المتوقعة قبل الالتزام بمصروفات مالية إضافية.",
          }
        : {
            title:
              "Recorded expenses are higher than completed revenue",
            description:
              "Review current expenses, completed sales, and expected invoice payments before making additional financial commitments.",
          };
    }

    if (summary.lowStockCount > 0) {
      return language === "ar"
        ? {
            title:
              "المخزون يحتاج إلى الانتباه",
            description: `${summary.lowStockCount} منتج عند مستوى إعادة الطلب المحدد أو أقل منه.`,
          }
        : {
            title:
              "Inventory requires attention",
            description: `${
              summary.lowStockCount
            } ${pluralize(
              summary.lowStockCount,
              "inventory product is",
              "inventory products are",
            )} at or below the configured reorder level.`,
          };
    }

    if (
      compareMoney(
        summary.outstandingReceivables,
        "0.00",
      ) > 0
    ) {
      return language === "ar"
        ? {
            title:
              "يجب متابعة مدفوعات الفواتير المستحقة",
            description:
              "لا يتم اعتبار مدفوعات الفواتير المتوقعة أموالًا مستلمة حتى تتغير حالة الدفع إلى مدفوعة.",
          }
        : {
            title:
              "Outstanding invoice payments should be monitored",
            description:
              "Expected invoice payments are not treated as received cash until their payment status changes to paid.",
          };
    }

    return language === "ar"
      ? {
          title:
            "تبدو السجلات المالية الحالية مستقرة",
          description:
            "لم يتم العثور على مصروفات محددة للمراجعة أو مخزون منخفض أو تحذيرات فواتير مستحقة في البيانات الحالية.",
        }
      : {
          title:
            "Current financial records appear stable",
          description:
            "No flagged expenses, low-stock records, or outstanding invoice warnings were found in the current data.",
        };
  }, [
    language,
    loadError,
    loading,
    summary,
  ]);

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title="Financial Overview"
          description="Monitor your company's financial health and AI insights."
        />

        <main className="p-5 lg:p-8">
          {loadError ? (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-100 bg-danger-soft px-5 py-4">
              <div className="flex items-start gap-3 text-danger">
                <WifiOff
                  size={20}
                  className="mt-0.5 shrink-0"
                />

                <div>
                  <p className="font-medium">
                    {language === "ar"
                      ? "تعذر تحميل بيانات لوحة التحكم"
                      : "Unable to load dashboard data"}
                  </p>

                  <p
                    dir="auto"
                    className="mt-1 text-sm"
                  >
                    {loadError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadDashboardData()
                }
                className="flex items-center gap-2 rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
              >
                <RefreshCw size={17} />

                {language === "ar"
                  ? "إعادة المحاولة"
                  : "Try again"}
              </button>
            </div>
          ) : null}

          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {language === "ar"
                    ? "ملخص الأعمال"
                    : "Business snapshot"}
                </h2>

                <p className="mt-1 text-sm text-text-secondary">
                  {language === "ar"
                    ? "أهم النتائج المالية من أحدث السجلات المتاحة."
                    : "Key financial results from the latest available records."}
                </p>
              </div>

              <span className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
                {loading ? (
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <span className="size-2 rounded-full bg-success" />
                )}

                {loading
                  ? language === "ar"
                    ? "جارٍ تحميل بيانات الباك إند"
                    : "Loading backend data"
                  : language === "ar"
                    ? "بيانات مباشرة من الباك إند"
                    : "Live backend data"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {dashboardMetrics.map(
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

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <CashFlowCard
              trackedInflows={
                summary.trackedInflows
              }
              recordedOutflows={
                summary.totalExpenses
              }
              expectedInflows={
                summary.expectedInflows
              }
              netCashFlow={
                summary.netCashFlow
              }
            />

            <ActionCenter
              lowStockQuantity={
                summary.lowStockQuantity
              }
              reorderLevel={
                summary.reorderLevel
              }
              flaggedExpenseAmount={
                summary.flaggedExpenseAmount
              }
              invoicedVat={
                summary.invoicedVat
              }
            />
          </section>

          <section className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-primary">
                  {language === "ar"
                    ? "ملاحظة المدير المالي الذكي"
                    : "AI CFO observation"}
                </p>

                <h2 className="mt-2 text-lg font-semibold text-text-primary">
                  {aiObservation.title}
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                  {aiObservation.description}
                </p>
              </div>

              <Link
                href="/chat"
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                {language === "ar"
                  ? "فتح محادثة المدير المالي"
                  : "Open AI CFO Chat"}
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
