"use client";

import {
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Trophy,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import SalesTable from "@/components/crm/SalesTable";
import DashboardWidget from "@/components/dashboard/DashboardWidget";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { subscribeToDataChanges } from "@/lib/data-events";
import {
  getSales,
  type Sale,
} from "@/lib/sales";
import {
  addMoney,
  compareMoney,
  formatMoney,
  type MoneyString,
} from "@/lib/money";

const UNKNOWN_LOAD_ERROR =
  "Unable to load sales metrics.";

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

function findTopProduct(sales: Sale[]) {
  const productPerformance = new Map<
    string,
    {
      quantity: number;
      revenue: MoneyString;
    }
  >();

  sales.forEach((sale) => {
    const current =
      productPerformance.get(
        sale.product_name,
      ) ?? {
        quantity: 0,
        revenue: "0.00",
      };

    productPerformance.set(
      sale.product_name,
      {
        quantity:
          current.quantity +
          Number(sale.quantity),
        revenue: addMoney([
          current.revenue,
          sale.total_amount,
        ]),
      },
    );
  });

  const rankedProducts = Array.from(
    productPerformance.entries(),
  ).sort((firstProduct, secondProduct) => {
    const quantityDifference =
      secondProduct[1].quantity -
      firstProduct[1].quantity;

    if (quantityDifference !== 0) {
      return quantityDifference;
    }

    return compareMoney(
      secondProduct[1].revenue,
      firstProduct[1].revenue,
    );
  });

  if (rankedProducts.length === 0) {
    return null;
  }

  const [name, performance] =
    rankedProducts[0];

  return {
    name,
    quantity: performance.quantity,
    revenue: performance.revenue,
  };
}

function getCompletedSalesDescription(
  count: number,
  isArabic: boolean,
) {
  if (!isArabic) {
    return count === 1
      ? "One completed sales record"
      : `${count} completed sales records`;
  }

  if (count === 0) {
    return "لا توجد سجلات مبيعات مكتملة";
  }

  if (count === 1) {
    return "سجل مبيعات مكتمل واحد";
  }

  if (count === 2) {
    return "سجلا مبيعات مكتملان";
  }

  return `${count} سجلات مبيعات مكتملة`;
}

export default function SalesPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [sales, setSales] = useState<Sale[]>(
    [],
  );

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const loadSalesMetrics =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await getSales();
        setSales(response);
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
    void loadSalesMetrics();
  }, [loadSalesMetrics]);

  useEffect(
    () =>
      subscribeToDataChanges(
        ["sales"],
        () => {
          void loadSalesMetrics();
        },
      ),
    [loadSalesMetrics],
  );

  const salesSummary = useMemo(() => {
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

    const topProduct =
      findTopProduct(completedSales);

    return {
      completedRevenue,
      completedUnits,
      completedSalesCount:
        completedSales.length,
      topProduct,
    };
  }, [sales]);

  const salesMetrics = useMemo(
    () => [
      {
        title: isArabic
          ? "إيرادات المبيعات المكتملة"
          : "Completed Revenue",
        value: loading
          ? "—"
          : formatMoney(
              salesSummary.completedRevenue,
              numberLocale,
            ),
        description: isArabic
          ? "الإيرادات الناتجة عن المبيعات المكتملة"
          : "Revenue from completed sales",
        icon: CircleDollarSign,
        tone: "green" as const,
      },
      {
        title: isArabic
          ? "الوحدات المباعة"
          : "Units Sold",
        value: loading
          ? "—"
          : new Intl.NumberFormat(
              numberLocale,
            ).format(
              salesSummary.completedUnits,
            ),
        description: isArabic
          ? "إجمالي الوحدات في المبيعات المكتملة"
          : "Completed units sold",
        icon: PackageCheck,
        tone: "blue" as const,
      },
      {
        title: isArabic
          ? "المبيعات المكتملة"
          : "Completed Sales",
        value: loading
          ? "—"
          : new Intl.NumberFormat(
              numberLocale,
            ).format(
              salesSummary.completedSalesCount,
            ),
        description:
          getCompletedSalesDescription(
            salesSummary.completedSalesCount,
            isArabic,
          ),
        icon: ShoppingCart,
        tone: "green" as const,
      },
      {
        title: isArabic
          ? "المنتج الأعلى مبيعًا"
          : "Top Product",
        value: loading
          ? "—"
          : salesSummary.topProduct
            ? isArabic
              ? `${new Intl.NumberFormat(
                  numberLocale,
                ).format(
                  salesSummary.topProduct
                    .quantity,
                )} وحدة`
              : `${salesSummary.topProduct.quantity} units`
            : isArabic
              ? "لا توجد بيانات"
              : "No data",
        description:
          salesSummary.topProduct?.name ??
          (isArabic
            ? "لا توجد مبيعات مكتملة للمنتجات"
            : "No completed product sales"),
        icon: Trophy,
        tone: "amber" as const,
      },
    ],
    [
      isArabic,
      loading,
      numberLocale,
      salesSummary,
    ],
  );

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل بيانات المبيعات من الخادم."
      : loadError;

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={
            isArabic ? "المبيعات" : "Sales"
          }
          description={
            isArabic
              ? "راقب نشاط المبيعات والإيرادات المكتملة وأداء المنتجات."
              : "Monitor sales activity, completed revenue, and product performance."
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
                      ? "تعذر تحميل مؤشرات المبيعات"
                      : "Unable to load sales metrics"}
                  </p>

                  <p className="mt-1 text-sm">
                    {displayedLoadError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadSalesMetrics()
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
              {salesMetrics.map((metric) => (
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
              ))}
            </div>
          </section>

          <SalesTable />
        </main>
      </div>
    </div>
  );
}
