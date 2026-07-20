"use client";

import {
  ArrowUpRight,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  WalletCards,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ExpensesTable from "@/components/crm/ExpensesTable";
import DashboardWidget from "@/components/dashboard/DashboardWidget";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  getExpenses,
  type Expense,
} from "@/lib/expenses";

const UNKNOWN_LOAD_ERROR =
  "Unable to load expense metrics.";

function formatAmount(
  amount: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function ExpensesPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [expenses, setExpenses] = useState<
    Expense[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const loadExpenseMetrics =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await getExpenses();
        setExpenses(response);
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
    void loadExpenseMetrics();
  }, [loadExpenseMetrics]);

  const expenseSummary = useMemo(() => {
    const totalExpenses = expenses.reduce(
      (total, expense) =>
        total + Number(expense.amount),
      0,
    );

    const flaggedExpenses = expenses.filter(
      (expense) => expense.is_flagged,
    );

    const largestExpense =
      expenses.length > 0
        ? expenses.reduce(
            (largest, expense) =>
              Number(expense.amount) >
              Number(largest.amount)
                ? expense
                : largest,
          )
        : null;

    const categoryNames = Array.from(
      new Set(
        expenses.map(
          (expense) => expense.category,
        ),
      ),
    );

    return {
      totalExpenses,
      expenseCount: expenses.length,
      flaggedCount: flaggedExpenses.length,
      largestExpense,
      categoryNames,
    };
  }, [expenses]);

  const expenseMetrics = useMemo(
    () => [
      {
        title: isArabic
          ? "إجمالي المصروفات"
          : "Total Expenses",
        value: loading
          ? "—"
          : formatAmount(
              expenseSummary.totalExpenses,
              numberLocale,
            ),
        description: isArabic
          ? "إجمالي المصروفات المسجلة"
          : "Total recorded expenses",
        icon: WalletCards,
        tone: "amber" as const,
      },
      {
        title: isArabic
          ? "سجلات المصروفات"
          : "Expense Records",
        value: loading
          ? "—"
          : new Intl.NumberFormat(
              numberLocale,
            ).format(
              expenseSummary.expenseCount,
            ),
        description:
          expenseSummary.categoryNames.length >
          0
            ? expenseSummary.categoryNames.join(
                isArabic ? " و" : " and ",
              )
            : isArabic
              ? "لا توجد فئات مصروفات"
              : "No expense categories",
        icon: ReceiptText,
        tone: "blue" as const,
      },
      {
        title: isArabic
          ? "معلّمة للمراجعة"
          : "Flagged for Review",
        value: loading
          ? "—"
          : new Intl.NumberFormat(
              numberLocale,
            ).format(
              expenseSummary.flaggedCount,
            ),
        description: isArabic
          ? "التحديد للمراجعة لا يؤكد وجود احتيال"
          : "Review does not confirm fraud",
        icon: ShieldAlert,
        tone:
          expenseSummary.flaggedCount > 0
            ? ("red" as const)
            : ("green" as const),
      },
      {
        title: isArabic
          ? "أكبر مصروف"
          : "Largest Expense",
        value: loading
          ? "—"
          : expenseSummary.largestExpense
            ? formatAmount(
                expenseSummary.largestExpense
                  .amount,
                numberLocale,
              )
            : formatAmount(
                0,
                numberLocale,
              ),
        description:
          expenseSummary.largestExpense
            ?.category ??
          (isArabic
            ? "لا توجد سجلات مصروفات"
            : "No expense records"),
        icon: ArrowUpRight,
        tone: "amber" as const,
      },
    ],
    [
      expenseSummary,
      isArabic,
      loading,
      numberLocale,
    ],
  );

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل مؤشرات المصروفات."
      : loadError;

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={
            isArabic
              ? "المصروفات"
              : "Expenses"
          }
          description={
            isArabic
              ? "تابع الإنفاق وفئات المصروفات والسجلات التي تحتاج إلى مراجعة."
              : "Track spending, expense categories, and records requiring review."
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
                      ? "تعذر تحميل مؤشرات المصروفات"
                      : "Unable to load expense metrics"}
                  </p>

                  <p className="mt-1 text-sm">
                    {displayedLoadError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadExpenseMetrics()
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
              {expenseMetrics.map(
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

          <ExpensesTable />
        </main>
      </div>
    </div>
  );
}