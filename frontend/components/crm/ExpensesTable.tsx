"use client";

import {
  CheckCircle2,
  CircleAlert,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldAlert,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ExpenseForm from "@/components/crm/ExpenseForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import Modal from "@/components/ui/Modal";
import { uploadAttachment } from "@/lib/attachments";
import { notifyDataChanged } from "@/lib/data-events";
import {
  createExpense,
  deleteExpense,
  getExpenses,
  updateExpense,
  type CreateExpenseInput,
  type Expense,
} from "@/lib/expenses";

type ReviewFilter =
  | "all"
  | "clear"
  | "review";

const UNKNOWN_LOAD_ERROR =
  "Unable to load expense records.";

function formatAmount(
  amount: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(
  date: string | null,
  locale: string,
  unavailableLabel: string,
) {
  if (!date) {
    return unavailableLabel;
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return unavailableLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function getExpenseCode(expenseId: string) {
  return `EXP-${expenseId
    .slice(0, 8)
    .toUpperCase()}`;
}

export default function ExpensesTable() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [expenses, setExpenses] = useState<
    Expense[]
  >([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [reviewFilter, setReviewFilter] =
    useState<ReviewFilter>("all");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [
    deletingExpenseId,
    setDeletingExpenseId,
  ] = useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadExpenses =
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
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return expenses.filter((expense) => {
      const matchesSearch =
        !normalizedSearch ||
        expense.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        expense.category
          .toLowerCase()
          .includes(normalizedSearch) ||
        (expense.vendor ?? "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (expense.description ?? "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesReviewFilter =
        reviewFilter === "all" ||
        (reviewFilter === "review" &&
          expense.is_flagged) ||
        (reviewFilter === "clear" &&
          !expense.is_flagged);

      return (
        matchesSearch &&
        matchesReviewFilter
      );
    });
  }, [
    expenses,
    reviewFilter,
    searchTerm,
  ]);

  function openCreateModal() {
    setEditingExpense(null);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingExpense(null);
    setSaveError(null);
  }

  async function handleSaveExpense(
    expenseInput: CreateExpenseInput,
    attachment?: File,
  ) {
    setSaving(true);
    setSaveError(null);
    setActionError(null);

    try {
      let savedExpense: Expense;

      if (editingExpense) {
        const updatedExpense =
          await updateExpense(
            editingExpense.id,
            expenseInput,
          );

        setExpenses((currentExpenses) =>
          currentExpenses.map(
            (currentExpense) =>
              currentExpense.id ===
              updatedExpense.id
                ? updatedExpense
                : currentExpense,
          ),
        );

        savedExpense = updatedExpense;

        setSuccessMessage(
          isArabic
            ? "تم تحديث سجل المصروف بنجاح."
            : "Expense record updated successfully.",
        );
      } else {
        const createdExpense =
          await createExpense(expenseInput);

        setExpenses((currentExpenses) => [
          createdExpense,
          ...currentExpenses,
        ]);

        savedExpense = createdExpense;

        setSuccessMessage(
          isArabic
            ? "تم إنشاء سجل المصروف بنجاح."
            : "Expense record created successfully.",
        );
      }

      notifyDataChanged(
        "expenses",
        editingExpense ? "update" : "create",
      );

      if (attachment) {
        try {
          await uploadAttachment("expense", savedExpense.id, attachment);
        } catch (uploadError) {
          setActionError(
            uploadError instanceof Error
              ? uploadError.message
              : isArabic
                ? "تم حفظ المصروف، لكن تعذر رفع المرفق."
                : "The expense was saved, but its attachment could not be uploaded.",
          );
        }
      }

      setModalOpen(false);
      setEditingExpense(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حفظ سجل المصروف."
            : "Unable to save the expense record.";

      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(
    expense: Expense,
  ) {
    const expenseCode = getExpenseCode(
      expense.id,
    );

    const confirmed = window.confirm(
      isArabic
        ? `هل تريد حذف ${expenseCode}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete ${expenseCode}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingExpenseId(expense.id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deleteExpense(expense.id);

      setExpenses((currentExpenses) =>
        currentExpenses.filter(
          (currentExpense) =>
            currentExpense.id !==
            expense.id,
        ),
      );

      notifyDataChanged("expenses", "delete");

      setSuccessMessage(
        isArabic
          ? "تم حذف سجل المصروف بنجاح."
          : "Expense record deleted successfully.",
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حذف سجل المصروف."
            : "Unable to delete the expense record.";

      setActionError(message);
    } finally {
      setDeletingExpenseId(null);
    }
  }

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل سجلات المصروفات."
      : loadError;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {isArabic
                  ? "سجلات المصروفات"
                  : "Expense records"}
              </h2>

              <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                {isArabic
                  ? "بيانات مباشرة من الخادم"
                  : "Live backend data"}
              </span>
            </div>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "تابع المصروفات وحدد السجلات التي تحتاج إلى مراجعة."
                : "Track expenses and identify records requiring review."}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <Plus size={18} />

            {isArabic
              ? "تسجيل مصروف"
              : "Record expense"}
          </button>
        </div>

        {successMessage ? (
          <div className="flex items-start gap-3 border-b border-green-100 bg-success-soft px-5 py-3 text-sm text-success">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>{successMessage}</span>
          </div>
        ) : null}

        {actionError ? (
          <div className="flex items-start gap-3 border-b border-red-100 bg-danger-soft px-5 py-3 text-sm text-danger">
            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>{actionError}</span>
          </div>
        ) : null}

        {loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-danger-soft px-5 py-3">
            <div className="flex items-start gap-3 text-sm text-danger">
              <WifiOff
                size={18}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-medium">
                  {isArabic
                    ? "تعذر الاتصال ببيانات المصروفات"
                    : "Unable to connect to expense data"}
                </p>

                <p className="mt-0.5 text-xs">
                  {displayedLoadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadExpenses()
              }
              className="rounded-xl border border-danger px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
            >
              {isArabic
                ? "إعادة المحاولة"
                : "Try again"}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <label className="flex h-11 min-w-64 flex-1 items-center gap-2 rounded-xl border border-border bg-app-background px-3 transition-colors focus-within:border-primary">
            <Search
              size={17}
              className="shrink-0 text-text-secondary"
            />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value,
                )
              }
              placeholder={
                isArabic
                  ? "البحث في المصروفات..."
                  : "Search expenses..."
              }
              aria-label={
                isArabic
                  ? "البحث في المصروفات"
                  : "Search expenses"
              }
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </label>

          <select
            value={reviewFilter}
            onChange={(event) =>
              setReviewFilter(
                event.target
                  .value as ReviewFilter,
              )
            }
            aria-label={
              isArabic
                ? "تصفية المصروفات حسب حالة المراجعة"
                : "Filter expenses by review status"
            }
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          >
            <option value="all">
              {isArabic
                ? "جميع السجلات"
                : "All records"}
            </option>

            <option value="clear">
              {isArabic
                ? "لا تحتاج مراجعة"
                : "Clear"}
            </option>

            <option value="review">
              {isArabic
                ? "تتطلب مراجعة"
                : "Requires review"}
            </option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table
            className={`w-full min-w-[1050px] border-collapse ${
              isArabic
                ? "text-right"
                : "text-left"
            }`}
          >
            <thead className="bg-surface-soft">
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">
                  {isArabic
                    ? "المصروف"
                    : "Expense"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "الفئة"
                    : "Category"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "المورّد"
                    : "Vendor"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "المبلغ"
                    : "Amount"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "تاريخ المصروف"
                    : "Expense date"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "حالة المراجعة"
                    : "Review status"}
                </th>

                <th className="px-5 py-3 text-right">
                  {isArabic
                    ? "الإجراءات"
                    : "Actions"}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-border border-t-primary" />

                    <p className="mt-3 text-sm text-text-secondary">
                      {isArabic
                        ? "جارٍ تحميل سجلات المصروفات..."
                        : "Loading expense records..."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredExpenses.map(
                  (expense) => {
                    const deleting =
                      deletingExpenseId ===
                      expense.id;

                    const expenseCode =
                      getExpenseCode(
                        expense.id,
                      );

                    return (
                      <tr
                        key={expense.id}
                        className="border-b border-border last:border-b-0 hover:bg-app-background"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                                expense.is_flagged
                                  ? "bg-danger-soft text-danger"
                                  : "bg-primary-soft text-primary"
                              }`}
                            >
                              {expense.is_flagged ? (
                                <ShieldAlert
                                  size={18}
                                />
                              ) : (
                                <ReceiptText
                                  size={18}
                                />
                              )}
                            </span>

                            <div>
                              <p
                                dir="ltr"
                                className="text-sm font-semibold text-text-primary"
                              >
                                {expenseCode}
                              </p>

                              <p className="mt-1 max-w-xs truncate text-xs text-text-secondary">
                                {expense.description ||
                                  (isArabic
                                    ? "لم تتم إضافة وصف"
                                    : "No description provided")}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-text-primary">
                          {expense.category}
                        </td>

                        <td className="px-5 py-4 text-sm text-text-secondary">
                          {expense.vendor ||
                            (isArabic
                              ? "غير مضاف"
                              : "Not provided")}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-text-primary">
                          {formatAmount(
                            expense.amount,
                            numberLocale,
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-text-secondary">
                          {formatDate(
                            expense.expense_date,
                            numberLocale,
                            isArabic
                              ? "التاريخ غير متاح"
                              : "Date not available",
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                              expense.is_flagged
                                ? "bg-danger-soft text-danger"
                                : "bg-success-soft text-success"
                            }`}
                          >
                            {expense.is_flagged
                              ? isArabic
                                ? "تتطلب مراجعة"
                                : "Review"
                              : isArabic
                                ? "لا تحتاج مراجعة"
                                : "Clear"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  expense,
                                )
                              }
                              disabled={
                                deleting
                              }
                              aria-label={
                                isArabic
                                  ? `تعديل ${expenseCode}`
                                  : `Edit ${expenseCode}`
                              }
                              title={
                                isArabic
                                  ? `تعديل ${expenseCode}`
                                  : `Edit ${expenseCode}`
                              }
                              className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Pencil
                                size={17}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDeleteExpense(
                                  expense,
                                )
                              }
                              disabled={
                                deleting
                              }
                              aria-label={
                                isArabic
                                  ? `حذف ${expenseCode}`
                                  : `Delete ${expenseCode}`
                              }
                              title={
                                isArabic
                                  ? `حذف ${expenseCode}`
                                  : `Delete ${expenseCode}`
                              }
                              className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deleting ? (
                                <span className="size-4 animate-spin rounded-full border-2 border-border border-t-danger" />
                              ) : (
                                <Trash2
                                  size={17}
                                />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
            </tbody>
          </table>
        </div>

        {!loading &&
        !loadError &&
        filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ReceiptText size={22} />
            </div>

            <p className="mt-3 font-medium text-text-primary">
              {expenses.length === 0
                ? isArabic
                  ? "لا توجد مصروفات محفوظة حتى الآن"
                  : "No expenses stored yet"
                : isArabic
                  ? "لم يتم العثور على مصروفات"
                  : "No expenses found"}
            </p>

            <p className="mt-1 text-sm text-text-secondary">
              {expenses.length === 0
                ? isArabic
                  ? "استخدم زر تسجيل مصروف لإنشاء أول سجل في الخادم."
                  : "Use Record expense to create the first backend record."
                : isArabic
                  ? "جرّب تغيير كلمة البحث أو فلتر المراجعة."
                  : "Try changing the search term or review filter."}
            </p>
          </div>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 text-sm text-text-secondary">
          <span>
            {isArabic
              ? `عرض ${new Intl.NumberFormat(
                  numberLocale,
                ).format(
                  filteredExpenses.length,
                )} من أصل ${new Intl.NumberFormat(
                  numberLocale,
                ).format(
                  expenses.length,
                )} من المصروفات`
              : `Showing ${filteredExpenses.length} of ${expenses.length} expenses`}
          </span>

          <span>
            {isArabic
              ? "متصل بـ FastAPI"
              : "Connected to FastAPI"}
          </span>
        </footer>
      </section>

      <Modal
        open={modalOpen}
        title={
          editingExpense
            ? isArabic
              ? "تعديل المصروف"
              : "Edit expense"
            : isArabic
              ? "تسجيل مصروف"
              : "Record expense"
        }
        description={
          editingExpense
            ? isArabic
              ? "حدّث سجل المصروف المحدد."
              : "Update the selected expense record."
            : isArabic
              ? "أضف تفاصيل الإنفاق والمعلومات الداعمة."
              : "Add spending details and supporting information."
        }
        onClose={closeModal}
      >
        <ExpenseForm
          key={
            editingExpense?.id ??
            "new-expense"
          }
          initialExpense={editingExpense}
          saving={saving}
          serverError={saveError}
          onCancel={closeModal}
          onSave={handleSaveExpense}
        />
      </Modal>
    </>
  );
}
