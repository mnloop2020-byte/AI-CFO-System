"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MailCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";

export default function ForgotPasswordPage() {
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background p-4 sm:p-6">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        <header className="border-b border-border bg-primary-soft px-6 py-8 text-center sm:px-10">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
              className="rounded-xl border border-blue-100 bg-surface px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary-soft"
            >
              {isArabic ? "English" : "العربية"}
            </button>
          </div>

          <div className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-blue-200">
            {submitted ? <MailCheck size={27} /> : <ShieldCheck size={27} />}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <Sparkles size={17} className="text-primary" />
            <span className="text-sm font-semibold text-text-primary">
              Zemam AI CFO
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-text-primary">
            {submitted
              ? isArabic
                ? "تحقق من بريدك الإلكتروني"
                : "Check your email"
              : isArabic
                ? "إعادة تعيين كلمة المرور"
                : "Reset your password"}
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            {submitted
              ? isArabic
                ? "إذا وُجد حساب مرتبط بهذا البريد، فستُرسل إليه تعليمات إعادة تعيين كلمة المرور بعد اكتمال الربط."
                : "If an account exists for this email, password reset instructions will be sent after integration."
              : isArabic
                ? "أدخل بريد الشركة لطلب تعليمات آمنة لإعادة تعيين كلمة المرور."
                : "Enter your company email to request secure password reset instructions."}
          </p>
        </header>

        <div className="px-6 py-7 sm:px-10">
          {submitted ? (
            <div className="space-y-5">
              <div
                role="status"
                className="rounded-xl border border-green-100 bg-success-soft px-4 py-4"
              >
                <p className="text-sm font-medium text-text-primary">
                  {isArabic ? "تم استلام الطلب التجريبي" : "Preview request received"}
                </p>

                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {isArabic
                    ? "لأسباب أمنية، ستعرض النسخة الحقيقية الاستجابة نفسها سواء كان البريد مسجلًا أم لا."
                    : "For security, the real flow will show the same response whether or not the email is registered."}
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-primary-soft px-4 py-4 text-sm leading-6 text-text-secondary">
                {isArabic
                  ? "إعادة تعيين كلمة المرور معاينة تصميمية حاليًا، ولم يتم إرسال أي بريد إلكتروني."
                  : "Password reset is currently a design preview. No email has been sent."}
              </div>

              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="h-12 w-full rounded-xl border border-border bg-surface text-sm font-semibold text-text-primary transition hover:bg-surface-soft"
              >
                {isArabic ? "تجربة بريد آخر" : "Try another email"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  {isArabic ? "البريد الإلكتروني للشركة" : "Company email"}
                </span>

                <span className="relative block" dir="ltr">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
                  />

                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                </span>
              </label>

              <button
                type="submit"
                className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                {isArabic ? "معاينة طلب الاستعادة" : "Preview reset request"}
              </button>
            </form>
          )}

          <div className="mt-6 rounded-xl border border-border bg-surface-soft px-4 py-4 text-sm text-text-secondary">
            {isArabic
              ? "ستُحمى طلبات الاستعادة لاحقًا بتحديد معدل الطلبات وCAPTCHA لتقليل إساءة الاستخدام الآلي."
              : "Reset requests will later be protected by rate limits and CAPTCHA to reduce automated abuse."}
          </div>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={17} className={isArabic ? "rotate-180" : undefined} />
            {isArabic ? "العودة إلى تسجيل الدخول" : "Back to sign in"}
          </Link>
        </div>

        <footer className="border-t border-border bg-surface-soft px-6 py-4 text-center text-xs leading-5 text-text-secondary">
          {isArabic
            ? "ستكون روابط إعادة تعيين كلمة المرور محدودة الوقت وستتم معالجتها عبر Supabase Auth بعد الربط."
            : "Password reset links will be time-limited and handled through Supabase Auth after integration."}
        </footer>
      </section>
    </main>
  );
}
