"use client";

import {
  CheckCircle2,
  CircleAlert,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import InventoryForm from "@/components/crm/InventoryForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { usePermission } from "@/lib/auth/use-permission";
import Modal from "@/components/ui/Modal";
import { notifyDataChanged } from "@/lib/data-events";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  updateInventoryItem,
  type CreateInventoryItemInput,
  type InventoryItem,
} from "@/lib/inventory";

type StockFilter =
  | "all"
  | "in-stock"
  | "low-stock"
  | "out-of-stock";

type StockStatus = {
  key: Exclude<StockFilter, "all">;
  label: string;
  badgeClass: string;
  iconClass: string;
  progressClass: string;
};

const UNKNOWN_LOAD_ERROR =
  "Unable to load inventory records.";

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

function getStockStatus(
  item: InventoryItem,
  isArabic: boolean,
): StockStatus {
  if (Number(item.quantity) === 0) {
    return {
      key: "out-of-stock",
      label: isArabic
        ? "نفد المخزون"
        : "Out of Stock",
      badgeClass: "bg-danger-soft text-danger",
      iconClass: "bg-danger-soft text-danger",
      progressClass: "bg-danger",
    };
  }

  if (
    Number(item.quantity) <=
    Number(item.reorder_level)
  ) {
    return {
      key: "low-stock",
      label: isArabic
        ? "مخزون منخفض"
        : "Low Stock",
      badgeClass: "bg-warning-soft text-warning",
      iconClass: "bg-warning-soft text-warning",
      progressClass: "bg-warning",
    };
  }

  return {
    key: "in-stock",
    label: isArabic
      ? "متوفر في المخزون"
      : "In Stock",
    badgeClass: "bg-success-soft text-success",
    iconClass: "bg-success-soft text-success",
    progressClass: "bg-success",
  };
}

function getQuantityProgress(item: InventoryItem) {
  if (Number(item.quantity) === 0) {
    return 0;
  }

  if (Number(item.reorder_level) <= 0) {
    return 100;
  }

  const targetQuantity =
    Number(item.reorder_level) * 2;

  return Math.min(
    Math.max(
      (Number(item.quantity) /
        targetQuantity) *
        100,
      8,
    ),
    100,
  );
}

