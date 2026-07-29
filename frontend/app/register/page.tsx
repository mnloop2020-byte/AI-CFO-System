"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, LoaderCircle, LockKeyhole, Mail, ShieldCheck, User } from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { createClient } from "@/lib/supabase/client";

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function RegisterPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const isArabic = language === "ar";
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    setInvitationToken(token?.trim() || null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  const requirements = useMemo(
    () => [
      { label: isArabic ? "12 حرفًا على الأقل" : "At least 12 characters", valid: password.length >= 12 },
      { label: isArabic ? "حروف كبيرة وصغيرة" : "Uppercase and lowercase letters", valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
      { label: isArabic ? "رقم واحد على الأقل" : "At least one number", valid: /\d/.test(password) },
      { label: isArabic ? "رمز خاص واحد على الأقل" : "At least one special character", valid: /[^A-Za-z0-9]/.test(password) },
    ],
    [isArabic, password],
  );
  const passwordIsStrong = requirements.every((requirement) => requirement.valid);
  const passwordsMatch = confirmation.length > 0 && password === confirmation;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!invitationToken || !passwordIsStrong || !passwordsMatch) return;

    setSubmitting(true);
    setAuthError(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const fullName = String(formData.get("fullName") ?? "").trim();

    try {
      const invitationTokenHash = await sha256Hex(invitationToken);
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/dashboard");

      const { data, error } = await createClient().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          data: {
            full_name: fullName,
            invitation_token_hash: invitationTokenHash,
          },
        },
      });
      if (error) throw error;

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setSubmitted(true);
    } catch {
      setAuthError(
        isArabic
          ? "تعذر قبول الدعوة. تأكد من البريد وأن الرابط صالح وغير مستخدم."
          : "Unable to accept the invitation. Verify the email and that the link is valid and unused.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background p-4 sm:p-6">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-surface p-7 shadow-xl sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-text-primary">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ShieldCheck size={22} />
            </span>
            <span className="font-semibold">Zemam AI CFO</span>
          </div>
          <button type="button" onClick={toggleLanguage} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-primary">
            {isArabic ? "English" : "العربية"}
          </button>
        </div>

        <h1 className="mt-8 text-3xl font-semibold text-text-primary">
          {isArabic ? "قبول دعوة الشركة" : "Accept company invitation"}
        </h1>
        <p className="mt-3 leading-7 text-text-secondary">
          {isArabic
            ? "أنشئ حسابك بالبريد الذي أُرسلت إليه الدعوة. لا يمكن إنشاء شركة جديدة من هذه الصفحة."
            : "Create your account with the email that received the invitation. This page cannot create another company."}
        </p>

        {!invitationToken ? (
          <div role="alert" className="mt-6 rounded-xl border border-amber-100 bg-warning-soft px-4 py-4 text-sm leading-6 text-text-secondary">
            {isArabic
              ? "رابط الدعوة غير موجود أو غير صالح. اطلب رابطًا جديدًا من المالك أو المدير."
              : "The invitation link is missing or invalid. Ask an owner or admin for a new link."}
          </div>
        ) : null}

        {submitted ? (
          <div role="status" className="mt-6 flex gap-3 rounded-xl border border-green-100 bg-success-soft px-4 py-4">
            <CheckCircle2 size={20} className="shrink-0 text-success" />
            <p className="text-sm leading-6 text-text-secondary">
              {isArabic
                ? "تم إنشاء الحساب. افتح رسالة التحقق من البريد، ثم سجّل الدخول."
                : "Your account was created. Open the verification email, then sign in."}
            </p>
          </div>
        ) : null}

        {authError ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-100 bg-danger-soft px-4 py-3 text-sm text-danger">
            {authError}
          </div>
        ) : null}

        {!submitted ? (
          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">{isArabic ? "الاسم" : "Name"}</span>
              <span className="relative block">
                <User size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input name="fullName" required autoComplete="name" className="h-12 w-full rounded-xl border border-border ps-11 pe-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">{isArabic ? "بريد الدعوة" : "Invited email"}</span>
              <span className="relative block" dir="ltr">
                <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input type="email" name="email" required autoComplete="email" className="h-12 w-full rounded-xl border border-border pl-11 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">{isArabic ? "كلمة مرور قوية" : "Strong password"}</span>
              <span className="relative block" dir="ltr">
                <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" className="h-12 w-full rounded-xl border border-border pl-11 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
              </span>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {requirements.map((requirement) => (
                <div key={requirement.label} className={`flex items-center gap-2 text-xs ${requirement.valid ? "text-success" : "text-text-secondary"}`}>
                  <Check size={14} />
                  {requirement.label}
                </div>
              ))}
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-text-primary">{isArabic ? "تأكيد كلمة المرور" : "Confirm password"}</span>
              <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required autoComplete="new-password" className="h-12 w-full rounded-xl border border-border px-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
            </label>

            <button type="submit" disabled={submitting || !invitationToken || !passwordIsStrong || !passwordsMatch} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? <LoaderCircle size={18} className="animate-spin" /> : null}
              {isArabic ? "قبول الدعوة وإنشاء الحساب" : "Accept invitation and create account"}
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/login" className="font-semibold text-primary">
            {isArabic ? "العودة إلى تسجيل الدخول" : "Back to sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
