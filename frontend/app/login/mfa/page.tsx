"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";

export default function MfaVerificationPage() {
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [code, setCode] = useState("");
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const numericCode = event.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(numericCode);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (code.length !== 6) return;

    setPreviewSubmitted(true);
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
            <ShieldCheck size={27} />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2">
            <Sparkles size={17} className="text-primary" />
            <span className="text-sm font-semibold text-text-primary">
              Zemam AI CFO
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-text-primary">
            {isArabic ? "تحقق من هويتك" : "Verify your identity"}
          </h1>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            {isArabic
              ? "أدخل رمز الأمان المكوّن من ستة أرقام من تطبيق المصادقة."
              : "Enter the six-digit security code from your authenticator application."}
          </p>
        </header>

        <div className="px-6 py-7 sm:px-10">
          {previewSubmitted ? (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-3 text-sm text-text-secondary"
            >
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
              <p>
                {isArabic
                  ? "تم إرسال تحقق MFA كمعاينة تصميمية، ولم يتم التحقق من الرمز فعليًا."
                  : "MFA verification was submitted as a design preview. The code has not been validated."}
              </p>
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-primary-soft p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary">
              <Smartphone size={20} />
            </div>

            <div>
              <p className="text-sm font-medium text-text-primary">
                {isArabic ? "افتح تطبيق المصادقة" : "Open your authenticator app"}
              </p>

              <p className="mt-1 text-xs leading-5 text-text-secondary">
                {isArabic
                  ? "تتغير الرموز عادة كل 30 ثانية. لا تشارك رمز الأمان مع أي شخص."
                  : "Codes normally change every 30 seconds. Never share this security code with anyone."}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">
                {isArabic ? "رمز الأمان المكوّن من ستة أرقام" : "Six-digit security code"}
              </span>

              <span className="relative block" dir="ltr">
                <KeyRound
                  size={19}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
                />

                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  placeholder="000000"
                  aria-label={
                    isArabic
                      ? "رمز الأمان المكوّن من ستة أرقام"
                      : "Six-digit security code"
                  }
                  className="h-14 w-full rounded-xl border border-border bg-surface pl-12 pr-4 text-center text-2xl font-semibold tracking-[0.45em] text-text-primary outline-none transition placeholder:text-slate-300 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                />
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                name="trustedDevice"
                className="mt-0.5 h-4 w-4 rounded border-border accent-blue-600"
              />

              <span>
                {isArabic ? "الوثوق بهذا الجهاز مؤقتًا" : "Trust this device temporarily"}
                <span className="mt-0.5 block text-xs">
                  {isArabic
                    ? "لا تفعّل هذا الخيار على جهاز مشترك أو عام."
                    : "Do not enable this option on a shared or public device."}
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={code.length !== 6}
              className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isArabic ? "معاينة التحقق" : "Preview verification"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-5 text-center">
            <p className="text-sm text-text-secondary">
              {isArabic
                ? "هل تواجه مشكلة في الوصول إلى تطبيق المصادقة؟"
                : "Having trouble accessing your authenticator?"}
            </p>

            <button
              type="button"
              disabled
              title={isArabic ? "الدعم غير متصل حاليًا" : "Support is not connected yet"}
              className="mt-2 cursor-not-allowed text-sm font-semibold text-text-secondary opacity-60"
            >
              {isArabic ? "التواصل مع مدير الشركة — قريبًا" : "Contact company administrator — coming soon"}
            </button>
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
            ? "MFA حاليًا تصميم فقط. سيتم تنفيذ تحقق TOTP الحقيقي وإنشاء الجلسة الآمنة باستخدام Supabase Auth."
            : "MFA is currently design-only. Real TOTP verification and secure session creation will be implemented with Supabase Auth."}
        </footer>
      </section>
    </main>
  );
}
