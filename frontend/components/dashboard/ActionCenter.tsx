"use client";

import {
  ChevronRight,
  PackageSearch,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

import { useLanguage } from "@/components/providers/LanguageProvider";

type ActionCenterProps = {
  lowStockQuantity: number;
  reorderLevel: number;
  flaggedExpenseAmount: number;
  invoicedVat: number;
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

export default function ActionCenter({
  lowStockQuantity,
  reorderLevel,
  flaggedExpenseAmount,
  invoicedVat,
}: ActionCenterProps) {
  const { language } = useLanguage();

  const hasLowStock =
    reorderLevel > 0 &&
    lowStockQuantity <= reorderLevel;

  const actionItems = [
    {
      title:
        language === "ar"
          ? "انخفاض مستوى المخزون"
          : "Low inventory level",

      description: hasLowStock
        ? language === "ar"
          ? `${lowStockQuantity} وحدات متاحة، وهي أقل من مستوى إعادة الطلب البالغ ${reorderLevel}.`
          : `${lowStockQuantity} units available, below the reorder level of ${reorderLevel}.`
        : language === "ar"
          ? "لا توجد حاليًا سجلات مخزون منخفضة."
          : "No low-stock records currently require attention.",

      status:
        hasLowStock
          ? language === "ar"
            ? "انتباه"
            : "Attention"
          : language === "ar"
            ? "مستقر"
            : "Stable",

      href: "/crm/inventory",
      icon: PackageSearch,

      iconStyle: hasLowStock
        ? "bg-warning-soft text-warning"
        : "bg-success-soft text-success",

      statusStyle: hasLowStock
        ? "bg-warning-soft text-warning"
        : "bg-success-soft text-success",
    },

    {
      title:
        language === "ar"
          ? "مصروف محدد للمراجعة"
          : "Flagged expense for review",

      description:
        flaggedExpenseAmount > 0
          ? language === "ar"
            ? `${formatAmount(
                flaggedExpenseAmount,
                language,
              )} محددة للمراجعة. هذا لا يؤكد وجود احتيال.`
            : `${formatAmount(
                flaggedExpenseAmount,
                language,
              )} is marked for review. This does not confirm fraud.`
          : language === "ar"
            ? "لا توجد مصروفات محددة للمراجعة حاليًا."
            : "No expenses are currently flagged for review.",

      status:
        flaggedExpenseAmount > 0
          ? language === "ar"
            ? "مراجعة"
            : "Review"
          : language === "ar"
            ? "واضح"
            : "Clear",

      href: "/crm/expenses",
      icon: ShieldAlert,

      iconStyle:
        flaggedExpenseAmount > 0
          ? "bg-danger-soft text-danger"
          : "bg-success-soft text-success",

      statusStyle:
        flaggedExpenseAmount > 0
          ? "bg-danger-soft text-danger"
          : "bg-success-soft text-success",
    },

    {
      title:
        language === "ar"
          ? "ضريبة القيمة المضافة المسجلة في الفواتير"
          : "Invoiced VAT recorded",

      description:
        language === "ar"
          ? `${formatAmount(
              invoicedVat,
              language,
            )} هي ضريبة مسجلة في الفواتير، وليست الضريبة النهائية المستحقة.`
          : `${formatAmount(
              invoicedVat,
              language,
            )} is invoiced VAT, not the final VAT payable.`,

      status:
        language === "ar"
          ? "معلومة"
          : "Information",

      href: "/crm/invoices",
      icon: ReceiptText,

      iconStyle:
        "bg-primary-soft text-primary",

      statusStyle:
        "bg-primary-soft text-primary",
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-text-secondary">
          {language === "ar"
            ? "مركز الإجراءات"
            : "Action center"}
        </p>

        <h2 className="mt-1 text-lg font-semibold text-text-primary">
          {language === "ar"
            ? "العناصر التي تحتاج إلى الانتباه"
            : "Items requiring attention"}
        </h2>
      </div>

      <div className="mt-4 divide-y divide-border">
        {actionItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-start gap-4 py-4 first:pt-2 last:pb-0"
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.iconStyle}`}
              >
                <Icon
                  size={19}
                  strokeWidth={1.8}
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {item.title}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.statusStyle}`}
                  >
                    {item.status}
                  </span>
                </span>

                <span className="mt-1 block text-sm leading-6 text-text-secondary">
                  {item.description}
                </span>
              </span>

              <ChevronRight
                size={18}
                className={`mt-2 shrink-0 text-text-secondary transition-transform group-hover:translate-x-1 ${
                  language === "ar"
                    ? "rotate-180 group-hover:-translate-x-1"
                    : ""
                }`}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}