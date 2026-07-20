"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  WalletCards,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";

type CashFlowCardProps = {
  trackedInflows: number;
  recordedOutflows: number;
  expectedInflows: number;
  netCashFlow: number;
};

function formatAmount(
  amount: number,
  language: "en" | "ar",
) {
  const locale =
    language === "ar"
      ? "ar-SA-u-nu-latn"
      : "en-US";

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function calculateBarWidth(
  value: number,
  maximumValue: number,
) {
  if (value <= 0 || maximumValue <= 0) {
    return 0;
  }

  return Math.max(
    4,
    Math.min(
      100,
      (value / maximumValue) * 100,
    ),
  );
}

export default function CashFlowCard({
  trackedInflows,
  recordedOutflows,
  expectedInflows,
  netCashFlow,
}: CashFlowCardProps) {
  const { language } = useLanguage();

  const maximumValue = Math.max(
    Math.abs(trackedInflows),
    Math.abs(recordedOutflows),
    Math.abs(expectedInflows),
    1,
  );

  const cashFlowRows = [
    {
      label:
        language === "ar"
          ? "التدفقات النقدية الداخلة المسجلة"
          : "Tracked cash inflows",

      value: trackedInflows,
      icon: ArrowDownLeft,
      iconStyle:
        "bg-success-soft text-success",
      barStyle: "bg-success",
    },
    {
      label:
        language === "ar"
          ? "التدفقات النقدية الخارجة المسجلة"
          : "Recorded cash outflows",

      value: recordedOutflows,
      icon: ArrowUpRight,
      iconStyle:
        "bg-warning-soft text-warning",
      barStyle: "bg-warning",
    },
    {
      label:
        language === "ar"
          ? "التدفقات المتوقعة غير المدفوعة"
          : "Expected unpaid inflows",

      value: expectedInflows,
      icon: Clock3,
      iconStyle:
        "bg-primary-soft text-primary",
      barStyle: "bg-primary",
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-text-secondary">
            {language === "ar"
              ? "نظرة عامة على التدفق النقدي"
              : "Cash flow overview"}
          </p>

          <h2 className="mt-1 text-lg font-semibold text-text-primary">
            {language === "ar"
              ? "الحركة المالية المسجلة"
              : "Tracked financial movement"}
          </h2>
        </div>

        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
            netCashFlow < 0
              ? "bg-danger-soft"
              : "bg-success-soft"
          }`}
        >
          <span
            className={`flex size-9 items-center justify-center rounded-lg bg-surface ${
              netCashFlow < 0
                ? "text-danger"
                : "text-success"
            }`}
          >
            <WalletCards size={18} />
          </span>

          <div>
            <p className="text-xs text-text-secondary">
              {language === "ar"
                ? "صافي التدفق النقدي المسجل"
                : "Net tracked cash flow"}
            </p>

            <p
              dir="ltr"
              className={`mt-0.5 text-sm font-semibold ${
                netCashFlow < 0
                  ? "text-danger"
                  : "text-success"
              }`}
            >
              {formatAmount(
                netCashFlow,
                language,
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7 space-y-6">
        {cashFlowRows.map((row) => {
          const Icon = row.icon;

          const barWidth = calculateBarWidth(
            Math.abs(row.value),
            maximumValue,
          );

          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${row.iconStyle}`}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.8}
                    />
                  </span>

                  <span className="truncate text-sm font-medium text-text-primary">
                    {row.label}
                  </span>
                </div>

                <span
                  dir="ltr"
                  className="shrink-0 text-sm font-semibold text-text-primary"
                >
                  {formatAmount(
                    row.value,
                    language,
                  )}
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${row.barStyle}`}
                  style={{
                    width: `${barWidth}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs leading-5 text-text-secondary">
        {language === "ar"
          ? "رصيد البنك غير مهيأ حاليًا. تمثل هذه القيم السجلات المالية التي يتتبعها النظام فقط."
          : "Bank balance is not configured. These values represent only the financial records currently tracked by the system."}
      </p>
    </section>
  );
}