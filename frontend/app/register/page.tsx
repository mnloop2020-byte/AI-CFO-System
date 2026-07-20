"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  LoaderCircle,
  Mail,
  Sparkles,
  User,
} from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

const inputClasses =
  "h-12 w-full rounded-xl border border-border bg-surface pe-4 ps-11 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft";

export default function RegisterPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const passwordRequirements = useMemo(
    () => [
      {
        label: isArabic ? "12 حرفًا على الأقل" : "At least 12 characters",
        valid: password.length >= 12,
      },
      {
        label: isArabic
          ? "أحرف إنجليزية كبيرة وصغيرة"
          : "Uppercase and lowercase letters",
        valid: /[A-Z]/.test(password) && /[a-z]/.test(password),
      },
      {
        label: isArabic ? "رقم واحد على الأقل" : "At least one number",
        valid: /\d/.test(password),
      },
      {
        label: isArabic ? "رمز خاص واحد على الأقل" : "At least one special character",
        valid: /[^A-Za-z0-9]/.test(password),
      },
    ],
    [isArabic, password],
  );

  const passwordIsStrong = passwordRequirements.every(
    (requirement) => requirement.valid,
  );
  const passwordsMatch =
    confirmation.length > 0 && password === confirmation;

  const features = isArabic
    ? [
        "عزل البيانات على مستوى الشركة",
        "صلاحيات مالية حسب الأدوار",
        "المصادقة متعددة العوامل",
        "مراجعة بشرية للإجراءات الحساسة",
      ]
    : [
        "Company-level data isolation",
        "Role-based financial access",
        "Multi-factor authentication",
        "Human review for sensitive actions",
      ];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordIsStrong || !passwordsMatch) return;

    setSubmitting(true);
    setSubmitted(false);
    setAuthError(null);

    const formData = new FormData(event.currentTarget);
    const companyName = String(
      formData.get("companyName") ?? "",
    ).trim();
    const administratorName = String(
      formData.get("administratorName") ?? "",
    ).trim();
    const email = String(formData.get("email") ?? "").trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            company_name: companyName,
            full_name: administratorName,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setSubmitted(true);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : isArabic
            ? "تعذر إنشاء الحساب."
            : "Unable to create the account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-app-background p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-3xl border border-border bg-surface shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden bg-primary-soft p-10 lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
              <Sparkles size={22} />
            </span>

            <span>
              <span className="block font-semibold text-text-primary">
                Zemam
              </span>

              <span className="block text-xs text-text-secondary">
                {isArabic ? "نظام المدير المالي الذكي" : "AI CFO System"}
              </span>
            </span>
          </Link>

          <div className="mx-auto max-w-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-blue-200">
              <Building2 size={29} />
            </div>

            <h2 className="mt-8 text-3xl font-semibold leading-tight text-text-primary">
              {isArabic
                ? "أنشئ مساحة عمل مالية آمنة لشركتك."
                : "Build a secure financial workspace for your company."}
            </h2>

            <p className="mt-4 leading-7 text-text-secondary">
              {isArabic
                ? "أنشئ حساب شركتك، وادعُ أعضاء الفريق المصرّح لهم، وأدر الوصول المالي من مكان واحد."
                : "Create your company account, invite authorized team members, and manage financial access from one place."}
            </p>

            <div className="mt-8 space-y-4">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-xl border border-blue-100 bg-surface/80 px-4 py-3"
                >
                  <CheckCircle2 size={18} className="shrink-0 text-success" />
                  <span className="text-sm font-medium text-text-primary">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-text-secondary">
            {isArabic
              ? "سيتم تطبيق ضوابط الأمان عند ربط الباك إند."
              : "Security controls will be enforced during backend integration."}
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-xl">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="inline-flex items-center gap-3 lg:hidden">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                  <Sparkles size={22} />
                </span>
                <span className="font-semibold text-text-primary">Zemam AI CFO</span>
              </Link>

              <button
                type="button"
                onClick={toggleLanguage}
                aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
                className="ms-auto rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary-soft"
              >
                {isArabic ? "English" : "العربية"}
              </button>
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium text-primary">
                {isArabic ? "إنشاء حساب شركة" : "Create company account"}
              </p>

              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
                {isArabic ? "ابدأ مساحة عملك الآمنة" : "Start your secure workspace"}
              </h1>

              <p className="mt-3 leading-7 text-text-secondary">
                {isArabic
                  ? "أدخل معلومات مدير الشركة. سيُطلب التحقق من البريد الإلكتروني وMFA بعد اكتمال الربط."
                  : "Enter the company administrator information. Email verification and MFA will be required after integration."}
              </p>
            </div>

            {submitted ? (
              <div
                role="status"
                className="mt-6 flex items-start gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-4"
              >
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" />

                <div>
                  <p className="font-medium text-text-primary">
                    {isArabic ? "تحقق من بريدك الإلكتروني" : "Check your email"}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    {isArabic
                      ? "تم إنشاء الحساب وإرسال رابط التأكيد. بعد تأكيد البريد يمكنك تسجيل الدخول إلى شركة معزولة البيانات."
                      : "The account was created and a confirmation link was sent. Confirm your email, then sign in to your isolated company workspace."}
                  </p>
                </div>
              </div>
            ) : null}

            {authError ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger"
              >
                {authError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-text-primary">
                    {isArabic ? "اسم الشركة" : "Company name"}
                  </span>

                  <span className="relative block">
                    <Building2
                      size={18}
                      className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                      type="text"
                      name="companyName"
                      required
                      placeholder={isArabic ? "اسم الشركة" : "Company name"}
                      className={inputClasses}
                    />
                  </span>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-text-primary">
                    {isArabic ? "اسم المدير" : "Administrator name"}
                  </span>

                  <span className="relative block">
                    <User
                      size={18}
                      className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
                    />
                    <input
                      type="text"
                      name="administratorName"
                      required
                      placeholder={isArabic ? "الاسم الكامل" : "Full name"}
                      className={inputClasses}
                    />
                  </span>
                </label>
              </div>

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
                    placeholder="admin@company.com"
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                </span>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  {isArabic ? "كلمة مرور قوية" : "Strong password"}
                </span>

                <span className="relative block" dir="ltr">
                  <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={isArabic ? "أنشئ كلمة مرور قوية" : "Create a strong password"}
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-12 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword
                        ? isArabic
                          ? "إخفاء كلمة المرور"
                          : "Hide password"
                        : isArabic
                          ? "إظهار كلمة المرور"
                          : "Show password"
                    }
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-soft"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                {passwordRequirements.map((requirement) => (
                  <div key={requirement.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={
                        requirement.valid
                          ? "flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success"
                          : "flex h-5 w-5 items-center justify-center rounded-full bg-surface-soft text-text-secondary"
                      }
                    >
                      <Check size={13} />
                    </span>

                    <span className={requirement.valid ? "text-success" : "text-text-secondary"}>
                      {requirement.label}
                    </span>
                  </div>
                ))}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-text-primary">
                  {isArabic ? "تأكيد كلمة المرور" : "Confirm password"}
                </span>

                <span className="relative block" dir="ltr">
                  <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
                  />
                  <input
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={isArabic ? "أدخل كلمة المرور مرة أخرى" : "Enter the password again"}
                    className="h-12 w-full rounded-xl border border-border bg-surface pl-11 pr-4 text-sm text-text-primary outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary-soft"
                  />
                </span>

                {confirmation.length > 0 ? (
                  <span className={passwordsMatch ? "text-xs text-success" : "text-xs text-danger"}>
                    {passwordsMatch
                      ? isArabic
                        ? "كلمتا المرور متطابقتان."
                        : "Passwords match."
                      : isArabic
                        ? "كلمتا المرور غير متطابقتين."
                        : "Passwords do not match."}
                  </span>
                ) : null}
              </label>

              <label className="flex items-start gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  name="agreement"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-border accent-blue-600"
                />

                <span>
                  {isArabic
                    ? "أوافق على الشروط وسياسة الخصوصية والاستخدام الآمن للبيانات المالية للشركة."
                    : "I agree to the terms, privacy policy, and secure use of company financial data."}
                </span>
              </label>

              <button
                type="submit"
                disabled={
                  submitting || !passwordIsStrong || !passwordsMatch
                }
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : null}
                {submitting
                  ? isArabic
                    ? "جارٍ إنشاء الحساب..."
                    : "Creating account..."
                  : isArabic
                    ? "إنشاء حساب الشركة"
                    : "Create company account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-text-secondary">
              {isArabic ? "لديك حساب بالفعل؟ " : "Already have an account? "}
              <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
                {isArabic ? "تسجيل الدخول" : "Sign in"}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
