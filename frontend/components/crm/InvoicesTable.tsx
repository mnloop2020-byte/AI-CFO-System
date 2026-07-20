"use client";

import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import InvoiceForm from "@/components/crm/InvoiceForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import Modal from "@/components/ui/Modal";
import {
  getCustomers,
  type Customer,
} from "@/lib/customers";
import {
  createInvoice,
  deleteInvoice,
  getInvoices,
  updateInvoice,
  type CreateInvoiceInput,
  type Invoice,
} from "@/lib/invoices";

type StatusFilter =
  | "all"
  | "paid"
  | "unpaid"
  | "overdue"
  | "cancelled";

const UNKNOWN_LOAD_ERROR =
  "Unable to load invoice records.";

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

function getStatusDetails(
  status: string,
  isArabic: boolean,
) {
  const normalizedStatus =
    status.trim().toLowerCase();

  if (normalizedStatus === "paid") {
    return {
      label: isArabic ? "مدفوعة" : "Paid",
      className:
        "bg-success-soft text-success",
    };
  }

  if (normalizedStatus === "unpaid") {
    return {
      label: isArabic
        ? "غير مدفوعة"
        : "Unpaid",
      className:
        "bg-warning-soft text-warning",
    };
  }

  if (normalizedStatus === "overdue") {
    return {
      label: isArabic ? "متأخرة" : "Overdue",
      className:
        "bg-danger-soft text-danger",
    };
  }

  if (normalizedStatus === "cancelled") {
    return {
      label: isArabic ? "ملغاة" : "Cancelled",
      className:
        "bg-surface-soft text-text-secondary",
    };
  }

  return {
    label:
      status.charAt(0).toUpperCase() +
      status.slice(1).toLowerCase(),
    className:
      "bg-primary-soft text-primary",
  };
}

