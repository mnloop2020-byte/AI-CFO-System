"use client";

import {
  LoaderCircle,
  Pencil,
  ReceiptText,
  Upload,
} from "lucide-react";
import {
  type FormEvent,
  useMemo,
  useState,
} from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { type Customer } from "@/lib/customers";
import {
  type CreateInvoiceInput,
  type Invoice,
} from "@/lib/invoices";

type InvoiceFormProps = {
  onCancel: () => void;
  onSave: (
    invoice: CreateInvoiceInput,
  ) => Promise<void> | void;
  customers?: Customer[];
  initialInvoice?: Invoice | null;
  saving?: boolean;
  serverError?: string | null;
};

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-70";

function getInitialDate(date: string | null) {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function formatAmount(
  amount: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatStatus(
  status: string,
  isArabic: boolean,
) {
  const normalizedStatus =
    status.trim().toLowerCase();

  if (isArabic) {
    switch (normalizedStatus) {
      case "paid":
        return "مدفوعة";

      case "unpaid":
        return "غير مدفوعة";

      case "overdue":
        return "متأخرة";

      case "cancelled":
        return "ملغاة";

      default:
        return status;
    }
  }

  if (!status) {
    return "";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1).toLowerCase()
  );
}

export default function InvoiceForm({
  onCancel,
  onSave,
  customers = [],
  initialInvoice = null,
  saving = false,
  serverError = null,
}: InvoiceFormProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [invoiceNumber, setInvoiceNumber] =
    useState(
      initialInvoice?.invoice_number ?? "",
    );

  const [customerId, setCustomerId] =
    useState(
      initialInvoice?.customer_id ?? "",
    );

  const [totalAmount, setTotalAmount] =
    useState(
      initialInvoice?.total_amount ?? 0,
    );

  const [vatAmount, setVatAmount] =
    useState(
      initialInvoice?.vat_amount ?? 0,
    );

  const [dueDate, setDueDate] = useState(
    getInitialDate(
      initialInvoice?.due_date ?? null,
    ),
  );

  const [status, setStatus] = useState(
    initialInvoice?.status?.toLowerCase() ??
      "unpaid",
  );

  const [selectedFileName, setSelectedFileName] =
    useState("");

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const isEditing = Boolean(initialInvoice);

  const calculations = useMemo(() => {
    const safeTotal = Number.isFinite(totalAmount)
      ? Math.max(totalAmount, 0)
      : 0;

    const safeVat = Number.isFinite(vatAmount)
      ? Math.max(vatAmount, 0)
      : 0;

    const vatPercentage =
      safeTotal > 0
        ? (safeVat / safeTotal) * 100
        : 0;

    const outstandingAmount =
      status === "paid" ? 0 : safeTotal;

    return {
      vatPercentage,
      outstandingAmount,
    };
  }, [status, totalAmount, vatAmount]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setValidationError(null);

    const normalizedInvoiceNumber =
      invoiceNumber.trim();

    if (!normalizedInvoiceNumber) {
      setValidationError(
        isArabic
          ? "رقم الفاتورة مطلوب."
          : "Invoice number is required.",
      );

      return;
    }

    if (
      !Number.isFinite(totalAmount) ||
      totalAmount < 0
    ) {
      setValidationError(
        isArabic
          ? "يجب أن يكون المبلغ الإجمالي صفرًا أو أكثر."
          : "Total amount must be zero or more.",
      );

      return;
    }

    if (
      !Number.isFinite(vatAmount) ||
      vatAmount < 0
    ) {
      setValidationError(
        isArabic
          ? "يجب أن يكون مبلغ الضريبة صفرًا أو أكثر."
          : "VAT amount must be zero or more.",
      );

      return;
    }

    if (vatAmount > totalAmount) {
      setValidationError(
        isArabic
          ? "لا يمكن أن يكون مبلغ الضريبة أكبر من إجمالي مبلغ الفاتورة."
          : "VAT amount cannot be greater than the total invoice amount.",
      );

      return;
    }

    await onSave({
      invoice_number: normalizedInvoiceNumber,
      customer_id: customerId || null,
      total_amount: totalAmount,
      vat_amount: vatAmount,
      status,
      due_date: dueDate
        ? new Date(
            `${dueDate}T00:00:00.000Z`,
          ).toISOString()
        : null,
      file_url:
        initialInvoice?.file_url ?? null,
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
              ? "رقم الفاتورة"
              : "Invoice number"}
          </span>

          <input
            type="text"
            value={invoiceNumber}
            onChange={(event) =>
              setInvoiceNumber(event.target.value)
            }
            required
            autoFocus
            disabled={saving}
            placeholder={
              isArabic
                ? "مثال: INV-0002"
                : "Example: INV-0002"
            }
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic ? "العميل" : "Customer"}
          </span>

          <select
            value={customerId}
            onChange={(event) =>
              setCustomerId(event.target.value)
            }
            disabled={saving}
            className={inputClasses}
          >
            <option value="">
              {isArabic
                ? "غير مرتبطة بعميل"
                : "Not linked"}
            </option>

            {customers.map((customer) => (
              <option
                key={customer.id}
                value={customer.id}
              >
                {customer.name}
                {customer.company_name
                  ? ` — ${customer.company_name}`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "المبلغ الإجمالي"
              : "Total amount"}
          </span>

          <input
            type="number"
            value={totalAmount}
            onChange={(event) =>
              setTotalAmount(
                Number(event.target.value),
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

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "ضريبة الفاتورة"
              : "Invoiced VAT"}
          </span>

          <input
            type="number"
            value={vatAmount}
            onChange={(event) =>
              setVatAmount(
                Number(event.target.value),
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

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "تاريخ الاستحقاق"
              : "Due date"}
          </span>

          <input
            type="date"
            value={dueDate}
            onChange={(event) =>
              setDueDate(event.target.value)
            }
            disabled={saving}
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "حالة الدفع"
              : "Payment status"}
          </span>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            disabled={saving}
            className={inputClasses}
          >
            <option value="unpaid">
              {isArabic
                ? "غير مدفوعة"
                : "Unpaid"}
            </option>

            <option value="paid">
              {isArabic ? "مدفوعة" : "Paid"}
            </option>

            <option value="overdue">
              {isArabic
                ? "متأخرة"
                : "Overdue"}
            </option>

            <option value="cancelled">
              {isArabic
                ? "ملغاة"
                : "Cancelled"}
            </option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-xs text-text-secondary">
            {isArabic
              ? "حالة الدفع"
              : "Payment status"}
          </p>

          <p className="mt-2 font-semibold text-text-primary">
            {formatStatus(status, isArabic)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-xs text-text-secondary">
            {isArabic
              ? "نسبة الضريبة"
              : "VAT percentage"}
          </p>

          <p className="mt-2 font-semibold text-text-primary">
            {formatAmount(
              calculations.vatPercentage,
              numberLocale,
            )}
            %
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <p className="text-xs text-text-secondary">
            {isArabic
              ? "المبلغ المستحق"
              : "Outstanding amount"}
          </p>

          <p className="mt-2 font-semibold text-text-primary">
            {formatAmount(
              calculations.outstandingAmount,
              numberLocale,
            )}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {isArabic
            ? "مستند الفاتورة"
            : "Invoice document"}
        </span>

        <label className="flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-soft px-4 py-3 transition-colors hover:border-primary">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Upload size={18} />
          </span>

          <span className="min-w-0">
            <span className="block text-sm font-medium text-text-primary">
              {selectedFileName ||
                (isArabic
                  ? "اختر مستند الفاتورة"
                  : "Choose invoice document")}
            </span>

            <span className="mt-1 block text-xs text-text-secondary">
              PDF, PNG, or JPG
            </span>
          </span>

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={saving}
            onChange={(event) => {
              const file =
                event.target.files?.[0];

              setSelectedFileName(
                file?.name ?? "",
              );
            }}
            className="sr-only"
          />
        </label>

        <p className="text-xs leading-5 text-text-secondary">
          {isArabic
            ? "لن يُرفع المستند المحدد حاليًا. سيتم ربط Supabase Storage في خطوة لاحقة."
            : "The selected document is not uploaded yet. Supabase Storage will be connected in a later step."}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-warning-soft px-4 py-3">
        <ReceiptText
          size={18}
          className="mt-0.5 shrink-0 text-warning"
        />

        <p className="text-sm leading-6 text-text-secondary">
          {isArabic
            ? "ضريبة الفاتورة ليست ضريبة القيمة المضافة النهائية المستحقة. لم يتم إعداد ضريبة المدخلات أو النطاق الضريبي للشركة بعد."
            : "Invoiced VAT is not the final VAT payable. Input VAT and the company's tax jurisdiction are not configured yet."}
        </p>
      </div>

      {initialInvoice?.file_url ? (
        <div className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-text-secondary">
          {isArabic
            ? "المستند الحالي: "
            : "Existing document: "}

          <a
            href={initialInvoice.file_url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {isArabic
              ? "فتح المستند"
              : "Open document"}
          </a>
        </div>
      ) : null}

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
              <ReceiptText size={18} />

              {isArabic
                ? "إنشاء الفاتورة"
                : "Create invoice"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
