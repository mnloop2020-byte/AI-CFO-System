"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Mail, MailCheck, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/login/reset-password");
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl.toString(),
      });
      if (error) throw error;
      setSubmitted(true);
    } catch {
      setErrorMessage(
        isArabic
          ? "تعذر إرسال طلب الاستعادة الآن. حاول لاحقًا."
          : "Unable to submit the reset request right now. Please try later.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background p-4 sm:p-6">
      <section className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-surface shadow-xl">
        <header className="border-b border-border bg-primary-soft px-6 py-8 text-center sm:px-10">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-xl border border-blue-100 bg-surface px-3 py-2 text-xs font-semibold text-primary"
            >
              {isArabic ? "English" : "العربية"}
            </button>
          </div>
          <div className="mx-auto mt-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
            {submitted ? <MailCheck size={27} /> : <ShieldCheck size={27} />}
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
                ? "إذا كان الحساب موجودًا، فستصل رسالة تحتوي على رابط استعادة محدود الوقت."
                : "If the account exists, a time-limited recovery link will be sent."
              : isArabic
                ? "أدخل بريد حسابك لطلب رابط استعادة آمن."
                : "Enter your account email to request a secure recovery link."}
          </p>
        </header>

        <div className="px-6 py-7 sm:px-10">
          {errorMessage ? (
            <div role="alert" className="mb-5 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger">
              {errorMessage}
            </div>
          ) : null}

          {submitted ? (
            <div role="status" className="rounded-xl border border-green-100 bg-success-soft px-4 py-4 text-sm leading-6 text-text-secondary">
              {isArabic
                ? "نعرض الرد نفسه سواء كان البريد مسجلًا أم لا لحماية خصوصية الحسابات."
                : "For account privacy, the same response is shown whether or not the email is registered."}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  {isArabic ? "البريد الإلكتروني" : "Email address"}
                </span>
                <span className="relative block" dir="ltr">
                  <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="name@company.com"
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? <LoaderCircle size={18} className="animate-spin" /> : null}
                {isArabic ? "إرسال رابط الاستعادة" : "Send recovery link"}
              </button>
            </form>
          )}

          <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary">
            <ArrowLeft size={17} className={isArabic ? "rotate-180" : undefined} />
            {isArabic ? "العودة إلى تسجيل الدخول" : "Back to sign in"}
          </Link>
        </div>
      </section>
    </main>
  );
}
