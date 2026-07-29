"use client";

import {
  Box,
  LoaderCircle,
  PackagePlus,
  Pencil,
} from "lucide-react";
import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  type CreateInventoryItemInput,
  type InventoryItem,
} from "@/lib/inventory";
import {
  compareMoney,
  formatMoney,
  isNonNegativeMoney,
  multiplyMoneyByInteger,
  normalizeMoney,
  subtractMoney,
} from "@/lib/money";

type InventoryFormProps = {
  onCancel: () => void;
  onSave: (
    item: CreateInventoryItemInput,
  ) => Promise<void> | void;
  initialItem?: InventoryItem | null;
  saving?: boolean;
  serverError?: string | null;
};

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-70";

export default function InventoryForm({
  onCancel,
  onSave,
  initialItem = null,
  saving = false,
  serverError = null,
}: InventoryFormProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [productName, setProductName] = useState(
    initialItem?.product_name ?? "",
  );

  const [sku, setSku] = useState(
    initialItem?.sku ?? "",
  );

  const [quantity, setQuantity] = useState(
    initialItem?.quantity ?? 0,
  );

  const [reorderLevel, setReorderLevel] =
    useState(
      initialItem?.reorder_level ?? 0,
    );

  const [costPrice, setCostPrice] = useState(
    initialItem?.cost_price ?? "0.00",
  );

  const [sellingPrice, setSellingPrice] =
    useState(
      initialItem?.selling_price ?? "0.00",
    );

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const isEditing = Boolean(initialItem);

  const calculatedValues = useMemo(() => {
    const safeQuantity =
      Number.isSafeInteger(quantity)
        ? Math.max(quantity, 0)
        : 0;

    const safeReorderLevel = Number.isFinite(
      reorderLevel,
    )
      ? Math.max(reorderLevel, 0)
      : 0;

    const safeCostPrice =
      isNonNegativeMoney(costPrice)
        ? normalizeMoney(costPrice)
        : "0.00";

    const safeSellingPrice =
      isNonNegativeMoney(sellingPrice)
        ? normalizeMoney(sellingPrice)
        : "0.00";

    const inventoryValue =
      multiplyMoneyByInteger(
        safeCostPrice,
        safeQuantity,
      );

    const potentialProfit =
      multiplyMoneyByInteger(
        subtractMoney(
          safeSellingPrice,
          safeCostPrice,
        ),
        safeQuantity,
      );

    let stockStatus = isArabic
      ? "متوفر في المخزون"
      : "In Stock";

    let stockStatusClass =
      "text-success bg-success-soft";

    if (safeQuantity === 0) {
      stockStatus = isArabic
        ? "نفد المخزون"
        : "Out of Stock";

      stockStatusClass =
        "text-danger bg-danger-soft";
    } else if (
      safeQuantity <= safeReorderLevel
    ) {
      stockStatus = isArabic
        ? "مخزون منخفض"
        : "Low Stock";

      stockStatusClass =
        "text-warning bg-warning-soft";
    }

    return {
      inventoryValue,
      potentialProfit,
      stockStatus,
      stockStatusClass,
    };
  }, [
    costPrice,
    isArabic,
    quantity,
    reorderLevel,
    sellingPrice,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setValidationError(null);

    const normalizedProductName =
      productName.trim();

    const normalizedSku = sku.trim();

    if (!normalizedProductName) {
      setValidationError(
        isArabic
          ? "اسم المنتج مطلوب."
          : "Product name is required.",
      );

      return;
    }

    if (!normalizedSku) {
      setValidationError(
        isArabic
          ? "رمز SKU مطلوب."
          : "SKU is required.",
      );

      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      setValidationError(
        isArabic
          ? "يجب أن تكون الكمية الحالية عددًا صحيحًا يساوي صفرًا أو أكثر."
          : "Current quantity must be a whole number of zero or more.",
      );

      return;
    }

    if (
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0
    ) {
      setValidationError(
        isArabic
          ? "يجب أن يكون مستوى إعادة الطلب عددًا صحيحًا يساوي صفرًا أو أكثر."
          : "Reorder level must be a whole number of zero or more.",
      );

      return;
    }

    if (!isNonNegativeMoney(costPrice)) {
      setValidationError(
        isArabic
          ? "يجب أن يكون سعر التكلفة صفرًا أو أكثر."
          : "Cost price must be zero or more.",
      );

      return;
    }

    if (!isNonNegativeMoney(sellingPrice)) {
      setValidationError(
        isArabic
          ? "يجب أن يكون سعر البيع صفرًا أو أكثر."
          : "Selling price must be zero or more.",
      );

      return;
    }

    await onSave({
      product_name: normalizedProductName,
      sku: normalizedSku,
      quantity,
      reorder_level: reorderLevel,
      cost_price: normalizeMoney(costPrice),
      selling_price:
        normalizeMoney(sellingPrice),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "اسم المنتج"
              : "Product name"}
          </span>

          <input
            type="text"
            value={productName}
            onChange={(event) =>
              setProductName(event.target.value)
            }
            required
            autoFocus
            disabled={saving}
            placeholder={
              isArabic
                ? "أدخل اسم المنتج"
                : "Enter product name"
            }
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic ? "رمز SKU" : "SKU"}
          </span>

          <input
            type="text"
            value={sku}
            onChange={(event) =>
              setSku(event.target.value)
            }
            required
            disabled={saving}
            placeholder={
              isArabic
                ? "مثال: SKU-1001"
                : "Example: SKU-1001"
            }
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "الكمية الحالية"
              : "Current quantity"}
          </span>

          <input
            type="number"
            value={quantity}
            onChange={(event) =>
              setQuantity(
                Number(event.target.value),
              )
            }
            required
            min={0}
            step={1}
            disabled={saving}
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "مستوى إعادة الطلب"
              : "Reorder level"}
          </span>

          <input
            type="number"
            value={reorderLevel}
            onChange={(event) =>
              setReorderLevel(
                Number(event.target.value),
              )
            }
            required
            min={0}
            step={1}
            disabled={saving}
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "سعر التكلفة"
              : "Cost price"}
          </span>

          <input
            type="number"
            value={costPrice}
            onChange={(event) =>
              setCostPrice(event.target.value)
            }
            required
            min={0}
            step="0.01"
            disabled={saving}
            placeholder="0.00"
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "سعر البيع"
              : "Selling price"}
          </span>

          <input
            type="number"
            value={sellingPrice}
            onChange={(event) =>
              setSellingPrice(
                event.target.value,
              )
            }
            required
            min={0}
            step="0.01"
            disabled={saving}
            placeholder="0.00"
            className={inputClasses}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-xs text-text-secondary">
            {isArabic
              ? "حالة المخزون"
              : "Stock status"}
          </p>

          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${calculatedValues.stockStatusClass}`}
          >
            {calculatedValues.stockStatus}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-xs text-text-secondary">
            {isArabic
              ? "قيمة المخزون"
              : "Inventory value"}
          </p>

          <p className="mt-2 font-semibold text-text-primary">
            {formatMoney(
              calculatedValues.inventoryValue,
              numberLocale,
            )}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-xs text-text-secondary">
            {isArabic
              ? "الربح المحتمل"
              : "Potential profit"}
          </p>

          <p
            className={`mt-2 font-semibold ${
              compareMoney(
                calculatedValues.potentialProfit,
                "0.00",
              ) < 0
                ? "text-danger"
                : "text-text-primary"
            }`}
          >
            {formatMoney(
              calculatedValues.potentialProfit,
              numberLocale,
            )}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-primary-soft px-4 py-3">
        <Box
          size={18}
          className="mt-0.5 shrink-0 text-primary"
        />

        <p className="text-sm leading-6 text-text-secondary">
          {isArabic
            ? "تُحسب حالة المخزون وقيمته والربح المحتمل تلقائيًا. ستُجلب العملة من إعدادات الشركة لاحقًا."
            : "Stock status, inventory value, and potential profit are calculated automatically. Currency will come from Company Settings later."}
        </p>
      </div>

      {validationError || serverError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {validationError || serverError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isArabic ? "إلغاء" : "Cancel"}
        </button>

        <button
          type="submit"
          disabled={saving}
          className="flex min-w-36 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <LoaderCircle
                size={18}
                className="animate-spin"
              />

              {isArabic
                ? "جارٍ الحفظ..."
                : "Saving..."}
            </>
          ) : isEditing ? (
            <>
              <Pencil size={17} />

              {isArabic
                ? "حفظ التعديلات"
                : "Save changes"}
            </>
          ) : (
            <>
              <PackagePlus size={18} />

              {isArabic
                ? "إضافة المنتج"
                : "Add product"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
