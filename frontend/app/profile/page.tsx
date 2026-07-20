"use client";

import { type FormEvent, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useLanguage } from "@/components/providers/LanguageProvider";

const inputClasses =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft";

export default function ProfilePage() {
  const { language, setLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPreviewSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <Header
          title={isArabic ? "الملف الشخصي والأمان" : "Profile & Security"}
          description={
            isArabic
              ? "أدر معلوماتك الشخصية ومستوى الوصول وأمان الحساب."
              : "Manage your personal information, access level, and account security."
          }
        />

        <main className="p-5 lg:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-xl font-semibold text-primary">
                  M
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-text-primary">
                      {isArabic ? "محمد" : "Mohammed"}
                    </h1>

                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                      <BadgeCheck size={14} />
                      {isArabic ? "نشط" : "Active"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-text-secondary">
                    {isArabic ? "مدير الشركة" : "Company Administrator"}
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
                    <Mail size={14} />
                    {isArabic
                      ? "سيتم جلب البريد الإلكتروني من Supabase Auth"
                      : "Email will come from Supabase Auth"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-3 text-sm text-text-secondary">
                {isArabic
                  ? "معلومات الملف الشخصي معاينة تصميمية حاليًا."
                  : "Profile information is currently a design preview."}
              </div>
            </section>

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
                    ? "تم إرسال تغييرات الملف الشخصي كمعاينة فقط، ولم تُحفظ أي معلومات للحساب."
                    : "Profile changes were submitted as a preview only. No account information was stored."}
                </p>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-border bg-surface shadow-sm"
              >
                <header className="flex items-start gap-3 border-b border-border p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <UserRound size={21} />
                  </div>

                  <div>
                    <h2 className="font-semibold text-text-primary">
                      {isArabic ? "المعلومات الشخصية" : "Personal information"}
                    </h2>

                    <p className="mt-1 text-sm text-text-secondary">
                      {isArabic
                        ? "المعلومات المستخدمة في مساحة عمل شركتك."
                        : "Information used across your company workspace."}
                    </p>
                  </div>
                </header>

                <div className="grid gap-5 p-5 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-text-primary">
                      {isArabic ? "الاسم الكامل" : "Full name"}
                    </span>

                    <input
                      type="text"
                      name="fullName"
                      defaultValue={isArabic ? "محمد" : "Mohammed"}
                      className={inputClasses}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-text-primary">
                      {isArabic ? "المسمى الوظيفي" : "Job title"}
                    </span>

                    <input
                      type="text"
                      name="jobTitle"
                      defaultValue={isArabic ? "مدير النظام" : "Administrator"}
                      className={inputClasses}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-text-primary">
                      {isArabic ? "البريد الإلكتروني" : "Email address"}
                    </span>

                    <input
                      type="email"
                      name="email"
                      dir="ltr"
                      placeholder={
                        isArabic
                          ? "سيتم ربطه من خلال المصادقة"
                          : "Connected through authentication"
                      }
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

                  <label className="space-y-2 sm:col-span-2">
                    <span className="text-sm font-medium text-text-primary">
                      {isArabic ? "اللغة المفضلة" : "Preferred language"}
                    </span>

                    <select
                      name="language"
                      value={language}
                      onChange={(event) =>
                        setLanguage(event.target.value === "ar" ? "ar" : "en")
                      }
                      className={inputClasses}
                    >
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                  </label>
                </div>

                <footer className="flex justify-end border-t border-border p-5">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  >
                    <Save size={18} />
                    {isArabic ? "إرسال المعاينة" : "Submit preview"}
                  </button>
                </footer>
              </form>

              <div className="space-y-6">
                <section className="rounded-2xl border border-border bg-surface shadow-sm">
                  <header className="flex items-start gap-3 border-b border-border p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                      <ShieldCheck size={21} />
                    </div>

                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic ? "أمان الحساب" : "Account security"}
                      </h2>

                      <p className="mt-1 text-sm text-text-secondary">
                        {isArabic
                          ? "حماية المصادقة والجلسات."
                          : "Authentication protection and sessions."}
                      </p>
                    </div>
                  </header>

                  <div className="divide-y divide-border">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <KeyRound
                            size={19}
                            className="mt-0.5 shrink-0 text-warning"
                          />

                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {isArabic
                                ? "المصادقة متعددة العوامل"
                                : "Multi-factor authentication"}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-text-secondary">
                              {isArabic
                                ? "ستكون مطلوبة لحسابات المديرين."
                                : "Will be required for administrator accounts."}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
                          {isArabic ? "غير متصلة" : "Not connected"}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled
                        title={isArabic ? "المصادقة غير متصلة حاليًا" : "Authentication is not connected yet"}
                        className="mt-4 h-10 w-full cursor-not-allowed rounded-xl border border-border text-sm font-medium text-text-secondary opacity-60"
                      >
                        {isArabic ? "إعداد MFA — قريبًا" : "Set up MFA — coming soon"}
                      </button>
                    </div>

                    <div className="p-5">
                      <div className="flex gap-3">
                        <MonitorSmartphone
                          size={19}
                          className="mt-0.5 shrink-0 text-primary"
                        />

                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {isArabic ? "الجلسات النشطة" : "Active sessions"}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-text-secondary">
                            {isArabic
                              ? "ستتوفر معلومات الجلسات بعد ربط نظام المصادقة."
                              : "Session information will be available after authentication integration."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled
                        title={isArabic ? "إدارة الجلسات غير متصلة حاليًا" : "Session management is not connected yet"}
                        className="mt-4 h-10 w-full cursor-not-allowed rounded-xl border border-border text-sm font-medium text-text-secondary opacity-60"
                      >
                        {isArabic ? "إدارة الجلسات — قريبًا" : "Manage sessions — coming soon"}
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-amber-100 bg-warning-soft p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={20}
                      className="mt-0.5 shrink-0 text-warning"
                    />

                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic ? "حساب ذو صلاحيات حساسة" : "Sensitive account"}
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        {isArabic
                          ? "ستتطلب إجراءات المدير، مثل تغيير صلاحيات الشركة أو تصدير البيانات المالية أو إدارة الأمان، تحققًا حديثًا باستخدام MFA."
                          : "Administrator actions such as changing company access, exporting financial data, or managing security will require recent MFA verification."}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Building2
                      size={20}
                      className="mt-0.5 shrink-0 text-primary"
                    />

                    <div>
                      <h2 className="font-semibold text-text-primary">
                        {isArabic ? "صلاحية الشركة" : "Company access"}
                      </h2>

                      <p className="mt-1 text-sm text-text-secondary">
                        {isArabic ? "الدور الحالي" : "Current role"}
                      </p>

                      <p className="mt-1 font-medium text-text-primary">
                        {isArabic ? "مدير النظام" : "Administrator"}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
