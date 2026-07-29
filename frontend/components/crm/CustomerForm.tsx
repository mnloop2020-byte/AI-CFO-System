"use client";

import {
  Building2,
  CircleAlert,
  LoaderCircle,
  Mail,
  Phone,
  Save,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  useState,
} from "react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  type CreateCustomerInput,
  type Customer,
} from "@/lib/customers";

type CustomerFormProps = {
  initialCustomer?: Customer | null;
  onCancel: () => void;
  onSave: (
    customer: CreateCustomerInput,
  ) => void | Promise<void>;
  saving?: boolean;
  serverError?: string | null;
};

type CustomerFormState = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  notes: string;
};

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-70";

export default function CustomerForm({
  initialCustomer = null,
  onCancel,
  onSave,
  saving = false,
  serverError = null,
}: CustomerFormProps) {
  const { language } = useLanguage();

  const [formData, setFormData] =
    useState<CustomerFormState>(() => ({
      name: initialCustomer?.name ?? "",
      email: initialCustomer?.email ?? "",
      phone: initialCustomer?.phone ?? "",
      companyName:
        initialCustomer?.company_name ?? "",
      notes: initialCustomer?.notes ?? "",
    }));

  function updateField(
    field: keyof CustomerFormState,
    value: string,
  ) {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const customerData: CreateCustomerInput = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      company_name:
        formData.companyName.trim(),
      notes: formData.notes.trim(),
    };

    void onSave(customerData);
  }

  const editing = Boolean(initialCustomer);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {serverError ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-danger-soft px-4 py-3">
          <CircleAlert
            size={19}
            className="mt-0.5 shrink-0 text-danger"
          />

          <div>
            <p className="text-sm font-semibold text-danger">
              {language === "ar"
                ? "تعذر حفظ بيانات العميل"
                : "Unable to save customer"}
            </p>

            <p
              dir="auto"
              className="mt-1 text-sm text-text-secondary"
            >
              {serverError}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {language === "ar"
              ? "اسم العميل"
              : "Customer name"}
          </span>

          <div className="relative">
            <UserRound
              size={17}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />

            <input
              dir="auto"
              type="text"
              name="name"
              required
              autoComplete="name"
              value={formData.name}
              onChange={(event) =>
                updateField(
                  "name",
                  event.target.value,
                )
              }
              disabled={saving}
              placeholder={
                language === "ar"
                  ? "أدخل اسم العميل"
                  : "Enter customer name"
              }
              className={`${inputClasses} pe-3.5 ps-10`}
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {language === "ar"
              ? "اسم الشركة"
              : "Company name"}
          </span>

          <div className="relative">
            <Building2
              size={17}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />

            <input
              dir="auto"
              type="text"
              name="companyName"
              autoComplete="organization"
              value={formData.companyName}
              onChange={(event) =>
                updateField(
                  "companyName",
                  event.target.value,
                )
              }
              disabled={saving}
              placeholder={
                language === "ar"
                  ? "أدخل اسم الشركة"
                  : "Enter company name"
              }
              className={`${inputClasses} pe-3.5 ps-10`}
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {language === "ar"
              ? "البريد الإلكتروني"
              : "Email address"}
          </span>

          <div className="relative">
            <Mail
              size={17}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />

            <input
              dir="ltr"
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={(event) =>
                updateField(
                  "email",
                  event.target.value,
                )
              }
              disabled={saving}
              placeholder="customer@example.com"
              className={`${inputClasses} pe-3.5 ps-10 text-left`}
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-text-primary">
            {language === "ar"
              ? "رقم الهاتف"
              : "Phone number"}
          </span>

          <div className="relative">
            <Phone
              size={17}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
            />

            <input
              dir="ltr"
              type="tel"
              name="phone"
              autoComplete="tel"
              value={formData.phone}
              onChange={(event) =>
                updateField(
                  "phone",
                  event.target.value,
                )
              }
              disabled={saving}
              placeholder="+90 555 000 0000"
              className={`${inputClasses} pe-3.5 ps-10 text-left`}
            />
          </div>
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-text-primary">
          {language === "ar"
            ? "ملاحظات"
            : "Notes"}
        </span>

        <textarea
          dir="auto"
          name="notes"
          rows={4}
          value={formData.notes}
          onChange={(event) =>
            updateField(
              "notes",
              event.target.value,
            )
          }
          disabled={saving}
          placeholder={
            language === "ar"
              ? "أضف ملاحظات اختيارية عن العميل..."
              : "Add optional notes about this customer..."
          }
          className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:opacity-70"
        />
      </label>

      <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3">
        <p className="text-sm leading-6 text-text-secondary">
          {language === "ar"
            ? "سيتم حفظ بيانات العميل مباشرة في FastAPI وقاعدة بيانات Supabase."
            : "Customer data will be stored directly through FastAPI in the Supabase database."}
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-11 rounded-xl border border-border bg-surface px-5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {language === "ar"
            ? "إلغاء"
            : "Cancel"}
        </button>

        <button
          type="submit"
          disabled={
            saving ||
            !formData.name.trim()
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
          ) : (
            <Save size={18} />
          )}

          {saving
            ? language === "ar"
              ? "جارٍ الحفظ..."
              : "Saving..."
            : editing
              ? language === "ar"
                ? "حفظ التعديلات"
                : "Save changes"
              : language === "ar"
                ? "إضافة العميل"
                : "Add customer"}
        </button>
      </div>
    </form>
  );
}