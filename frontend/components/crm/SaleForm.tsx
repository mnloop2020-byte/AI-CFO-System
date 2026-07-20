"use client";

import {
  type FormEvent,
  useState,
} from "react";
import {
  LoaderCircle,
  Pencil,
  ShoppingCart,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Customer } from "@/lib/customers";
import type {
  CreateSaleInput,
  Sale,
} from "@/lib/sales";

type SaleFormProps = {
  onCancel: () => void;
  onSave: (
    sale: CreateSaleInput,
  ) => Promise<void> | void;
  customers?: Customer[];
  initialSale?: Sale | null;
  saving?: boolean;
  serverError?: string | null;
};

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-text-secondary";

function getInitialDate(sale: Sale | null) {
  if (sale?.sale_date) {
    return sale.sale_date.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function getInitialStatus(sale: Sale | null) {
  const normalizedStatus = sale?.status
    ?.trim()
    .toLowerCase();

  switch (normalizedStatus) {
    case "completed":
      return "Completed";

    case "pending":
      return "Pending";

    case "refunded":
      return "Refunded";

    case "cancelled":
      return "Cancelled";

    default:
      return sale?.status ?? "Completed";
  }
}

function formatAmount(
  value: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function SaleForm({
  onCancel,
  onSave,
  customers = [],
  initialSale = null,
  saving = false,
  serverError,
}: SaleFormProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const isEditing = initialSale !== null;

  const [productName, setProductName] =
    useState(
      initialSale?.product_name ?? "",
    );

  const [customerId, setCustomerId] =
    useState(
      initialSale?.customer_id ?? "",
    );

  const [saleDate, setSaleDate] = useState(
    getInitialDate(initialSale),
  );

  const [quantity, setQuantity] = useState(
    initialSale?.quantity ?? 1,
  );

  const [unitPrice, setUnitPrice] = useState(
    initialSale?.unit_price ?? 0,
  );

  const [status, setStatus] = useState(
    getInitialStatus(initialSale),
  );

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const calculatedTotal =
    Math.max(0, quantity) *
    Math.max(0, unitPrice);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setValidationError(null);

    const normalizedProductName =
      productName.trim();

    if (!normalizedProductName) {
      setValidationError(
        isArabic
          ? "اسم المنتج أو عملية البيع مطلوب."
          : "Product or sale name is required.",
      );

      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      setValidationError(
        isArabic
          ? "يجب أن تكون الكمية عددًا صحيحًا أكبر من صفر."
          : "Quantity must be a whole number greater than zero.",
      );

      return;
    }

    if (
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      setValidationError(
        isArabic
          ? "يجب أن يكون سعر الوحدة صفرًا أو أكبر."
          : "Unit price must be zero or greater.",
      );

      return;
    }

    await onSave({
      product_name: normalizedProductName,
      customer_id: customerId || null,
      quantity,
      unit_price: unitPrice,
      status,
      sale_date: saleDate
        ? `${saleDate}T00:00:00.000Z`
        : null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {isArabic
            ? "اسم المنتج أو عملية البيع"
            : "Sale or product name"}
        </span>

        <input
          type="text"
          required
          value={productName}
          onChange={(event) =>
            setProductName(
              event.target.value,
            )
          }
          disabled={saving}
          placeholder={
            isArabic
              ? "أدخل اسم المنتج أو عملية البيع"
              : "Enter sale or product name"
          }
          className={inputClasses}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "العميل"
              : "Customer"}
          </span>

          <select
            value={customerId}
            onChange={(event) =>
              setCustomerId(
                event.target.value,
              )
            }
            disabled={saving}
            className={inputClasses}
          >
            <option value="">
              {isArabic
                ? "غير مرتبط بعميل"
                : "Not linked"}
            </option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "تاريخ البيع"
              : "Sale date"}
          </span>

          <input
            type="date"
            value={saleDate}
            onChange={(event) =>
              setSaleDate(
                event.target.value,
              )
            }
            disabled={saving}
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "الكمية"
              : "Quantity"}
          </span>

          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={(event) =>
              setQuantity(
                Number(event.target.value),
              )
            }
            disabled={saving}
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "سعر الوحدة"
              : "Unit price"}
          </span>

          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={unitPrice}
            onChange={(event) =>
              setUnitPrice(
                Number(event.target.value),
              )
            }
            disabled={saving}
            placeholder="0.00"
            className={inputClasses}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {isArabic
            ? "حالة المبيعة"
            : "Sale status"}
        </span>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          disabled={saving}
          className={inputClasses}
        >
          <option value="Completed">
            {isArabic
              ? "مكتملة"
              : "Completed"}
          </option>

          <option value="Pending">
            {isArabic
              ? "قيد الانتظار"
              : "Pending"}
          </option>

          <option value="Refunded">
            {isArabic
              ? "مُستردة"
              : "Refunded"}
          </option>

          <option value="Cancelled">
            {isArabic
              ? "ملغاة"
              : "Cancelled"}
          </option>
        </select>
      </label>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-primary-soft px-4 py-4">
        <div>
          <p className="text-sm text-text-secondary">
            {isArabic
              ? "الإجمالي المحسوب"
              : "Calculated total"}
          </p>

          <p className="mt-1 text-xl font-semibold text-text-primary">
            {formatAmount(
              calculatedTotal,
              numberLocale,
            )}
          </p>
        </div>

        <span className="text-xs text-text-secondary">
          {isArabic
            ? "لم يتم إعداد العملة"
            : "Currency not configured"}
        </span>
      </div>

      {validationError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {validationError}
        </div>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {serverError}
        </div>
      ) : null}

      <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3 text-sm leading-6 text-text-secondary">
        {isArabic
          ? "سيحسب الخادم الإجمالي النهائي ويتحقق منه باستخدام الكمية وسعر الوحدة قبل حفظ المبيعة."
          : "The backend will calculate and verify the final total from quantity and unit price before storing the sale."}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-11 rounded-xl border border-border bg-surface px-5 text-sm font-medium text-text-primary transition hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isArabic ? "إلغاء" : "Cancel"}
        </button>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
          ) : isEditing ? (
            <Pencil size={18} />
          ) : (
            <ShoppingCart size={18} />
          )}

          {saving
            ? isEditing
              ? isArabic
                ? "جارٍ حفظ التعديلات..."
                : "Saving changes..."
              : isArabic
                ? "جارٍ تسجيل المبيعة..."
                : "Recording sale..."
            : isEditing
              ? isArabic
                ? "حفظ التعديلات"
                : "Save changes"
              : isArabic
                ? "تسجيل المبيعة"
                : "Record sale"}
        </button>
      </div>
    </form>
  );
}