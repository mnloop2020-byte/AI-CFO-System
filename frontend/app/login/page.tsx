"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { getAuthMe } from "@/lib/auth";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const callbackError = new URLSearchParams(window.location.search).get(
      "error",
    );
    if (callbackError === "confirmation_failed") {
      setAuthError(
        isArabic
          ? "تعذر تأكيد رابط المصادقة. اطلب رابطًا جديدًا وحاول مرة أخرى."
          : "The authentication link could not be confirmed. Request a new link and try again.",
      );
    }
  }, [isArabic]);

  const benefits = isArabic
    ? [
        "سجلات مالية وبيانات عملاء في مكان واحد",
        "تحليلات من وكلاء ماليين متخصصين",
        "مراجعة بشرية للقرارات الحساسة",
      ]
    : [
        "Centralized financial and CRM records",
        "Specialized finance agent analysis",
        "Human review for sensitive decisions",
      ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      try {
        await getAuthMe();
      } catch (membershipError) {
        await supabase.auth.signOut();
        throw membershipError;
      }

      const nextPath = getSafeNextPath(
        new URLSearchParams(window.location.search).get("next"),
      );
      router.replace(nextPath);
      router.refresh();
    } catch {
      setAuthError(
        isArabic
          ? "تعذر تسجيل الدخول. تحقق من بيانات الدخول أو تواصل مع مدير الشركة."
          : "Unable to sign in. Check your credentials or contact the company administrator.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-app-background p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-3xl border border-border bg-surface shadow-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                  <Sparkles size={22} />
                </span>
                <span>
                  <span className="block font-semibold text-text-primary">Zemam</span>
                  <span className="block text-xs text-text-secondary">
                    {isArabic ? "نظام المدير المالي الذكي" : "AI CFO System"}
                  </span>
                </span>
              </Link>

              <button
                type="button"
                onClick={toggleLanguage}
                aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary-soft"
              >
                {isArabic ? "English" : "العربية"}
              </button>
            </div>

            <div className="mt-10">
              <p className="text-sm font-medium text-primary">
                {isArabic ? "مرحبًا بعودتك" : "Welcome back"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
                {isArabic
                  ? "سجّل الدخول إلى مساحة عملك المالية"
                  : "Sign in to your financial workspace"}
              </h1>
              <p className="mt-3 leading-7 text-text-secondary">
                {isArabic
                  ? "تتحقق الجلسة عبر Supabase Auth، ويحدد الخادم شركتك وصلاحياتك قبل الوصول إلى البيانات."
                  : "Supabase Auth verifies your session, then the server resolves your company and permissions before data access."}
              </p>
            </div>

            {authError ? (
              <div role="alert" className="mt-6 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger">
                {authError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                </span>
              </label>

              <label className="block space-y-2">
                <span className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-text-primary">
                    {isArabic ? "كلمة المرور" : "Password"}
                  </span>
                  <Link href="/login/forgot-password" className="text-sm font-medium text-primary hover:text-primary-hover">
                    {isArabic ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </Link>
                </span>
                <span className="relative block" dir="ltr">
                  <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder={isArabic ? "أدخل كلمة المرور" : "Enter your password"}
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-12 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-soft hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <LoaderCircle size={18} className="animate-spin" /> : null}
                {submitting
                  ? isArabic
                    ? "جارٍ تسجيل الدخول..."
                    : "Signing in..."
                  : isArabic
                    ? "تسجيل الدخول"
                    : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              {isArabic
                ? "الحسابات الجديدة تُنشأ من رابط دعوة آمن يرسله المالك أو المدير."
                : "New accounts require a secure invitation from an owner or admin."}
            </p>
          </div>
        </section>

        <section className="hidden bg-primary-soft p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-surface px-3 py-1.5 text-xs font-medium text-primary">
              <ShieldCheck size={15} />
              {isArabic ? "مساحة عمل مالية آمنة" : "Secure financial workspace"}
            </span>
          </div>
          <div className="mx-auto max-w-lg">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-blue-200">
              <Sparkles size={30} />
            </div>
            <h2 className="mt-8 text-3xl font-semibold leading-tight text-text-primary">
              {isArabic
                ? "وضوح مالي مدعوم بوكلاء ذكاء اصطناعي متخصصين."
                : "Financial clarity powered by specialized AI agents."}
            </h2>
            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 rounded-xl border border-blue-100 bg-surface/80 px-4 py-3">
                  <CheckCircle2 size={18} className="shrink-0 text-success" />
                  <span className="text-sm font-medium text-text-primary">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center text-xs text-text-secondary">
            {isArabic
              ? "يجب مراجعة إجابات الذكاء الاصطناعي قبل اتخاذ القرارات المالية."
              : "AI responses should be reviewed before financial decisions."}
          </p>
        </section>
      </div>
    </main>
  );
}