export default function InvoicesTable() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [invoices, setInvoices] = useState<
    Invoice[]
  >([]);

  const [customers, setCustomers] = useState<
    Customer[]
  >([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingInvoice, setEditingInvoice] =
    useState<Invoice | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [
    deletingInvoiceId,
    setDeletingInvoiceId,
  ] = useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [
        invoiceResponse,
        customerResponse,
      ] = await Promise.all([
        getInvoices(),
        getCustomers(),
      ]);

      setInvoices(invoiceResponse);
      setCustomers(customerResponse);
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
    void loadRecords();
  }, [loadRecords]);

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

  const customerNames = useMemo(() => {
    return new Map(
      customers.map((customer) => [
        customer.id,
        customer.name,
      ]),
    );
  }, [customers]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const normalizedStatus =
        invoice.status.trim().toLowerCase();

      const customerName = invoice.customer_id
        ? customerNames.get(
            invoice.customer_id,
          ) ?? ""
        : "";

      const matchesSearch =
        !normalizedSearch ||
        invoice.invoice_number
          .toLowerCase()
          .includes(normalizedSearch) ||
        invoice.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        customerName
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    customerNames,
    invoices,
    searchTerm,
    statusFilter,
  ]);

  function openCreateModal() {
    setEditingInvoice(null);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice);
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
    setEditingInvoice(null);
    setSaveError(null);
  }

  async function handleSaveInvoice(
    invoiceInput: CreateInvoiceInput,
  ) {
    setSaving(true);
    setSaveError(null);
    setActionError(null);

    try {
      if (editingInvoice) {
        const updatedInvoice =
          await updateInvoice(
            editingInvoice.id,
            invoiceInput,
          );

        setInvoices((currentInvoices) =>
          currentInvoices.map(
            (currentInvoice) =>
              currentInvoice.id ===
              updatedInvoice.id
                ? updatedInvoice
                : currentInvoice,
          ),
        );

        setSuccessMessage(
          isArabic
            ? "تم تحديث الفاتورة بنجاح."
            : "Invoice updated successfully.",
        );
      } else {
        const createdInvoice =
          await createInvoice(invoiceInput);

        setInvoices((currentInvoices) => [
          createdInvoice,
          ...currentInvoices,
        ]);

        setSuccessMessage(
          isArabic
            ? "تم إنشاء الفاتورة بنجاح."
            : "Invoice created successfully.",
        );
      }

      setModalOpen(false);
      setEditingInvoice(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حفظ الفاتورة."
            : "Unable to save the invoice.";

      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteInvoice(
    invoice: Invoice,
  ) {
    const confirmed = window.confirm(
      isArabic
        ? `هل تريد حذف الفاتورة ${invoice.invoice_number}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete invoice ${invoice.invoice_number}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingInvoiceId(invoice.id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deleteInvoice(invoice.id);

      setInvoices((currentInvoices) =>
        currentInvoices.filter(
          (currentInvoice) =>
            currentInvoice.id !== invoice.id,
        ),
      );

      setSuccessMessage(
        isArabic
          ? "تم حذف الفاتورة بنجاح."
          : "Invoice deleted successfully.",
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حذف الفاتورة."
            : "Unable to delete the invoice.";

      setActionError(message);
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل سجلات الفواتير."
      : loadError;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {isArabic
                  ? "سجلات الفواتير"
                  : "Invoice records"}
              </h2>

              <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                {isArabic
                  ? "بيانات مباشرة من الخادم"
                  : "Live backend data"}
              </span>
            </div>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "تابع قيم الفواتير والضريبة وحالة الدفع والعملاء والمستندات."
                : "Track invoice amounts, VAT, payment status, customers, and documents."}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <Plus size={18} />

            {isArabic
              ? "إنشاء فاتورة"
              : "Create invoice"}
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
                    ? "تعذر الاتصال ببيانات الفواتير"
                    : "Unable to connect to invoice data"}
                </p>

                <p className="mt-0.5 text-xs">
                  {displayedLoadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadRecords()}
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
                setSearchTerm(event.target.value)
              }
              placeholder={
                isArabic
                  ? "البحث في الفواتير أو العملاء..."
                  : "Search invoices or customers..."
              }
              aria-label={
                isArabic
                  ? "البحث في الفواتير"
                  : "Search invoices"
              }
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as StatusFilter,
              )
            }
            aria-label={
              isArabic
                ? "تصفية الفواتير حسب الحالة"
                : "Filter invoices by status"
            }
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          >
            <option value="all">
              {isArabic
                ? "جميع الحالات"
                : "All statuses"}
            </option>

            <option value="paid">
              {isArabic ? "مدفوعة" : "Paid"}
            </option>

            <option value="unpaid">
              {isArabic
                ? "غير مدفوعة"
                : "Unpaid"}
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
        </div>

        <div className="overflow-x-auto">
          <table
            className={`w-full min-w-[1250px] border-collapse ${
              isArabic
                ? "text-right"
                : "text-left"
            }`}
          >
            <thead className="bg-surface-soft">
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">
                  {isArabic
                    ? "الفاتورة"
                    : "Invoice"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "العميل"
                    : "Customer"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "المبلغ الإجمالي"
                    : "Total amount"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "مبلغ الضريبة"
                    : "VAT amount"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "تاريخ الاستحقاق"
                    : "Due date"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "الحالة"
                    : "Status"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "المستند"
                    : "Document"}
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
                    colSpan={8}
                    className="px-5 py-12 text-center"
                  >
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-border border-t-primary" />

                    <p className="mt-3 text-sm text-text-secondary">
                      {isArabic
                        ? "جارٍ تحميل سجلات الفواتير..."
                        : "Loading invoice records..."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredInvoices.map(
                  (invoice) => {
                    const statusDetails =
                      getStatusDetails(
                        invoice.status,
                        isArabic,
                      );

                    const customerName =
                      invoice.customer_id
                        ? customerNames.get(
                            invoice.customer_id,
                          ) ??
                          (isArabic
                            ? "عميل غير معروف"
                            : "Unknown customer")
                        : isArabic
                          ? "غير مرتبطة بعميل"
                          : "Not linked";

                    const deleting =
                      deletingInvoiceId ===
                      invoice.id;

                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-border last:border-b-0 hover:bg-app-background"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                              <FileText size={18} />
                            </span>

                            <div>
                              <p
                                dir="ltr"
                                className={`text-sm font-semibold text-text-primary ${
                                  isArabic
                                    ? "text-right"
                                    : "text-left"
                                }`}
                              >
                                {
                                  invoice.invoice_number
                                }
                              </p>

                              <p
                                dir="ltr"
                                className={`mt-1 text-xs text-text-secondary ${
                                  isArabic
                                    ? "text-right"
                                    : "text-left"
                                }`}
                              >
                                ID:{" "}
                                {invoice.id
                                  .slice(0, 8)
                                  .toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-text-secondary">
                          {customerName}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold text-text-primary">
                          {formatAmount(
                            invoice.total_amount,
                            numberLocale,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-text-primary">
                            {formatAmount(
                              invoice.vat_amount,
                              numberLocale,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-text-secondary">
                            {isArabic
                              ? "ضريبة الفاتورة"
                              : "Invoiced VAT"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-text-secondary">
                          {formatDate(
                            invoice.due_date,
                            numberLocale,
                            isArabic
                              ? "غير متاح"
                              : "Not available",
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusDetails.className}`}
                          >
                            {statusDetails.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {invoice.file_url ? (
                            <a
                              href={invoice.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                            >
                              <Paperclip
                                size={16}
                              />

                              {isArabic
                                ? "فتح المستند"
                                : "Open document"}
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
                              <Paperclip
                                size={16}
                              />

                              {isArabic
                                ? "لم يُرفع"
                                : "Not uploaded"}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  invoice,
                                )
                              }
                              disabled={deleting}
                              aria-label={
                                isArabic
                                  ? `تعديل ${invoice.invoice_number}`
                                  : `Edit ${invoice.invoice_number}`
                              }
                              title={
                                isArabic
                                  ? `تعديل ${invoice.invoice_number}`
                                  : `Edit ${invoice.invoice_number}`
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
                                void handleDeleteInvoice(
                                  invoice,
                                )
                              }
                              disabled={deleting}
                              aria-label={
                                isArabic
                                  ? `حذف ${invoice.invoice_number}`
                                  : `Delete ${invoice.invoice_number}`
                              }
                              title={
                                isArabic
                                  ? `حذف ${invoice.invoice_number}`
                                  : `Delete ${invoice.invoice_number}`
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
        filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FileText size={22} />
            </div>

            <p className="mt-3 font-medium text-text-primary">
              {invoices.length === 0
                ? isArabic
                  ? "لا توجد فواتير محفوظة حتى الآن"
                  : "No invoices stored yet"
                : isArabic
                  ? "لم يتم العثور على فواتير"
                  : "No invoices found"}
            </p>

            <p className="mt-1 text-sm text-text-secondary">
              {invoices.length === 0
                ? isArabic
                  ? "استخدم زر إنشاء فاتورة لإنشاء أول سجل في الخادم."
                  : "Use Create invoice to create the first backend record."
                : isArabic
                  ? "جرّب تغيير كلمة البحث أو فلتر الحالة."
                  : "Try changing the search term or status filter."}
            </p>
          </div>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 text-sm text-text-secondary">
          <span>
            {isArabic
              ? `عرض ${formatNumber(
                  filteredInvoices.length,
                  numberLocale,
                )} من أصل ${formatNumber(
                  invoices.length,
                  numberLocale,
                )} من الفواتير`
              : `Showing ${filteredInvoices.length} of ${invoices.length} invoices`}
          </span>

          <span>
            {isArabic
              ? "ضريبة الفواتير ليست الضريبة النهائية المستحقة"
              : "Invoiced VAT is not the final VAT payable"}
          </span>
        </footer>
      </section>

      <Modal
        open={modalOpen}
        title={
          editingInvoice
            ? isArabic
              ? "تعديل الفاتورة"
              : "Edit invoice"
            : isArabic
              ? "إنشاء فاتورة"
              : "Create invoice"
        }
        description={
          editingInvoice
            ? isArabic
              ? "حدّث قيم الفاتورة والعميل والحالة وتاريخ الاستحقاق."
              : "Update invoice amounts, customer, status, and due date."
            : isArabic
              ? "أضف قيم الفاتورة وتفاصيل الدفع والضريبة وبيانات العميل."
              : "Add invoice amounts, payment details, VAT, and customer information."
        }
        onClose={closeModal}
      >
        <InvoiceForm
          key={
            editingInvoice?.id ??
            "new-invoice"
          }
          customers={customers}
          initialInvoice={editingInvoice}
          saving={saving}
          serverError={saveError}
          onCancel={closeModal}
          onSave={handleSaveInvoice}
        />
      </Modal>
    </>
  );
}
