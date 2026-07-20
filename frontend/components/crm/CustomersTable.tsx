"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  WifiOff,
} from "lucide-react";

import CustomerForm from "@/components/crm/CustomerForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import Modal from "@/components/ui/Modal";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
  type CreateCustomerInput,
  type Customer,
} from "@/lib/customers";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) =>
      part[0]?.toUpperCase(),
    )
    .join("");
}

function formatDate(
  value: string | null | undefined,
  language: "en" | "ar",
) {
  const notAvailable =
    language === "ar"
      ? "غير متاح"
      : "Not available";

  if (!value) {
    return notAvailable;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return notAvailable;
  }

  const locale =
    language === "ar"
      ? "ar-SA-u-nu-latn"
      : "en-US";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(date);
}

export default function CustomersTable() {
  const { language } = useLanguage();

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [search, setSearch] =
    useState("");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [
    editingCustomer,
    setEditingCustomer,
  ] = useState<Customer | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [
    savingCustomer,
    setSavingCustomer,
  ] = useState(false);

  const [saveError, setSaveError] =
    useState<string | null>(null);

  const [
    deletingCustomerId,
    setDeletingCustomerId,
  ] = useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);

  const loadCustomers =
    useCallback(async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const response =
          await getCustomers();

        setCustomers(response);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to load customers.";

        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers =
    useMemo(() => {
      const normalizedSearch = search
        .trim()
        .toLowerCase();

      if (!normalizedSearch) {
        return customers;
      }

      return customers.filter(
        (customer) => {
          return [
            customer.id,
            customer.name,
            customer.email,
            customer.phone,
            customer.company_name,
          ].some((value) =>
            value
              ?.toLowerCase()
              .includes(
                normalizedSearch,
              ),
          );
        },
      );
    }, [customers, search]);

  function openCreateCustomerModal() {
    setEditingCustomer(null);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function openEditCustomerModal(
    customer: Customer,
  ) {
    setEditingCustomer(customer);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function closeCustomerModal() {
    if (savingCustomer) {
      return;
    }

    setModalOpen(false);
    setEditingCustomer(null);
    setSaveError(null);
  }

  async function handleSaveCustomer(
    customerData: CreateCustomerInput,
  ) {
    setSavingCustomer(true);
    setSaveError(null);
    setActionError(null);
    setSuccessMessage(null);

    try {
      if (editingCustomer) {
        const updatedCustomer =
          await updateCustomer(
            editingCustomer.id,
            customerData,
          );

        setCustomers(
          (currentCustomers) =>
            currentCustomers.map(
              (customer) =>
                customer.id ===
                updatedCustomer.id
                  ? updatedCustomer
                  : customer,
            ),
        );

        setSuccessMessage(
          language === "ar"
            ? `تم تحديث بيانات ${updatedCustomer.name} بنجاح.`
            : `${updatedCustomer.name} was updated successfully.`,
        );
      } else {
        const createdCustomer =
          await createCustomer(
            customerData,
          );

        setCustomers(
          (currentCustomers) => [
            createdCustomer,
            ...currentCustomers,
          ],
        );

        setSuccessMessage(
          language === "ar"
            ? `تم إنشاء العميل ${createdCustomer.name} بنجاح.`
            : `${createdCustomer.name} was created successfully.`,
        );
      }

      setModalOpen(false);
      setEditingCustomer(null);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : editingCustomer
            ? language === "ar"
              ? "تعذر تحديث بيانات العميل."
              : "Unable to update the customer."
            : language === "ar"
              ? "تعذر إنشاء العميل."
              : "Unable to create the customer.";

      setSaveError(message);
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleDeleteCustomer(
    customer: Customer,
  ) {
    const confirmationMessage =
      language === "ar"
        ? `هل تريد حذف ${customer.name}؟ لا يمكن التراجع عن هذا الإجراء.`
        : `Delete ${customer.name}? This action cannot be undone.`;

    const confirmed = window.confirm(
      confirmationMessage,
    );

    if (!confirmed) {
      return;
    }

    setDeletingCustomerId(customer.id);
    setActionError(null);
    setSuccessMessage(null);

    try {
      await deleteCustomer(customer.id);

      setCustomers(
        (currentCustomers) =>
          currentCustomers.filter(
            (currentCustomer) =>
              currentCustomer.id !==
              customer.id,
          ),
      );

      setSuccessMessage(
        language === "ar"
          ? `تم حذف العميل ${customer.name} بنجاح.`
          : `${customer.name} was deleted successfully.`,
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : language === "ar"
            ? "تعذر حذف العميل."
            : "Unable to delete the customer.";

      setActionError(message);
    } finally {
      setDeletingCustomerId(null);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {language === "ar"
                  ? "دليل العملاء"
                  : "Customer directory"}
              </h2>

              <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                {language === "ar"
                  ? "بيانات مباشرة من الباك إند"
                  : "Live backend data"}
              </span>
            </div>

            <p className="mt-1 text-sm text-text-secondary">
              {language === "ar"
                ? "عرض وإدارة سجلات عملاء شركتك."
                : "View and manage your company's customer records."}
            </p>
          </div>

          <button
            type="button"
            onClick={
              openCreateCustomerModal
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <Plus size={18} />

            {language === "ar"
              ? "إضافة عميل"
              : "Add customer"}
          </button>
        </header>

        {successMessage ? (
          <div className="flex items-start gap-3 border-b border-green-100 bg-success-soft px-5 py-3 text-sm text-text-secondary">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0 text-success"
            />

            <p dir="auto">
              {successMessage}
            </p>
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
                  {language === "ar"
                    ? "تعذر الاتصال ببيانات العملاء"
                    : "Unable to connect to customer data"}
                </p>

                <p
                  dir="auto"
                  className="mt-1 text-sm text-text-secondary"
                >
                  {loadError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadCustomers()
              }
              className="rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
            >
              {language === "ar"
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
                  {language === "ar"
                    ? "فشل إجراء العميل"
                    : "Customer action failed"}
                </p>

                <p
                  dir="auto"
                  className="mt-1 text-sm text-text-secondary"
                >
                  {actionError}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setActionError(null)
              }
              className="rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white"
            >
              {language === "ar"
                ? "إغلاق"
                : "Dismiss"}
            </button>
          </div>
        ) : null}

        <div className="border-b border-border p-4">
          <label className="relative block">
            <Search
              size={18}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-text-secondary"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder={
                language === "ar"
                  ? "البحث عن العملاء..."
                  : "Search customers..."
              }
              className="h-11 w-full rounded-xl border border-border bg-surface-soft pe-4 ps-10 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary-soft"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-start">
            <thead className="bg-surface-soft">
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3 font-semibold">
                  {language === "ar"
                    ? "العميل"
                    : "Customer"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {language === "ar"
                    ? "معلومات التواصل"
                    : "Contact"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {language === "ar"
                    ? "الشركة"
                    : "Company"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {language === "ar"
                    ? "تاريخ الإنشاء"
                    : "Created"}
                </th>

                <th className="px-5 py-3 font-semibold">
                  {language === "ar"
                    ? "الحالة"
                    : "Status"}
                </th>

                <th className="w-28 px-5 py-3 text-end font-semibold">
                  {language === "ar"
                    ? "الإجراءات"
                    : "Actions"}
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary-soft border-t-primary" />

                    <p className="mt-3 text-sm text-text-secondary">
                      {language === "ar"
                        ? "جارٍ تحميل العملاء من الباك إند..."
                        : "Loading customers from the backend..."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filteredCustomers.map(
                  (customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-soft/60"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">
                            {getInitials(
                              customer.name,
                            ) || "CU"}
                          </div>

                          <div>
                            <p className="font-medium text-text-primary">
                              {
                                customer.name
                              }
                            </p>

                            <p
                              dir="ltr"
                              className="mt-1 text-xs text-text-secondary"
                            >
                              CUS-
                              {customer.id
                                .slice(0, 8)
                                .toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-2 text-sm text-text-secondary">
                          <div className="flex items-center gap-2">
                            <Mail
                              size={15}
                              className="shrink-0"
                            />

                            <span dir="auto">
                              {customer.email ||
                                (language ===
                                "ar"
                                  ? "البريد الإلكتروني غير متوفر"
                                  : "Email not provided")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Phone
                              size={15}
                              className="shrink-0"
                            />

                            <span dir="auto">
                              {customer.phone ||
                                (language ===
                                "ar"
                                  ? "رقم الهاتف غير متوفر"
                                  : "Phone not provided")}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                          <Building2
                            size={16}
                            className="shrink-0"
                          />

                          <span dir="auto">
                            {customer.company_name ||
                              (language ===
                              "ar"
                                ? "اسم الشركة غير متوفر"
                                : "Company not provided")}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-text-secondary">
                        {formatDate(
                          customer.created_at,
                          language,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                          {language === "ar"
                            ? "محفوظ"
                            : "Stored"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditCustomerModal(
                                customer,
                              )
                            }
                            disabled={
                              deletingCustomerId !==
                              null
                            }
                            aria-label={
                              language === "ar"
                                ? `تعديل ${customer.name}`
                                : `Edit ${customer.name}`
                            }
                            title={
                              language === "ar"
                                ? `تعديل ${customer.name}`
                                : `Edit ${customer.name}`
                            }
                            className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil
                              size={17}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteCustomer(
                                customer,
                              )
                            }
                            disabled={
                              deletingCustomerId !==
                              null
                            }
                            aria-label={
                              language === "ar"
                                ? `حذف ${customer.name}`
                                : `Delete ${customer.name}`
                            }
                            title={
                              language === "ar"
                                ? `حذف ${customer.name}`
                                : `Delete ${customer.name}`
                            }
                            className="inline-flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2
                              size={18}
                              className={
                                deletingCustomerId ===
                                customer.id
                                  ? "animate-pulse"
                                  : undefined
                              }
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}

              {!loading &&
              !loadError &&
              filteredCustomers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-14 text-center"
                  >
                    <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Users size={22} />
                    </div>

                    <p className="mt-3 font-medium text-text-primary">
                      {customers.length === 0
                        ? language === "ar"
                          ? "لا يوجد عملاء محفوظون بعد"
                          : "No customers stored yet"
                        : language === "ar"
                          ? "لا يوجد عملاء مطابقون للبحث"
                          : "No customers match your search"}
                    </p>

                    <p className="mt-1 text-sm text-text-secondary">
                      {customers.length === 0
                        ? language === "ar"
                          ? "استخدم زر إضافة عميل لإنشاء أول سجل في الباك إند."
                          : "Use Add customer to create the first backend record."
                        : language === "ar"
                          ? "حاول تغيير كلمة البحث عن العميل."
                          : "Try changing your customer search."}
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border px-5 py-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <span>
            {language === "ar"
              ? `عرض ${filteredCustomers.length} من أصل ${customers.length} عميل`
              : `Showing ${filteredCustomers.length} of ${customers.length} customers`}
          </span>

          <span>
            {language === "ar"
              ? "متصل بـ FastAPI"
              : "Connected to FastAPI"}
          </span>
        </footer>
      </section>

      <Modal
        open={modalOpen}
        title={
          editingCustomer
            ? language === "ar"
              ? "تعديل العميل"
              : "Edit customer"
            : language === "ar"
              ? "إضافة عميل"
              : "Add customer"
        }
        description={
          editingCustomer
            ? language === "ar"
              ? "تحديث سجل العميل في قاعدة بيانات شركتك."
              : "Update this customer record in your company database."
            : language === "ar"
              ? "إنشاء سجل عميل جديد لشركتك."
              : "Create a new customer record for your company."
        }
        onClose={closeCustomerModal}
      >
        <CustomerForm
          key={
            editingCustomer?.id ??
            "new-customer"
          }
          initialCustomer={
            editingCustomer
          }
          onCancel={
            closeCustomerModal
          }
          onSave={handleSaveCustomer}
          saving={savingCustomer}
          serverError={saveError}
        />
      </Modal>
    </>
  );
}