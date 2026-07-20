"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { getAuthMe } from "@/lib/auth";
import {
  getCompanySettings,
  updateCompanySettings,
  type CompanySettings,
  type CompanySettingsUpdate,
} from "@/lib/company";

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-text-secondary";

const emptySettings: CompanySettingsUpdate = {
  name: "",
  legal_name: null,
  email: null,
  phone: null,
  address: null,
  country: null,
  city: null,
  currency: null,
  timezone: "UTC",
  default_language: "en",
  fiscal_year_start: 1,
  tax_jurisdiction: null,
  tax_id: null,
  vat_registered: null,
  bank_name: null,
  opening_balance: null,
  balance_date: null,
  financial_settings: {},
};

function editableSettings(settings: CompanySettings): CompanySettingsUpdate {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...editable } =
    settings;
  return editable;
}

function nullable(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export default function CompanySettingsForm() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [settings, setSettings] = useState<CompanySettingsUpdate>(emptySettings);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [company, identity] = await Promise.all([
        getCompanySettings(),
        getAuthMe(),
      ]);
      setSettings(editableSettings(company));
      setCanEdit(identity.permissions.includes("company.update"));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر تحميل إعدادات الشركة."
            : "Unable to load company settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const setText = (field: keyof CompanySettingsUpdate, value: string) => {
    setSettings((current) => ({ ...current, [field]: nullable(value) }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateCompanySettings(settings);
      setSettings(editableSettings(updated));
      setSuccessMessage(
        isArabic
          ? "تم حفظ إعدادات الشركة بنجاح."
          : "Company settings were saved successfully.",
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر حفظ إعدادات الشركة."
            : "Unable to save company settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border bg-surface">
        <LoaderCircle className="animate-spin text-primary" size={30} />
        <p className="mt-3 text-sm text-text-secondary">
          {isArabic ? "جارٍ تحميل إعدادات الشركة..." : "Loading company settings..."}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-danger-soft p-5 text-danger">
        <div className="flex items-start gap-3">
          <CircleAlert size={20} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              {isArabic ? "تعذر تحميل إعدادات الشركة" : "Unable to load company settings"}
            </p>
            <p className="mt-1 text-sm">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="inline-flex items-center gap-2 rounded-xl border border-danger px-3 py-2 text-sm font-medium"
          >
            <RefreshCw size={16} />
            {isArabic ? "إعادة المحاولة" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!canEdit ? (
        <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3 text-sm text-text-secondary">
          {isArabic
            ? "يمكنك عرض إعدادات الشركة، لكن التعديل متاح للمالك والمدير فقط."
            : "You can view company settings. Only the Owner and Admin can edit them."}
        </div>
      ) : null}

      {successMessage ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{successMessage}</p>
        </div>
      ) : null}

      {saveError ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{saveError}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Building2 size={21} /></div>
          <div>
            <h2 className="font-semibold text-text-primary">{isArabic ? "معلومات الشركة" : "Company information"}</h2>
            <p className="mt-1 text-sm text-text-secondary">{isArabic ? "المعلومات الأساسية المستخدمة في التقارير والفواتير." : "Core information used across reports and invoices."}</p>
          </div>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label={isArabic ? "اسم الشركة" : "Company name"}>
            <input required disabled={!canEdit || saving} value={settings.name} onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "الاسم القانوني" : "Legal name"}>
            <input disabled={!canEdit || saving} value={settings.legal_name ?? ""} onChange={(event) => setText("legal_name", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "البريد التجاري" : "Business email"}>
            <input type="email" dir="ltr" disabled={!canEdit || saving} value={settings.email ?? ""} onChange={(event) => setText("email", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "رقم الهاتف" : "Phone number"}>
            <input type="tel" dir="ltr" disabled={!canEdit || saving} value={settings.phone ?? ""} onChange={(event) => setText("phone", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "الدولة" : "Country"}>
            <input disabled={!canEdit || saving} value={settings.country ?? ""} onChange={(event) => setText("country", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "المدينة" : "City"}>
            <input disabled={!canEdit || saving} value={settings.city ?? ""} onChange={(event) => setText("city", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "العنوان" : "Business address"} wide>
            <textarea rows={3} disabled={!canEdit || saving} value={settings.address ?? ""} onChange={(event) => setText("address", event.target.value)} className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-surface-soft" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><ShieldCheck size={21} /></div>
          <div>
            <h2 className="font-semibold text-text-primary">{isArabic ? "الإعدادات المالية والضريبية" : "Finance and tax settings"}</h2>
            <p className="mt-1 text-sm text-text-secondary">{isArabic ? "قيم صريحة يستخدمها النظام دون تخمينها." : "Explicit values the system can use without guessing."}</p>
          </div>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label={isArabic ? "العملة الافتراضية" : "Default currency"}>
            <select disabled={!canEdit || saving} value={settings.currency ?? ""} onChange={(event) => setSettings((current) => ({ ...current, currency: event.target.value || null }))} className={inputClasses}>
              <option value="">{isArabic ? "غير معدّة" : "Not configured"}</option>
              {['USD','EUR','TRY','SAR','AED','GBP'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? "المنطقة الزمنية" : "Timezone"}>
            <input required disabled={!canEdit || saving} value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "اللغة الافتراضية" : "Default language"}>
            <select disabled={!canEdit || saving} value={settings.default_language} onChange={(event) => setSettings((current) => ({ ...current, default_language: event.target.value as "en" | "ar" }))} className={inputClasses}>
              <option value="en">English</option><option value="ar">العربية</option>
            </select>
          </Field>
          <Field label={isArabic ? "شهر بداية السنة المالية" : "Fiscal year start month"}>
            <select disabled={!canEdit || saving} value={settings.fiscal_year_start} onChange={(event) => setSettings((current) => ({ ...current, fiscal_year_start: Number(event.target.value) }))} className={inputClasses}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1)))}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? "الاختصاص الضريبي" : "Tax jurisdiction"}>
            <input disabled={!canEdit || saving} value={settings.tax_jurisdiction ?? ""} onChange={(event) => setText("tax_jurisdiction", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "الرقم الضريبي" : "Tax ID"}>
            <input dir="ltr" disabled={!canEdit || saving} value={settings.tax_id ?? ""} onChange={(event) => setText("tax_id", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "التسجيل في ضريبة القيمة المضافة" : "VAT registration"} wide>
            <select disabled={!canEdit || saving} value={settings.vat_registered === null ? "unknown" : settings.vat_registered ? "yes" : "no"} onChange={(event) => setSettings((current) => ({ ...current, vat_registered: event.target.value === "unknown" ? null : event.target.value === "yes" }))} className={inputClasses}>
              <option value="unknown">{isArabic ? "غير معدّ" : "Not configured"}</option>
              <option value="yes">{isArabic ? "مسجّلة" : "Registered"}</option>
              <option value="no">{isArabic ? "غير مسجّلة" : "Not registered"}</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success"><Landmark size={21} /></div>
          <div>
            <h2 className="font-semibold text-text-primary">{isArabic ? "الرصيد الافتتاحي" : "Opening balance"}</h2>
            <p className="mt-1 text-sm text-text-secondary">{isArabic ? "قيمة اختيارية يحددها المستخدم، وليست رصيدًا بنكيًا مباشرًا." : "An optional user-provided value, not a live bank balance."}</p>
          </div>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label={isArabic ? "اسم البنك أو الحساب" : "Bank or account name"}>
            <input disabled={!canEdit || saving} value={settings.bank_name ?? ""} onChange={(event) => setText("bank_name", event.target.value)} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "الرصيد الافتتاحي" : "Opening balance"}>
            <input type="number" step="0.01" dir="ltr" disabled={!canEdit || saving} value={settings.opening_balance ?? ""} onChange={(event) => setSettings((current) => ({ ...current, opening_balance: event.target.value || null }))} className={inputClasses} />
          </Field>
          <Field label={isArabic ? "تاريخ الرصيد" : "Balance date"}>
            <input type="date" disabled={!canEdit || saving} value={settings.balance_date ?? ""} onChange={(event) => setSettings((current) => ({ ...current, balance_date: event.target.value || null }))} className={inputClasses} />
          </Field>
        </div>
      </section>

      {canEdit ? (
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60">
            {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : (isArabic ? "حفظ الإعدادات" : "Save settings")}
          </button>
        </div>
      ) : null}
    </form>
  );
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
    </label>
  );
}