export default function InventoryTable() {
  const { language } = useLanguage();
  const canWrite = usePermission("financial.write");
  const isArabic = language === "ar";
  const numberLocale = isArabic
    ? "ar-SA"
    : "en-US";

  const [items, setItems] = useState<
    InventoryItem[]
  >([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [stockFilter, setStockFilter] =
    useState<StockFilter>("all");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingItem, setEditingItem] =
    useState<InventoryItem | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [deletingItemId, setDeletingItemId] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await getInventoryItems();
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
    void loadItems();
  }, [loadItems]);

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

  const filteredItems = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const status = getStockStatus(
        item,
        isArabic,
      );

      const matchesSearch =
        !normalizedSearch ||
        item.product_name
          .toLowerCase()
          .includes(normalizedSearch) ||
        item.sku
          .toLowerCase()
          .includes(normalizedSearch) ||
        item.id
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        stockFilter === "all" ||
        stockFilter === status.key;

      return matchesSearch && matchesStatus;
    });
  }, [
    isArabic,
    items,
    searchTerm,
    stockFilter,
  ]);

  function openCreateModal() {
    setEditingItem(null);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function openEditModal(item: InventoryItem) {
    setEditingItem(item);
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
    setEditingItem(null);
    setSaveError(null);
  }

  async function handleSaveItem(
    itemInput: CreateInventoryItemInput,
  ) {
    setSaving(true);
    setSaveError(null);
    setActionError(null);

    try {
      if (editingItem) {
        const updatedItem =
          await updateInventoryItem(
            editingItem.id,
            itemInput,
          );

        setItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === updatedItem.id
              ? updatedItem
              : currentItem,
          ),
        );

        setSuccessMessage(
          isArabic
            ? "تم تحديث منتج المخزون بنجاح."
            : "Inventory product updated successfully.",
        );
      } else {
        const createdItem =
          await createInventoryItem(itemInput);

        setItems((currentItems) => [
          createdItem,
          ...currentItems,
        ]);

        setSuccessMessage(
          isArabic
            ? "تم إنشاء منتج المخزون بنجاح."
            : "Inventory product created successfully.",
        );
      }

      notifyDataChanged(
        "inventory",
        editingItem ? "update" : "create",
      );

      setModalOpen(false);
      setEditingItem(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حفظ منتج المخزون."
            : "Unable to save the inventory product.";

      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(
    item: InventoryItem,
  ) {
    const confirmed = window.confirm(
      isArabic
        ? `هل تريد حذف ${item.product_name}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete ${item.product_name}? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingItemId(item.id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deleteInventoryItem(item.id);

      setItems((currentItems) =>
        currentItems.filter(
          (currentItem) =>
            currentItem.id !== item.id,
        ),
      );

      notifyDataChanged("inventory", "delete");

      setSuccessMessage(
        isArabic
          ? "تم حذف منتج المخزون بنجاح."
          : "Inventory product deleted successfully.",
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : isArabic
            ? "تعذر حذف منتج المخزون."
            : "Unable to delete the inventory product.";

      setActionError(message);
    } finally {
      setDeletingItemId(null);
    }
  }

  const displayedLoadError =
    isArabic &&
    loadError === UNKNOWN_LOAD_ERROR
      ? "تعذر تحميل سجلات المخزون."
      : loadError;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {isArabic
                  ? "سجلات المخزون"
                  : "Inventory records"}
              </h2>

              <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                {isArabic
                  ? "بيانات مباشرة من الخادم"
                  : "Live backend data"}
              </span>
            </div>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "راقب الكميات ومستويات إعادة الطلب وقيم المنتجات."
                : "Monitor quantities, reorder levels, and product values."}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canWrite}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />

            {isArabic
              ? "إضافة منتج"
              : "Add product"}
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
                    ? "تعذر الاتصال ببيانات المخزون"
                    : "Unable to connect to inventory data"}
                </p>

                <p className="mt-0.5 text-xs">
                  {displayedLoadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadItems()}
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
                  ? "البحث عن منتج أو رمز SKU..."
                  : "Search products or SKU..."
              }
              aria-label={
                isArabic
                  ? "البحث في منتجات المخزون"
                  : "Search inventory products"
              }
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
          </label>

          <select
            value={stockFilter}
            onChange={(event) =>
              setStockFilter(
                event.target.value as StockFilter,
              )
            }
            aria-label={
              isArabic
                ? "التصفية حسب حالة المخزون"
                : "Filter by stock status"
            }
            className="h-11 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          >
            <option value="all">
              {isArabic
                ? "جميع حالات المخزون"
                : "All stock statuses"}
            </option>

            <option value="in-stock">
              {isArabic
                ? "متوفر في المخزون"
                : "In Stock"}
            </option>

            <option value="low-stock">
              {isArabic
                ? "مخزون منخفض"
                : "Low Stock"}
            </option>

            <option value="out-of-stock">
              {isArabic
                ? "نفد المخزون"
                : "Out of Stock"}
            </option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table
            className={`w-full min-w-[1150px] border-collapse ${
              isArabic
                ? "text-right"
                : "text-left"
            }`}
          >
            <thead className="bg-surface-soft">
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">
                  {isArabic
                    ? "المنتج"
                    : "Product"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "الكمية"
                    : "Quantity"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "مستوى إعادة الطلب"
                    : "Reorder level"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "سعر التكلفة"
                    : "Cost price"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "سعر البيع"
                    : "Selling price"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "آخر بيع"
                    : "Last sold"}
                </th>

                <th className="px-5 py-3">
                  {isArabic
                    ? "الحالة"
                    : "Status"}
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
                        ? "جارٍ تحميل سجلات المخزون..."
                        : "Loading inventory records..."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredItems.map((item) => {
                  const status =
                    getStockStatus(
                      item,
                      isArabic,
                    );

                  const progress =
                    getQuantityProgress(item);

                  const deleting =
                    deletingItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-b-0 hover:bg-app-background"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${status.iconClass}`}
                          >
                            {status.key ===
                            "in-stock" ? (
                              <Package size={18} />
                            ) : (
                              <TriangleAlert
                                size={18}
                              />
                            )}
                          </span>

                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {item.product_name}
                            </p>

                            <p
                              dir="ltr"
                              className={`mt-1 text-xs text-text-secondary ${
                                isArabic
                                  ? "text-right"
                                  : "text-left"
                              }`}
                            >
                              SKU: {item.sku}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-text-primary">
                          {formatNumber(
                            item.quantity,
                            numberLocale,
                          )}
                        </p>

                        <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-surface-soft">
                          <div
                            className={`h-full rounded-full ${status.progressClass}`}
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {formatNumber(
                          item.reorder_level,
                          numberLocale,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {formatAmount(
                          item.cost_price,
                          numberLocale,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm font-semibold text-text-primary">
                        {formatAmount(
                          item.selling_price,
                          numberLocale,
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {formatDate(
                          item.last_sold,
                          numberLocale,
                          isArabic
                            ? "غير متاح"
                            : "Not available",
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.badgeClass}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(item)
                            }
                            disabled={!canWrite || deleting}
                            aria-label={
                              isArabic
                                ? `تعديل ${item.product_name}`
                                : `Edit ${item.product_name}`
                            }
                            title={
                              isArabic
                                ? `تعديل ${item.product_name}`
                                : `Edit ${item.product_name}`
                            }
                            className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteItem(
                                item,
                              )
                            }
                            disabled={!canWrite || deleting}
                            aria-label={
                              isArabic
                                ? `حذف ${item.product_name}`
                                : `Delete ${item.product_name}`
                            }
                            title={
                              isArabic
                                ? `حذف ${item.product_name}`
                                : `Delete ${item.product_name}`
                            }
                            className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deleting ? (
                              <span className="size-4 animate-spin rounded-full border-2 border-border border-t-danger" />
                            ) : (
                              <Trash2 size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {!loading &&
        !loadError &&
        filteredItems.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Package size={22} />
            </div>

            <p className="mt-3 font-medium text-text-primary">
              {items.length === 0
                ? isArabic
                  ? "لا توجد منتجات مخزون محفوظة حتى الآن"
                  : "No inventory products stored yet"
                : isArabic
                  ? "لم يتم العثور على منتجات مخزون"
                  : "No inventory products found"}
            </p>

            <p className="mt-1 text-sm text-text-secondary">
              {items.length === 0
                ? isArabic
                  ? "استخدم زر إضافة منتج لإنشاء أول سجل في الخادم."
                  : "Use Add product to create the first backend record."
                : isArabic
                  ? "جرّب تغيير كلمة البحث أو فلتر المخزون."
                  : "Try changing the search term or stock filter."}
            </p>
          </div>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-4 text-sm text-text-secondary">
          <span>
            {isArabic
              ? `عرض ${formatNumber(
                  filteredItems.length,
                  numberLocale,
                )} من أصل ${formatNumber(
                  items.length,
                  numberLocale,
                )} من المنتجات`
              : `Showing ${filteredItems.length} of ${items.length} products`}
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
          editingItem
            ? isArabic
              ? "تعديل المنتج"
              : "Edit product"
            : isArabic
              ? "إضافة منتج"
              : "Add product"
        }
        description={
          editingItem
            ? isArabic
              ? "حدّث بيانات المنتج وقيم المخزون الخاصة به."
              : "Update the product and its stock values."
            : isArabic
              ? "أنشئ سجل منتج واضبط قيم المخزون الخاصة به."
              : "Create a product record and configure its stock values."
        }
        onClose={closeModal}
      >
        <InventoryForm
          key={editingItem?.id ?? "new-product"}
          initialItem={editingItem}
          saving={saving}
          serverError={saveError}
          onCancel={closeModal}
          onSave={handleSaveItem}
        />
      </Modal>
    </>
  );
}
