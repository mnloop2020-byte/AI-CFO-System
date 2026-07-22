"use client";

import {
  type FormEvent,
  useState,
} from "react";
import {
  LoaderCircle,
  Pencil,
  ReceiptText,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import FinancialAttachments from "@/components/crm/FinancialAttachments";
import type {
  CreateExpenseInput,
  Expense,
} from "@/lib/expenses";

type ExpenseFormProps = {
  onCancel: () => void;
  onSave: (
    expense: CreateExpenseInput,
    attachment?: File,
  ) => Promise<void> | void;
  initialExpense?: Expense | null;
  saving?: boolean;
  serverError?: string | null;
};

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-text-secondary";

function getInitialDate(
  expense: Expense | null,
) {
  if (expense?.expense_date) {
    return expense.expense_date.slice(
      0,
      10,
    );
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
}

export default function ExpenseForm({
  onCancel,
  onSave,
  initialExpense = null,
  saving = false,
  serverError,
}: ExpenseFormProps) {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const isEditing =
    initialExpense !== null;

  const [amount, setAmount] = useState(
    initialExpense?.amount ?? 0,
  );

  const [expenseDate, setExpenseDate] =
    useState(
      getInitialDate(initialExpense),
    );

  const [category, setCategory] = useState(
    initialExpense?.category ?? "",
  );

  const [vendor, setVendor] = useState(
    initialExpense?.vendor ?? "",
  );

  const [isFlagged, setIsFlagged] =
    useState(
      initialExpense?.is_flagged ?? false,
    );

  const [description, setDescription] =
    useState(
      initialExpense?.description ?? "",
    );

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [
    validationError,
    setValidationError,
  ] = useState<string | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setValidationError(null);

    const normalizedCategory =
      category.trim();

    const normalizedVendor =
      vendor.trim();

    const normalizedDescription =
      description.trim();

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setValidationError(
        isArabic
          ? "يجب أن يكون مبلغ المصروف أكبر من صفر."
          : "Expense amount must be greater than zero.",
      );

      return;
    }

    if (!normalizedCategory) {
      setValidationError(
        isArabic
          ? "فئة المصروف مطلوبة."
          : "Expense category is required.",
      );

      return;
    }

    await onSave({
      amount,
      category: normalizedCategory,
      vendor: normalizedVendor || null,
      description:
        normalizedDescription || null,
      expense_date: expenseDate
        ? `${expenseDate}T00:00:00.000Z`
        : null,
      is_flagged: isFlagged,
    }, selectedFile ?? undefined);
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
              ? "المبلغ"
              : "Amount"}
          </span>

          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(event) =>
              setAmount(
                Number(event.target.value),
              )
            }
            disabled={saving}
            placeholder="0.00"
            className={inputClasses}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "تاريخ المصروف"
              : "Expense date"}
          </span>

          <input
            type="date"
            value={expenseDate}
            onChange={(event) =>
              setExpenseDate(
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
              ? "الفئة"
              : "Category"}
          </span>

          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value,
              )
            }
            disabled={saving}
            required
            className={inputClasses}
          >
            <option value="">
              {isArabic
                ? "اختر الفئة"
                : "Select category"}
            </option>

            <option value="Office">
              {isArabic
                ? "مكتب"
                : "Office"}
            </option>

            <option value="Consulting">
              {isArabic
                ? "استشارات"
                : "Consulting"}
            </option>

            <option value="Utilities">
              {isArabic
                ? "خدمات عامة"
                : "Utilities"}
            </option>

            <option value="Software">
              {isArabic
                ? "برمجيات"
                : "Software"}
            </option>

            <option value="Marketing">
              {isArabic
                ? "تسويق"
                : "Marketing"}
            </option>

            <option value="Travel">
              {isArabic
                ? "سفر"
                : "Travel"}
            </option>

            <option value="Payroll">
              {isArabic
                ? "رواتب"
                : "Payroll"}
            </option>

            <option value="Inventory">
              {isArabic
                ? "مخزون"
                : "Inventory"}
            </option>

            <option value="Other">
              {isArabic
                ? "أخرى"
                : "Other"}
            </option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {isArabic
              ? "المورّد"
              : "Vendor"}
          </span>

          <input
            type="text"
            value={vendor}
            onChange={(event) =>
              setVendor(event.target.value)
            }
            disabled={saving}
            placeholder={
              isArabic
                ? "اسم المورّد أو مقدم الخدمة"
                : "Vendor or supplier name"
            }
            className={inputClasses}
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {isArabic
            ? "حالة المراجعة"
            : "Review status"}
        </span>

        <select
          value={
            isFlagged ? "review" : "clear"
          }
          onChange={(event) =>
            setIsFlagged(
              event.target.value ===
                "review",
            )
          }
          disabled={saving}
          className={inputClasses}
        >
          <option value="clear">
            {isArabic
              ? "لا يحتاج مراجعة"
              : "Clear"}
          </option>

          <option value="review">
            {isArabic
              ? "تعليمه للمراجعة البشرية"
              : "Flag for human review"}
          </option>
        </select>

        <span className="block text-xs leading-5 text-text-secondary">
          {isArabic
            ? "تعليم المصروف يطلب مراجعة بشرية ولا يؤكد وجود احتيال."
            : "Flagging an expense requests human review and does not confirm fraud."}
        </span>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {isArabic
            ? "الوصف"
            : "Description"}
        </span>

        <textarea
          rows={4}
          value={description}
          onChange={(event) =>
            setDescription(
              event.target.value,
            )
          }
          disabled={saving}
          placeholder={
            isArabic
              ? "اشرح الغرض التجاري من هذا المصروف..."
              : "Describe the business purpose of this expense..."
          }
          className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {isArabic
            ? "الإيصال أو المستند الداعم"
            : "Receipt or supporting document"}
        </span>

        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          disabled={saving}
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-dashed border-border bg-surface-soft px-4 py-4 text-sm text-text-secondary file:me-4 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
        />

        <span className="block text-xs leading-5 text-text-secondary">
          {isArabic
            ? "سيُفحص الملف ثم يُرفع إلى مساحة تخزين خاصة بعد حفظ المصروف. الحد الأقصى 5 ميجابايت."
            : "The file will be validated and uploaded to private storage after the expense is saved. Maximum 5 MB."}
        </span>
      </label>

      {initialExpense ? (
        <FinancialAttachments recordType="expense" recordId={initialExpense.id} />
      ) : null}

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

      <div className="rounded-xl border border-amber-100 bg-warning-soft px-4 py-3 text-sm leading-6 text-text-secondary">
        {isArabic
          ? "ستُحفظ بيانات المصروف والمرفق الخاص في FastAPI وSupabase. حذف المرفق لا يحذف سجل المصروف."
          : "The expense and its private attachment are stored through FastAPI and Supabase. Deleting the file does not delete the expense record."}
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
            <ReceiptText size={18} />
          )}

          {saving
            ? isEditing
              ? isArabic
                ? "جارٍ حفظ التعديلات..."
                : "Saving changes..."
              : isArabic
                ? "جارٍ تسجيل المصروف..."
                : "Recording expense..."
            : isEditing
              ? isArabic
                ? "حفظ التعديلات"
                : "Save changes"
              : isArabic
                ? "تسجيل المصروف"
                : "Record expense"}
        </button>
      </div>
    </form>
  );
}
