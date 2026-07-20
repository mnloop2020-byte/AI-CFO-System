"use client";

import {
  Coins,
  Package,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import InventoryTable from "@/components/crm/InventoryTable";
import DashboardWidget from "@/components/dashboard/DashboardWidget";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  getInventoryItems,
  type InventoryItem,
} from "@/lib/inventory";

const UNKNOWN_LOAD_ERROR =
  "Unable to load inventory metrics.";

function formatAmount(
  amount: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(
  value: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale).format(
    value,
  );
}

function getProductCountDescription(
  count: number,
  isArabic: boolean,
  locale: string,
) {
  if (!isArabic) {
    return `${count} ${
      count === 1
        ? "recorded product"
        : "recorded products"
    }`;
  }

  if (count === 0) {
    return "لا توجد منتجات مسجلة";
  }

  if (count === 1) {
    return "منتج مسجل واحد";
  }

  if (count === 2) {
    return "منتجان مسجلان";
  }

  return `${formatNumber(
    count,
    locale,
  )} منتجات مسجلة`;
}

export default function InventoryPage() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [items, setItems] = useState<
    InventoryItem[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const loadInventoryMetrics =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response =
          await getInventoryItems();

        setItems(response);
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
    void loadInventoryMetrics();
  }, [loadInventoryMetrics]);

  const inventorySummary = useMemo(() => {
    const totalUnits = items.reduce(
      (total, item) =>
        total + Number(item.quantity),
      0,
    );

    const lowStockItems = items.filter(
      (item) =>
        Number(item.quantity) <=
        Number(item.reorder_level),
    );

    const inventoryCostValue =
      items.reduce(
        (total, item) =>
          total +
          Number(item.quantity) *
            Number(item.cost_price),
        0,
      );

    const potentialGrossProfit =
      items.reduce(
        (total, item) =>
          total +
          Number(item.quantity) *
            (Number(item.selling_price) -
              Number(item.cost_price)),
        0,
      );

    return {
      totalUnits,
      lowStockCount: lowStockItems.length,
      inventoryCostValue,
      potentialGrossProfit,
      productCount: items.length,
    };
  }, [items]);

  const inventoryMetrics = useMemo(
    () => [
      {
        title: isArabic
          ? "إجمالي الوحدات"
          : "Total Units",
        value: loading
          ? "—"
          : formatNumber(
              inventorySummary.totalUnits,
              numberLocale,
            ),
        description:
          getProductCountDescription(
            inventorySummary.productCount,
            isArabic,
            numberLocale,
          ),
        icon: Package,
        tone: "blue" as const,
      },
      {
        title: isArabic
          ? "أصناف منخفضة المخزون"
          : "Low Stock Items",
        value: loading
          ? "—"
          : formatNumber(
              inventorySummary.lowStockCount,
              numberLocale,
            ),
        description:
          inventorySummary.lowStockCount > 0
            ? isArabic
              ? "الكمية عند مستوى إعادة الطلب أو أدنى منه"
              : "Quantity is at or below reorder level"
            : isArabic
              ? "جميع المنتجات أعلى من مستوى إعادة الطلب"
              : "All products are above reorder level",
        icon: TriangleAlert,
        tone:
          inventorySummary.lowStockCount > 0
            ? ("amber" as const)
            : ("green" as const),
      },
      {
        title: isArabic
          ? "قيمة تكلفة المخزون"
          : "Inventory Cost Value",
        value: loading
          ? "—"
          : formatAmount(
              inventorySummary.inventoryCostValue,
              numberLocale,
            ),
        description: isArabic
          ? "الكمية مضروبة في سعر التكلفة"
          : "Quantity multiplied by cost price",
        icon: Coins,
        tone: "blue" as const,
      },
      {
        title: isArabic
          ? "إجمالي الربح المحتمل"
          : "Potential Gross Profit",
        value: loading
          ? "—"
          : formatAmount(
              inventorySummary.potentialGrossProfit,
              numberLocale,
            ),
        description: isArabic
          ? "قيمة البيع مطروحًا منها قيمة التكلفة"
          : "Selling value minus cost value",
        icon: TrendingUp,
        tone:
          inventorySummary.potentialGrossProfit <
          0
            ? ("red" as const)
            : ("green" as const),
      },
    ],
    [
      inventorySummary,
      isArabic,
      loading,
      numberLocale,
    ],
  );

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل مؤشرات المخزون."
      : loadError;

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={
            isArabic ? "المخزون" : "Inventory"
          }
          description={
            isArabic
              ? "راقب كميات المخزون ومستويات إعادة الطلب وقيمة المخزون."
              : "Monitor stock quantities, reorder levels, and inventory value."
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
                      ? "تعذر تحميل مؤشرات المخزون"
                      : "Unable to load inventory metrics"}
                  </p>

                  <p className="mt-1 text-sm">
                    {displayedLoadError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadInventoryMetrics()
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
              {inventoryMetrics.map(
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

          <InventoryTable />
        </main>
      </div>
    </div>
  );
}
