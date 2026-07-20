"use client";

import { type FormEvent, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Landmark,
  Save,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft";

export default function CompanySettingsForm() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPreviewSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {previewSubmitted ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-3 text-sm text-text-secondary"
        >
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-success"
          />

          <p>
            {isArabic
              ? "تم إرسال الإعدادات كمعاينة تصميمية فقط، ولم تُحفظ أي إعدادات للشركة."
              : "Settings were submitted as a design preview only. No company configuration was stored."}
          </p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Building2 size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-text-primary">
              {isArabic ? "معلومات الشركة" : "Company information"}
            </h2>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "المعلومات الأساسية التي ستظهر في التقارير والفواتير."
                : "Basic information that will appear across reports and invoices."}
            </p>
          </div>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "اسم الشركة" : "Company name"}
            </span>

            <input
              type="text"
              name="companyName"
              required
              placeholder={isArabic ? "أدخل اسم الشركة" : "Enter company name"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "الاسم القانوني" : "Legal name"}
            </span>

            <input
              type="text"
              name="legalName"
              placeholder={isArabic ? "الاسم القانوني المسجل" : "Registered legal name"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "البريد الإلكتروني للشركة" : "Business email"}
            </span>

            <input
              type="email"
              name="email"
              dir="ltr"
              placeholder="finance@company.com"
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "رقم الهاتف" : "Phone number"}
            </span>

            <input
              type="tel"
              name="phone"
              dir="ltr"
              placeholder="+90 555 000 0000"
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "الدولة" : "Country"}
            </span>

            <input
              type="text"
              name="country"
              placeholder={isArabic ? "دولة الشركة" : "Company country"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "المدينة" : "City"}
            </span>

            <input
              type="text"
              name="city"
              placeholder={isArabic ? "مدينة الشركة" : "Company city"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "عنوان الشركة" : "Business address"}
            </span>

            <textarea
              name="address"
              rows={3}
              placeholder={
                isArabic
                  ? "أدخل عنوان الشركة المسجل..."
                  : "Enter the registered business address..."
              }
              className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <ShieldCheck size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-text-primary">
              {isArabic ? "الإعدادات المالية والضريبية" : "Finance and tax settings"}
            </h2>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "اضبط العملة والسنة المالية والمعلومات الضريبية."
                : "Configure currency, fiscal year, and tax information."}
            </p>
          </div>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "العملة الافتراضية" : "Default currency"}
            </span>

            <select name="currency" defaultValue="" className={inputClasses}>
              <option value="">
                {isArabic ? "غير مُعدّة" : "Not configured"}
              </option>
              <option value="USD">USD — {isArabic ? "الدولار الأمريكي" : "US Dollar"}</option>
              <option value="EUR">EUR — {isArabic ? "اليورو" : "Euro"}</option>
              <option value="TRY">TRY — {isArabic ? "الليرة التركية" : "Turkish Lira"}</option>
              <option value="SAR">SAR — {isArabic ? "الريال السعودي" : "Saudi Riyal"}</option>
              <option value="AED">AED — {isArabic ? "الدرهم الإماراتي" : "UAE Dirham"}</option>
              <option value="GBP">GBP — {isArabic ? "الجنيه الإسترليني" : "British Pound"}</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "بداية السنة المالية" : "Fiscal year starts"}
            </span>

            <select
              name="fiscalYearStart"
              defaultValue="january"
              className={inputClasses}
            >
              <option value="january">{isArabic ? "يناير" : "January"}</option>
              <option value="april">{isArabic ? "أبريل" : "April"}</option>
              <option value="july">{isArabic ? "يوليو" : "July"}</option>
              <option value="october">{isArabic ? "أكتوبر" : "October"}</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "الاختصاص الضريبي" : "Tax jurisdiction"}
            </span>

            <input
              type="text"
              name="taxJurisdiction"
              placeholder={isArabic ? "غير مُعدّ" : "Not configured"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "الرقم التعريفي الضريبي" : "Tax identification number"}
            </span>

            <input
              type="text"
              name="taxId"
              dir="ltr"
              placeholder={isArabic ? "أدخل الرقم الضريبي" : "Enter tax ID"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "التسجيل في ضريبة القيمة المضافة" : "VAT registration"}
            </span>

            <select
              name="vatRegistration"
              defaultValue="not-configured"
              className={inputClasses}
            >
              <option value="not-configured">
                {isArabic ? "غير مُعدّ" : "Not configured"}
              </option>
              <option value="registered">
                {isArabic ? "مسجل في ضريبة القيمة المضافة" : "VAT registered"}
              </option>
              <option value="not-registered">
                {isArabic ? "غير مسجل في ضريبة القيمة المضافة" : "Not VAT registered"}
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
            <Landmark size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-text-primary">
              {isArabic ? "البنك والرصيد الافتتاحي" : "Bank and opening balance"}
            </h2>

            <p className="mt-1 text-sm text-text-secondary">
              {isArabic
                ? "معلومات بداية اختيارية لتتبع التدفق النقدي مستقبلًا."
                : "Optional starting information for future cash-flow tracking."}
            </p>
          </div>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "اسم البنك أو الحساب" : "Bank or account name"}
            </span>

            <input
              type="text"
              name="bankName"
              placeholder={isArabic ? "غير مُعدّ" : "Not configured"}
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "الرصيد الافتتاحي" : "Opening balance"}
            </span>

            <input
              type="number"
              name="openingBalance"
              step="0.01"
              dir="ltr"
              placeholder="0.00"
              className={inputClasses}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-text-primary">
              {isArabic ? "تاريخ الرصيد" : "Balance date"}
            </span>

            <input type="date" name="balanceDate" className={inputClasses} />
          </label>

          <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3 text-sm text-text-secondary">
            {isArabic
              ? "الربط المباشر بالبنك غير متوفر حاليًا. هذه المعلومات مخصصة لإعداد الرصيد الافتتاحي فقط."
              : "Live bank connection is not included yet. This information is only an opening balance configuration."}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          <Save size={18} />
          {isArabic ? "إرسال المعاينة" : "Submit preview"}
        </button>
      </div>
    </form>
  );
}
