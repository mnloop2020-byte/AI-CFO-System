"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  CircleAlert,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  WifiOff,
} from "lucide-react";

import SaleForm from "@/components/crm/SaleForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { usePermission } from "@/lib/auth/use-permission";
import Modal from "@/components/ui/Modal";
import { notifyDataChanged } from "@/lib/data-events";
import {
  getCustomers,
  type Customer,
} from "@/lib/customers";
import {
  createSale,
  deleteSale,
  getSales,
  updateSale,
  type CreateSaleInput,
  type Sale,
} from "@/lib/sales";

const UNKNOWN_LOAD_ERROR =
  "Unable to load sales data.";

function formatAmount(
  value: number,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(
  value: string | null | undefined,
  locale: string,
  unavailableLabel: string,
) {
  if (!value) {
    return unavailableLabel;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return unavailableLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(date);
}

function getStatusClasses(status: string) {
  switch (status.toLowerCase()) {
    case "completed":
      return "bg-success-soft text-success";

    case "pending":
      return "bg-warning-soft text-warning";

    case "refunded":
    case "cancelled":
      return "bg-danger-soft text-danger";

    default:
      return "bg-surface-soft text-text-secondary";
  }
}

function getStatusLabel(
  status: string,
  isArabic: boolean,
) {
  if (!isArabic) {
    return status;
  }

  switch (status.toLowerCase()) {
    case "completed":
      return "مكتملة";

    case "pending":
      return "قيد الانتظار";

    case "refunded":
      return "مُستردة";

    case "cancelled":
      return "ملغاة";

    default:
      return status;
  }
}

export default function SalesTable() {
  const { language } = useLanguage();
  const canWrite = usePermission("financial.write");
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [sales, setSales] = useState<Sale[]>(
    [],
  );

  const [customers, setCustomers] = useState<
    Customer[]
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingSale, setEditingSale] =
    useState<Sale | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [savingSale, setSavingSale] =
    useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [deletingSaleId, setDeletingSaleId] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadSalesData =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [
          salesResponse,
          customersResponse,
        ] = await Promise.all([
          getSales(),
          getCustomers(),
        ]);

        setSales(salesResponse);
        setCustomers(customersResponse);
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
    void loadSalesData();
  }, [loadSalesData]);

  const customerNames = useMemo(() => {
    return new Map(
      customers.map((customer) => [
        customer.id,
        customer.name,
      ]),
    );
  }, [customers]);

  const filteredSales = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return sales.filter((sale) => {
      const customerName = sale.customer_id
        ? customerNames.get(sale.customer_id) ??
          ""
        : "";

      const matchesSearch =
        !normalizedSearch ||
        sale.id
          .toLowerCase()
          .includes(normalizedSearch) ||
        sale.product_name
          .toLowerCase()
          .includes(normalizedSearch) ||
        sale.status
          .toLowerCase()
          .includes(normalizedSearch) ||
        customerName
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        sale.status.toLowerCase() ===
          statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    customerNames,
    sales,
    search,
    statusFilter,
  ]);

  const openCreateSaleModal = () => {
    setEditingSale(null);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const openEditSaleModal = (sale: Sale) => {
    setEditingSale(sale);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const closeSaleModal = () => {
    if (savingSale) {
      return;
    }

    setModalOpen(false);
    setEditingSale(null);
    setSaveError(null);
  };

  const handleSaveSale = async (
    saleData: CreateSaleInput,
  ) => {
    setSavingSale(true);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);

    try {
      if (editingSale) {
        const updatedSale = await updateSale(
          editingSale.id,
          saleData,
        );

        setSales((currentSales) =>
          currentSales.map((sale) =>
            sale.id === updatedSale.id
              ? updatedSale
              : sale,
          ),
        );

        setSuccessMessage(
          isArabic
            ? `تم تحديث مبيعة ${updatedSale.product_name} بنجاح.`
            : `${updatedSale.product_name} was updated successfully.`,
        );
      } else {
        const createdSale = await createSale(
          saleData,
        );

        setSales((currentSales) => [
          createdSale,
          ...currentSales,
        ]);

        setSuccessMessage(
          isArabic
            ? `تم تسجيل مبيعة ${createdSale.product_name} بنجاح.`
            : `${createdSale.product_name} was recorded successfully.`,
        );
      }

      notifyDataChanged(
        "sales",
        editingSale ? "update" : "create",
      );

      setModalOpen(false);
      setEditingSale(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : editingSale
            ? isArabic
              ? "تعذر تحديث المبيعة."
              : "Unable to update the sale."
            : isArabic
              ? "تعذر تسجيل المبيعة."
              : "Unable to record the sale.";

      setSaveError(message);
    } finally {
      setSavingSale(false);
    }
  };

  const handleDeleteSale = async (
    sale: Sale,
  ) => {
    const confirmed = window.confirm(
      isArabic
        ? `هل تريد حذف مبيعة ${sale.product_name}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete ${sale.product_name}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingSaleId(sale.id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deleteSale(sale.id);

      setSales((currentSales) =>
        currentSales.filter(
          (currentSale) =>
            currentSale.id !== sale.id,
        ),
      );

      notifyDataChanged("sales", "delete");

      setSuccessMessage(
        isArabic
          ? `تم حذف مبيعة ${sale.product_name} بنجاح.`
          : `${sale.product_name} was deleted successfully.`,
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حذف المبيعة."
            : "Unable to delete the sale.";

      setActionError(message);
    } finally {
      setDeletingSaleId(null);
    }
  };

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل بيانات المبيعات."
      : loadError;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {isArabic
                  ? "سجلات المبيعات"
                  : "Sales records"}
              </h2>

              <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                {isArabic
                  ? "بيانات مباشرة من الخادم"
                  : "Live backend data"}
              </span>
            </div>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "تابع المبيعات المكتملة وقيد الانتظار والمُستردة والملغاة."
                : "Track completed, pending, refunded, and cancelled sales."}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateSaleModal}
            disabled={!canWrite}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />

            {isArabic
              ? "تسجيل مبيعة"
              : "Record sale"}
          </button>
        </header>

        {successMessage ? (
          <div className="flex items-start gap-3 border-b border-green-100 bg-success-soft px-5 py-3 text-sm text-text-secondary">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-success"
            />

            <p>{successMessage}</p>
          </div>
        ) : null}

        {loadError ? (
          <div className="flex flex-col gap-3 border-b border-red-100 bg-danger-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <WifiOff
                size={19}
                className="mt-0.5 shrink-0 text-danger"
              />

              <div>
                <p className="text-sm font-semibold text-danger">
                  {isArabic
                    ? "تعذر الاتصال ببيانات المبيعات"
                    : "Unable to connect to sales data"}
                </p>

                <p className="mt-1 text-sm text-text-secondary">
                  {displayedLoadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadSalesData()
              }
              className="rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger hover:text-white"
            >
              {isArabic
                ? "إعادة المحاولة"
                : "Try again"}
            </button>
          </div>
        ) : null}

        {actionError ? (
          <div className="flex flex-col gap-3 border-b border-red-100 bg-danger-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={19}
                className="mt-0.5 shrink-0 text-danger"
              />

              <div>
                <p className="text-sm font-semibold text-danger">
                  {isArabic
                    ? "فشل تنفيذ إجراء المبيعات"
                    : "Sales action failed"}
                </p>

                <p className="mt-1 text-sm text-text-secondary">
                  {actionError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setActionError(null)
              }
              className="rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger hover:text-white"
            >
              {isArabic ? "إغلاق" : "Dismiss"}
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search
              size={18}
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-secondary ${
                isArabic
                  ? "right-3"
                  : "left-3"
              }`}
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={
                isArabic
                  ? "البحث في المبيعات..."
                  : "Search sales..."
              }
              className={`h-11 w-full rounded-xl border border-border bg-surface-soft text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-soft ${
                isArabic
                  ? "pl-4 pr-10"
                  : "pl-10 pr-4"
              }`}
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            aria-label={
              isArabic
                ? "تصفية المبيعات حسب الحالة"
                : "Filter sales by status"
            }
            className="h-11 rounded-xl border border-border bg-surface px-4 text-sm text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft"
          >
            <option value="all">
              {isArabic
                ? "جميع الحالات"
                : "All statuses"}
            </option>

            <option value="completed">
              {isArabic
                ? "مكتملة"
                : "Completed"}
            </option>

            <option value="pending">
              {isArabic
                ? "قيد الانتظار"
                : "Pending"}
            </option>

            <option value="refunded">
              {isArabic
                ? "مُستردة"
                : "Refunded"}
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
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "المبيعة"
                    : "Sale"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "العميل"
                    : "Customer"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "الكمية"
                    : "Quantity"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "سعر الوحدة"
                    : "Unit price"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "الإجمالي"
                    : "Total"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "تاريخ البيع"
                    : "Sale date"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {isArabic
                    ? "الحالة"
                    : "Status"}
                </th>

                <th className="w-28 px-5 py-3 text-right font-semibold">
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
                    className="px-5 py-14 text-center"
                  >
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary-soft border-t-primary" />

                    <p className="mt-3 text-sm text-text-secondary">
                      {isArabic
                        ? "جارٍ تحميل المبيعات من الخادم..."
                        : "Loading sales from the backend..."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-soft/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <ShoppingCart
                            size={18}
                          />
                        </div>

                        <div>
                          <p className="font-medium text-text-primary">
                            {sale.product_name}
                          </p>

                          <p
                            dir="ltr"
                            className="mt-1 text-xs text-text-secondary"
                          >
                            SALE-
                            {sale.id
                              .slice(0, 8)
                              .toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-text-secondary">
                      {sale.customer_id
                        ? customerNames.get(
                            sale.customer_id,
                          ) ??
                          (isArabic
                            ? "العميل غير متاح"
                            : "Customer unavailable")
                        : isArabic
                          ? "غير مرتبط"
                          : "Not linked"}
                    </td>

                    <td className="px-5 py-4 font-medium text-text-primary">
                      {new Intl.NumberFormat(
                        numberLocale,
                      ).format(sale.quantity)}
                    </td>

                    <td className="px-5 py-4 text-sm text-text-secondary">
                      {formatAmount(
                        sale.unit_price,
                        numberLocale,
                      )}
                    </td>

                    <td className="px-5 py-4 font-semibold text-text-primary">
                      {formatAmount(
                        sale.total_amount,
                        numberLocale,
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-text-secondary">
                      {formatDate(
                        sale.sale_date,
                        numberLocale,
                        isArabic
                          ? "غير متاح"
                          : "Not available",
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                          sale.status,
                        )}`}
                      >
                        {getStatusLabel(
                          sale.status,
                          isArabic,
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            openEditSaleModal(
                              sale,
                            )
                          }
                          disabled={
                            !canWrite ||
                            deletingSaleId !==
                            null
                          }
                          aria-label={
                            isArabic
                              ? `تعديل ${sale.product_name}`
                              : `Edit ${sale.product_name}`
                          }
                          title={
                            isArabic
                              ? `تعديل ${sale.product_name}`
                              : `Edit ${sale.product_name}`
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil size={17} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteSale(
                              sale,
                            )
                          }
                          disabled={
                            !canWrite ||
                            deletingSaleId !==
                            null
                          }
                          aria-label={
                            isArabic
                              ? `حذف ${sale.product_name}`
                              : `Delete ${sale.product_name}`
                          }
                          title={
                            isArabic
                              ? `حذف ${sale.product_name}`
                              : `Delete ${sale.product_name}`
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary transition hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2
                            size={18}
                            className={
                              deletingSaleId ===
                              sale.id
                                ? "animate-pulse"
                                : undefined
                            }
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading &&
              !loadError &&
              filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center"
                  >
                    <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <ShoppingCart size={22} />
                    </div>

                    <p className="mt-3 font-medium text-text-primary">
                      {sales.length === 0
                        ? isArabic
                          ? "لا توجد مبيعات محفوظة حتى الآن"
                          : "No sales stored yet"
                        : isArabic
                          ? "لا توجد مبيعات تطابق عوامل التصفية"
                          : "No sales match your filters"}
                    </p>

                    <p className="mt-1 text-sm text-text-secondary">
                      {sales.length === 0
                        ? isArabic
                          ? "استخدم زر تسجيل مبيعة لإنشاء أول سجل في الخادم."
                          : "Use Record sale to create the first backend record."
                        : isArabic
                          ? "جرّب تغيير البحث أو عامل تصفية الحالة."
                          : "Try changing the search or status filter."}
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border px-5 py-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <span>
            {isArabic
              ? `عرض ${new Intl.NumberFormat(
                  numberLocale,
                ).format(
                  filteredSales.length,
                )} من أصل ${new Intl.NumberFormat(
                  numberLocale,
                ).format(
                  sales.length,
                )} من سجلات المبيعات`
              : `Showing ${filteredSales.length} of ${sales.length} sales`}
          </span>

          <span>
            {isArabic
              ? "لم يتم إعداد العملة"
              : "Currency not configured"}
          </span>
        </footer>
      </section>

      <Modal
        open={modalOpen}
        title={
          editingSale
            ? isArabic
              ? "تعديل المبيعة"
              : "Edit sale"
            : isArabic
              ? "تسجيل مبيعة"
              : "Record sale"
        }
        description={
          editingSale
            ? isArabic
              ? "حدّث بيانات هذه المبيعة في قاعدة بيانات الخادم."
              : "Update this sale in the backend database."
            : isArabic
              ? "أضف مبيعة جديدة واحسب قيمتها الإجمالية."
              : "Add a new sale and calculate its total value."
        }
        onClose={closeSaleModal}
      >
        <SaleForm
          key={
            editingSale?.id ?? "new-sale"
          }
          customers={customers}
          initialSale={editingSale}
          onCancel={closeSaleModal}
          onSave={handleSaveSale}
          saving={savingSale}
          serverError={saveError}
        />
      </Modal>
    </>
  );
}
